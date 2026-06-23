"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Trophy, XCircle, Minus, RefreshCw } from "lucide-react";

interface Bet {
  id: number;
  match: string;
  matchId: string | null;
  betOption: string | null;
  betAmount: number;
  odds: number; // 可赢金额
  result: string;
  profit: number | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface MatchInfo {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string | null;
  awayScore: string | null;
  finished: boolean;
  timeElapsed: string;
}

interface BetListProps {
  bets: Bet[];
  users: { id: number; name: string; balance: number }[];
  onRefresh: () => void;
  filter: string;
}

export function BetList({ bets, users, onRefresh, filter }: BetListProps) {
  const [matchMap, setMatchMap] = useState<Map<string, MatchInfo>>(new Map());
  const [matchesLoading, setMatchesLoading] = useState(false);

  // 加载赛程数据（用于显示比分）
  const fetchMatchData = async () => {
    setMatchesLoading(true);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) return;
      const data: MatchInfo[] = await res.json();
      const map = new Map(data.map((m) => [m.id, m]));
      setMatchMap(map);
    } catch {
      // 静默失败
    } finally {
      setMatchesLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchData();
  }, []);

  const filteredBets =
    filter === "all" ? bets : bets.filter((b) => b.result === filter);

  const handleSetResult = async (id: number, result: string) => {
    try {
      const res = await fetch(`/api/bets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error("更新失败");
      toast.success(`已标记为${result === "win" ? "赢" : result === "loss" ? "输" : "待定"}`);
      onRefresh();
    } catch {
      toast.error("更新结果失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/bets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("投注记录已删除");
      onRefresh();
    } catch {
      toast.error("删除失败");
    }
  };

  interface ResultConfig {
    label: string;
    color: string;
    icon: React.ReactNode;
  }

  const resultConfig: Record<string, ResultConfig> = {
    win: { label: "赢", color: "bg-green-100 text-green-700 hover:bg-green-200", icon: <Trophy className="h-3 w-3" /> },
    loss: { label: "输", color: "bg-red-100 text-red-700 hover:bg-red-200", icon: <XCircle className="h-3 w-3" /> },
    pending: { label: "待定", color: "bg-gray-100 text-gray-700 hover:bg-gray-200", icon: <Minus className="h-3 w-3" /> },
  };

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  // 渲染比分标签
  const ScoreBadge = ({ matchId }: { matchId: string | null }) => {
    if (!matchId) return null;
    const m = matchMap.get(matchId);
    if (!m) return null;
    if (m.homeScore === null || m.awayScore === null) {
      return (
        <span className="inline-flex items-center text-xs text-blue-500 bg-blue-50 rounded px-1.5 py-0.5 ml-1">
          未开赛
        </span>
      );
    }
    const scoreText = `${m.homeScore}:${m.awayScore}`;
    if (m.finished) {
      return (
        <span className="inline-flex items-center text-xs font-bold text-gray-600 bg-gray-100 rounded px-1.5 py-0.5 ml-1">
          终 {scoreText}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-xs font-bold text-green-700 bg-green-50 rounded px-1.5 py-0.5 ml-1 animate-pulse">
        ● {scoreText}
      </span>
    );
  };

  // 渲染投注项标签
  const BetOptionBadge = ({ option }: { option: string | null }) => {
    if (!option) return null;
    return (
      <span className="inline-flex items-center text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
        {option}
      </span>
    );
  };

  return (
    <div className="rounded-lg border bg-white">
      {/* Desktop: 表格 */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  比赛
                  <button
                    onClick={fetchMatchData}
                    className="text-gray-400 hover:text-blue-500 transition-colors ml-1"
                    title="刷新比分"
                  >
                    <RefreshCw className={`h-3 w-3 ${matchesLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </TableHead>
              <TableHead>投注项</TableHead>
              <TableHead className="text-right">投注额</TableHead>
              <TableHead className="text-right">可赢</TableHead>
              <TableHead className="text-center">结果</TableHead>
              <TableHead className="text-right">盈利</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  暂无投注记录
                </TableCell>
              </TableRow>
            ) : (
              filteredBets.map((bet) => (
                <TableRow key={bet.id}>
                  <TableCell className="font-medium text-sm whitespace-nowrap">
                    {userMap.get(bet.userId) || "未知"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm leading-snug">{bet.match}</span>
                      <ScoreBadge matchId={bet.matchId} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <BetOptionBadge option={bet.betOption} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">¥{bet.betAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-blue-600 whitespace-nowrap">¥{bet.odds.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className={resultConfig[bet.result]?.color || ""}>
                      {resultConfig[bet.result]?.icon}
                      <span className="ml-1">{resultConfig[bet.result]?.label}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {bet.profit !== null ? (
                      <span className={bet.profit >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                        {bet.profit >= 0 ? "+" : ""}
                        ¥{(bet.result === "win" ? bet.profit + bet.betAmount : bet.profit).toFixed(2)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-green-600" onClick={() => handleSetResult(bet.id, "win")} title="标记为赢">
                        <Trophy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => handleSetResult(bet.id, "loss")} title="标记为输">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500" onClick={() => handleSetResult(bet.id, "pending")} title="标记为待定">
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500" onClick={() => handleDelete(bet.id)} title="删除">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: 卡片列表 */}
      <div className="md:hidden">
        {filteredBets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无投注记录</div>
        ) : (
          filteredBets.map((bet) => (
            <div key={bet.id} className="border-b last:border-b-0 p-4 space-y-3">
              {/* 顶部：用户 + 结果标签 + 盈利 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{userMap.get(bet.userId) || "未知"}</span>
                  <Badge variant="secondary" className={resultConfig[bet.result]?.color || ""}>
                    {resultConfig[bet.result]?.icon}
                    <span className="ml-1">{resultConfig[bet.result]?.label}</span>
                  </Badge>
                </div>
                <div className="text-right">
                  {bet.profit !== null ? (
                    <span className={bet.profit >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                      {bet.profit >= 0 ? "+" : ""}
                      ¥{(bet.result === "win" ? bet.profit + bet.betAmount : bet.profit).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>
              </div>

              {/* 比赛名称 + 比分 */}
              <div>
                <div className="font-medium text-gray-900 text-sm">{bet.match}</div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <ScoreBadge matchId={bet.matchId} />
                  <BetOptionBadge option={bet.betOption} />
                </div>
              </div>

              {/* 金额信息 */}
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>
                  <span className="text-gray-400">投注:</span> ¥{bet.betAmount.toFixed(2)}
                </div>
                <div>
                  <span className="text-gray-400">可赢:</span> <span className="text-blue-600">¥{bet.odds.toFixed(2)}</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 pt-1">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-green-600 flex-1" onClick={() => handleSetResult(bet.id, "win")}>
                  <Trophy className="h-4 w-4 mr-1" />
                  赢
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 flex-1" onClick={() => handleSetResult(bet.id, "loss")}>
                  <XCircle className="h-4 w-4 mr-1" />
                  输
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 flex-1" onClick={() => handleSetResult(bet.id, "pending")}>
                  <Minus className="h-4 w-4 mr-1" />
                  待定
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-red-500 flex-1" onClick={() => handleDelete(bet.id)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
