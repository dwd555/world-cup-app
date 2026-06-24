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
import { Trash2, Trophy, XCircle, Minus, RefreshCw, Calendar, Pencil, Check, X } from "lucide-react";

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

// ===== 日期分组辅助函数 =====

function getDateKey(createdAt: string): string {
  // SQLite CURRENT_TIMESTAMP 返回 UTC 时间，格式 "YYYY-MM-DD HH:MM:SS"
  // 需转换为本地时区后再提取日期，避免凌晨前后归错日期
  const isoStr = createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T");
  const utcStr = isoStr.endsWith("Z") ? isoStr : isoStr + "Z";
  const date = new Date(utcStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateStr: string): { label: string; sublabel: string } {
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
    label = `${month}月${day}日`;
  }

  const dateStrFormatted = `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  return { label, sublabel: `${weekdays[date.getDay()]} · ${dateStrFormatted}` };
}

function groupBetsByDate(bets: Bet[]): { dateKey: string; bets: Bet[] }[] {
  const groups = new Map<string, Bet[]>();
  for (const bet of bets) {
    const key = getDateKey(bet.createdAt);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(bet);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, dayBets]) => ({ dateKey, bets: dayBets }));
}

interface DayStats {
  count: number;
  totalAmount: number;
  winCount: number;
  lossCount: number;
  pendingCount: number;
  totalProfit: number;
  settledCount: number;
}

function computeDayStats(dayBets: Bet[]): DayStats {
  const count = dayBets.length;
  const totalAmount = dayBets.reduce((sum, b) => sum + b.betAmount, 0);
  const winCount = dayBets.filter((b) => b.result === "win").length;
  const lossCount = dayBets.filter((b) => b.result === "loss").length;
  const pendingCount = dayBets.filter((b) => b.result === "pending").length;
  const settledCount = winCount + lossCount;
  const totalProfit = dayBets.reduce((sum, b) => sum + (b.profit ?? 0), 0);
  return { count, totalAmount, winCount, lossCount, pendingCount, totalProfit, settledCount };
}

// ===== 日汇总头部组件 =====

function DayHeader({ dateKey, stats }: { dateKey: string; stats: DayStats }) {
  const { label, sublabel } = formatDateLabel(dateKey);
  const isProfit = stats.totalProfit > 0;
  const isLoss = stats.totalProfit < 0;

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 py-2.5 px-3 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className="font-semibold text-gray-800 text-sm">{label}</span>
        <span className="text-xs text-gray-400">{sublabel}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
        <span className="text-gray-500">
          {stats.count}注
          {stats.pendingCount > 0 && (
            <span className="text-gray-400 ml-1">({stats.pendingCount}待定)</span>
          )}
        </span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">投 ¥{stats.totalAmount.toFixed(0)}</span>
        <span className="text-gray-300">|</span>
        {stats.settledCount > 0 ? (
          <>
            <span className="text-gray-500">
              {stats.winCount}赢{stats.lossCount}输
            </span>
            <span className="text-gray-300">|</span>
            <span
              className={`font-bold ${
                isProfit ? "text-red-600" : isLoss ? "text-green-600" : "text-gray-600"
              }`}
            >
              {stats.totalProfit >= 0 ? "+" : ""}
              ¥{stats.totalProfit.toFixed(2)}
            </span>
          </>
        ) : (
          <span className="text-gray-400">未结算</span>
        )}
      </div>
    </div>
  );
}

export function BetList({ bets, users, onRefresh, filter }: BetListProps) {
  const [matchMap, setMatchMap] = useState<Map<string, MatchInfo>>(new Map());
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [editingWinAmountId, setEditingWinAmountId] = useState<number | null>(null);
  const [winAmountInput, setWinAmountInput] = useState("");

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

  // 按日期分组
  const groupedDays = groupBetsByDate(filteredBets);

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

  const handleStartEditWinAmount = (bet: Bet) => {
    setEditingWinAmountId(bet.id);
    setWinAmountInput(bet.odds.toFixed(2));
  };

  const handleCancelEditWinAmount = () => {
    setEditingWinAmountId(null);
    setWinAmountInput("");
  };

  const handleSaveWinAmount = async (bet: Bet) => {
    const val = parseFloat(winAmountInput);
    if (isNaN(val) || val < 0) {
      toast.error("请输入有效金额");
      return;
    }
    try {
      const res = await fetch(`/api/bets/${bet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: bet.result, winAmount: val }),
      });
      if (!res.ok) throw new Error("更新失败");
      toast.success("可赢金额已更新");
      setEditingWinAmountId(null);
      setWinAmountInput("");
      onRefresh();
    } catch {
      toast.error("更新可赢金额失败");
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

  // ===== 桌面端：单行投注渲染 =====
  const renderBetRow = (bet: Bet) => (
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
      <TableCell className="text-right whitespace-nowrap">
        {editingWinAmountId === bet.id ? (
          <div className="flex items-center gap-1 justify-end">
            <input
              type="number"
              step="0.01"
              min="0"
              value={winAmountInput}
              onChange={(e) => setWinAmountInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveWinAmount(bet);
                if (e.key === "Escape") handleCancelEditWinAmount();
              }}
              className="w-20 h-7 rounded border border-blue-400 px-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
            <button
              onClick={() => handleSaveWinAmount(bet)}
              className="text-green-600 hover:text-green-700 p-0.5"
              title="保存"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancelEditWinAmount}
              className="text-gray-400 hover:text-gray-600 p-0.5"
              title="取消"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <span className="text-blue-600">¥{bet.odds.toFixed(2)}</span>
            <button
              onClick={() => handleStartEditWinAmount(bet)}
              className="text-gray-300 hover:text-blue-500 p-0.5"
              title="修改可赢金额"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="secondary" className={resultConfig[bet.result]?.color || ""}>
          {resultConfig[bet.result]?.icon}
          <span className="ml-1">{resultConfig[bet.result]?.label}</span>
        </Badge>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {bet.profit !== null ? (
          <span className={bet.profit >= 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
            {bet.profit >= 0 ? "+" : ""}
            ¥{bet.profit.toFixed(2)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
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
  );

  // ===== 移动端：单条投注卡片渲染 =====
  const renderBetCard = (bet: Bet) => (
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
            <span className={bet.profit >= 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
              {bet.profit >= 0 ? "+" : ""}
              ¥{bet.profit.toFixed(2)}
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
        <div className="flex items-center gap-1">
          <span className="text-gray-400">可赢:</span>
          {editingWinAmountId === bet.id ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={winAmountInput}
                onChange={(e) => setWinAmountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveWinAmount(bet);
                  if (e.key === "Escape") handleCancelEditWinAmount();
                }}
                className="w-20 h-7 rounded border border-blue-400 px-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                autoFocus
              />
              <button
                onClick={() => handleSaveWinAmount(bet)}
                className="text-green-600 hover:text-green-700 p-0.5"
                title="保存"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancelEditWinAmount}
                className="text-gray-400 hover:text-gray-600 p-0.5"
                title="取消"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <span className="text-blue-600">¥{bet.odds.toFixed(2)}</span>
              <button
                onClick={() => handleStartEditWinAmount(bet)}
                className="text-gray-300 hover:text-blue-500 p-0.5"
                title="修改可赢金额"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
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
  );

  if (filteredBets.length === 0) {
    return (
      <div className="rounded-lg border bg-white">
        <div className="text-center py-8 text-muted-foreground">暂无投注记录</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedDays.map((group) => {
        const stats = computeDayStats(group.bets);
        return (
          <div key={group.dateKey} className="rounded-lg border bg-white overflow-hidden">
            {/* 日汇总头部 */}
            <DayHeader dateKey={group.dateKey} stats={stats} />

            {/* 桌面端：表格 */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="h-9">用户</TableHead>
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
                    <TableHead className="h-9">投注项</TableHead>
                    <TableHead className="text-right h-9">投注额</TableHead>
                    <TableHead className="text-right h-9">可赢</TableHead>
                    <TableHead className="text-center h-9">结果</TableHead>
                    <TableHead className="text-right h-9">盈利</TableHead>
                    <TableHead className="text-center h-9">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.bets.map(renderBetRow)}
                </TableBody>
              </Table>
            </div>

            {/* 移动端：卡片列表 */}
            <div className="md:hidden">
              {group.bets.map(renderBetCard)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
