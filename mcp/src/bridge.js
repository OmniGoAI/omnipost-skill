// OmniPost MCP bridge.
//
// A standard MCP server that does no work itself: it forwards tool listing and tool calls to the
// OmniPost desktop app running on the same machine (its built-in MCP endpoint, http://127.0.0.1:<port>/sse).
// When the app is not running, tools are still listed from a bundled snapshot so clients and
// directories can introspect the server, and every call returns a clear "install / open OmniPost" hint.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Agent, fetch as undiciFetch } from 'undici';

export const DEFAULT_PORT = 8787;
export const DOWNLOAD_URL = 'https://omnigoai.com/en/download/omnipost/';

// Publishing a large video can keep a tool call open for a long time. Keep this in line with the
// OmniPost CLI (6 hours). A client-side timeout here would make the agent think the publish failed
// and retry it, uploading the same content twice.
export const CALL_TIMEOUT_MS = 6 * 3600 * 1000;

// Node's built-in fetch drops a response body that stays idle for 5 minutes. The app's SSE stream
// is silent while a long publish is running, so use a dispatcher without body/header timeouts.
const longLivedAgent = new Agent({ bodyTimeout: 0, headersTimeout: 0, keepAliveTimeout: 60_000 });
const longLivedFetch = (url, init = {}) => undiciFetch(url, { ...init, dispatcher: longLivedAgent });

/** Where the running app's MCP endpoint is. Order: OMNIPOST_MCP_URL > ~/.omnipost/server.json > default port. */
export function resolveEndpoint({ env = process.env, home = os.homedir() } = {}) {
  if (env.OMNIPOST_MCP_URL) return env.OMNIPOST_MCP_URL;
  const dataDir = env.OMNIPOST_DATA_DIR || path.join(home, '.omnipost');
  let port = DEFAULT_PORT;
  try {
    const info = JSON.parse(fs.readFileSync(path.join(dataDir, 'server.json'), 'utf8'));
    if (Number.isInteger(info?.port) && info.port > 0) port = info.port;
  } catch {
    // no server.json yet: fall back to the default port
  }
  return `http://127.0.0.1:${port}/sse`;
}

export function loadSnapshot(file = new URL('../tools-snapshot.json', import.meta.url)) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data?.tools) ? data.tools : [];
  } catch {
    return [];
  }
}

export function notRunningResult(endpoint, cause) {
  const text = [
    'OmniPost desktop app is not reachable, so this tool could not run.',
    `Tried: ${endpoint}${cause ? ` (${cause})` : ''}`,
    '',
    'To fix: install OmniPost and keep it open, then log in to the platforms you want to publish to inside the app.',
    `Download: ${DOWNLOAD_URL}`,
    '',
    '未检测到正在运行的 OmniPost 桌面应用，工具无法执行。请先安装并打开 OmniPost，在应用里登录要发布的平台账号后重试。',
  ].join('\n');
  return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Connection to the desktop app, created lazily and recreated after a failure, so the bridge picks
 * the app up whenever the user opens or restarts it.
 */
export class AppConnection {
  constructor({ resolve = () => resolveEndpoint(), connectTimeoutMs = 5000, transportFactory } = {}) {
    this.resolve = resolve;
    this.connectTimeoutMs = connectTimeoutMs;
    this.transportFactory = transportFactory || ((url) => new SSEClientTransport(new URL(url), {
      fetch: longLivedFetch,
      eventSourceInit: { fetch: longLivedFetch },
    }));
    this.client = null;
    this.endpoint = null;
  }

  async get() {
    if (this.client) return this.client;
    const endpoint = this.resolve();
    const client = new Client({ name: 'omnipost-mcp-bridge', version: '0.1.0' });
    client.onclose = () => { if (this.client === client) this.client = null; };
    const connecting = client.connect(this.transportFactory(endpoint));
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`connect timed out after ${this.connectTimeoutMs} ms`)), this.connectTimeoutMs);
    });
    try {
      await Promise.race([connecting, timeout]);
    } catch (err) {
      try { await client.close(); } catch { /* ignore */ }
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), { endpoint });
    } finally {
      clearTimeout(timer);
    }
    this.client = client;
    this.endpoint = endpoint;
    return client;
  }

  async reset() {
    const c = this.client;
    this.client = null;
    if (c) { try { await c.close(); } catch { /* ignore */ } }
  }
}

function shortCause(err) {
  return String(err?.cause?.code || err?.code || err?.message || err).slice(0, 160);
}

export function createBridgeServer({ connection = new AppConnection(), snapshot = loadSnapshot(), version = '0.1.0' } = {}) {
  const server = new Server(
    { name: 'omnipost', version },
    {
      capabilities: { tools: {} },
      instructions:
        'OmniPost publishes content you have already written to 40+ platforms (Zhihu, CSDN, WeChat Official Accounts, ' +
        'Xiaohongshu, Bilibili, Dev.to, Mastodon, Bluesky, WordPress...). It needs the OmniPost desktop app running on ' +
        'this machine with the target accounts logged in. Call list_alerts before publishing; most Chinese platforms ' +
        'create drafts by default.',
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const client = await connection.get();
      return await client.listTools();
    } catch {
      await connection.reset();
      return { tools: snapshot };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    let client;
    try {
      client = await connection.get();
    } catch (err) {
      await connection.reset();
      return notRunningResult(err?.endpoint || connection.resolve(), shortCause(err));
    }
    try {
      return await client.callTool({ name, arguments: args || {} }, undefined, {
        timeout: CALL_TIMEOUT_MS,
        maxTotalTimeout: CALL_TIMEOUT_MS,
      });
    } catch (err) {
      // The link dropped mid-call (app closed or restarted). Do not retry automatically: the call may
      // already have published something, and a blind retry could publish it twice.
      await connection.reset();
      return {
        content: [{
          type: 'text',
          text: `Lost the connection to the OmniPost app during "${name}" (${shortCause(err)}). ` +
            'It may or may not have completed. Check list_posts before retrying so nothing is published twice.',
        }],
        isError: true,
      };
    }
  });

  // When the AI client goes away, drop the link to the app too, so nothing is left open.
  server.onclose = () => { connection.reset(); };

  return server;
}

/** Close pooled sockets so the process can exit promptly (used on shutdown and in tests). */
export async function shutdown() {
  try { await longLivedAgent.close(); } catch { /* ignore */ }
}
