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
  matchId?: string | null;
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
  const winCount = settledBets.filter((b) => b.result === "win").length;
  const lossCount = settledBets.filter((b) => b.result === "loss").length;
  const winRate =
    settledBets.length > 0
      ? ((winCount / settledBets.length) * 100).toFixed(1)
      : "0.0";
  const roi =
    totalAmount > 0
      ? ((totalProfit / totalAmount) * 100).toFixed(1)
      : "0.0";

  const stats = [
    { title: "总投注数", value: totalBets.toString(), color: "bg-blue-50 text-blue-700" },
    { title: "总投注金额", value: `¥${totalAmount.toFixed(2)}`, color: "bg-purple-50 text-purple-700" },
    { title: "总盈利", value: `${totalProfit >= 0 ? "+" : ""}¥${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700" },
    { title: "胜率", value: `${winRate}%`, color: "bg-amber-50 text-amber-700" },
    { title: "ROI", value: `${roi}%`, color: parseFloat(roi) >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700" },
  ];

  // 阶段分析
  function detectPhase(match: string): "小组赛" | "淘汰赛" | "未知" {
    if (/(组|Group|[A-H]$)/i.test(match)) return "小组赛";
    if (/(决赛|Final|半决赛|Semi|四分之一|Quarter|32强|16强|round of)/i.test(match)) return "淘汰赛";
    return "未知";
  }

  const phaseGroups = new Map<string, Bet[]>();
  for (const bet of settledBets) {
    const phase = detectPhase(bet.match);
    if (!phaseGroups.has(phase)) phaseGroups.set(phase, []);
    phaseGroups.get(phase)!.push(bet);
  }

  const phaseStats = Array.from(phaseGroups.entries()).map(([phase, phaseBets]) => {
    const pwins = phaseBets.filter((b) => b.result === "win").length;
    const plosses = phaseBets.filter((b) => b.result === "loss").length;
    const psettled = pwins + plosses;
    const pwinRate = psettled > 0 ? ((pwins / psettled) * 100).toFixed(1) : "0.0";
    const pprofit = phaseBets.reduce((sum, b) => sum + (b.profit ?? 0), 0);
    const pamount = phaseBets.reduce((sum, b) => sum + b.betAmount, 0);
    const proi = pamount > 0 ? ((pprofit / pamount) * 100).toFixed(1) : "0.0";
    return { phase, count: phaseBets.length, psettled, pwins, plosses, pwinRate, pprofit, pamount, proi };
  });

  const dayStats = computeDayStats(bets);

  return (
    <div className="space-y-3">
      {/* 总计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className={`${stat.color} border-0 dark:bg-opacity-20`}>
            <CardHeader className="pb-1 sm:pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 sm:pb-4 px-3 sm:px-4">
              <div className="text-lg sm:text-xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 阶段胜率分析 */}
      {phaseStats.filter((p) => p.phase !== "未知" && p.psettled > 0).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              阶段分析
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-3">
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left font-medium py-2 pl-2">阶段</th>
                    <th className="text-right font-medium py-2">投注数</th>
                    <th className="text-right font-medium py-2">投注额</th>
                    <th className="text-center font-medium py-2">赢/输</th>
                    <th className="text-right font-medium py-2">胜率</th>
                    <th className="text-right font-medium py-2">ROI</th>
                    <th className="text-right font-medium py-2 pr-2">盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseStats.filter((p) => p.phase !== "未知" && p.psettled > 0).map((p) => (
                    <tr key={p.phase} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 pl-2">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{p.phase}</span>
                      </td>
                      <td className="text-right py-2.5 text-gray-600 dark:text-gray-400">{p.count}</td>
                      <td className="text-right py-2.5 text-gray-600 dark:text-gray-400">¥{p.pamount.toFixed(0)}</td>
                      <td className="text-center py-2.5">
                        <span className="text-red-600 dark:text-red-400 font-medium">{p.pwins}</span>
                        <span className="text-gray-300 mx-0.5">/</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">{p.plosses}</span>
                      </td>
                      <td className="text-right py-2.5 text-gray-600 dark:text-gray-400">{p.pwinRate}%</td>
                      <td className="text-right py-2.5">
                        <span className={parseFloat(p.proi) >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                          {p.proi}%
                        </span>
                      </td>
                      <td className="text-right py-2.5 pr-2">
                        <span className={`font-bold ${p.pprofit > 0 ? "text-red-600 dark:text-red-400" : p.pprofit < 0 ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
                          {p.pprofit >= 0 ? "+" : ""}¥{p.pprofit.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 移动端 */}
            <div className="sm:hidden space-y-2">
              {phaseStats.filter((p) => p.phase !== "未知" && p.psettled > 0).map((p) => (
                <div key={p.phase} className="flex items-center justify-between py-2.5 px-2 rounded-lg bg-gray-50/70 dark:bg-gray-800/50">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{p.phase}</span>
                    <span className="text-xs text-gray-400">{p.count}注 · ¥{p.pamount.toFixed(0)}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${p.pprofit > 0 ? "text-red-600 dark:text-red-400" : p.pprofit < 0 ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
                      {p.pprofit >= 0 ? "+" : ""}¥{p.pprofit.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.pwins}赢{p.plosses}输 · 胜率{p.pwinRate}% · ROI {p.proi}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 每日汇总 */}
      {dayStats.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              每日统计
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-3">
            {/* 桌面端表格 */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100 dark:border-gray-800">
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
                    <tr key={day.dateKey} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{day.label}</span>
                          <span className="text-xs text-gray-400">{day.weekday}</span>
                          {day.pendingCount > 0 && (
                            <span className="text-xs text-gray-400">({day.pendingCount}待定)</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-2.5 text-gray-600 dark:text-gray-400">{day.count}</td>
                      <td className="text-right py-2.5 text-gray-600 dark:text-gray-400">¥{day.totalAmount.toFixed(0)}</td>
                      <td className="text-center py-2.5">
                        {day.settledCount > 0 ? (
                          <span className="text-gray-600 dark:text-gray-400">
                            <span className="text-red-600 dark:text-red-400 font-medium">{day.winCount}</span>
                            <span className="text-gray-300 mx-0.5">/</span>
                            <span className="text-green-600 dark:text-green-400 font-medium">{day.lossCount}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="text-right py-2.5 text-gray-600 dark:text-gray-400">{day.winRate === "-" ? "-" : `${day.winRate}%`}</td>
                      <td className="text-right py-2.5 pr-2">
                        {day.settledCount > 0 ? (
                          <span className={`font-bold ${day.totalProfit > 0 ? "text-red-600 dark:text-red-400" : day.totalProfit < 0 ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
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
                <div key={day.dateKey} className="flex items-center justify-between py-2.5 px-2 rounded-lg bg-gray-50/70 dark:bg-gray-800/50">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{day.label}</span>
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
                        <div className={`text-sm font-bold ${day.totalProfit > 0 ? "text-red-600 dark:text-red-400" : day.totalProfit < 0 ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
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
