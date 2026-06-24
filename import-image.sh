#!/bin/bash
# 手动导入 node:22-slim 镜像脚本（用于 Docker Hub 无法访问的环境）

set -e

if [ -z "$1" ]; then
  echo "用法: $0 <tar文件路径>"
  echo ""
  echo "示例:"
  echo "  $0 ./node-22-slim.tar"
  echo ""
  echo "在能访问 Docker Hub 的电脑上导出镜像："
  echo "  docker pull node:22-slim"
  echo "  docker save node:22-slim > node-22-slim.tar"
  echo "  scp node-22-slim.tar user@server:/opt/world-cup-app/"
  echo ""
  exit 1
fi

TAR_FILE="$1"

if [ ! -f "$TAR_FILE" ]; then
  echo "错误: 文件不存在: $TAR_FILE"
  exit 1
fi

echo "→ 导入镜像: $TAR_FILE"
docker load < "$TAR_FILE"

echo "✓ 导入完成"
echo ""
echo "现在可以运行: ./build.sh"
