#!/bin/bash

# Remove existing servers
servers=(
    "desktop-commander"
    "server-sequential-thinking"
    "weather"
    "memory-bank-mcp"
    "toolbox"
    "terminal-controller-mcp"
    "code-mcp"
    "notion-api-mcp"
    "context7-mcp"
    "brave-search"
    "servers"
    "desktop-commander_1"
    "weather_1"
    "server-sequential-thinking_1"
    "memory-bank-mcp_1"
    "toolbox_1"
)

echo "Removing existing MCP servers..."
for server in "${servers[@]}"; do
    echo "Removing $server..."
    claude mcp remove "$server" 2>/dev/null || true
done

echo "Adding MCP servers with Linux-compatible commands..."

# Add servers with proper Linux commands
claude mcp add weather npx -- -y @smithery/cli@latest run @turkyden/weather --key 4b1bbfbd-c112-406b-9539-165c29be8813

claude mcp add desktop-commander npx -- -y @smithery/cli@latest run @wonderwhy-er/desktop-commander --key 4b1bbfbd-c112-406b-9539-165c29be8813

claude mcp add server-sequential-thinking npx -- -y @smithery/cli@latest run @smithery-ai/server-sequential-thinking --key 4b1bbfbd-c112-406b-9539-165c29be8813

claude mcp add memory-bank-mcp npx -- -y @smithery/cli@latest run @aakarsh-sasi/memory-bank-mcp --key 4b1bbfbd-c112-406b-9539-165c29be8813

claude mcp add toolbox npx -- -y @smithery/cli@latest run @smithery/toolbox --key 4b1bbfbd-c112-406b-9539-165c29be8813 --profile chilly-tarsier-IbPhaP

claude mcp add terminal-controller-mcp npx -- -y @smithery/cli@latest run @GongRzhe/terminal-controller-mcp --key 4b1bbfbd-c112-406b-9539-165c29be8813

claude mcp add code-mcp npx -- -y @smithery/cli@latest run @block/code-mcp --key 4b1bbfbd-c112-406b-9539-165c29be8813

claude mcp add notion-api-mcp npx -- -y @smithery/cli@latest run notion-api-mcp --key 4b1bbfbd-c112-406b-9539-165c29be8813 --profile chilly-tarsier-IbPhaP

claude mcp add context7-mcp npx -- -y @smithery/cli@latest run @upstash/context7-mcp --key 4b1bbfbd-c112-406b-9539-165c29be8813

claude mcp add brave-search npx -- -y @smithery/cli@latest run @smithery-ai/brave-search --key 4b1bbfbd-c112-406b-9539-165c29be8813 --profile chilly-tarsier-IbPhaP

claude mcp add servers npx -- -y @smithery/cli@latest run @jlia0/servers --key 6c92fd44-4df4-44d8-9145-962db2dce7cf

echo "MCP servers reconfigured successfully!"
echo "Listing new configuration:"
claude mcp list