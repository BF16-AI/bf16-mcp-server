import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPerMillion, getClientSetupSnippet } from '../dist/index.js';

test('formats per-token USD string to per-1M USD cleanly', () => {
  assert.equal(formatPerMillion('0.00000028'), 0.28);
  assert.equal(formatPerMillion('0.000000055'), 0.055);
  assert.equal(formatPerMillion(undefined), null);
});

test('generates Claude Code and Codex CLI setup snippets', () => {
  assert.match(getClientSetupSnippet('claude-code'), /ANTHROPIC_BASE_URL="https:\/\/api\.bf16\.ai"/);
  assert.match(getClientSetupSnippet('codex-cli'), /wire_api = "responses"/);
});
