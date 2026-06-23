# 阶段一：构建
FROM node:22-slim AS builder

WORKDIR /app

# 安装 better-sqlite3 编译依赖（glibc 版本，兼容性更好）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        sqlite3 \
        libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# 复制依赖文件并安装
COPY package.json package-lock.json ./
RUN npm ci

# 复制项目源码
COPY . .

# 构建 Next.js（standalone 模式）
RUN npm run build

# 阶段二：运行
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/dev.db

# 安装 SQLite 运行时库（better-sqlite3 需要）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        sqlite3 \
        libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# 创建数据目录
RUN mkdir -p /app/data

# 复制 standalone 构建产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
