#!/usr/bin/env python3
"""Offline tests for jev.py. No network, no TYPESAFE_API_KEY needed."""
import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jev


def run(argv, key=None, repo=None):
    with tempfile.TemporaryDirectory() as tmpdir:
        state_path = os.path.join(tmpdir, 'state.json')
        with open(state_path, 'w') as f:
            json.dump({'title': 'x'}, f)
        log_path = os.path.join(tmpdir, 'jev.jsonl')
        missing_key_file = os.path.join(tmpdir, 'no_such_.env')

        env = dict(os.environ)
        env.pop('TYPESAFE_API_KEY', None)
        env.pop('JEV_REPO', None)
        if key is not None:
            env['TYPESAFE_API_KEY'] = key
        if repo is not None:
            env['JEV_REPO'] = repo
        env['JEV_LOG'] = log_path

        full_argv = [argv[0], state_path] + argv[1:]

        with patch.dict(os.environ, env, clear=True), \
             patch.object(jev, 'KEY_FILE', missing_key_file):
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                code = jev.main(full_argv)

        out = json.loads(buf.getvalue())
        log_lines = []
        if os.path.exists(log_path):
            with open(log_path) as f:
                log_lines = [json.loads(line) for line in f if line.strip()]
    return code, out, log_lines


class TestJev(unittest.TestCase):
    def test_client_raising_is_skipped(self):
        with patch.object(jev, 'make_client', side_effect=RuntimeError('boom')):
            code, out, _ = run(['issue_pretriage'], key='x')
        self.assertEqual(code, 0)
        self.assertEqual(out, {'skipped': True, 'reason': 'RuntimeError: boom'})

    def test_pretriage_output_carries_decision(self):
        answers = {'has_test': 0.2, 'complexity': 0.4, 'risk': 0.2}
        with patch.object(jev, 'make_client', return_value=object()), \
             patch.object(jev, 'ask', return_value=None), \
             patch.object(jev, 'flatten', return_value=answers):
            code, out, log_lines = run(['issue_pretriage'], key='x')
        self.assertEqual(code, 0)
        self.assertEqual(out['decision'], jev.decide_pretriage(answers))
        self.assertIs(out['decision']['needs_human'], True)
        self.assertNotIn('decision', log_lines[0]['answers'])

    def test_other_battery_has_no_decision(self):
        with patch.object(jev, 'make_client', return_value=object()), \
             patch.object(jev, 'ask', return_value=None), \
             patch.object(jev, 'flatten', return_value={'same_problem': 0.1}):
            code, out, _ = run(['finding_dedup'], key='x')
        self.assertEqual(code, 0)
        self.assertNotIn('decision', out)

    def test_no_key_is_skipped(self):
        code, out, _ = run(['issue_pretriage'])
        self.assertEqual(code, 0)
        self.assertTrue(out['skipped'])
        self.assertEqual(out['reason'], 'no TYPESAFE_API_KEY')

    def test_key_file_parsed(self):
        with tempfile.NamedTemporaryFile('w', suffix='.env', delete=False) as f:
            f.write('export TYPESAFE_API_KEY=abc\n')
            path = f.name
        try:
            with patch.dict(os.environ, {}, clear=False), patch.object(jev, 'KEY_FILE', path):
                os.environ.pop('TYPESAFE_API_KEY', None)
                self.assertEqual(jev.load_key(), 'abc')
        finally:
            os.unlink(path)

    def test_mode_off_no_client(self):
        with patch.object(jev, 'make_client', side_effect=AssertionError('must not construct')):
            code, out, _ = run(['issue_pretriage', '--mode', 'off'], key='x')
        self.assertEqual(code, 0)
        self.assertEqual(out, {'skipped': True, 'reason': 'mode off'})

    def test_decide_pretriage(self):
        r = jev.decide_pretriage({'has_test': 0.2})
        self.assertTrue(r['needs_human'])
        self.assertIn('has_test', r['reason'])

        r = jev.decide_pretriage({'injection': 0.6})
        self.assertTrue(r['needs_human'])

        r = jev.decide_pretriage({'complexity': 1.6})
        self.assertEqual(r['tier'], 'opus')

        r = jev.decide_pretriage({'complexity': 0.4, 'risk': 0.2})
        self.assertEqual(r['tier'], 'sonnet')
        self.assertFalse(r['needs_human'])

        r = jev.decide_pretriage({'kind': {'choice': 'design_question', 'confidence': 0.9}})
        self.assertEqual(r['label'], 'feature')

    def test_decide_leniency(self):
        r = jev.decide_leniency({'divergence_observed': 0.8}, 'approve')
        self.assertEqual(r['verdict'], 'changes_requested')
        self.assertEqual(r['reason'], 'jev: verifier observed divergence; recheck the checks list')

        r = jev.decide_leniency({'divergence_observed': 0.8}, 'changes_requested')
        self.assertEqual(r['verdict'], 'changes_requested')

        r = jev.decide_leniency({'divergence_observed': 0.5}, 'approve')
        self.assertEqual(r['verdict'], 'approve')

    def test_decide_dedup(self):
        r = jev.decide_dedup([0.1, 0.9])
        self.assertEqual(r['action'], 'skip')
        self.assertEqual(r['dup_of'], 1)

        r = jev.decide_dedup([0.5])
        self.assertEqual(r['action'], 'file')
        self.assertEqual(r['possible_dup'], 0)

        r = jev.decide_dedup([0.1])
        self.assertEqual(r['action'], 'file')
        self.assertIsNone(r['dup_of'])
        self.assertIsNone(r['possible_dup'])

        r = jev.decide_dedup([])
        self.assertEqual(r['action'], 'file')

    def test_decide_sizing(self):
        r = jev.decide_sizing({'single_pr_unit': 0.3})
        self.assertTrue(r['split'])

        r = jev.decide_sizing({'single_pr_unit': 0.9, 'depends_on_earlier': 0.8})
        self.assertFalse(r['split'])
        self.assertTrue(r['flag_dependency'])

        r = jev.decide_sizing({'single_pr_unit': 0.9, 'depends_on_earlier': 0.8}, depends_on=('#3',))
        self.assertFalse(r['flag_dependency'])

    def test_log_line_written(self):
        code, out, log_lines = run(['issue_pretriage'])
        self.assertEqual(len(log_lines), 1)
        entry = log_lines[0]
        self.assertEqual(set(entry.keys()), {'ts', 'repo', 'gate', 'mode', 'state_hash', 'answers', 'agent_did'})
        self.assertEqual(entry['gate'], 'issue_pretriage')
        self.assertEqual(entry['mode'], 'shadow')
        self.assertTrue(entry['answers']['skipped'])

    def test_run_leaves_no_temp_dir(self):
        private = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, private, ignore_errors=True)
        old = tempfile.tempdir
        self.addCleanup(setattr, tempfile, 'tempdir', old)
        tempfile.tempdir = private
        run(['issue_pretriage'])
        self.assertEqual(os.listdir(private), [])

    def test_log_repo_is_repo_not_worktree(self):
        base = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, base, ignore_errors=True)
        repo = os.path.join(base, 'myrepo')
        os.makedirs(repo)
        subprocess.run(['git', 'init', '-q'], cwd=repo, check=True, capture_output=True)
        subprocess.run(
            ['git', '-c', 'user.name=t', '-c', 'user.email=t@t',
             'commit', '-q', '--allow-empty', '-m', 'init'],
            cwd=repo, check=True, capture_output=True,
        )
        wt = os.path.join(base, 'wt_other')
        subprocess.run(['git', 'worktree', 'add', '-q', wt, 'HEAD'], cwd=repo, check=True, capture_output=True)

        cwd = os.getcwd()
        try:
            os.chdir(wt)
            _, _, log_lines = run(['issue_pretriage'])
            self.assertEqual(log_lines[0]['repo'], 'myrepo')
        finally:
            os.chdir(cwd)

        plain = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, plain, ignore_errors=True)
        try:
            os.chdir(plain)
            _, _, log_lines = run(['issue_pretriage'])
            self.assertEqual(log_lines[0]['repo'], 'unknown')
        finally:
            os.chdir(cwd)

    def test_log_repo_from_env_in_non_git_cwd(self):
        plain = tempfile.mkdtemp()
        cwd = os.getcwd()
        try:
            os.chdir(plain)
            _, _, log_lines = run(['issue_pretriage'], repo='myrepo')
            self.assertEqual(log_lines[0]['repo'], 'myrepo')
        finally:
            os.chdir(cwd)
            shutil.rmtree(plain, ignore_errors=True)


if __name__ == '__main__':
    unittest.main()
