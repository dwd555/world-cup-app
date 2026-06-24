"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Bet {
  id: number;
  match: string;
  betAmount: number;
  odds: number;
  result: string;
  profit: number | null;
  userId: number;
  createdAt: string;
}

interface ProfitChartProps {
  bets: Bet[];
  users: { id: number; name: string }[];
}

const USER_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
];

export function ProfitChart({ bets, users }: ProfitChartProps) {
  const chartData = useMemo(() => {
    // 按日期排序所有已结算投注
    const settled = bets
      .filter((b) => b.result !== "pending")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (settled.length === 0) return null;

    // 收集所有日期
    const dateSet = new Set<string>();
    for (const bet of settled) {
      const d = new Date(bet.createdAt.includes("T") ? bet.createdAt : bet.createdAt.replace(" ", "T") + "Z");
      dateSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    const sortedDates = Array.from(dateSet).sort();

    // 按用户计算每日累计盈利
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const userCumulative = new Map<number, Map<string, number>>();
    const userRunning = new Map<number, number>();

    for (const userId of new Set(settled.map((b) => b.userId))) {
      userCumulative.set(userId, new Map());
      userRunning.set(userId, 0);
    }

    // 按日期分组，计算每日净盈利
    const dayGroups = new Map<string, Bet[]>();
    for (const bet of settled) {
      const d = new Date(bet.createdAt.includes("T") ? bet.createdAt : bet.createdAt.replace(" ", "T") + "Z");
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dayGroups.has(dayKey)) dayGroups.set(dayKey, []);
      dayGroups.get(dayKey)!.push(bet);
    }

    // 构建图表数据
    const rows: Record<string, string | number>[] = [];
    for (const date of sortedDates) {
      const row: Record<string, string | number> = { date: date.slice(5) }; // MM-DD
      const dayBets = dayGroups.get(date) || [];

      // 更新每个用户的累计盈利
      for (const bet of dayBets) {
        const prev = userRunning.get(bet.userId) || 0;
        userRunning.set(bet.userId, prev + (bet.profit ?? 0));
      }

      for (const userId of userRunning.keys()) {
        const name = userMap.get(userId) || `用户${userId}`;
        row[name] = Math.round((userRunning.get(userId) || 0) * 100) / 100;
      }
      rows.push(row);
    }

    return { rows, userNames: Array.from(userRunning.keys()).map((id) => userMap.get(id) || `用户${id}`) };
  }, [bets, users]);

  if (!chartData || chartData.rows.length < 2) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            盈利趋势
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="text-center py-8 text-gray-400 text-sm">数据不足，至少需要2天的已结算记录</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          盈利趋势
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.rows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={(v) => `¥${v}`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                fontSize: "13px",
              }}
              formatter={(value: number) => [`¥${value.toFixed(2)}`, ""]}
              labelFormatter={(label) => `日期: ${label}`}
            />
            {chartData.userNames.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
            )}
            {chartData.userNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={USER_COLORS[i % USER_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
