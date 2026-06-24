# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

# Use China mirror for Debian apt to avoid slow downloads
# 清华 / 阿里 / 中科大 可选，默认清华
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies with China npm mirror
COPY package.json package-lock.json* ./
COPY .npmrc ./
RUN npm config set registry https://registry.npmmirror.com && npm install

# Copy source
COPY . .

# Build Next.js standalone output
RUN npm run build

# Stage 2: Production
FROM node:22-slim AS runner

WORKDIR /app

# Install runtime libraries needed by better-sqlite3
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends libsqlite3-dev libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create data directory for SQLite (persistent volume mount point)
RUN mkdir -p /app/data

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
