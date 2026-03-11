# syntax=docker/dockerfile:1.7
# Daycare Engine Docker Image
#
# Build:
#   docker build -t daycare:latest -f packages/daycare/Dockerfile .
#
# Run (all roles):
#   docker run -v /var/run/docker.sock:/var/run/docker.sock daycare:latest
#
# Run (specific role):
#   docker run -e DAYCARE_ROLE=api daycare:latest
#   docker run daycare:latest --role worker
#
# Roles: all (default), api, worker, scheduler, connector

FROM node:22-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace root files
COPY package.json yarn.lock ./

# Copy package manifests for all workspaces
COPY packages/daycare/package.json packages/daycare/
COPY packages/daycare-dashboard/package.json packages/daycare-dashboard/

# Install dependencies
RUN yarn install --frozen-lockfile --non-interactive

# Copy source code
COPY packages/daycare packages/daycare
COPY packages/daycare-dashboard packages/daycare-dashboard

# Build the project
RUN yarn build

# Production image
FROM node:22-slim

WORKDIR /app

# Install runtime dependencies (for better-sqlite3 and other native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built application and production dependencies
COPY --from=builder /build/packages/daycare/dist ./dist
COPY --from=builder /build/packages/daycare/bin ./bin
COPY --from=builder /build/packages/daycare/package.json ./
COPY --from=builder /build/node_modules ./node_modules

# Create data directory
RUN mkdir -p /data/daycare

# Environment variables
ENV NODE_ENV=production
ENV DAYCARE_ROOT_DIR=/data/daycare
ENV DAYCARE_ROLE=all

# Expose default API port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

# Entrypoint script to support both env var and CLI role override
COPY packages/daycare/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["start"]
