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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { result, winAmount: customWinAmount } = body;

    if (!result || !["win", "loss", "pending"].includes(result)) {
      return NextResponse.json(
        { error: "result 必须是 win, loss 或 pending" },
        { status: 400 }
      );
    }

    const existing = db.prepare("SELECT * FROM Bet WHERE id = ?").get(Number(id)) as
      { betAmount: number; odds: number; result: string; profit: number | null; userId: number; match: string } | undefined;

    if (!existing) {
      return NextResponse.json({ error: "投注记录不存在" }, { status: 404 });
    }

    const oldResult = existing.result;
    const oldProfit = existing.profit;
    const oldWinAmount = existing.odds; // odds 字段存储 winAmount
    const newResult = result;
    const { betAmount, userId, match } = existing;

    // 可赢金额：如果传入了 customWinAmount 则使用新值，否则保持原值
    const newWinAmount = customWinAmount != null && !isNaN(Number(customWinAmount))
      ? Number(customWinAmount)
      : oldWinAmount;

    // 根据 result 和 winAmount 自动计算 profit
    let newProfit: number | null;
    if (newResult === "pending") {
      newProfit = null;
    } else if (newResult === "win") {
      newProfit = newWinAmount; // 赢 = 可赢金额
    } else {
      newProfit = -betAmount; // 输 = -投注额
    }

    // 如果结果、winAmount、profit 都没变化，直接返回
    if (oldResult === newResult && oldWinAmount === newWinAmount && oldProfit === newProfit) {
      const unchanged = db.prepare("SELECT * FROM Bet WHERE id = ?").get(Number(id));
      return NextResponse.json(unchanged);
    }

    // 统一余额变动计算：balanceChange = betAmount + profit
    // - 赢时 profit > 0：返还本金 + 盈利
    // - 输时 profit < 0：返还本金 + 亏损
    // - 待定 profit = null：无变动
    let oldBalanceChange = 0;
    if (oldResult === "win" || oldResult === "loss") {
      oldBalanceChange = betAmount + (oldProfit ?? 0);
    }

    let newBalanceChange = 0;
    if (newResult === "win" || newResult === "loss") {
      newBalanceChange = betAmount + (newProfit ?? 0);
    }

    const netBalanceChange = newBalanceChange - oldBalanceChange;

    if (netBalanceChange !== 0) {
      db.prepare("UPDATE User SET balance = balance + ? WHERE id = ?")
        .run(netBalanceChange, userId);

      const resultLabel = newResult === "win" ? "赢" : newResult === "loss" ? "输" : "待定";
      const oldLabel = oldResult === "pending" ? "待定" : oldResult === "win" ? "赢" : "输";
      const winAmountNote = newWinAmount !== oldWinAmount ? `（可赢金额 ¥${oldWinAmount.toFixed(2)} → ¥${newWinAmount.toFixed(2)}）` : "";
      recordBalanceChange(
        userId,
        netBalanceChange,
        "bet_result",
        `《${match}》结果从「${oldLabel}」改为「${resultLabel}」${winAmountNote}，余额变动 ¥${netBalanceChange.toFixed(2)}`,
        Number(id)
      );
    }

    // 更新 Bet：result、profit，以及 odds（可赢金额）如果有变化
    if (newWinAmount !== oldWinAmount) {
      db.prepare("UPDATE Bet SET result = ?, profit = ?, odds = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?")
        .run(newResult, newProfit, newWinAmount, Number(id));
    } else {
      db.prepare("UPDATE Bet SET result = ?, profit = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?")
        .run(newResult, newProfit, Number(id));
    }

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
