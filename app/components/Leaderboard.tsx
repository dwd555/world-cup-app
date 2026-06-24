"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, TrendingUp, Target } from "lucide-react";

interface Bet {
  id: number;
  betAmount: number;
  result: string;
  profit: number | null;
  userId: number;
}

interface User {
  id: number;
  name: string;
  balance: number;
}

interface LeaderboardProps {
  bets: Bet[];
  users: User[];
}

type RankBy = "profit" | "winRate" | "roi";

export function Leaderboard({ bets, users }: LeaderboardProps) {
  const [rankBy, setRankBy] = useState<RankBy>("profit");

  const ranking = useMemo(() => {
    return users
      .map((user) => {
        const userBets = bets.filter((b) => b.userId === user.id);
        const settled = userBets.filter((b) => b.result !== "pending");
        const wins = settled.filter((b) => b.result === "win").length;
        const losses = settled.filter((b) => b.result === "loss").length;
        const settledCount = wins + losses;
        const totalProfit = settled.reduce((sum, b) => sum + (b.profit ?? 0), 0);
        const totalAmount = settled.reduce((sum, b) => sum + b.betAmount, 0);
        const winRate = settledCount > 0 ? (wins / settledCount) * 100 : 0;
        const roi = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

        return {
          userId: user.id,
          name: user.name,
          balance: user.balance,
          totalBets: userBets.length,
          settledCount,
          wins,
          losses,
          pending: userBets.filter((b) => b.result === "pending").length,
          totalProfit,
          totalAmount,
          winRate,
          roi,
        };
      })
      .sort((a, b) => {
        if (rankBy === "profit") return b.totalProfit - a.totalProfit;
        if (rankBy === "winRate") return b.winRate - a.winRate;
        return b.roi - a.roi;
      });
  }, [bets, users, rankBy]);

  const tabs: { key: RankBy; label: string; icon: React.ReactNode }[] = [
    { key: "profit", label: "盈利排行", icon: <Trophy className="h-3.5 w-3.5" /> },
    { key: "winRate", label: "胜率排行", icon: <Target className="h-3.5 w-3.5" /> },
    { key: "roi", label: "ROI排行", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  ];

  const getMedal = (index: number) => {
    if (index === 0) return <span className="text-yellow-500 text-lg">🥇</span>;
    if (index === 1) return <span className="text-gray-400 text-lg">🥈</span>;
    if (index === 2) return <span className="text-amber-600 text-lg">🥉</span>;
    return <span className="text-gray-400 w-6 text-center text-sm">{index + 1}</span>;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
            <Medal className="h-4 w-4 text-gray-400" />
            排行榜
          </CardTitle>
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <Button
                key={tab.key}
                variant={rankBy === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setRankBy(tab.key)}
                className="h-7 text-xs"
              >
                {tab.icon}
                <span className="ml-1 hidden sm:inline">{tab.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-3">
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-100 dark:border-gray-800">
                <th className="text-left font-medium py-2 pl-2 w-10">#</th>
                <th className="text-left font-medium py-2">用户</th>
                <th className="text-right font-medium py-2">投注数</th>
                <th className="text-right font-medium py-2">投注额</th>
                <th className="text-center font-medium py-2">赢/输</th>
                <th className="text-right font-medium py-2">胜率</th>
                <th className="text-right font-medium py-2">ROI</th>
                <th className="text-right font-medium py-2 pr-2">盈利</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((user, i) => (
                <tr
                  key={user.userId}
                  className={`border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 ${
                    i < 3 ? "bg-amber-50/30 dark:bg-amber-900/10" : ""
                  }`}
                >
                  <td className="py-3 pl-2">{getMedal(i)}</td>
                  <td className="py-3">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{user.name}</span>
                  </td>
                  <td className="text-right py-3 text-gray-600 dark:text-gray-400">
                    {user.totalBets}
                    {user.pending > 0 && (
                      <span className="text-gray-400 text-xs ml-1">({user.pending}待)</span>
                    )}
                  </td>
                  <td className="text-right py-3 text-gray-600 dark:text-gray-400">
                    ¥{user.totalAmount.toFixed(0)}
                  </td>
                  <td className="text-center py-3">
                    <span className="text-red-600 dark:text-red-400 font-medium">{user.wins}</span>
                    <span className="text-gray-300 mx-0.5">/</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">{user.losses}</span>
                  </td>
                  <td className="text-right py-3 text-gray-600 dark:text-gray-400">
                    {user.settledCount > 0 ? `${user.winRate.toFixed(1)}%` : "-"}
                  </td>
                  <td className="text-right py-3">
                    <span className={user.roi >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                      {user.settledCount > 0 ? `${user.roi >= 0 ? "+" : ""}${user.roi.toFixed(1)}%` : "-"}
                    </span>
                  </td>
                  <td className="text-right py-3 pr-2">
                    <span
                      className={`font-bold ${
                        user.totalProfit > 0
                          ? "text-red-600 dark:text-red-400"
                          : user.totalProfit < 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-500"
                      }`}
                    >
                      {user.totalProfit >= 0 ? "+" : ""}¥{user.totalProfit.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 移动端 */}
        <div className="sm:hidden space-y-2">
          {ranking.map((user, i) => (
            <div
              key={user.userId}
              className={`flex items-center justify-between py-3 px-3 rounded-lg ${
                i < 3 ? "bg-amber-50/70 dark:bg-amber-900/15" : "bg-gray-50/70 dark:bg-gray-800/50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 flex justify-center">
                  {getMedal(i)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{user.name}</span>
                  <span className="text-xs text-gray-400">
                    {user.totalBets}注 · {user.wins}赢{user.losses}输
                    {user.pending > 0 && ` · ${user.pending}待`}
                  </span>
                  <span className="text-xs text-gray-400">
                    胜率{user.settledCount > 0 ? `${user.winRate.toFixed(1)}%` : "-"} · 
                    ROI {user.settledCount > 0 ? `${user.roi >= 0 ? "+" : ""}${user.roi.toFixed(1)}%` : "-"}
                  </span>
                </div>
              </div>
              <div className={`text-sm font-bold ${
                user.totalProfit > 0 ? "text-red-600 dark:text-red-400" : user.totalProfit < 0 ? "text-green-600 dark:text-green-400" : "text-gray-500"
              }`}>
                {user.totalProfit >= 0 ? "+" : ""}¥{user.totalProfit.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
