"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, RefreshCw, Trophy, Clock, CheckCircle, TrendingUp, X } from "lucide-react";

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamEn: string;
  awayTeamEn: string;
  homeScore: string | null;
  awayScore: string | null;
  date: string;
  group: string | null;
  type: string;
  finished: boolean;
  timeElapsed: string;
  displayName: string;
}

interface OddsEntry {
  matchKey: string;
  homeTeamEn: string;
  awayTeamEn: string;
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmaker: string;
}

interface BetFormProps {
  onSuccess: () => void;
  users: { id: number; name: string; balance: number }[];
  currentUserId: number | null;
}

type BetType = "single" | "parlay" | "handicap" | "overunder" | "htft" | "score" | "custom";

interface ParlayLeg {
  match: Match;
  selection: string;
}

const BET_TYPE_OPTIONS: { value: BetType; label: string }[] = [
  { value: "single", label: "独赢" },
  { value: "parlay", label: "串关" },
  { value: "handicap", label: "让球" },
  { value: "overunder", label: "大小球" },
  { value: "htft", label: "半全场" },
  { value: "score", label: "波胆" },
  { value: "custom", label: "自定义" },
];

function getParlayTypeOptions(count: number): string[] {
  if (count < 2) return [];
  if (count === 2) return ["2串1"];
  if (count === 3) return ["3串1", "3串3", "3串4"];
  if (count === 4) return ["4串1", "4串4", "4串5", "4串6", "4串11"];
  if (count === 5) return ["5串1", "5串10", "5串31"];
  if (count === 6) return ["6串1", "6串63"];
  if (count === 7) return ["7串1"];
  if (count === 8) return ["8串1"];
  return [`${count}串1`];
}

const COMMON_SCORES = [
  "1:0", "2:0", "2:1", "3:0", "3:1", "3:2",
  "0:0", "1:1", "2:2", "0:1", "0:2", "1:2",
  "0:3", "1:3", "2:3", "4:0", "4:1", "其他",
];

