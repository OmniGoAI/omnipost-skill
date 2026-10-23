#!/usr/bin/env node
// omnipost-mcp: stdio MCP server that forwards to the OmniPost desktop app on this machine.
//   Claude Code:   claude mcp add omnipost -- npx -y omnipost-mcp
//   Other clients: { "command": "npx", "args": ["-y", "omnipost-mcp"] }
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBridgeServer, resolveEndpoint, shutdown, inFlight } from './bridge.js';

let exiting = false;
async function exit(code = 0, { immediate = false } = {}) {
  if (exiting) return;
  exiting = true;
  // Let calls that are already running finish and send their answers first. The short pause lets a
  // request that arrived just before stdin closed get registered as in flight.
  if (!immediate) await new Promise((r) => setTimeout(r, 300));
  while (!immediate && inFlight() > 0) await new Promise((r) => setTimeout(r, 200));
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
  process.on('SIGINT', () => exit(0, { immediate: true }));
  process.on('SIGTERM', () => exit(0, { immediate: true }));
  process.stderr.write(`[omnipost-mcp] ready, forwarding to ${resolveEndpoint()}\n`);
}

main().catch((err) => {
  process.stderr.write(`[omnipost-mcp] failed to start: ${err?.stack || err}\n`);
  exit(1, { immediate: true });
});
