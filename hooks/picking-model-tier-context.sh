#!/usr/bin/env bash
# SessionStart hook: force picking-model-tier skill to fire as the very first
# action of every session, ahead of brainstorming / debugging / any other skill.
#
# Why a hook: skill discovery is description-based and probabilistic. Other
# "MUST use" skills (brainstorming, debugging) outrank picking-model-tier on
# strong-prompt matches and skip the tier check entirely. This hook injects
# a system-reminder that overrides discovery and pins picking-model-tier as
# the first skill of the session.

set -euo pipefail

context=$(cat <<'CTX'
SESSION START - picking-model-tier pre-flight check required.

After receiving the user's first substantive prompt, BEFORE any other action
(including invoking other skills like brainstorming, systematic-debugging,
writing-plans, etc., and including ALL tool calls except this one), invoke
the picking-model-tier skill via the Skill tool (namespaced as
cc-config:picking-model-tier when installed as a plugin):

  Skill({ skill: "picking-model-tier" })

This is the FIRST thing you do every session. Non-negotiable. The skill
will read intent sources (handoff doc / memory / first prompt), pick a tier,
and either proceed silently (if current model matches) or tell the user to
/model switch before substantive work.

If picking-model-tier has already fired in this session (after a /clear or
on a resumed session that already passed the pre-flight), skip.
CTX
)

jq -n --arg ctx "$context" \
  '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx}}'
