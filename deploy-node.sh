#!/bin/bash
set -e

echo "========================================"
echo "  World Cup App 直接部署脚本（无 Docker）"
echo "========================================"
echo ""

# 检查 Node 版本
NODE_VERSION=$(node -v 2>/dev/null || echo "")
if [ -z "$NODE_VERSION" ]; then
    echo "⚠ 未检测到 Node.js，请安装："
    echo "  https://nodejs.org/ 或 nvm"
    echo ""
    exit 1
fi

echo "✓ Node.js 版本: $NODE_VERSION"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "⚠ 未检测到 npm"
    exit 1
fi

# 安装依赖
echo "→ 安装依赖..."
npm install

# 构建项目
echo "→ 构建项目..."
npm run build

# 确保数据目录存在
mkdir -p data

# 安装 PM2（如果没有）
if ! command -v pm2 &> /dev/null; then
    echo "→ 安装 PM2..."
    npm install -g pm2
fi

# 启动或重启
echo "→ 启动应用..."
NODE_ENV=production pm2 startOrRestart ecosystem.config.js

pm2 save
pm2 startup systemd

echo ""
echo "========================================"
echo "  ✓ 部署完成！"
echo "========================================"
echo ""
echo "应用地址: http://localhost:3000"
echo "PM2 管理: pm2 status"
echo "查看日志: pm2 logs world-cup-app"
echo "重启: pm2 restart world-cup-app"
echo "停止: pm2 stop world-cup-app"
echo ""
