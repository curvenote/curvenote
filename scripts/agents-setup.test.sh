#!/usr/bin/env bash
# Runs agents-setup.sh against a temp tree. Does not touch the real repo.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_SRC="$HERE/agents-setup.sh"
FAILED=0

fail() {
  echo "FAIL: $*" >&2
  FAILED=1
}

pass() {
  echo "PASS: $*"
}

assert_exit() {
  local expected="$1"
  local label="$2"
  shift 2
  local actual=0
  "$@" >/tmp/agents-setup-test-out.txt 2>/tmp/agents-setup-test-err.txt || actual=$?
  if [[ "$actual" -eq "$expected" ]]; then
    pass "$label (exit $expected)"
  else
    fail "$label: expected exit $expected, got $actual"
    cat /tmp/agents-setup-test-err.txt >&2 || true
  fi
}

assert_symlink() {
  local path="$1"
  local expected_rel="$2"
  local label="$3"
  if [[ ! -L "$path" ]]; then
    fail "$label: $path is not a symlink"
    return
  fi
  local actual
  actual="$(readlink "$path")"
  if [[ "$actual" == "$expected_rel" ]]; then
    pass "$label"
  else
    fail "$label: $path -> $actual (expected $expected_rel)"
  fi
}

if [[ ! -f "$SETUP_SRC" ]]; then
  echo "FAIL: missing $SETUP_SRC" >&2
  exit 1
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/agents-setup-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/scripts" "$TMP/.agents/skills/foo"
cp "$SETUP_SRC" "$TMP/scripts/agents-setup.sh"
printf 'dummy\n' >"$TMP/AGENTS.md"
SETUP="$TMP/scripts/agents-setup.sh"

assert_exit 1 "no argument" bash "$SETUP"
assert_exit 1 "unknown argument" bash "$SETUP" nope

mv "$TMP/AGENTS.md" "$TMP/AGENTS.md.bak"
assert_exit 1 "missing AGENTS.md" bash "$SETUP" claude
mv "$TMP/AGENTS.md.bak" "$TMP/AGENTS.md"

mv "$TMP/.agents/skills" "$TMP/.agents/skills.bak"
assert_exit 1 "missing .agents/skills" bash "$SETUP" claude
mv "$TMP/.agents/skills.bak" "$TMP/.agents/skills"

assert_exit 0 "claude first run" bash "$SETUP" claude
assert_symlink "$TMP/.claude/skills" "../.agents/skills" "claude skills symlink"
assert_symlink "$TMP/CLAUDE.md" "AGENTS.md" "CLAUDE.md symlink"
assert_exit 0 "claude second run (idempotent)" bash "$SETUP" claude

rm -f "$TMP/CLAUDE.md"
rm -rf "$TMP/.claude"
assert_exit 0 "cursor first run" bash "$SETUP" cursor
assert_symlink "$TMP/.cursor/skills" "../.agents/skills" "cursor skills symlink"
if [[ -e "$TMP/CLAUDE.md" || -L "$TMP/CLAUDE.md" ]]; then
  fail "cursor must not create CLAUDE.md"
else
  pass "cursor does not create CLAUDE.md"
fi

mkdir -p "$TMP/.cursor-conflict/skills"
rm -rf "$TMP/.cursor"
mkdir -p "$TMP/.cursor/skills"
echo 'real-dir' >"$TMP/.cursor/skills/keep-me"
assert_exit 1 "cursor when destination is a real directory" bash "$SETUP" cursor
if [[ -L "$TMP/.cursor/skills" ]]; then
  fail "conflict must not replace a real directory with a symlink"
elif [[ -f "$TMP/.cursor/skills/keep-me" ]]; then
  pass "conflict left the real directory in place"
else
  fail "conflict deleted the real directory"
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "agents-setup tests failed" >&2
  exit 1
fi
echo "agents-setup tests passed"
