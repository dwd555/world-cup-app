import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    if (!match || betAmount == null || effectiveWinAmount == null || !userId) {
      return NextResponse.json(
        { error: "缺少必要字段: match, betAmount, winAmount, userId" },
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

    // odds 字段存储 winAmount（可赢金额）
    const stmt = db.prepare(
      "INSERT INTO Bet (match, matchId, betOption, betAmount, odds, result, userId) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
    );
    const result = stmt.run(
      String(match),
      matchId ? String(matchId) : null,
      betOption ? String(betOption) : null,
      amount,
      win,
      uid
    );

    const bet = db
      .prepare("SELECT * FROM Bet WHERE id = ?")
      .get(result.lastInsertRowid);

    return NextResponse.json(bet, { status: 201 });
  } catch (error) {
    console.error("POST bet error:", error);
    return NextResponse.json({ error: "创建投注记录失败" }, { status: 500 });
  }
}
