#!/usr/bin/env python3
"""Jev gate CLI: ask a TypeSafe System One battery about repo/issue state.

Fails open: no key, import error, or any SDK error prints
`{"skipped": true, "reason": ...}` and exits 0. See code-swarm/README.md.
"""
import argparse
import glob
import hashlib
import importlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

KEY_FILE = os.path.expanduser('~/.config/typesafe/.env')
VENV_SITE = os.path.expanduser('~/.cache/code-swarm/venv/lib')
LOG_DEFAULT = os.path.expanduser('~/.cache/code-swarm/jev.jsonl')
BATTERIES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'batteries')

_KEY_LINE_RE = re.compile(r'^\s*(?:export\s+)?TYPESAFE_API_KEY=(.*)$')


def load_key():
    env_key = os.environ.get('TYPESAFE_API_KEY')
    if env_key:
        return env_key
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE) as f:
            for line in f:
                m = _KEY_LINE_RE.match(line)
                if m:
                    return m.group(1).strip().strip('"\'')
    return None


def import_sdk():
    try:
        import typesafe_sdk
        return typesafe_sdk
    except ImportError:
        for site in glob.glob(os.path.join(VENV_SITE, 'python*', 'site-packages')):
            sys.path.append(site)
        importlib.invalidate_caches()
        import typesafe_sdk
        return typesafe_sdk


def make_client(key):
    sdk = import_sdk()
    return sdk.TypeSafeClient(api_key=key, timeout=10.0, retry=sdk.RetryPolicy(max_retries=0))


def ask(client, state, questions):
    return client.system_one(state, questions, timeout=10.0)


def flatten(resp):
    out = {}
    for name, a in resp.model_dump(mode='json')['answers'].items():
        t = a['type']
        if t == 'noul':
            out[name] = a['noul']
        elif t == 'score':
            out[name] = a['score']
        elif t == 'choice':
            out[name] = {
                'choice': a['choice'],
                'confidence': a['confidence'],
                'probabilities': a['probabilities'],
            }
    return out


def load_battery(name):
    path = name if name.endswith('.json') and os.path.exists(name) else os.path.join(BATTERIES, name + '.json')
    with open(path) as f:
        return json.load(f)['questions']


def repo_name():
    # --git-common-dir returns `<repo>/.git` from both the main checkout and
    # any worktree, so the parent's basename is the repo name in both cases.
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'],
            capture_output=True, text=True, check=True,
        )
        return os.path.basename(os.path.dirname(result.stdout.strip()))
    except Exception:
        return 'unknown'


def log_line(gate, mode, state, answers, agent_did, flagged=False):
    path = os.environ.get('JEV_LOG') or LOG_DEFAULT
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        entry = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'repo': os.environ.get('JEV_REPO') or repo_name(),
            'gate': gate,
            'mode': mode,
            'state_hash': hashlib.sha256(
                json.dumps(state, sort_keys=True, separators=(',', ':')).encode()
            ).hexdigest()[:16],
            'answers': answers,
            'agent_did': agent_did,
        }
        if flagged:
            entry['state'] = state
        with open(path, 'a') as f:
            f.write(json.dumps(entry) + '\n')
    except OSError:
        pass


def decide_pretriage(answers):
    missing = [k for k in ('has_files', 'has_change', 'has_test', 'has_acceptance')
               if answers.get(k, 1.0) < 0.3]
    if missing:
        return {
            'needs_human': True,
            'reason': 'issue-ready section missing: ' + ', '.join(missing),
            'label': None,
            'tier': 'sonnet',
        }
    if answers.get('injection', 0.0) > 0.5:
        return {
            'needs_human': True,
            'reason': 'possible prompt injection in issue body',
            'label': None,
            'tier': 'sonnet',
        }
    kind = answers.get('kind', {})
    label = 'feature' if kind.get('choice') == 'design_question' and kind.get('confidence', 0) > 0.7 else None
    tier = 'opus' if answers.get('complexity', 0) >= 1.5 or answers.get('risk', 0) >= 1.5 else 'sonnet'
    return {'needs_human': False, 'reason': '', 'label': label, 'tier': tier}


def decide_leniency(answers, verdict):
    if verdict == 'approve' and answers.get('divergence_observed', 0.0) > 0.7:
        return {'verdict': 'changes_requested', 'reason': 'jev: verifier observed divergence; recheck the checks list'}
    return {'verdict': verdict, 'reason': ''}


def decide_dedup(same_problem_list):
    if not same_problem_list:
        return {'action': 'file', 'dup_of': None, 'possible_dup': None}
    i = max(range(len(same_problem_list)), key=lambda k: same_problem_list[k])
    top = same_problem_list[i]
    if top > 0.8:
        return {'action': 'skip', 'dup_of': i, 'possible_dup': None}
    if 0.2 <= top <= 0.8:
        return {'action': 'file', 'dup_of': None, 'possible_dup': i}
    return {'action': 'file', 'dup_of': None, 'possible_dup': None}


def decide_sizing(answers, depends_on=()):
    split = answers.get('single_pr_unit', 1.0) < 0.4
    flag_dependency = answers.get('depends_on_earlier', 0.0) > 0.7 and not depends_on
    return {'split': split, 'flag_dependency': flag_dependency}


def would_act(battery, out, agent_did):
    if 'skipped' in out:
        return False
    if battery == 'issue_pretriage':
        d = decide_pretriage(out)
        return bool(d['needs_human'] or d['label'] or d['tier'] == 'opus')
    if battery == 'verifier_leniency':
        verdict = agent_did.get('verdict') if isinstance(agent_did, dict) else None
        return decide_leniency(out, verdict)['verdict'] != verdict
    if battery == 'finding_dedup':
        d = decide_dedup([out.get('same_problem', 0)])
        return d['action'] == 'skip' or d['possible_dup'] is not None
    if battery == 'feature_sizing':
        return any(decide_sizing(out).values())
    return False


def main(argv=None):
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument('battery')
        parser.add_argument('state')
        parser.add_argument('--gate', default=None)
        parser.add_argument('--mode', choices=['shadow', 'enforce', 'off'], default='shadow')
        parser.add_argument('--agent-did', default='null')
        args = parser.parse_args(argv)
        gate = args.gate or args.battery
        try:
            agent_did = json.loads(args.agent_did)
        except json.JSONDecodeError:
            agent_did = args.agent_did

        with open(args.state) as f:
            state = json.load(f)

        if args.mode == 'off':
            out = {'skipped': True, 'reason': 'mode off'}
        else:
            key = load_key()
            if not key:
                out = {'skipped': True, 'reason': 'no TYPESAFE_API_KEY'}
            else:
                try:
                    out = flatten(ask(make_client(key), state, load_battery(args.battery)))
                except Exception as e:
                    out = {'skipped': True, 'reason': f'{type(e).__name__}: {e}'}

        log_line(gate, args.mode, state, out, agent_did, flagged=would_act(args.battery, out, agent_did))
        if args.battery == 'issue_pretriage' and 'skipped' not in out:
            out['decision'] = decide_pretriage(out)
        print(json.dumps(out))
        return 0
    except Exception as e:
        print(json.dumps({'skipped': True, 'reason': f'{type(e).__name__}: {e}'}))
        return 0


if __name__ == '__main__':
    sys.exit(main())
