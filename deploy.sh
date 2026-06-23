#!/bin/bash
set -e

echo "======================================"
echo "  足球投注系统 - Docker 部署脚本"
echo "======================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误：未安装 Docker"
    echo "   请访问 https://docs.docker.com/get-docker/ 安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否可用
if ! docker compose version &> /dev/null; then
    echo "❌ 错误：Docker Compose 插件不可用"
    echo "   请安装 Docker Desktop 或 docker-compose-plugin"
    exit 1
fi

echo "✅ Docker 版本: $(docker --version)"
echo "✅ Docker Compose 版本: $(docker compose version | head -1)"
echo ""

# 创建数据目录（如果不存在）
if [ ! -d "./data" ]; then
    echo "📁 创建数据目录 ./data"
    mkdir -p ./data
fi

# 如果本地有 dev.db，复制到数据目录
if [ -f "./dev.db" ] && [ ! -f "./data/dev.db" ]; then
    echo "📦 复制本地 dev.db 到 ./data/"
    cp ./dev.db ./data/dev.db
    cp -f ./dev.db-shm ./data/dev.db-shm 2>/dev/null || true
    cp -f ./dev.db-wal ./data/dev.db-wal 2>/dev/null || true
fi

echo ""
echo "🔧 开始构建 Docker 镜像..."
docker compose build --no-cache

echo ""
echo "🚀 启动服务..."
docker compose up -d

echo ""
echo "======================================"
echo "  ✅ 部署成功！"
echo "======================================"
echo ""

# 获取服务器 IP
IP_ADDRESSES=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "服务器IP")
echo "📱 访问地址："
echo "   - 本机: http://localhost:3000"
echo "   - 局域网: http://${IP_ADDRESSES}:3000"
echo ""

echo "📊 常用命令："
echo "   查看日志: docker compose logs -f"
echo "   停止服务: docker compose stop"
echo "   重启服务: docker compose restart"
echo "   查看状态: docker compose ps"
echo ""

echo "💾 数据文件保存在 ./data/dev.db"
echo "   备份时直接复制此文件即可"
echo ""
