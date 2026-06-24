# World Cup App

世界杯竞猜投注管理系统，支持多用户、投注记录管理与盈亏统计。

## 技术栈

- **框架**: Next.js 16 + App Router + React 19 + TypeScript
- **样式**: Tailwind CSS + shadcn/ui
- **数据库**: SQLite (better-sqlite3)
- **赛事数据**: 从 worldcup26.ir 获取世界杯实时赛程

## 功能

- 多用户模式，支持新增用户和切换用户
- 投注记录增删改查（比赛、金额、可赢金额、结果）
- 用户盈亏统计与余额结算
- 全用户汇总统计视图
- 赛程搜索选择，自动填充比赛名称

## 快速开始

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看效果。
