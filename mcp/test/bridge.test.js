import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  AppConnection, createBridgeServer, resolveEndpoint, loadSnapshot, shutdown, DEFAULT_PORT, DOWNLOAD_URL,
} from '../src/bridge.js';

const APP_TOOLS = [
  { name: 'list_accounts', description: 'fake', inputSchema: { type: 'object', properties: {} } },
  { name: 'publish_post', description: 'fake', inputSchema: { type: 'object', properties: { title: { type: 'string' } } } },
];

/** A fake OmniPost app: real MCP over SSE on a random local port. */
async function startFakeApp(port = 0) {
  const calls = [];
  const sessions = {};
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new SSEServerTransport('/mcp/messages', res);
      sessions[transport.sessionId] = transport;
      res.on('close', () => { delete sessions[transport.sessionId]; });
      const mcp = new Server({ name: 'fake-omnipost', version: '0' }, { capabilities: { tools: {} } });
      mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: APP_TOOLS }));
      mcp.setRequestHandler(CallToolRequestSchema, async (r) => {
        calls.push(r.params);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, echo: r.params }) }] };
      });
      await mcp.connect(transport);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/mcp/messages') {
      const t = sessions[url.searchParams.get('sessionId')];
      if (!t) { res.writeHead(400).end(); return; }
      await t.handlePostMessage(req, res);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const actualPort = srv.address().port;
  return {
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}/sse`,
    calls,
    close: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(() => r()); }),
  };
}

after(() => shutdown());

async function connectClient(bridge) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await bridge.connect(a);
  const client = new Client({ name: 'test-client', version: '0' });
  await client.connect(b);
  return client;
}

async function freePort() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return port;
}

test('resolveEndpoint: env override > server.json > default port', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opmcp-'));
  assert.equal(resolveEndpoint({ env: {}, home }), `http://127.0.0.1:${DEFAULT_PORT}/sse`);
  fs.mkdirSync(path.join(home, '.omnipost'));
  fs.writeFileSync(path.join(home, '.omnipost', 'server.json'), JSON.stringify({ port: 9123 }));
  assert.equal(resolveEndpoint({ env: {}, home }), 'http://127.0.0.1:9123/sse');
  assert.equal(resolveEndpoint({ env: { OMNIPOST_MCP_URL: 'http://127.0.0.1:1/sse' }, home }), 'http://127.0.0.1:1/sse');
  fs.writeFileSync(path.join(home, '.omnipost', 'server.json'), '{broken');
  assert.equal(resolveEndpoint({ env: {}, home }), `http://127.0.0.1:${DEFAULT_PORT}/sse`);
});

test('bundled snapshot lists tools with names and input schemas', () => {
  const tools = loadSnapshot();
  assert.ok(tools.length >= 10, `expected a real snapshot, got ${tools.length} tools`);
  for (const t of tools) {
    assert.equal(typeof t.name, 'string');
    assert.equal(t.inputSchema?.type, 'object');
  }
});

test('app running: tools and calls are forwarded unchanged', async () => {
  const app = await startFakeApp();
  const client = await connectClient(createBridgeServer({ connection: new AppConnection({ resolve: () => app.url }), snapshot: [] }));
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name), ['list_accounts', 'publish_post']);
    const r = await client.callTool({ name: 'publish_post', arguments: { title: 'hello' } });
    assert.ok(!r.isError);
    assert.deepEqual(JSON.parse(r.content[0].text).echo, { name: 'publish_post', arguments: { title: 'hello' } });
    assert.equal(app.calls.length, 1);
  } finally {
    await client.close();
    await app.close();
  }
});

test('app not running: snapshot is listed and calls return an install hint', async () => {
  const port = await freePort();
  const snapshot = [{ name: 'list_alerts', inputSchema: { type: 'object', properties: {} } }];
  const client = await connectClient(createBridgeServer({
    connection: new AppConnection({ resolve: () => `http://127.0.0.1:${port}/sse` }), snapshot,
  }));
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name), ['list_alerts']);
    const r = await client.callTool({ name: 'list_alerts', arguments: {} });
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /not reachable/);
    assert.ok(r.content[0].text.includes(DOWNLOAD_URL));
  } finally {
    await client.close();
  }
});

test('app opened after the bridge started: the next call reconnects', async () => {
  const port = await freePort();
  const client = await connectClient(createBridgeServer({
    connection: new AppConnection({ resolve: () => `http://127.0.0.1:${port}/sse` }), snapshot: [],
  }));
  let app;
  try {
    const first = await client.callTool({ name: 'list_accounts', arguments: {} });
    assert.equal(first.isError, true);
    app = await startFakeApp(port);
    const second = await client.callTool({ name: 'list_accounts', arguments: {} });
    assert.ok(!second.isError, second.content?.[0]?.text);
    assert.equal(app.calls.length, 1);
  } finally {
    await client.close();
    if (app) await app.close();
  }
});
