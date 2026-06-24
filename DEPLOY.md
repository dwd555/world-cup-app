# 部署指南

## 快速开始（推荐）

```bash
cd /opt/world-cup-app
chmod +x build.sh
./build.sh
```

---

## 完整部署步骤

### 1. 服务器环境准备

```bash
# 安装 Docker 和 docker-compose（如果还没有）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录后生效
```

### 2. 项目上传到服务器

```bash
# 在本地打包
zip -r world-cup-app.zip world-cup-app -x "*/node_modules/*" "*/.next/*" "*/.git/*"

# 上传到服务器（替换为你的服务器地址）
scp world-cup-app.zip user@your-server-ip:/home/user/

# 在服务器上解压
sudo apt install -y unzip
unzip world-cup-app.zip -d /opt/
cd /opt/world-cup-app

# 赋予脚本执行权限
chmod +x build.sh import-image.sh
```

### 3. 一键构建

```bash
./build.sh
```

`build.sh` 会自动尝试拉取 `debian:12-slim` 镜像，然后构建应用。

---

## 网络受限环境的部署方案

如果你的服务器完全无法访问外网，使用以下方案：

### 方案 A：预下载基础镜像（debian:12-slim）

**在能访问 Docker Hub 的电脑上：**
```bash
docker pull debian:12-slim
docker save debian:12-slim > debian-12-slim.tar
```

**传到服务器：**
```bash
scp debian-12-slim.tar user@server:/opt/world-cup-app/
```

**在服务器上：**
```bash
cd /opt/world-cup-app
docker load < debian-12-slim.tar
./build.sh
```

### 方案 B：预下载 Node.js 二进制（如果服务器无法访问 nodejs.org）

**在能访问外网的电脑上：**
```bash
curl -O https://nodejs.org/dist/v22.21.0/node-v22.21.0-linux-x64.tar.xz
```

**传到服务器（放入项目目录）：**
```bash
scp node-v22.21.0-linux-x64.tar.xz user@server:/opt/world-cup-app/
```

**在服务器上：**
```bash
cd /opt/world-cup-app
./build.sh
```

Dockerfile 会优先使用项目目录中的预下载 tarball，避免从网络下载。

### 方案 C：完全离线（两者都预下载）

**在能访问外网的电脑上：**
```bash
# 1. 下载基础镜像
docker pull debian:12-slim
docker save debian:12-slim > debian-12-slim.tar

# 2. 下载 Node.js 二进制
curl -O https://nodejs.org/dist/v22.21.0/node-v22.21.0-linux-x64.tar.xz
```

**全部传到服务器：**
```bash
scp debian-12-slim.tar node-v22.21.0-linux-x64.tar.xz user@server:/opt/world-cup-app/
```

**在服务器上：**
```bash
cd /opt/world-cup-app
docker load < debian-12-slim.tar
./build.sh
```

### 方案 D：不用 Docker，直接 Node 部署

如果你服务器已有 Node.js：

```bash
cd /opt/world-cup-app
npm install
npm run build
mkdir -p logs
chmod +x deploy-node.sh
./deploy-node.sh
```

如果没有 Node：
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 然后部署
./deploy-node.sh
```

---

## 检查是否运行正常

```bash
# 查看容器状态
docker compose ps

# 测试本地访问
curl http://localhost:3000/api/matches
curl http://localhost:3000/api/bets
```

---

## Nginx 配置

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
docker compose up -d
```

### 方案 B：服务器原生 Nginx（推荐，性能好）

```bash
# 安装 Nginx
sudo apt update && sudo apt install -y nginx

# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/world-cup-app
sudo ln -sf /etc/nginx/sites-available/world-cup-app /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## SSL 证书（HTTPS）

```bash
# 安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（替换为你的域名）
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 常用运维命令

```bash
# 查看日志
docker compose logs -f app

# 重启应用
docker compose restart app

# 重新构建（代码更新后）
./build.sh

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

---

## 更新部署（代码更新后）

```bash
cd /opt/world-cup-app

# 备份数据库
mkdir -p backups
cp data/dev.db backups/dev.db.$(date +%Y%m%d_%H%M%S)

# 拉取新代码（git 方式）
git pull
# 或重新上传代码后

# 重新构建并启动
./build.sh

# 确认正常
docker compose ps
curl -s http://localhost:3000/api/matches | head -c 100
```

---

## 防火墙配置

```bash
# 使用 Nginx 反向代理时，只开放 80/443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 如果直接暴露 3000 端口（不用 Nginx）
sudo ufw allow 3000/tcp
```

---

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_PATH` | SQLite 数据库路径 | `/app/data/dev.db` |
| `ODDS_API_KEY` | The Odds API 密钥（可选） | 无 |
| `PORT` | 应用端口 | `3000` |

---

## 故障排查

### 容器启动后立即退出

```bash
# 查看错误日志
docker compose logs app

# 常见原因：
# 1. data 目录权限问题
sudo chown -R 1000:1000 data/
# 2. 数据库文件损坏
# 恢复备份：cp backups/dev.db.xxx data/dev.db
```

### 端口被占用

```bash
# 修改 docker-compose.yml 中的端口映射
# 例如改为 3001:3000
```

---

## 项目文件说明

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 基于完整 Debian 镜像，手动安装 Node.js |
| `docker-compose.yml` | 服务编排 |
| `build.sh` | 一键构建脚本 |
| `import-image.sh` | 手动导入 Docker 镜像 |
| `deploy-node.sh` | 无 Docker 直接部署（Node + PM2） |
| `ecosystem.config.js` | PM2 配置文件 |
| `nginx.conf` | Nginx 反向代理配置 |
| `DEPLOY.md` | 本文件 |
