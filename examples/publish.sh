#!/usr/bin/env bash
# 用本机 OmniPost 把一篇 Markdown 建成多平台草稿（macOS / Linux / Git Bash）。
# 用法：./publish.sh ./article.md zhihu,csdn,cnblogs
set -euo pipefail

DOC="${1:?用法: publish.sh <article.md> <platforms,逗号分隔> [draft|publish]}"
PLATFORMS="${2:?缺平台列表，如 zhihu,csdn}"
MODE="${3:-draft}"

# 1. 从 ~/.omnipost/server.json 取端口
PORT=$(node -e "console.log(require(require('os').homedir()+'/.omnipost/server.json').port)" 2>/dev/null || echo 8787)
BASE="http://127.0.0.1:${PORT}"

# 2. 用 /api/health 拿这台机器的 CLI 命令
CLI=$(curl -sf "${BASE}/api/health" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.cli.shell))")
[ -n "$CLI" ] || { echo "OmniPost 没在运行，请先打开它"; exit 1; }

# 3. 分发前先看告警：有账号失效就别发
"$CLI" alerts

# 4. 建草稿 / 发布，标题取 Markdown 第一行 # 标题
TITLE=$(grep -m1 '^# ' "$DOC" | sed 's/^# //')
"$CLI" publish --doc "$DOC" --platforms "$PLATFORMS" --mode "$MODE" --title "$TITLE" --baseDir "$(dirname "$DOC")"

# 5. 看结果：拿返回的 recordId 对账
"$CLI" posts --limit 5
