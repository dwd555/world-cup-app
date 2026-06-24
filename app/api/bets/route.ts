import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// 记录余额变更（辅助函数）
function recordBalanceChange(
  userId: number,
  changeAmount: number,
  type: string,
  reason: string,
  betId?: number
) {
  const user = db.prepare("SELECT balance FROM User WHERE id = ?").get(userId) as
    { balance: number } | undefined;
  if (!user) return;
  const newBalance = user.balance + changeAmount;
  db.prepare(
    "INSERT INTO BalanceChange (userId, changeAmount, oldBalance, newBalance, type, reason, betId) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(userId, changeAmount, user.balance, newBalance, type, reason, betId ?? null);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    let bets;
    if (userId) {
      bets = db
        .prepare("SELECT * FROM Bet WHERE userId = ? ORDER BY createdAt DESC")
        .all(Number(userId));
    } else {
      bets = db.prepare("SELECT * FROM Bet ORDER BY createdAt DESC").all();
    }

    return NextResponse.json(bets);
  } catch (error) {
    console.error("GET bets error:", error);
    return NextResponse.json({ error: "获取投注记录失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // 支持 winAmount（新）或 odds（旧兼容）
    const { match, matchId, betOption, betAmount, winAmount, odds, userId } = body;
    const effectiveWinAmount = winAmount != null ? winAmount : odds;

    if (betAmount == null || effectiveWinAmount == null || !userId) {
      return NextResponse.json(
        { error: "缺少必要字段: betAmount, winAmount, userId" },
        { status: 400 }
      );
    }

    const amount = Number(betAmount);
    const win = Number(effectiveWinAmount);
    const uid = Number(userId);

    // 检查用户余额
    const user = db.prepare("SELECT balance FROM User WHERE id = ?").get(uid) as
      { balance: number } | undefined;
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    if (user.balance < amount) {
      return NextResponse.json(
        { error: `余额不足，当前余额: ${user.balance.toFixed(2)}` },
        { status: 400 }
      );
    }

    // 扣除余额
    db.prepare("UPDATE User SET balance = balance - ? WHERE id = ?")
      .run(amount, uid);

    // 记录余额变更
    const matchDesc = match ? `投注《${match}》，` : "自定义投注，";
    recordBalanceChange(
      uid,
      -amount,
      "bet_create",
      `${matchDesc}扣除本金 ¥${amount.toFixed(2)}`
    );

    // odds 字段存储 winAmount（可赢金额）
    const stmt = db.prepare(
      "INSERT INTO Bet (match, matchId, betOption, betAmount, odds, result, userId) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
    );
    const result = stmt.run(
      match ? String(match) : "",
      matchId ? String(matchId) : null,
      matchId ? String(matchId) : null,
      betOption ? String(betOption) : null,
      amount,
      win,
      uid
    );

    const betId = Number(result.lastInsertRowid);

    // 更新关联的 BalanceChange 记录 betId
    db.prepare(
      "UPDATE BalanceChange SET betId = ? WHERE userId = ? AND type = 'bet_create' AND betId IS NULL ORDER BY id DESC LIMIT 1"
    ).run(betId, uid);

    const bet = db
      .prepare("SELECT * FROM Bet WHERE id = ?")
      .get(betId);

    return NextResponse.json(bet, { status: 201 });
  } catch (error) {
    console.error("POST bet error:", error);
    return NextResponse.json({ error: "创建投注记录失败" }, { status: 500 });
  }
}
