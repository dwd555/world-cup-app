"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  UserPlus,
  Settings,
  Trash2,
} from "lucide-react";

interface BalanceChangeRecord {
  id: number;
  userId: number;
  changeAmount: number;
  oldBalance: number;
  newBalance: number;
  type: string;
  reason: string | null;
  betId: number | null;
  createdAt: string;
}

interface BalanceHistoryProps {
  userId: number | null;
  users: { id: number; name: string }[];
  refreshKey?: number;
}

const typeConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  bet_create: {
    label: "投注扣款",
    icon: <TrendingDown className="h-3.5 w-3.5" />,
    color: "text-orange-600",
  },
  bet_result: {
    label: "投注结算",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    color: "text-blue-600",
  },
  bet_delete: {
    label: "投注撤销",
    icon: <Trash2 className="h-3.5 w-3.5" />,
    color: "text-purple-600",
  },
  manual_adjust: {
    label: "手动调整",
    icon: <Settings className="h-3.5 w-3.5" />,
    color: "text-gray-600",
  },
  user_create: {
    label: "用户创建",
    icon: <UserPlus className="h-3.5 w-3.5" />,
    color: "text-green-600",
  },
};

export function BalanceHistory({ userId, users, refreshKey }: BalanceHistoryProps) {
  const [records, setRecords] = useState<BalanceChangeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const url = userId
        ? `/api/balance-history?userId=${userId}`
        : "/api/balance-history";
      const res = await fetch(url);
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setRecords(data);
    } catch {
      console.error("获取余额变更记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [userId, refreshKey]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d
      .getHours()
      .toString()
      .padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const displayRecords = userId
    ? records.filter((r) => r.userId === userId)
    : records;

  return (
    <div className="rounded-lg border bg-white">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-gray-900">余额变更记录</h3>
        </div>
        <button
          onClick={fetchRecords}
          className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
        >
          刷新
        </button>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">时间</TableHead>
              {!userId && <TableHead className="text-xs">用户</TableHead>}
              <TableHead className="text-xs">类型</TableHead>
              <TableHead className="text-xs text-right">变动</TableHead>
              <TableHead className="text-xs text-right">余额</TableHead>
              <TableHead className="text-xs">说明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={userId ? 5 : 6}
                  className="text-center py-8 text-gray-400"
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : displayRecords.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={userId ? 5 : 6}
                  className="text-center py-8 text-gray-400"
                >
                  暂无余额变更记录
                </TableCell>
              </TableRow>
            ) : (
              displayRecords.map((record) => {
                const typeInfo = typeConfig[record.type] || {
                  label: record.type,
                  icon: <Wallet className="h-3.5 w-3.5" />,
                  color: "text-gray-600",
                };
                const isPositive = record.changeAmount > 0;
                const isNegative = record.changeAmount < 0;
                return (
                  <TableRow key={record.id}>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(record.createdAt)}
                    </TableCell>
                    {!userId && (
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {userMap.get(record.userId) || "未知"}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={typeInfo.color}>{typeInfo.icon}</span>
                        <span className="text-xs font-medium">
                          {typeInfo.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {record.changeAmount !== 0 ? (
                        <span
                          className={`text-xs font-semibold ${
                            isPositive
                              ? "text-green-600"
                              : isNegative
                              ? "text-red-600"
                              : "text-gray-500"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          ¥{record.changeAmount.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="text-xs text-gray-700">
                        ¥{record.newBalance.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-xs truncate">
                      {record.reason || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : displayRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-400">暂无余额变更记录</div>
        ) : (
          displayRecords.map((record) => {
            const typeInfo = typeConfig[record.type] || {
              label: record.type,
              icon: <Wallet className="h-3.5 w-3.5" />,
              color: "text-gray-600",
            };
            const isPositive = record.changeAmount > 0;
            const isNegative = record.changeAmount < 0;
            return (
              <div
                key={record.id}
                className="border-b last:border-b-0 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={typeInfo.color}>{typeInfo.icon}</span>
                    <span className="text-xs font-medium">
                      {typeInfo.label}
                    </span>
                    {!userId && (
                      <span className="text-xs text-gray-500 ml-1">
                        · {userMap.get(record.userId) || "未知"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDate(record.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {record.reason || "—"}
                  </span>
                  <div className="text-right">
                    {record.changeAmount !== 0 ? (
                      <span
                        className={`text-sm font-semibold ${
                          isPositive
                            ? "text-green-600"
                            : isNegative
                            ? "text-red-600"
                            : "text-gray-500"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        ¥{record.changeAmount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-400 text-right">
                  余额: ¥{record.newBalance.toFixed(2)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
