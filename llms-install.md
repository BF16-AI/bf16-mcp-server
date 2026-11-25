# Installing bf16-mcp-server (Autonomous Agent Guide)

This document lets Cline and other MCP-capable coding agents install and verify `bf16-mcp-server` autonomously in one step.

## Overview

`bf16-mcp-server` is the official MCP server for **[bf16.ai](https://bf16.ai)** (uncensored 1M-context LLM API, Zero Data Retention).

- **No API key required** for `bf16_list_models`, `bf16_estimate_cost`, and `bf16_get_client_setup`.
- **Optional `BF16_API_KEY`** enables `bf16_chat` (direct uncensored ZDR completion sidecar).

## Installation Steps

1. Add the following entry to your Cline MCP settings JSON file (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "bf16": {
      "command": "npx",
      "args": ["-y", "bf16-mcp-server"],
      "env": {
        "BF16_API_KEY": ""
      },
      "disabled": false,
      "autoApprove": [
        "bf16_list_models",
        "bf16_estimate_cost",
        "bf16_get_client_setup"
      ]
    }
  }
}
```

2. Ask the user if they want to add their optional `BF16_API_KEY` (they can get `$0.20` free starter credit at https://bf16.ai/dashboard/keys or run `npx bf16ai login`). Leave `BF16_API_KEY` empty if they only need live model pricing, cost estimation, and client setup configs.

3. Verify the installation by calling the `bf16_list_models` tool — it should return active 1M-context models from `https://api.bf16.ai/v1/models` with zero errors.
