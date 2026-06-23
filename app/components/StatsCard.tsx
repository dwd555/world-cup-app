import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatsCard({ bets }) {
  const totalBets = bets.length;
  const totalAmount = bets.reduce((sum, b) => sum + b.betAmount, 0);
  const totalProfit = bets.reduce((sum, b) => sum + (b.profit ?? 0), 0);
  const settledBets = bets.filter((b) => b.result !== "pending");
  const winRate =
    settledBets.length > 0
      ? ((settledBets.filter((b) => b.result === "win").length / settledBets.length) * 100).toFixed(1)
      : "0.0";

  const stats = [
    { title: "总投注数", value: totalBets.toString(), color: "bg-blue-50 text-blue-700" },
    { title: "总投注金额", value: `¥${totalAmount.toFixed(2)}`, color: "bg-purple-50 text-purple-700" },
    { title: "总盈利", value: `¥${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700" },
    { title: "胜率", value: `${winRate}%`, color: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className={`${stat.color} border-0`}>
          <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-6 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 sm:pb-6 px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}