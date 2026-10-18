# ==============================================================================
# Multi-Stage Production Dockerfile for ProjectMind Platform
# ==============================================================================

# --- Stage 1: Build & Compilation ---
FROM node:20.18.0-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for native compilation (e.g., better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install all dependencies (including devDependencies required for compilation)
COPY package.json package-lock.json ./
RUN npm ci

# Copy TypeScript configs, build scripts, and production sources
COPY tsconfig.json tsconfig.prod.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/

# Compile TypeScript to JavaScript and normalize ESM specifiers
RUN npm run build

# --- Stage 2: Production Runner ---
FROM node:20.18.0-bookworm-slim AS runner

WORKDIR /app

# Install security updates, dumb-init for proper signal handling, and curl for health probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set production environment defaults
ENV NODE_ENV=production
ENV PROJECTMIND_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV PROJECTMIND_STORAGE_LOCATION=.projectmind/data

# Copy package descriptors and bin entrypoints
COPY package.json package-lock.json ./
COPY bin/ ./bin/

# Install production-only dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled distribution from builder stage
COPY --from=builder /app/dist ./dist

# Create workspace and data storage directories with non-root ownership
RUN mkdir -p /app/.projectmind/data && chown -R node:node /app

# Switch to non-root user
USER node

# Expose API and health port
EXPOSE 3000

# Health check integration using HTTP readiness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health/live || exit 1

# Signal handling via dumb-init
ENTRYPOINT ["dumb-init", "--", "node", "dist/platform/main.js"]

