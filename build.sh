#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  World Cup App Docker 构建脚本"
echo "========================================"
echo ""

# 检查本地是否已有 node:22-slim
if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^node:22-slim$"; then
  echo "✓ 本地已有 node:22-slim 镜像"
else
  echo "⚠ 本地没有 node:22-slim 镜像"
  echo "   请先在另一台电脑导出后传入："
  echo "     docker pull node:22-slim"
  echo "     docker save node:22-slim > node-22-slim.tar"
  echo "     scp node-22-slim.tar user@server:/opt/world-cup-app/"
  echo "   然后在服务器执行："
  echo "     docker load < node-22-slim.tar"
  echo "     ./build.sh"
  echo ""
  exit 1
fi

# 创建数据目录
mkdir -p "$PROJECT_DIR/data"

# 构建并启动
echo "→ 开始构建..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d --build

echo ""
echo "========================================"
echo "  ✓ 构建完成！"
echo "========================================"
echo ""
echo "应用地址: http://localhost:3000"
echo "查看日志: docker compose logs -f app"
echo ""
