#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.BF16_BASE_URL || 'https://api.bf16.ai/v1').replace(/\/$/, '');

interface RawModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  max_output_tokens?: number;
  supports_vision?: boolean;
  supports_tools?: boolean;
  supports_reasoning?: boolean;
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
  };
}

export async function fetchLiveModels(): Promise<RawModel[]> {
  const res = await fetch(`${BASE_URL}/models`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET ${BASE_URL}/models failed with HTTP ${res.status}`);
  }
  const body = (await res.json()) as { data?: RawModel[] };
  return body.data ?? [];
}

export function formatPerMillion(perToken?: string): number | null {
  if (!perToken) return null;
  const n = Number(perToken);
  return Number.isFinite(n) ? Number((n * 1_000_000).toFixed(4)) : null;
}

export function getClientSetupSnippet(client: string): string {
  switch (client) {
    case 'claude-code':
      return [
        '# Claude Code (native Anthropic Messages API)',
        'export ANTHROPIC_BASE_URL="https://api.bf16.ai"',
        'export ANTHROPIC_AUTH_TOKEN="$BF16_API_KEY"',
        'export ANTHROPIC_MODEL="zai-org/glm-5.3-uncensored"',
        'export ANTHROPIC_SMALL_FAST_MODEL="deepseek/deepseek-v4.1-flash-uncensored-fast"',
        'claude',
      ].join('\n');
    case 'codex-cli':
      return [
        '# Codex CLI (~/.codex/config.toml)',
        'model_provider = "bf16"',
        'model = "deepseek/deepseek-v4.1-flash-uncensored-fast"',
        '',
        '[model_providers.bf16]',
        'name = "bf16.ai"',
        'base_url = "https://api.bf16.ai/v1"',
        'env_key = "BF16_API_KEY"',
        'wire_api = "responses"',
      ].join('\n');
    case 'opencode':
      return JSON.stringify(
        {
          provider: {
            bf16: {
              npm: '@ai-sdk/openai-compatible',
              options: {
                baseURL: 'https://api.bf16.ai/v1',
                apiKey: '{env:BF16_API_KEY}',
              },
              models: {
                'deepseek/deepseek-v4.1-flash-uncensored-fast': {
                  name: 'DeepSeek V4.1 Flash Fast (1M)',
                },
                'moonshotai/kimi-k3.1-pro-uncensored': {
                  name: 'Kimi K3.1 Pro (1M)',
                },
              },
            },
          },
        },
        null,
        2
      );
    case 'cursor':
    case 'cline':
    case 'roo-code':
    default:
      return [
        `# ${client} (OpenAI-compatible settings)`,
        'Base URL: https://api.bf16.ai/v1',
        'API Key:  $BF16_API_KEY (get $0.20 free starter credit at https://bf16.ai/dashboard/keys)',
        'Fast 1M Model: deepseek/deepseek-v4.1-flash-uncensored-fast',
        'Pro 1M Model:  moonshotai/kimi-k3.1-pro-uncensored',
        'Quick CLI:     npx github:BF16-AI/bf16-setup --client claude-code',
      ].join('\n');
  }
}

const server = new McpServer({
  name: 'bf16-mcp-server',
  version: '0.1.0',
});

server.tool(
  'bf16_list_models',
  'List live 1M-context uncensored open-weight models on bf16.ai with real-time per-1M USD pricing and capabilities (no API key required).',
  {
    includeRouters: z.boolean().optional().default(false),
  },
  async ({ includeRouters }) => {
    const models = await fetchLiveModels();
    const filtered = includeRouters
      ? models
      : models.filter((m) => !m.id.startsWith('bf16/auto'));
    const summary = filtered.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      context_length: m.context_length ?? null,
      max_output_tokens: m.max_output_tokens ?? null,
      vision: Boolean(m.supports_vision),
      tools: Boolean(m.supports_tools),
      reasoning: Boolean(m.supports_reasoning),
      usd_per_1m_tokens: m.pricing
        ? {
            input: formatPerMillion(m.pricing.prompt),
            cached_input: formatPerMillion(m.pricing.input_cache_read),
            output: formatPerMillion(m.pricing.completion),
          }
        : null,
    }));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              source: `${BASE_URL}/models`,
              docs: 'https://bf16.ai/docs',
              pricing_page: 'https://bf16.ai/pricing',
              models: summary,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  'bf16_estimate_cost',
  'Estimate exact USD cost for running a workload on a bf16.ai model using live /v1/models rates and optional prompt-cache hit ratio (no API key required).',
  {
    model: z.string().min(1).describe('Model ID from bf16_list_models'),
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
    cached_input_tokens: z.number().int().min(0).optional().default(0),
  },
  async ({ model, input_tokens, output_tokens, cached_input_tokens }) => {
    const models = await fetchLiveModels();
    const match = models.find((m) => m.id === model);
    if (!match || !match.pricing) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Model "${model}" not found with live pricing. Run bf16_list_models first.`,
          },
        ],
      };
    }
    const uncached = Math.max(0, input_tokens - cached_input_tokens);
    const inRate = Number(match.pricing.prompt ?? 0);
    const cacheRate = Number(match.pricing.input_cache_read ?? inRate);
    const outRate = Number(match.pricing.completion ?? 0);
    const totalUsd =
      uncached * inRate + cached_input_tokens * cacheRate + output_tokens * outRate;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              model: match.id,
              input_tokens,
              cached_input_tokens,
              uncached_input_tokens: uncached,
              output_tokens,
              estimated_usd: Number(totalUsd.toFixed(6)),
              calculator: 'https://bf16.ai/tools/cost-calculator',
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  'bf16_get_client_setup',
  'Return copy-paste configuration for connecting Claude Code, Codex CLI, OpenCode, Cursor, Cline, or Roo Code to bf16.ai (no API key required).',
  {
    client: z
      .enum(['claude-code', 'codex-cli', 'opencode', 'cursor', 'cline', 'roo-code'])
      .default('claude-code'),
  },
  async ({ client }) => ({
    content: [{ type: 'text', text: getClientSetupSnippet(client) }],
  })
);

server.tool(
  'bf16_complete',
  'Run a zero-data-retention chat completion on bf16.ai (requires BF16_API_KEY env var).',
  {
    prompt: z.string().min(1),
    model: z.string().optional().default('deepseek/deepseek-v4.1-flash-uncensored-fast'),
    system: z.string().optional(),
    max_tokens: z.number().int().min(1).max(16384).optional().default(2048),
  },
  async ({ prompt, model, system, max_tokens }) => {
    const apiKey = process.env.BF16_API_KEY;
    if (!apiKey) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Set BF16_API_KEY (create a key with $0.20 free credit at https://bf16.ai/dashboard/keys) to run bf16_complete.',
          },
        ],
      };
    }
    const messages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ];
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens }),
    });
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `bf16.ai API error (${res.status}): ${data.error?.message ?? JSON.stringify(data)}`,
          },
        ],
      };
    }
    return {
      content: [
        { type: 'text', text: data.choices?.[0]?.message?.content ?? '' },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
