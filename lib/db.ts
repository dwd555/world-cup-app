import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "dev.db");

export const db = new Database(dbPath);

// 启用 WAL 模式以提高性能
db.pragma("journal_mode = WAL");

// 创建表（如果不存在）
db.exec(`
  CREATE TABLE IF NOT EXISTS User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    balance REAL NOT NULL DEFAULT 1000,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Bet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match TEXT NOT NULL,
    betAmount REAL NOT NULL,
    odds REAL NOT NULL,
    result TEXT NOT NULL DEFAULT 'pending',
    profit REAL,
    userId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  );
`);

// 兼容升级：为已有 Bet 表添加新字段（如果不存在）
const betCols = (db.prepare("PRAGMA table_info(Bet)").all() as { name: string }[]).map(c => c.name);
if (!betCols.includes("betOption")) {
  db.exec("ALTER TABLE Bet ADD COLUMN betOption TEXT");
}
if (!betCols.includes("matchId")) {
  db.exec("ALTER TABLE Bet ADD COLUMN matchId TEXT");
}

export interface User {
  id: number;
  name: string;
  balance: number;
  createdAt: string;
}

export interface Bet {
  id: number;
  match: string;
  matchId: string | null;   // 关联赛程 ID（用于查询实时比分）
  betOption: string | null; // 投注项（如：主胜、平局、客胜）
  betAmount: number;
  odds: number; // 存储"可赢金额"（winAmount），字段名保持兼容
  result: string;
  profit: number | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
}
