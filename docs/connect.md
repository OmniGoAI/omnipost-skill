# 把 OmniPost 接到你的 agent

前提：本机已安装并打开 OmniPost，且在应用里登录了要发的平台账号。OmniPost 运行时在 `127.0.0.1` 开一个本地服务，端口写在 `~/.omnipost/server.json`（通常 `8787`）。

`GET http://127.0.0.1:8787/api/health` 是所有接入方式的权威答案：它返回这台机器上的 CLI 命令（`cli.shell`）、MCP SSE 地址（`mcp.sse`）、MCP stdio 命令（`mcp.stdio`）。路径变了以它为准。

## 方式一：Skill（推荐，所有 agent 通用）

把本仓库 `skills/omnipost/` 整个文件夹放进 agent 的 skills 目录。Skill 里写明了「有 MCP 用 MCP、没有就用 CLI」的判断和完整工作流，agent 不需要额外配置。

| agent | 放到哪 |
|---|---|
| Claude Code | `~/.claude/skills/omnipost/`（全局）或 `.claude/skills/omnipost/`（项目） |
| OpenClaw | `~/.openclaw/skills/omnipost/`，或工作区 `skills/omnipost/` |
| Codex CLI | 支持 Agent Skills 的版本放 `~/.codex/skills/omnipost/`；否则在 `AGENTS.md` 里写一句「发布内容时先读 `<路径>/SKILL.md`」 |
| Cursor / Cline / Windsurf 等 | 放进各自的 rules / skills 目录，或把 `SKILL.md` 作为项目规则引用 |
| 自研 agent | 把 `SKILL.md` 内容放进系统提示，再给它一个能跑 shell 或发 HTTP 的工具 |

想要为这台机器定制、路径都算好的版本：`GET http://127.0.0.1:8787/api/skill?download=1` 会下载一份本机专属 Skill（zip）。

## 方式二：MCP 工具（可选）

OmniPost 提供 44 个 MCP 工具（`list_platforms`、`list_accounts`、`list_alerts`、`create_draft`、`publish_post`、`schedule_post`、`get_publish_status`、`get_account_overview` 等），与 HTTP API 同构。

**SSE 传输**（Claude Code 原生支持）：

```
claude mcp add --transport sse omnipost http://127.0.0.1:8787/sse
```

OpenClaw 的远程 MCP 支持 `sse` 传输，一条命令加好并探测：

```
openclaw mcp add omnipost --url http://127.0.0.1:8787/sse --transport sse
openclaw mcp doctor omnipost --probe
```

**stdio 传输**（只支持 stdio 的客户端）：把 `GET /api/health` 返回的 `mcp.stdio` 填进配置。Windows 上形如：

```json
{
  "mcpServers": {
    "omnipost": {
      "command": "<安装目录>\\OmniPost.exe",
      "args": ["<安装目录>\\resources\\app.asar\\bin\\omnipost-mcp.js"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

macOS 上 `command` 是 `/Applications/OmniPost.app/Contents/MacOS/OmniPost`，`args` 指向同一个 `omnipost-mcp.js`。两种传输都要求桌面应用正在运行。

## 方式三：CLI

`GET /api/health` 的 `cli.shell` 就是本机可执行的命令。Windows 通常是 `<安装目录>\omnipost.cmd`（同目录另有 `omnipost.ps1`），macOS 是 `/Applications/OmniPost.app/Contents/Resources/bin/omnipost-cli`。

```
omnipost --help
omnipost platforms
omnipost accounts
omnipost alerts
omnipost publish --doc ./article.md --platforms zhihu,csdn --mode draft --title "标题" --summary "摘要"
omnipost publish --json ./examples/publish.json
omnipost posts --limit 20
```

## 方式四：HTTP

```
GET  /api/health            服务信息与接入方式
GET  /api/platforms         平台能力清单
GET  /api/accounts          已登录账号
GET  /api/alerts            登录态告警 / 待补发
POST /api/publish           发布（body 见 examples/publish.json）
POST /api/schedule          定时（body 见 examples/schedule.json）
GET  /api/posts             发布记录
POST /api/publish-status    回查真实状态
```

完整 API 见 https://omnigoai.com/zh/docs/omnipost/api-reference/ 。

## 免费版与 agent 通道

免费版可以在应用界面里发 8 个开发者平台；通过 MCP / CLI 自动发布属于专业版功能。装好后在应用内一键领 7 天专业版试用即可直接体验，不填卡。