export function BetForm({ onSuccess, users, currentUserId }: BetFormProps) {
  const [open, setOpen] = useState(false);
  const [betType, setBetType] = useState<BetType>("single");
  const [match, setMatch] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [betOption, setBetOption] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [winAmount, setWinAmount] = useState("");
  const [userId, setUserId] = useState(currentUserId?.toString() ?? "");
  const [loading, setLoading] = useState(false);

  // 赛程相关
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");
  const [showMatchDropdown, setShowMatchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 赔率相关
  const [oddsMap, setOddsMap] = useState<Map<string, OddsEntry>>(new Map());
  const [matchOdds, setMatchOdds] = useState<OddsEntry | null>(null);

  // 串关相关
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([]);
  const [parlayType, setParlayType] = useState("2串1");

  // 当弹窗打开时拉取赛程和赔率
  useEffect(() => {
    if (open) {
      fetchMatches();
      fetchOdds();
    }
  }, [open]);

  // 同步 currentUserId 变化
  useEffect(() => {
    if (currentUserId) setUserId(currentUserId.toString());
  }, [currentUserId]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowMatchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchMatches = async () => {
    setMatchesLoading(true);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setMatches(data);
    } catch {
      toast.error("获取赛程失败，请手动输入比赛名称");
    } finally {
      setMatchesLoading(false);
    }
  };

  const fetchOdds = async () => {
    try {
      const res = await fetch("/api/odds");
      if (!res.ok) return;
      const data: OddsEntry[] = await res.json();
      const map = new Map<string, OddsEntry>();
      for (const o of data) {
        map.set(`${o.homeTeamEn}__${o.awayTeamEn}`, o);
        map.set(`${o.awayTeamEn}__${o.homeTeamEn}`, {
          ...o,
          homeTeamEn: o.awayTeamEn,
          awayTeamEn: o.homeTeamEn,
          home: o.away,
          away: o.home,
        });
      }
      setOddsMap(map);
    } catch {
      // 静默失败
    }
  };

  const filteredMatches = matches.filter((m) => {
    if (m.finished) return false;
    if (betType === "parlay" && parlayLegs.some((l) => l.match.id === m.id)) return false;
    const q = matchSearch.toLowerCase();
    if (!q) return true;
    return (
      m.homeTeam.toLowerCase().includes(q) ||
      m.awayTeam.toLowerCase().includes(q) ||
      m.displayName.toLowerCase().includes(q) ||
      (m.group && m.group.toLowerCase().includes(q))
    );
  });

  // 单场模式：选择比赛
  const handleSelectMatch = (m: Match) => {
    setSelectedMatch(m);
    setMatch(m.displayName);
    setMatchSearch(m.displayName);
    setBetOption("");
    setShowMatchDropdown(false);
    const o = oddsMap.get(`${m.homeTeamEn}__${m.awayTeamEn}`) ?? null;
    setMatchOdds(o);
  };

  // 串关模式：添加比赛到串关列表
  const handleAddParlayLeg = (m: Match) => {
    setParlayLegs([...parlayLegs, { match: m, selection: "" }]);
    setMatchSearch("");
    setShowMatchDropdown(false);
    const newCount = parlayLegs.length + 1;
    const options = getParlayTypeOptions(newCount);
    if (options.length > 0 && !options.includes(parlayType)) {
      setParlayType(options[0]);
    }
  };

  const handleParlayLegSelection = (index: number, selection: string) => {
    const newLegs = [...parlayLegs];
    newLegs[index].selection = newLegs[index].selection === selection ? "" : selection;
    setParlayLegs(newLegs);
  };

  const handleRemoveParlayLeg = (index: number) => {
    const newLegs = parlayLegs.filter((_, i) => i !== index);
    setParlayLegs(newLegs);
    const options = getParlayTypeOptions(newLegs.length);
    if (options.length > 0 && !options.includes(parlayType)) {
      setParlayType(options[0]);
    }
  };

  const applyOddsToWinAmount = (oddsValue: number) => {
    const bet = parseFloat(betAmount);
    if (!isNaN(bet) && bet > 0) {
      const win = (bet * (oddsValue - 1)).toFixed(2);
      setWinAmount(win);
    } else {
      setBetAmount("100");
      const win = (100 * (oddsValue - 1)).toFixed(2);
      setWinAmount(win);
    }
  };

  // 快选投注项
  const getQuickBetOptions = (): string[] => {
    switch (betType) {
      case "handicap":
        return selectedMatch
          ? [
              `${selectedMatch.homeTeam} -0.5`,
              `${selectedMatch.homeTeam} -1`,
              `${selectedMatch.homeTeam} -1.5`,
              `${selectedMatch.awayTeam} -0.5`,
              `${selectedMatch.awayTeam} -1`,
              `${selectedMatch.awayTeam} -1.5`,
            ]
          : ["主让半球", "主让一球", "主让1.5", "客让半球", "客让一球", "客让1.5"];
      case "overunder":
        return ["大0.5/1", "大1.5", "大2", "大2.5", "大3", "小2", "小2.5", "小3"];
      case "htft":
        return selectedMatch
          ? [
              `半${selectedMatch.homeTeam}/全${selectedMatch.homeTeam}`,
              `半平/全${selectedMatch.homeTeam}`,
              `半${selectedMatch.awayTeam}/全${selectedMatch.homeTeam}`,
              `半${selectedMatch.homeTeam}/全平`,
              `半平/全平`,
              `半${selectedMatch.awayTeam}/全平`,
              `半${selectedMatch.homeTeam}/全${selectedMatch.awayTeam}`,
              `半平/全${selectedMatch.awayTeam}`,
              `半${selectedMatch.awayTeam}/全${selectedMatch.awayTeam}`,
            ]
          : [
              "半主/全主", "半平/全主", "半客/全主",
              "半主/全平", "半平/全平", "半客/全平",
              "半主/全客", "半平/全客", "半客/全客",
            ];
      case "score":
        return COMMON_SCORES;
      case "single":
      default:
        return selectedMatch
          ? [`${selectedMatch.homeTeam} 胜`, "平局", `${selectedMatch.awayTeam} 胜`]
          : ["主队胜", "平局", "客队胜"];
    }
  };

  const quickBetOptions = betType === "custom" ? [] : getQuickBetOptions();

  // 串关信息
  const parlayMatchString = parlayLegs.map((l) => l.match.displayName).join(" | ");
  const parlayBetOption =
    parlayLegs.length >= 2
      ? `${parlayType}: ` +
        parlayLegs
          .map((l) => {
            const home = l.match.homeTeam;
            const away = l.match.awayTeam;
            if (l.selection === "主胜") return `${home}胜`;
            if (l.selection === "平") return `${home}vs${away}平`;
            if (l.selection === "客胜") return `${away}胜`;
            return "?";
          })
          .join(" + ")
      : "";
  const parlayReady = parlayLegs.length >= 2 && parlayLegs.every((l) => l.selection !== "");
  const parlayTypeOptions = getParlayTypeOptions(parlayLegs.length);

  const computedOdds =
    betAmount && winAmount && parseFloat(betAmount) > 0
      ? ((parseFloat(betAmount) + parseFloat(winAmount)) / parseFloat(betAmount)).toFixed(2)
      : null;

  const effectiveMatch = betType === "parlay" ? parlayMatchString : match.trim();
  const effectiveBetOption = betType === "parlay" ? parlayBetOption : (betOption.trim() || null);
  const effectiveMatchId = betType === "parlay" ? null : (selectedMatch?.id ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (betType === "parlay") {
      if (!parlayReady) {
        toast.error("串关需要至少2场比赛且每场都需选择结果");
        return;
      }
    }

    // 自定义模式不要求填写比赛名称
    const needMatch = betType !== "custom";
    if ((needMatch && !effectiveMatch) || !betAmount || !winAmount || !userId) {
      toast.error("请填写所有字段");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match: effectiveMatch,
          matchId: effectiveMatchId,
          betOption: effectiveBetOption,
          betAmount: parseFloat(betAmount),
          winAmount: parseFloat(winAmount),
          userId: parseInt(userId),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "创建失败" }));
        toast.error(err.error || "创建失败");
        return;
      }

      toast.success("投注记录已添加");
      setBetType("single");
      setMatch("");
      setMatchSearch("");
      setSelectedMatch(null);
      setBetOption("");
      setMatchOdds(null);
      setParlayLegs([]);
      setParlayType("2串1");
      setBetAmount("");
      setWinAmount("");
      setOpen(false);
      onSuccess();
    } catch {
      toast.error("添加投注记录失败");
    } finally {
      setLoading(false);
    }
  };

  const getMatchStatusIcon = (m: Match) => {
    if (m.finished) return <CheckCircle className="h-3 w-3 text-gray-400 flex-shrink-0" />;
    if (m.timeElapsed !== "notstarted") return <Trophy className="h-3 w-3 text-green-500 flex-shrink-0 animate-pulse" />;
    return <Clock className="h-3 w-3 text-blue-400 flex-shrink-0" />;
  };

  const getMatchScore = (m: Match) => {
    if (m.homeScore !== null && m.awayScore !== null) {
      return (
        <span className={`text-xs font-bold ml-1 ${m.finished ? "text-gray-500" : "text-green-600"}`}>
          {m.homeScore}:{m.awayScore}
        </span>
      );
    }
    return null;
  };

  const isSingleMode = betType !== "parlay" && betType !== "custom";
  const showOddsRef = betType === "single" && selectedMatch && matchOdds;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          新增投注
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-w-[94vw] rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增投注记录</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* 投注类型选择器 */}
          <div className="space-y-2">
            <Label>投注类型</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {BET_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setBetType(opt.value);
                    setMatch("");
                    setMatchSearch("");
                    setSelectedMatch(null);
                    setBetOption("");
                    setMatchOdds(null);
                    if (opt.value !== "parlay") {
                      setParlayLegs([]);
                    }
                    setShowMatchDropdown(false);
                  }}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    betType === opt.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 用户选择 */}
          <div className="space-y-2">
            <Label htmlFor="user">用户</Label>
            <select
              id="user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm"
              required
            >
              <option value="" disabled>选择用户</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (余额 ¥{u.balance.toFixed(0)})
                </option>
              ))}
            </select>
          </div>

          {/* ===== 串关模式 ===== */}
          {betType === "parlay" && (
            <>
              {/* 搜索比赛添加到串关 */}
              <div className="space-y-2" ref={searchRef}>
                <Label>添加比赛到串关</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    placeholder={matchesLoading ? "加载赛程中..." : "搜索队伍添加到串关..."}
                    value={matchSearch}
                    onChange={(e) => {
                      setMatchSearch(e.target.value);
                      setShowMatchDropdown(true);
                    }}
                    onFocus={() => setShowMatchDropdown(true)}
                    className="pl-8"
                  />
                  {showMatchDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {matchesLoading ? (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">加载中...</div>
                      ) : filteredMatches.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-400 text-center">未找到比赛</div>
                      ) : (
                        filteredMatches.slice(0, 20).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onMouseDown={() => handleAddParlayLeg(m)}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b last:border-b-0"
                          >
                            <div className="flex items-center gap-1.5">
                              {getMatchStatusIcon(m)}
                              <span className="text-sm font-medium text-gray-900 flex-1">
                                {m.homeTeam} vs {m.awayTeam}
                              </span>
                              {getMatchScore(m)}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 pl-4">
                              {m.group ? `${m.group}组` : ""}{m.type !== "group" ? ` · ${m.type.toUpperCase()}` : ""} · {m.date ? `${m.date}` : ""}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 串关比赛列表 */}
              {parlayLegs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>串关比赛 ({parlayLegs.length}场)</Label>
                    <span className="text-xs text-gray-400">点击选择结果</span>
                  </div>
                  <div className="space-y-2">
                    {parlayLegs.map((leg, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                            {leg.match.homeTeam} vs {leg.match.awayTeam}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveParlayLeg(index)}
                            className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: `${leg.match.homeTeam}胜`, value: "主胜" },
                            { label: "平局", value: "平" },
                            { label: `${leg.match.awayTeam}胜`, value: "客胜" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleParlayLegSelection(index, opt.value)}
                              className={`px-2 py-1.5 rounded text-xs font-medium border transition-colors truncate ${
                                leg.selection === opt.value
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 串关类型选择 */}
              {parlayLegs.length >= 2 && (
                <div className="space-y-2">
                  <Label>串关方式</Label>
                  <div className="flex flex-wrap gap-2">
                    {parlayTypeOptions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setParlayType(t)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          parlayType === t
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {/* 串关预览 */}
                  {parlayReady && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 space-y-1">
                      <div className="text-xs text-purple-700 font-medium">投注预览</div>
                      <div className="text-xs text-gray-600 break-all">{parlayBetOption}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===== 单场模式：赛程选择器 ===== */}
          {betType !== "parlay" && (
            <div className="space-y-2" ref={searchRef}>
              <div className="flex items-center justify-between">
                <Label>
                  选择比赛
                  {betType === "custom" && (
                    <span className="ml-1 text-gray-400 font-normal text-xs">（选填）</span>
                  )}
                </Label>
                <button
                  type="button"
                  onClick={fetchMatches}
                  className="text-xs text-blue-500 flex items-center gap-1 hover:text-blue-700"
                  disabled={matchesLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${matchesLoading ? "animate-spin" : ""}`} />
                  刷新赛程
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  placeholder={matchesLoading ? "加载赛程中..." : "搜索队伍或直接输入比赛名称..."}
                  value={matchSearch}
                  onChange={(e) => {
                    setMatchSearch(e.target.value);
                    setMatch(e.target.value);
                    setSelectedMatch(null);
                    setBetOption("");
                    setShowMatchDropdown(true);
                  }}
                  onFocus={() => setShowMatchDropdown(true)}
                  className="pl-8"
                />
                {showMatchDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                    {matchesLoading ? (
                      <div className="px-3 py-4 text-sm text-gray-400 text-center">加载中...</div>
                    ) : filteredMatches.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-400 text-center">未找到比赛</div>
                    ) : (
                      filteredMatches.slice(0, 20).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onMouseDown={() => handleSelectMatch(m)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b last:border-b-0 ${
                            selectedMatch?.id === m.id ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {getMatchStatusIcon(m)}
                            <span className="text-sm font-medium text-gray-900 flex-1">
                              {m.homeTeam} vs {m.awayTeam}
                            </span>
                            {getMatchScore(m)}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 pl-4">
                            {m.group ? `${m.group}组` : ""}{m.type !== "group" ? ` · ${m.type.toUpperCase()}` : ""} · {m.date ? `${m.date} 北京时间` : ""}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedMatch && (
                <div className="text-xs text-green-600">✓ 已选择：{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</div>
              )}
            </div>
          )}

          {/* 投注项（非串关模式） */}
          {betType !== "parlay" && (
            <div className="space-y-2">
              <Label>
                投注项
                <span className="ml-1 text-gray-400 font-normal text-xs">（选择或自定义）</span>
              </Label>
              {quickBetOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quickBetOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        if (opt === "其他") {
                          setBetOption("");
                          return;
                        }
                        setBetOption(opt);
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        betOption === opt
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              <Input
                placeholder="或输入自定义投注项，如：让球主胜、大球..."
                value={betOption}
                onChange={(e) => setBetOption(e.target.value)}
              />
            </div>
          )}

          {/* 实时赔率参考（仅独赢模式） */}
          {showOddsRef && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-sm font-medium text-gray-700">实时赔率参考</span>
                <span className="text-xs text-gray-400">({matchOdds.bookmaker} · 点击自动填入可赢金额)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: `${selectedMatch!.homeTeam} 胜`, value: matchOdds.home, option: `${selectedMatch!.homeTeam} 胜` },
                  { label: "平局", value: matchOdds.draw, option: "平局" },
                  { label: `${selectedMatch!.awayTeam} 胜`, value: matchOdds.away, option: `${selectedMatch!.awayTeam} 胜` },
                ].map(({ label, value, option }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={value === null}
                    onClick={() => {
                      if (value !== null) {
                        setBetOption(option);
                        applyOddsToWinAmount(value);
                      }
                    }}
                    className={`flex flex-col items-center py-2 px-1 rounded-lg border transition-all ${
                      value === null
                        ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                        : betOption === option
                        ? "border-green-400 bg-green-50 ring-1 ring-green-300"
                        : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 cursor-pointer"
                    }`}
                  >
                    <span className="text-[10px] text-gray-500 mb-0.5 truncate w-full text-center leading-tight">{label}</span>
                    <span className="text-base font-bold text-green-700 tabular-nums">
                      {value !== null ? value.toFixed(2) : "-"}
                    </span>
                    {value !== null && (
                      <span className="text-[9px] text-gray-400 mt-0.5">点击应用</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 投注金额 */}
          <div className="space-y-2">
            <Label htmlFor="betAmount">投注金额</Label>
            <Input
              id="betAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="如：100"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              required
            />
          </div>

          {/* 可赢金额 */}
          <div className="space-y-2">
            <Label htmlFor="winAmount">可赢金额</Label>
            <Input
              id="winAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="如：150（赢了能拿到的净利润）"
              value={winAmount}
              onChange={(e) => setWinAmount(e.target.value)}
              required
            />
            {computedOdds && (
              <p className="text-xs text-gray-500">
                对应赔率：{computedOdds}  ·  赢了到手：¥{betAmount} + ¥{winAmount} = ¥{(parseFloat(betAmount) + parseFloat(winAmount)).toFixed(2)}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "提交中..." : "确认添加"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
