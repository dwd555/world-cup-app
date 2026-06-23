"use client";

import { useState, useEffect } from "react";
import { BetForm } from "./components/BetForm";
import { BetList } from "./components/BetList";
import { StatsCard } from "./components/StatsCard";
import { UserSelector } from "./components/UserSelector";
import { UserStatsSummary } from "./components/UserStatsSummary";
import { MatchCenter } from "./components/MatchCenter";
import { Button } from "@/components/ui/button";
import { Trophy, BookOpen } from "lucide-react";

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

interface User {
  id: number;
  name: string;
  balance: number;
}

type PageTab = "bets" | "matches";

export default function Home() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [allBets, setAllBets] = useState<Bet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [pageTab, setPageTab] = useState<PageTab>("bets");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
      if (data.length > 0 && currentUserId === null) {
        setCurrentUserId(data[0].id);
      }
    } catch {
      console.error("获取用户列表失败");
    }
  };

  const fetchBets = async () => {
    try {
      const url = currentUserId ? `/api/bets?userId=${currentUserId}` : "/api/bets";
      const res = await fetch(url);
      const data = await res.json();
      setBets(data);
    } catch {
      console.error("获取投注记录失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBets = async () => {
    try {
      const res = await fetch("/api/bets");
      const data = await res.json();
      setAllBets(data);
    } catch {
      console.error("获取全部投注记录失败");
    }
  };

  const refreshAll = async () => {
    await fetchBets();
    await fetchAllBets();
    await fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchBets();
    fetchAllBets();
  }, [currentUserId]);

  const filterButtons = [
    { key: "all", label: "全部" },
    { key: "pending", label: "待定" },
    { key: "win", label: "已赢" },
    { key: "loss", label: "已输" },
  ];

  const currentUser = users.find((u) => u.id === currentUserId);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              ⚽ 足球投注记录
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">2026 世界杯投注追踪</p>
          </div>
          {pageTab === "bets" && (
            <div className="flex items-center gap-3">
              <UserSelector
                users={users}
                currentUserId={currentUserId}
                onUserChange={setCurrentUserId}
                onUsersChange={fetchUsers}
              />
              <div className="hidden sm:block">
                <BetForm onSuccess={refreshAll} users={users} currentUserId={currentUserId} />
              </div>
            </div>
          )}
        </div>

        {/* 顶部 Tab 切换 */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-5 shadow-sm">
          <button
            onClick={() => setPageTab("bets")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              pageTab === "bets"
                ? "bg-blue-600 text-white shadow"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            我的投注
          </button>
          <button
            onClick={() => setPageTab("matches")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              pageTab === "matches"
                ? "bg-blue-600 text-white shadow"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Trophy className="h-4 w-4" />
            赛事中心
          </button>
        </div>

        {/* 投注记录 Tab */}
        {pageTab === "bets" && (
          <>
            {/* Mobile-only add button */}
            <div className="sm:hidden mb-4">
              <BetForm onSuccess={refreshAll} users={users} currentUserId={currentUserId} />
            </div>

            {/* Stats */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500">
                  当前视图:{" "}
                  <span className="font-medium text-gray-900">
                    {currentUser?.name || "全部用户"}
                  </span>
                </div>
                {currentUserId && (
                  <div className="text-sm font-medium text-blue-600">
                    可用余额: ¥{currentUser?.balance.toFixed(2) ?? "0.00"}
                  </div>
                )}
              </div>
              <StatsCard bets={bets} />
              {currentUserId === null && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">各用户汇总</div>
                  <UserStatsSummary bets={allBets} users={users} />
                </div>
              )}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 mb-4">
              {filterButtons.map((btn) => (
                <Button
                  key={btn.key}
                  variant={filter === btn.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(btn.key)}
                  className="text-xs sm:text-sm"
                >
                  {btn.label}
                </Button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">加载中...</div>
            ) : (
              <BetList bets={bets} users={users} onRefresh={refreshAll} filter={filter} />
            )}
          </>
        )}

        {/* 赛事中心 Tab */}
        {pageTab === "matches" && <MatchCenter />}
      </div>
    </div>
  );
}
