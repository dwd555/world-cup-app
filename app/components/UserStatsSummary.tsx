import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function UserStatsSummary({ bets, users }) {
  if (bets.length === 0 || users.length <= 1) return null;

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const stats = users.map((user) => {
    const userBets = bets.filter((b) => b.userId === user.id);
    const totalAmount = userBets.reduce((sum, b) => sum + b.betAmount, 0);
    const totalProfit = userBets.reduce((sum, b) => sum + (b.profit ?? 0), 0);
    const settled = userBets.filter((b) => b.result !== "pending");
    const winRate = settled.length > 0
      ? ((settled.filter((b) => b.result === "win").length / settled.length) * 100).toFixed(1)
      : "0.0";
    return {
      name: user.name,
      count: userBets.length,
      totalAmount,
      totalProfit,
      winRate,
    };
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
      {stats.map((s) => (
        <Card key={s.name} className="bg-white">
          <CardHeader className="pb-2 pt-3 sm:pt-6">
            <CardTitle className="text-sm font-medium text-gray-600">{s.name}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 sm:pb-6">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-400 text-xs">投注数</div>
                <div className="font-semibold">{s.count}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">胜率</div>
                <div className="font-semibold">{s.winRate}%</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">投注金额</div>
                <div className="font-semibold">¥{s.totalAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">盈利</div>
                <div className={`font-semibold ${s.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {s.totalProfit >= 0 ? "+" : ""}¥{s.totalProfit.toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
