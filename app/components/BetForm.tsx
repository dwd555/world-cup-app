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
import { Plus, Search, RefreshCw, Trophy, Clock, CheckCircle, TrendingUp, Camera, Loader2, ImageIcon, X, Wand2 } from "lucide-react";
import Tesseract from "tesseract.js";

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

export function BetForm({ onSuccess, users, currentUserId }: BetFormProps) {
  const [open, setOpen] = useState(false);
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

  // OCR 图片识别相关
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrParsed, setOcrParsed] = useState<{
    match?: string;
    betAmount?: number;
    winAmount?: number;
    odds?: number;
    betOption?: string;
  } | null>(null);
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // 反向索引（主客颠倒）
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
      // 静默失败，赔率只是参考
    }
  };

  const filteredMatches = matches.filter((m) => {
    // 过滤掉已结束的比赛
    if (m.finished) return false;
    const q = matchSearch.toLowerCase();
    if (!q) return true;
    return (
      m.homeTeam.toLowerCase().includes(q) ||
      m.awayTeam.toLowerCase().includes(q) ||
      m.displayName.toLowerCase().includes(q) ||
      (m.group && m.group.toLowerCase().includes(q))
    );
  });

  const handleSelectMatch = (m: Match) => {
    setSelectedMatch(m);
    setMatch(m.displayName);
    setMatchSearch(m.displayName);
    setBetOption(""); // 重置投注项
    setShowMatchDropdown(false);
    // 查找该比赛的赔率
    const o = oddsMap.get(`${m.homeTeamEn}__${m.awayTeamEn}`) ?? null;
    setMatchOdds(o);
  };

  // 点击赔率快填可赢金额
  const applyOddsToWinAmount = (oddsValue: number) => {
    const bet = parseFloat(betAmount);
    if (!isNaN(bet) && bet > 0) {
      // winAmount = bet * (odds - 1)
      const win = (bet * (oddsValue - 1)).toFixed(2);
      setWinAmount(win);
    } else {
      // 没填投注额，先设默认100
      setBetAmount("100");
      const win = (100 * (oddsValue - 1)).toFixed(2);
      setWinAmount(win);
    }
  };

  // ===================== OCR 图片识别 =====================

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setOcrImage(reader.result as string);
      setShowOcrPanel(true);
      runOCR(reader.result as string);
    };
    reader.readAsDataURL(file);
    // 清空 input 以便可重复选择同一文件
    e.target.value = "";
  };

  const runOCR = async (imageBase64: string) => {
    setOcrLoading(true);
    setOcrRawText("");
    setOcrParsed(null);
    try {
      const result = await Tesseract.recognize(
        imageBase64,
        "chi_sim+eng",
        {
          logger: (m: any) => {
            if (m.status === "recognizing text") {
              // 可选进度
            }
          },
        }
      );
      const text = result.data.text;
      setOcrRawText(text);
      const parsed = parseBetText(text);
      setOcrParsed(parsed);
      if (parsed) {
        toast.success("识别成功！请核对后点击应用");
      } else {
        toast.warning("未能提取完整投注信息，请手动填写");
      }
    } catch (err: any) {
      toast.error("图片识别失败: " + (err?.message || "未知错误"));
    } finally {
      setOcrLoading(false);
    }
  };

  // 解析 OCR 文本提取投注信息
  const parseBetText = (text: string) => {
    const result: { match?: string; betAmount?: number; winAmount?: number; odds?: number; betOption?: string } = {};

    // 1. 比赛名称：找 "VS" / "vs" / "对" 前后的队伍
    const matchPatterns = [
      /([\u4e00-\u9fa5]{2,10})\s*[VSvs]{2}\s*([\u4e00-\u9fa5]{2,10})/,
      /([\u4e00-\u9fa5]{2,10})\s*对\s*([\u4e00-\u9fa5]{2,10})/,
    ];
    for (const p of matchPatterns) {
      const m = text.match(p);
      if (m) {
        result.match = `${m[1]} VS ${m[2]}`;
        break;
      }
    }

    // 2. 投注额："投注额" / "投注金额" / "下注" 后面的数字
    const amountPatterns = [
      /投注额[\s:：]*([\d,]+\.?\d*)\s*[元￥]/i,
      /投注金额[\s:：]*([\d,]+\.?\d*)\s*[元￥]/i,
      /下注[\s:：]*([\d,]+\.?\d*)\s*[元￥]/i,
      /投注额[\s:：]*([\d,]+\.?\d*)/i,
      /([\d,]+\.?\d*)\s*元\s*.*?(?:投注|下注)/i,
    ];
    for (const p of amountPatterns) {
      const m = text.match(p);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ""));
        if (!isNaN(val) && val > 0) {
          result.betAmount = val;
          break;
        }
      }
    }

    // 3. 赔率："@数字" 或 "赔率" 后面的数字
    const oddsPatterns = [
      /@[\s:：]*([\d.]+)/,
      /赔率[\s:：]*([\d.]+)/i,
      /([\d.]+)\s*赔率/i,
    ];
    for (const p of oddsPatterns) {
      const m = text.match(p);
      if (m) {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && val > 1) {
          result.odds = val;
          break;
        }
      }
    }

    // 4. 可赢金额 / 结算金额："赢" / "结算" 后面的数字
    const winPatterns = [
      /赢[\s:：]*([\d,]+\.?\d*)\s*[元￥]/i,
      /结算[\s:：]*([\d,]+\.?\d*)\s*[元￥]/i,
      /赢[\s:：]*\+?([\d,]+\.?\d*)/i,
      /([\d,]+\.?\d*)\s*元\s*赢/i,
    ];
    for (const p of winPatterns) {
      const m = text.match(p);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ""));
        if (!isNaN(val) && val > 0) {
          result.winAmount = val;
          break;
        }
      }
    }

    // 5. 投注项：找 "全场独赢" / "让球" / "大小球" 等，以及队伍名
    const optionPatterns = [
      /全场独赢[\s:：]*([\u4e00-\u9fa5]{2,10})/i,
      /独赢[\s:：]*([\u4e00-\u9fa5]{2,10})/i,
      /让球[\s:：]*([\u4e00-\u9fa5]{2,10})/i,
      /大小球[\s:：]*([\u4e00-\u9fa5]{2,10})/i,
    ];
    for (const p of optionPatterns) {
      const m = text.match(p);
      if (m) {
        result.betOption = m[1];
        break;
      }
    }

    // 如果没有投注项，但有比赛和赔率，尝试从 "@赔率" 前面找队伍名
    if (!result.betOption && result.odds) {
      const oddsAtPattern = new RegExp(`([\\u4e00-\\u9fa5]{2,10})\\s*@\\s*${result.odds}`);
      const m = text.match(oddsAtPattern);
      if (m) {
        result.betOption = m[1];
      }
    }

    // 6. 如果既没有 winAmount 也没有 odds，但有 betAmount 和 odds，计算 winAmount
    if (!result.winAmount && result.odds && result.betAmount) {
      result.winAmount = parseFloat(((result.odds - 1) * result.betAmount).toFixed(2));
    }
    // 反过来，如果有 betAmount 和 winAmount，但没有 odds，计算 odds
    if (!result.odds && result.betAmount && result.winAmount && result.betAmount > 0) {
      result.odds = parseFloat(((result.betAmount + result.winAmount) / result.betAmount).toFixed(2));
    }

    return Object.keys(result).length > 0 ? result : null;
  };

  const applyOcrResult = () => {
    if (!ocrParsed) return;
    if (ocrParsed.match) {
      setMatch(ocrParsed.match);
      setMatchSearch(ocrParsed.match);
      // 尝试匹配赛程
      const q = ocrParsed.match.toLowerCase();
      const found = matches.find((m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.homeTeam.toLowerCase().includes(q) ||
        m.awayTeam.toLowerCase().includes(q)
      );
      if (found) {
        setSelectedMatch(found);
        const o = oddsMap.get(`${found.homeTeamEn}__${found.awayTeamEn}`) ?? null;
        setMatchOdds(o);
      } else {
        setSelectedMatch(null);
      }
    }
    if (ocrParsed.betAmount) setBetAmount(ocrParsed.betAmount.toString());
    if (ocrParsed.winAmount) setWinAmount(ocrParsed.winAmount.toString());
    if (ocrParsed.betOption) setBetOption(ocrParsed.betOption);
    setShowOcrPanel(false);
    toast.success("已自动填充识别结果");
  };

  const clearOcr = () => {
    setOcrImage(null);
    setOcrRawText("");
    setOcrParsed(null);
    setShowOcrPanel(false);
  };

  // ===================== /OCR 图片识别 =====================

  // 快选投注项（根据选定的比赛生成）
  const quickBetOptions = selectedMatch
    ? [
        `${selectedMatch.homeTeam} 胜`,
        "平局",
        `${selectedMatch.awayTeam} 胜`,
      ]
    : ["主队胜", "平局", "客队胜"];

  // 计算赔率（仅显示用）
  const computedOdds =
    betAmount && winAmount && parseFloat(betAmount) > 0
      ? ((parseFloat(betAmount) + parseFloat(winAmount)) / parseFloat(betAmount)).toFixed(2)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match.trim() || !betAmount || !winAmount || !userId) {
      toast.error("请填写所有字段");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match: match.trim(),
          matchId: selectedMatch?.id ?? null,
          betOption: betOption.trim() || null,
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
      setMatch("");
      setMatchSearch("");
      setSelectedMatch(null);
      setBetOption("");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          新增投注
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-w-[94vw] rounded-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>新增投注记录</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm"
            >
              <Camera className="h-3.5 w-3.5" />
              图片识别
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* OCR 图片识别面板 */}
          {showOcrPanel && (
            <div className="border border-indigo-200 rounded-lg bg-indigo-50/50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-700">
                  <Wand2 className="h-4 w-4" />
                  图片识别结果
                </div>
                <button type="button" onClick={clearOcr} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {ocrImage && (
                <div className="relative">
                  <img
                    src={ocrImage}
                    alt="投注单"
                    className="max-h-40 w-auto mx-auto rounded border border-indigo-200 object-contain"
                  />
                </div>
              )}

              {ocrLoading ? (
                <div className="flex items-center gap-2 text-sm text-indigo-600 py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在识别图片中的文字...
                </div>
              ) : ocrParsed ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {ocrParsed.match && (
                      <div className="bg-white rounded px-2.5 py-1.5 border border-indigo-100">
                        <span className="text-gray-400 text-xs">比赛</span>
                        <div className="font-medium text-gray-800 truncate">{ocrParsed.match}</div>
                      </div>
                    )}
                    {ocrParsed.betOption && (
                      <div className="bg-white rounded px-2.5 py-1.5 border border-indigo-100">
                        <span className="text-gray-400 text-xs">投注项</span>
                        <div className="font-medium text-gray-800 truncate">{ocrParsed.betOption}</div>
                      </div>
                    )}
                    {ocrParsed.betAmount !== undefined && (
                      <div className="bg-white rounded px-2.5 py-1.5 border border-indigo-100">
                        <span className="text-gray-400 text-xs">投注额</span>
                        <div className="font-medium text-gray-800">¥{ocrParsed.betAmount.toFixed(2)}</div>
                      </div>
                    )}
                    {ocrParsed.winAmount !== undefined && (
                      <div className="bg-white rounded px-2.5 py-1.5 border border-indigo-100">
                        <span className="text-gray-400 text-xs">可赢金额</span>
                        <div className="font-medium text-green-600">¥{ocrParsed.winAmount.toFixed(2)}</div>
                      </div>
                    )}
                    {ocrParsed.odds !== undefined && (
                      <div className="bg-white rounded px-2.5 py-1.5 border border-indigo-100">
                        <span className="text-gray-400 text-xs">赔率</span>
                        <div className="font-medium text-gray-800">{ocrParsed.odds.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={applyOcrResult}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    <ImageIcon className="h-4 w-4 mr-1.5" />
                    应用识别结果
                  </Button>
                </div>
              ) : ocrRawText ? (
                <div className="text-sm text-gray-500">
                  <p className="mb-1">未能提取完整信息，原始文字：</p>
                  <pre className="bg-white rounded border border-indigo-100 p-2 text-xs text-gray-400 whitespace-pre-wrap max-h-24 overflow-y-auto">{ocrRawText}</pre>
                </div>
              ) : null}
            </div>
          )}

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

          {/* 赛程选择器 */}
          <div className="space-y-2" ref={searchRef}>
            <div className="flex items-center justify-between">
              <Label>选择比赛</Label>
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
                    filteredMatches.map((m) => (
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

          {/* 投注项 */}
          <div className="space-y-2">
            <Label>
              投注项
              <span className="ml-1 text-gray-400 font-normal text-xs">（选择或自定义）</span>
            </Label>
            {/* 快选按钮 */}
            <div className="flex flex-wrap gap-2">
              {quickBetOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setBetOption(opt)}
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
            {/* 自定义输入 */}
            <Input
              placeholder="或输入自定义投注项，如：让球主胜、大球..."
              value={betOption}
              onChange={(e) => setBetOption(e.target.value)}
            />
          </div>

          {/* 实时赔率参考（仅在选中比赛且有赔率数据时显示） */}
          {selectedMatch && matchOdds && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-sm font-medium text-gray-700">实时赔率参考</span>
                <span className="text-xs text-gray-400">({matchOdds.bookmaker} · 点击自动填入可赢金额)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: `${selectedMatch.homeTeam} 胜`, value: matchOdds.home, option: `${selectedMatch.homeTeam} 胜` },
                  { label: "平局", value: matchOdds.draw, option: "平局" },
                  { label: `${selectedMatch.awayTeam} 胜`, value: matchOdds.away, option: `${selectedMatch.awayTeam} 胜` },
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
