#!/usr/bin/env node
// omnipost-mcp: stdio MCP server that forwards to the OmniPost desktop app on this machine.
//   Claude Code:   claude mcp add omnipost -- npx -y omnipost-mcp
//   Other clients: { "command": "npx", "args": ["-y", "omnipost-mcp"] }
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBridgeServer, resolveEndpoint, shutdown } from './bridge.js';

let exiting = false;
async function exit(code = 0) {
  if (exiting) return;
  exiting = true;
  await shutdown();
  process.exit(code);
}

async function main() {
  const server = createBridgeServer();
  const transport = new StdioServerTransport();
  const prev = server.onclose;
  server.onclose = () => { prev?.(); exit(0); };
  await server.connect(transport);
  // The client closing our stdin means it is done with us.
  process.stdin.on('end', () => exit(0));
  process.stdin.on('close', () => exit(0));
  process.on('SIGINT', () => exit(0));
  process.on('SIGTERM', () => exit(0));
  process.stderr.write(`[omnipost-mcp] ready, forwarding to ${resolveEndpoint()}\n`);
}

main().catch((err) => {
  process.stderr.write(`[omnipost-mcp] failed to start: ${err?.stack || err}\n`);
  exit(1);
});
