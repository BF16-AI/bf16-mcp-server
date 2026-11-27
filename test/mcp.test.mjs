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

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('starts stdio MCP server when invoked through a symlink (npx behavior)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bf16-mcp-symlink-'));
  const binLink = join(dir, 'bf16-mcp-server');
  symlinkSync(resolve('dist/index.js'), binLink);
  try {
    const response = await new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, [binLink], { stdio: ['pipe', 'pipe', 'pipe'] });
      let buf = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Timed out waiting for MCP initialize/tools response'));
      }, 10000);
      child.stdout.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n').filter(Boolean);
        if (lines.length >= 2) {
          clearTimeout(timer);
          child.kill();
          resolvePromise(lines.map((l) => JSON.parse(l)));
        }
      });
      child.on('exit', (code) => {
        if (buf.split('\n').filter(Boolean).length < 2) {
          clearTimeout(timer);
          reject(new Error(`Exited prematurely with code ${code}`));
        }
      });
      child.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
      }) + '\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
    });
    assert.equal(response[0].id, 1);
    assert.ok(response[0].result?.serverInfo?.name);
    assert.equal(response[1].id, 2);
    assert.ok(Array.isArray(response[1].result?.tools) && response[1].result.tools.length >= 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
