module.exports = {
  apps: [{
    name: 'world-cup-app',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/opt/world-cup-app',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
      DATABASE_PATH: '/opt/world-cup-app/data/dev.db',
    },
    // 或使用 standalone 输出（推荐，更稳定）
    // script: './server.js',
    // cwd: '/opt/world-cup-app/.next/standalone',
    
    error_file: '/opt/world-cup-app/logs/err.log',
    out_file: '/opt/world-cup-app/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // 自动重启
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // 内存限制
    max_memory_restart: '512M',
    
    // 监听文件变化（开发环境）
    watch: false,
    
    // 优雅关闭
    kill_timeout: 5000,
    
    // 环境变量（生产）
    env_production: {
      NODE_ENV: 'production',
    },
  }],
};
