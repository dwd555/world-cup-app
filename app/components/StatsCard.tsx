"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

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

interface StatsCardProps {
  bets: Bet[];
}

// ===== 日期分组辅助函数 =====

function getDateKey(createdAt: string): string {
  const isoStr = createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T");
  const utcStr = isoStr.endsWith("Z") ? isoStr : isoStr + "Z";
  const date = new Date(utcStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateStr: string): { label: string; weekday: string } {
  const parts = dateStr.split("-").map(Number);
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let label: string;
  if (date.getTime() === today.getTime()) {
    label = "今天";
  } else if (date.getTime() === yesterday.getTime()) {
    label = "昨天";
  } else {
    label = `${month}/${day}`;
  }

  return { label, weekday: weekdays[date.getDay()] };
}

interface DayStats {
  dateKey: string;
  label: string;
  weekday: string;
  count: number;
  totalAmount: number;
  winCount: number;
  lossCount: number;
  pendingCount: number;
  totalProfit: number;
  settledCount: number;
  winRate: string;
}

function computeDayStats(bets: Bet[]): DayStats[] {
  const groups = new Map<string, Bet[]>();
  for (const bet of bets) {
    const key = getDateKey(bet.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bet);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, dayBets]) => {
      const { label, weekday } = formatDateLabel(dateKey);
      const count = dayBets.length;
      const totalAmount = dayBets.reduce((sum, b) => sum + b.betAmount, 0);
      const winCount = dayBets.filter((b) => b.result === "win").length;
      const lossCount = dayBets.filter((b) => b.result === "loss").length;
      const pendingCount = dayBets.filter((b) => b.result === "pending").length;
      const settledCount = winCount + lossCount;
      const totalProfit = dayBets.reduce((sum, b) => sum + (b.profit ?? 0), 0);
      const winRate =
        settledCount > 0
          ? ((winCount / settledCount) * 100).toFixed(0)
          : "-";

      return {
        dateKey,
        label,
        weekday,
        count,
        totalAmount,
        winCount,
        lossCount,
        pendingCount,
        totalProfit,
        settledCount,
        winRate,
      };
    });
}

export function StatsCard({ bets }: StatsCardProps) {
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
    { title: "总盈利", value: `${totalProfit >= 0 ? "+" : ""}¥${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700" },
    { title: "胜率", value: `${winRate}%`, color: "bg-amber-50 text-amber-700" },
  ];

  const dayStats = computeDayStats(bets);

  return (
    <div className="space-y-3">
      {/* 总计卡片 */}
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

      {/* 每日汇总 */}
      {dayStats.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              每日统计
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-3">
            {/* 桌面端表格 */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100">
                    <th className="text-left font-medium py-2 pl-2">日期</th>
                    <th className="text-right font-medium py-2">投注数</th>
                    <th className="text-right font-medium py-2">投注额</th>
                    <th className="text-center font-medium py-2">赢/输</th>
                    <th className="text-right font-medium py-2">胜率</th>
                    <th className="text-right font-medium py-2 pr-2">当日盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  {dayStats.map((day) => (
                    <tr key={day.dateKey} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{day.label}</span>
                          <span className="text-xs text-gray-400">{day.weekday}</span>
                          {day.pendingCount > 0 && (
                            <span className="text-xs text-gray-400">({day.pendingCount}待定)</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-2.5 text-gray-600">{day.count}</td>
                      <td className="text-right py-2.5 text-gray-600">¥{day.totalAmount.toFixed(0)}</td>
                      <td className="text-center py-2.5">
                        {day.settledCount > 0 ? (
                          <span className="text-gray-600">
                            <span className="text-red-600 font-medium">{day.winCount}</span>
                            <span className="text-gray-300 mx-0.5">/</span>
                            <span className="text-green-600 font-medium">{day.lossCount}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="text-right py-2.5 text-gray-600">{day.winRate === "-" ? "-" : `${day.winRate}%`}</td>
                      <td className="text-right py-2.5 pr-2">
                        {day.settledCount > 0 ? (
                          <span className={`font-bold ${day.totalProfit > 0 ? "text-red-600" : day.totalProfit < 0 ? "text-green-600" : "text-gray-500"}`}>
                            {day.totalProfit >= 0 ? "+" : ""}¥{day.totalProfit.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端卡片 */}
            <div className="sm:hidden space-y-2">
              {dayStats.map((day) => (
                <div key={day.dateKey} className="flex items-center justify-between py-2.5 px-2 rounded-lg bg-gray-50/70">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-800 text-sm">{day.label}</span>
                      <span className="text-xs text-gray-400">{day.weekday}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {day.count}注 · ¥{day.totalAmount.toFixed(0)}
                      {day.pendingCount > 0 && ` · ${day.pendingCount}待定`}
                    </div>
                  </div>
                  <div className="text-right">
                    {day.settledCount > 0 ? (
                      <>
                        <div className={`text-sm font-bold ${day.totalProfit > 0 ? "text-red-600" : day.totalProfit < 0 ? "text-green-600" : "text-gray-500"}`}>
                          {day.totalProfit >= 0 ? "+" : ""}¥{day.totalProfit.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {day.winCount}赢{day.lossCount}输 · {day.winRate}%
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-300">未结算</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
