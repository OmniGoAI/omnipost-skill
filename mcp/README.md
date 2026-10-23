# omnipost-mcp

MCP server for [OmniPost](https://omnigoai.com/en/products/omnipost/). It lets Claude Code, Claude Desktop, Cursor, Cline and other MCP clients publish articles, image posts and videos to 40+ platforms: Zhihu, CSDN, WeChat Official Accounts, Xiaohongshu, Bilibili, Weibo, Douyin, Dev.to, Mastodon, Bluesky, WordPress and more.

This package does no publishing itself. It forwards your AI client's requests to the OmniPost desktop app running on the same machine, where your platform accounts are logged in. Nothing goes through a cloud server.

[中文说明](#中文说明)

## Requirements

1. Install the OmniPost desktop app (Windows / macOS) from https://omnigoai.com/en/download/omnipost/ and keep it open.
2. Log in to the platforms you want to publish to inside the app.
3. Node.js 18.17 or newer.

## Setup

Claude Code:

```bash
claude mcp add omnipost -- npx -y omnipost-mcp
```

Claude Desktop, Cursor, Cline and other clients (MCP config file):

```json
{
  "mcpServers": {
    "omnipost": { "command": "npx", "args": ["-y", "omnipost-mcp"] }
  }
}
```

Then ask your agent something like: "Publish this Markdown to Zhihu and CSDN, and put it in my WeChat Official Account drafts."

## How it works

- Finds the running app through `~/.omnipost/server.json` (falls back to port 8787) and connects to its built-in MCP endpoint `http://127.0.0.1:<port>/sse`.
- Tool list and tool calls are forwarded unchanged, so you always get the tools of the app version you have installed.
- If the app is not running, the tools are still listed from a bundled snapshot, and each call returns a short "install / open OmniPost" message instead of a raw connection error.
- Long calls (for example a large video upload) are allowed to run for up to 6 hours without being cut off.
- Plan limits are enforced by the app, not by this package.

Environment variables:

- `OMNIPOST_MCP_URL`: use a specific endpoint, e.g. `http://127.0.0.1:8787/sse`.
- `OMNIPOST_DATA_DIR`: where to look for `server.json` (default `~/.omnipost`).

You can also connect to the app directly without this package if your client supports SSE: `claude mcp add --transport sse omnipost http://127.0.0.1:8787/sse`.

## Development

```bash
npm install
npm test           # bridge tests against a fake app
npm run snapshot   # refresh tools-snapshot.json from the app running on this machine
```

## 中文说明

`omnipost-mcp` 让 Claude Code、Claude Desktop、Cursor 等 AI 工具通过标准 MCP 协议调用 OmniPost，把写好的内容发到知乎、CSDN、公众号、小红书、B 站等 40 多个平台。

它本身不发布，只把请求转给你电脑上正在运行的 OmniPost 桌面应用，账号登录都在应用里，不经过任何云端。

1. 安装并打开 OmniPost：https://omnigoai.com/zh/download/omnipost/ ，在应用里登录要发的平台。
2. Claude Code 里运行：`claude mcp add omnipost -- npx -y omnipost-mcp`。其它客户端按上面的配置文件写法添加。
3. 对 AI 说「把这篇发到知乎和 CSDN，公众号进草稿箱」。

应用没开时，AI 工具仍能看到工具列表，调用时会提示先安装并打开 OmniPost。

## License

MIT
