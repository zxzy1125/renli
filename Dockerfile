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

# Install build tools for native modules (better-sqlite3), then clean up
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --production && \
    # Remove ppt-only heavy native packages not needed by the web app
    rm -rf node_modules/skia-canvas \
           node_modules/fontkit \
           node_modules/pptxgenjs \
           node_modules/linebreak \
           node_modules/mathjax-full && \
    # Clean up build tools (no longer needed at runtime)
    apt-get purge -y --auto-remove python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy compiled backend code
COPY --from=builder /app/server/dist ./server/dist

# Create persistent data directories (mounted as volumes in compose)
RUN mkdir -p server/data server/uploads

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server/dist/index.js"]


# ============================================================
#  Stage 3: Caddy (reverse proxy + static file server + auto SSL)
# ============================================================
FROM caddy:2-alpine AS caddy

# Copy built frontend static files
COPY --from=builder /app/dist /srv

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile
