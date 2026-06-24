interface Bet {
  id: number;
  match: string;
  matchId: string | null;
  betOption: string | null;
  betAmount: number;
  odds: number;
  result: string;
  profit: number | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  name: string;
  balance: number;
}

const resultLabels: Record<string, string> = {
  win: "已赢",
  loss: "已输",
  pending: "待定",
};

export function exportBetsToCSV(bets: Bet[], users: User[]) {
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const headers = ["用户", "比赛", "投注项", "投注额", "可赢金额", "赔率", "结果", "盈利", "日期"];
  const rows = bets.map((bet) => [
    userMap.get(bet.userId) || "未知",
    bet.match,
    bet.betOption || "-",
    bet.betAmount.toFixed(2),
    bet.odds.toFixed(2),
    bet.betAmount > 0 ? (bet.odds / bet.betAmount).toFixed(2) : "0",
    resultLabels[bet.result] || bet.result,
    bet.profit != null ? bet.profit.toFixed(2) : "-",
    new Date(bet.createdAt).toLocaleString("zh-CN"),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `投注记录_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
