# Runs the OmniPost MCP bridge (stdio). Used by MCP directories such as Glama to start the server
# and list its tools. Real publishing needs the OmniPost desktop app on the user's own machine;
# inside this container the bridge serves its bundled tool list and returns an install hint on calls.
FROM node:20-alpine
WORKDIR /app
COPY mcp/package.json mcp/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY mcp/src ./src
COPY mcp/tools-snapshot.json ./
ENTRYPOINT ["node", "src/index.js"]
