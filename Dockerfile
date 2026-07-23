# ============================================================
#  Stage 0: Docker CLI + Compose 插件（用于后端容器内触发宿主机 docker compose 更新）
#  docker:cli 镜像自带 docker 二进制；compose 插件从 docker/compose-bin 官方镜像复制
# ============================================================
FROM docker:27-cli AS docker-cli
FROM docker/compose-bin:v2.29.2 AS compose-bin


# ============================================================
#  Stage 1: Builder - build frontend + compile backend
# ============================================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files and install ALL dependencies (including devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build frontend (tsc -b && vite build -> dist/)
RUN npm run build

# Compile backend TypeScript -> server/dist/
RUN npx tsc -p server/tsconfig.json

# Copy non-TS files that runtime needs (schema.sql)
RUN cp server/src/db/schema.sql server/dist/db/schema.sql


# ============================================================
#  Stage 2: Backend runtime (Express API server)
# ============================================================
FROM node:22-bookworm-slim AS backend

WORKDIR /app

# Install build tools for native modules (better-sqlite3) + git（更新脚本需要）
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ git curl && \
    rm -rf /var/lib/apt/lists/*

# 复制 docker CLI + compose 插件（用于容器内触发宿主机 docker compose 自更新）
# 直接从官方镜像复制二进制，避免 curl 下载（slim 镜像缺 ca-certificates 导致 HTTPS 失败）
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
RUN mkdir -p /usr/local/lib/docker/cli-plugins
COPY --from=compose-bin /docker-compose /usr/local/lib/docker/cli-plugins/docker-compose
RUN chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Copy package files and install production dependencies only
# --omit=optional 跳过 skia-canvas 等原生可选依赖（运行时有 try/catch 回退）
COPY package.json package-lock.json ./
RUN npm ci --production --omit=optional && \
    # Clean up build tools (no longer needed at runtime)
    apt-get purge -y --auto-remove python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy compiled backend code
COPY --from=builder /app/server/dist ./server/dist

# Create persistent data directories (mounted as volumes in compose)
RUN mkdir -p server/data server/uploads

ENV NODE_ENV=production

EXPOSE 3001

# 健康检查：每 30 秒探测 /api/health，连续 3 次失败标记为 unhealthy
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -fs http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]


# ============================================================
#  Stage 3: Caddy (reverse proxy + static file server + auto SSL)
# ============================================================
FROM caddy:2-alpine AS caddy

# Copy built frontend static files
COPY --from=builder /app/dist /srv

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile
