# @bf16/mcp-server

Official Model Context Protocol (MCP) server for [bf16.ai](https://bf16.ai).

## Tools

| Tool | Auth Required? | Description |
| :--- | :---: | :--- |
| `bf16_list_models` | No (free) | Fetches live 1M-context models, capabilities, and per-1M USD pricing from `https://api.bf16.ai/v1/models` |
| `bf16_estimate_cost` | No (free) | Calculates exact USD cost including prompt-cache hit rates using live pricing |
| `bf16_get_client_setup` | No (free) | Outputs copy-paste configs for Claude Code, Codex CLI, OpenCode, Cursor, Cline, and Roo Code |
| `bf16_complete` | `BF16_API_KEY` | Runs a strict Zero Data Retention (ZDR) completion on bf16.ai |

## Quick Start

```json
{
  "mcpServers": {
    "bf16": {
      "command": "npx",
      "args": ["-y", "@bf16/mcp-server"],
      "env": {
        "BF16_API_KEY": "sk-bf16-..."
      }
    }
  }
}
```

## Links

- Website: https://bf16.ai
- API Docs: https://bf16.ai/docs
- Pricing & Cost Calculator: https://bf16.ai/tools/cost-calculator
- OpenAPI Spec: https://github.com/BF16-AI/bf16-openapi
