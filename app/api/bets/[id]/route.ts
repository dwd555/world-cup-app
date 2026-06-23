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

// odds 字段存储的是 winAmount（可赢金额）
function calculateProfit(betAmount: number, winAmount: number, result: string): number | null {
  if (result === "win") {
    return winAmount; // 盈利 = 可赢金额
  }
  if (result === "loss") {
    return -betAmount; // 亏损 = 投注额
  }
  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { result } = body;

    if (!result || !["win", "loss", "pending"].includes(result)) {
      return NextResponse.json(
        { error: "result 必须是 win, loss 或 pending" },
        { status: 400 }
      );
    }

    const existing = db.prepare("SELECT * FROM Bet WHERE id = ?").get(Number(id)) as
      { betAmount: number; odds: number; result: string; userId: number; match: string } | undefined;

    if (!existing) {
      return NextResponse.json({ error: "投注记录不存在" }, { status: 404 });
    }

    const oldResult = existing.result;
    const newResult = result;
    // odds 字段存储 winAmount（可赢金额）
    const { betAmount, odds: winAmount, userId, match } = existing;

    // 如果结果没有变化，直接返回
    if (oldResult === newResult) {
      const unchanged = db.prepare("SELECT * FROM Bet WHERE id = ?").get(Number(id));
      return NextResponse.json(unchanged);
    }

    // 根据状态转移计算余额变化
    // 赢时：返还 betAmount + winAmount；输时：不操作（本金已在投注时扣除）
    let balanceChange = 0;
    if (oldResult === "pending" && newResult === "win") {
      balanceChange = betAmount + winAmount; // 返还本金+可赢金额
    } else if (oldResult === "pending" && newResult === "loss") {
      balanceChange = 0; // 输了不返还
    } else if (oldResult === "win" && newResult === "pending") {
      balanceChange = -(betAmount + winAmount); // 撤销赢：扣回
    } else if (oldResult === "loss" && newResult === "pending") {
      balanceChange = 0; // 撤销输：不变（本金已扣）
    } else if (oldResult === "win" && newResult === "loss") {
      balanceChange = -(betAmount + winAmount); // 从赢到输：扣回
    } else if (oldResult === "loss" && newResult === "win") {
      balanceChange = betAmount + winAmount; // 从输到赢：返还
    }

    if (balanceChange !== 0) {
      db.prepare("UPDATE User SET balance = balance + ? WHERE id = ?")
        .run(balanceChange, userId);

      const resultLabel = newResult === "win" ? "赢" : "输";
      const oldLabel = oldResult === "pending" ? "待定" : oldResult === "win" ? "赢" : "输";
      recordBalanceChange(
        userId,
        balanceChange,
        "bet_result",
        `《${match}》结果从「${oldLabel}」改为「${resultLabel}」，余额变动 ¥${balanceChange.toFixed(2)}`,
        Number(id)
      );
    }

    const profit = calculateProfit(betAmount, winAmount, newResult);

    db.prepare("UPDATE Bet SET result = ?, profit = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?")
      .run(newResult, profit, Number(id));

    const updated = db.prepare("SELECT * FROM Bet WHERE id = ?").get(Number(id));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT bet error:", error);
    return NextResponse.json({ error: "更新投注记录失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = db.prepare("SELECT * FROM Bet WHERE id = ?").get(Number(id)) as
      { betAmount: number; odds: number; result: string; userId: number; match: string } | undefined;

    if (!existing) {
      return NextResponse.json({ error: "投注记录不存在" }, { status: 404 });
    }

    // odds 字段存储 winAmount（可赢金额）
    const { betAmount, odds: winAmount, result, userId, match } = existing;

    // 删除时根据结果状态恢复余额
    let balanceChange = 0;
    if (result === "pending") {
      balanceChange = betAmount; // 返还本金（投注时扣除）
    } else if (result === "win") {
      balanceChange = -(betAmount + winAmount); // 撤销赢：扣回本金+可赢金额
    } else if (result === "loss") {
      balanceChange = betAmount; // 撤销输：返还本金
    }

    if (balanceChange !== 0) {
      db.prepare("UPDATE User SET balance = balance + ? WHERE id = ?")
        .run(balanceChange, userId);

      const resultLabel = result === "win" ? "赢" : result === "loss" ? "输" : "待定";
      recordBalanceChange(
        userId,
        balanceChange,
        "bet_delete",
        `删除《${match}》投注（${resultLabel}），余额变动 ¥${balanceChange.toFixed(2)}`,
        Number(id)
      );
    }

    db.prepare("DELETE FROM Bet WHERE id = ?").run(Number(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE bet error:", error);
    return NextResponse.json({ error: "删除投注记录失败" }, { status: 500 });
  }
}
