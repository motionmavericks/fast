# Claude Configuration

This file contains configuration for MCP servers available in this project.

## MCP Servers

```json
{
  "mcpServers": {
    "desktop-commander": {
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@latest",
        "run",
        "@wonderwhy-er/desktop-commander",
        "--key",
        "4b1bbfbd-c112-406b-9539-165c29be8813"
      ]
    },
    "server-sequential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@latest",
        "run",
        "@smithery-ai/server-sequential-thinking",
        "--key",
        "6c92fd44-4df4-44d8-9145-962db2dce7cf"
      ]
    }
  }
}
```