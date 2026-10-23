// Export the tool list from the OmniPost app running on this machine into tools-snapshot.json.
// The snapshot is only used when the app is not running (so clients and directories can still list tools).
//   npm run snapshot
import fs from 'node:fs';
import { AppConnection } from '../src/bridge.js';

const conn = new AppConnection();
const client = await conn.get();
const { tools } = await client.listTools();
const out = new URL('../tools-snapshot.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), tools }, null, 2) + '\n');
console.log(`wrote ${tools.length} tools to ${out.pathname}`);
await conn.reset();
