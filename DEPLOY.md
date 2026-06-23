# 部署指南

## 1. 服务器环境准备

```bash
# 安装 Docker 和 docker-compose（如果还没有）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录后生效
```

## 2. 项目上传到服务器

```bash
# 在本地打包
zip -r world-cup-app.zip world-cup-app -x "*/node_modules/*" "*/.next/*" "*/.git/*"

# 上传到服务器（示例）
scp world-cup-app.zip user@your-server-ip:/home/user/

# 在服务器上解压
unzip world-cup-app.zip -d /opt/
cd /opt/world-cup-app
```

## 3. 创建数据目录和配置

```bash
cd /opt/world-cup-app

# 创建 SQLite 数据库目录（重要！持久化数据）
mkdir -p data

# 配置环境变量（可选）
echo "ODDS_API_KEY=your_api_key_here" > .env.local

# 如果已有数据库需要迁移，复制到 data 目录
# cp /path/to/old/dev.db ./data/dev.db
```

## 4. 构建并运行

```bash
# 构建并启动（后台运行）
docker compose up -d --build

# 查看日志
docker compose logs -f app

# 查看状态
docker compose ps
```

## 5. 检查是否运行正常

```bash
# 测试本地访问
curl http://localhost:3000/api/matches
curl http://localhost:3000/api/bets
```

## 6. Nginx 配置（可选，用于域名 + SSL）

### 方案 A：用 docker-compose 一起启动 Nginx

编辑 `docker-compose.yml`，取消 `nginx` 服务的注释：

```yaml
  nginx:
    image: nginx:alpine
    container_name: world-cup-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - app-network
```

```bash
# 重启
docker compose up -d
```

### 方案 B：服务器原生 Nginx（推荐，性能好）

```bash
# 安装 Nginx
sudo apt update && sudo apt install -y nginx

# 复制配置文件
sudo cp nginx.conf /etc/nginx/nginx.conf
# 或单独配置 sites-enabled
sudo cp nginx.conf /etc/nginx/sites-available/world-cup-app
sudo ln -s /etc/nginx/sites-available/world-cup-app /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 设置开机自启
sudo systemctl enable nginx
```

## 7. SSL 证书（HTTPS）

```bash
# 安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（替换为你的域名）
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

## 8. 常用运维命令

```bash
# 查看日志
docker compose logs -f app

# 重启应用
docker compose restart app

# 重新构建（代码更新后）
docker compose up -d --build app

# 备份数据库
cp data/dev.db data/dev.db.backup.$(date +%Y%m%d)

# 进入容器
docker exec -it world-cup-app sh

# 查看数据库
docker exec -it world-cup-app sh -c "sqlite3 /app/data/dev.db '.tables'"

# 停止
docker compose down

# 停止并删除数据卷（慎用！）
docker compose down -v
```

## 9. 更新部署（代码更新后）

```bash
cd /opt/world-cup-app

# 备份数据库
mkdir -p backups
cp data/dev.db backups/dev.db.$(date +%Y%m%d_%H%M%S)

# 拉取新代码（git 方式）
git pull
# 或重新上传代码后

# 重新构建并启动
docker compose up -d --build

# 确认正常
docker compose ps
curl -s http://localhost:3000/api/matches | head -c 100
```

## 10. 防火墙配置（如有需要）

```bash
# 仅开放 80/443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# 如果不用 Nginx，直接暴露 3000
sudo ufw allow 3000/tcp
```
