# OmniPost Skill

**Let Claude Code / OpenClaw / Codex publish what they wrote to 40+ platforms with one command.**

[中文](./README.md) · [SKILL.md](./skills/omnipost/SKILL.md) · [Connect your agent](./docs/connect.md) · [FAQ](./docs/faq.md) · [Download OmniPost](https://omnigoai.com/en/download/omnipost/)

- **Write once, publish once**: Zhihu, CSDN, WeChat Official Accounts, Xiaohongshu, Bilibili, Douyin, Dev.to, Mastodon, Bluesky, WordPress… one entry point instead of one MCP server per platform.
- **Your accounts stay on your machine**: sessions live in isolated local partitions and requests go out from your own browser session. Nothing is relayed through a cloud.
- **Drafts by default, you press publish**: session-expiry warnings ahead of time, and posts that failed because of a lost login are retried automatically after you log back in.

OmniPost is a pair of hands, not a brain: it contains no model, writes nothing, judges nothing, and never auto-engages. Your agent decides what to post and where.

## 30-second setup

1. Install [OmniPost](https://omnigoai.com/en/download/omnipost/) (Windows / macOS) and log in to your platform accounts inside the app, exactly as you would on the web.
2. Copy the `skills/omnipost/` folder into your agent's skills directory:
   - Claude Code: `~/.claude/skills/omnipost/` (or `.claude/skills/omnipost/` inside a project)
   - OpenClaw: `~/.openclaw/skills/omnipost/` (or `skills/omnipost/` in your workspace)
   - Any other agent: drop it into its skills directory, or feed `SKILL.md` as a system prompt
   - Optional MCP tools: `claude mcp add --transport sse omnipost http://127.0.0.1:8787/sse`
3. Tell your agent: **"Publish this to Dev.to and Hashnode, and put a draft on WeChat."**

Codex, Cursor, Cline and plain HTTP are covered in [docs/connect.md](./docs/connect.md).

## What is in this repo

- `skills/omnipost/SKILL.md` — the skill: how to locate the local OmniPost, CLI cheat sheet, 44 MCP tools mapped to CLI commands, publishing workflow, per-platform content specs, account operations, conventions. (Chinese; the tools themselves are self-describing in JSON.)
- `skills/omnipost/rules/` — content-rule cheat sheets for 10 Chinese platforms (Xiaohongshu, WeChat, Douyin, Kuaishou, Channels, Bilibili, Weibo, Baijiahao, Toutiao, Zhihu) with official clause numbers and source links. Useful even without OmniPost.
- `examples/` — ready-to-edit publish JSON, schedule JSON, Bash and PowerShell scripts.
- `docs/connect.md`, `docs/faq.md`.

## Platforms (41)

- **Chinese, articles**: CSDN, Juejin, Zhihu, WeChat Official Accounts, Cnblogs, SegmentFault, OSChina, 51CTO, iMooc, Woshipm, Xueqiu, Eastmoney, Douban, Toutiao, Sohu, Baijiahao, Weibo
- **Chinese, articles + video**: Xiaohongshu, Bilibili, WeChat Channels, Douyin, Kuaishou, Weibo, Baijiahao, Sohu
- **International (official APIs)**: Dev.to, Hashnode, WordPress, Ghost, Mastodon, Pleroma, GoToSocial, Pixelfed, Bluesky, Threads, Reddit, LinkedIn, Lemmy, Micro.blog, Telegram, Discord, Slack, Matrix, Tumblr

`omnipost platforms` / MCP `list_platforms` returns a machine-readable capability list (content types, required fields for real publishing, platform-specific extras), so the agent never has to memorize any of this.

## On account bans, honestly

Automated posting carries platform risk by itself; Xiaohongshu's March 2026 notice says AI-operated posting and engagement get banned. OmniPost does not do and does not claim "ban-proof":

- drafts by default, you decide when to publish;
- no auto-like, auto-comment, auto-reply, auto-follow, no human-behavior simulation;
- `rules/` lists each platform's official red lines for the agent to read first;
- many accounts, high frequency and near-duplicate content are the main causes of bans. Slow down, rewrite, confirm by hand.

You are responsible for your content.

## Free vs Pro

- **Free**: 8 developer platforms (CSDN, Juejin, Zhihu, Cnblogs, SegmentFault, OSChina, 51CTO, iMooc), 3 accounts, 30 posts per month, forever.
- **Pro**: all platforms, 50 accounts, 1000 posts per month, scheduling and spacing, auto publish, account groups, MCP / CLI automation. ¥39/month, ¥99/quarter, ¥299/year. A **7-day Pro trial** is one click inside the app, no card.

## Talk to us

We are looking for 10 people who publish with Claude Code / OpenClaw / Codex for a 20-minute chat about their workflow. 3 months of Pro as a thank-you. Open an issue titled "chat".

Bugs, broken platforms after a redesign, missing platforms: open an issue.

## License

This repository (skill, rule sheets, examples, docs) is MIT. The OmniPost desktop app itself is closed-source free + paid software by [OmniGoAI](https://omnigoai.com).
