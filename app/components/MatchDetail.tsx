"use client";

import { useState, useEffect, useCallback } from "react";
import { X, RefreshCw } from "lucide-react";

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamEn: string;
  awayTeamEn: string;
  homeScore: string | null;
  awayScore: string | null;
  homeScorers: string[];
  awayScorers: string[];
  date: string;
  group: string | null;
  matchday: string | null;
  type: string;
  finished: boolean;
  inProgress: boolean;
  timeElapsed: string;
  displayName: string;
}

interface StatItem {
  label: string;
  key: string;
  value: [number, number] | null;
  unit?: string;
}

interface MatchEvent {
  id: number;
  player: { id: number; name: string } | null;
  time: number;
  event: string;
  sort: number;
  info: { id: number; name: string } | null;
  is_home: boolean;
  is_away: boolean;
  label: string;
}

interface DetailData {
  noApiKey: boolean;
  stats: StatItem[] | null;
  events: MatchEvent[];
  isLive?: boolean;
  error?: boolean;
}

const typeLabel: Record<string, string> = {
  group: "小组赛",
  r32: "32强", r16: "16强",
  qf: "四分之一决赛", sf: "半决赛",
  third: "三四名决赛", final: "决赛",
};

const eventIcon: Record<string, string> = {
  GOAL: "⚽",
  GOAL_PENALTY: "⚽",
  YELLOW_CARD: "🟨",
  RED_CARD: "🟥",
  YELLOW_RED_CARD: "🟧",
  SUBSTITUTION: "🔄",
  VAR: "📺",
};

const eventLabel: Record<string, string> = {
  GOAL: "进球",
  GOAL_PENALTY: "点球进球",
  YELLOW_CARD: "黄牌",
  RED_CARD: "红牌",
  YELLOW_RED_CARD: "第二黄牌",
  SUBSTITUTION: "换人",
  VAR: "VAR 裁定",
};

// 统计条形图
function StatBar({
  stat,
  homeTeam,
  awayTeam,
}: {
  stat: StatItem;
  homeTeam: string;
  awayTeam: string;
}) {
  if (!stat.value) return null;
  const [home, away] = stat.value;
  const total = home + away;

  // 控球率：直接用百分比
  const isPercent = stat.unit === "%";
  const homeWidth = isPercent
    ? home
    : total === 0 ? 50 : Math.round((home / total) * 100);
  const awayWidth = isPercent ? away : 100 - homeWidth;

  const homeLabel = isPercent ? `${home}%` : String(home);
  const awayLabel = isPercent ? `${away}%` : String(away);

  // 高亮：数字更大的一方（控球率也是）
  const homeLeads = home > away;
  const awayLeads = away > home;

  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      {/* 数值行 */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-sm font-bold tabular-nums min-w-[32px] text-right
            ${homeLeads ? "text-blue-600" : "text-gray-500"}`}
        >
          {homeLabel}
        </span>
        <span className="text-xs text-gray-400 flex-1 text-center px-2">{stat.label}</span>
        <span
          className={`text-sm font-bold tabular-nums min-w-[32px] text-left
            ${awayLeads ? "text-orange-500" : "text-gray-500"}`}
        >
          {awayLabel}
        </span>
      </div>

      {/* 进度条 */}
      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
        <div
          className={`h-full transition-all duration-500 ${homeLeads ? "bg-blue-500" : "bg-blue-300"}`}
          style={{ width: `${homeWidth}%` }}
        />
        <div
          className={`h-full transition-all duration-500 ${awayLeads ? "bg-orange-400" : "bg-orange-200"}`}
          style={{ width: `${awayWidth}%` }}
        />
      </div>
    </div>
  );
}

// 事件时间线
function EventTimeline({
  events,
  homeTeam,
  awayTeam,
}: {
  events: MatchEvent[];
  homeTeam: string;
  awayTeam: string;
}) {
  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">暂无比赛事件记录</div>
    );
  }

  const sorted = [...events].sort((a, b) => a.time - b.time);

  return (
    <div className="space-y-1">
      {sorted.map((ev) => {
        const icon = eventIcon[ev.event] || "📌";
        const label = eventLabel[ev.event] || ev.label;
        const isHome = ev.is_home;
        const isAway = ev.is_away;

        return (
          <div key={ev.id} className={`flex items-center gap-2 py-1.5 ${isHome ? "flex-row" : "flex-row-reverse"}`}>
            {/* 队名侧 */}
            <div className={`flex-1 ${isHome ? "text-left" : "text-right"}`}>
              <span className="text-xs text-gray-500">
                {isHome ? homeTeam : isAway ? awayTeam : ""}
              </span>
              <div className={`text-sm font-medium text-gray-800 ${isHome ? "" : "text-right"}`}>
                {ev.player?.name || ""}
                {ev.event === "SUBSTITUTION" && ev.info && (
                  <span className="text-xs text-gray-400 ml-1">← {ev.info.name}</span>
                )}
              </div>
              <div className={`text-xs ${ev.event.includes("GOAL") ? "text-green-600 font-semibold" : ev.event.includes("RED") ? "text-red-500" : ev.event.includes("YELLOW") ? "text-yellow-600" : "text-gray-400"}`}>
                {label}
              </div>
            </div>

            {/* 时间 + 图标 中心轴 */}
            <div className="flex flex-col items-center flex-shrink-0 w-12">
              <div className="text-lg leading-none">{icon}</div>
              <div className="text-xs font-bold text-gray-500 tabular-nums">{ev.time}&apos;</div>
            </div>

            {/* 另一侧占位 */}
            <div className="flex-1" />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 主组件：比赛详情抽屉
// ─────────────────────────────────────────────────────────────
export function MatchDetail({
  match,
  onClose,
}: {
  match: Match;
  onClose: () => void;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "events">("stats");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (match.homeTeamEn) params.set("home", match.homeTeamEn);
      if (match.awayTeamEn) params.set("away", match.awayTeamEn);
      const qs = params.toString();
      const res = await fetch(`/api/match-detail/${match.id}${qs ? "?" + qs : ""}`);
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      setData(json);
    } catch {
      setData({ noApiKey: false, stats: null, events: [], error: true });
    } finally {
      setLoading(false);
    }
  }, [match.id, match.homeTeamEn, match.awayTeamEn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 自动刷新（进行中的比赛每60秒）
  useEffect(() => {
    if (!match.inProgress) return;
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [match.inProgress, fetchData]);

  const stageLabel =
    match.type === "group" && match.group && match.matchday
      ? `${match.group}组 第${match.matchday}轮`
      : typeLabel[match.type] || match.type;

  const hs = match.homeScore !== null ? parseInt(match.homeScore) : null;
  const as_ = match.awayScore !== null ? parseInt(match.awayScore) : null;
  const homeWins = hs !== null && as_ !== null && hs > as_;
  const awayWins = hs !== null && as_ !== null && as_ > hs;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗主体 */}
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 顶部区域：队名 + 比分 */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-700 px-4 pt-5 pb-4 flex-shrink-0">
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* 阶段 + 状态 */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-white/60 text-xs">{stageLabel}</span>
            {match.inProgress && (
              <span className="flex items-center gap-1 bg-green-500/20 border border-green-400/40 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-xs">进行中</span>
              </span>
            )}
            {match.finished && (
              <span className="text-white/40 text-xs bg-white/10 rounded-full px-2 py-0.5">已结束</span>
            )}
            {!match.finished && !match.inProgress && (
              <span className="text-white/40 text-xs bg-white/10 rounded-full px-2 py-0.5">
                {match.date} 北京时间
              </span>
            )}
          </div>

          {/* 比分区 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center">
              <div className={`text-base font-bold leading-tight
                ${homeWins ? "text-white" : "text-white/70"}`}>
                {match.homeTeam}
              </div>
              {match.homeScorers.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {match.homeScorers.map((s, i) => (
                    <div key={i} className="text-green-300 text-xs">⚽ {s}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 text-center min-w-[80px]">
              {match.homeScore !== null && match.awayScore !== null ? (
                <div className="flex items-center justify-center gap-1">
                  <span className={`text-3xl font-black tabular-nums
                    ${homeWins ? "text-white" : "text-white/60"}`}>
                    {match.homeScore}
                  </span>
                  <span className="text-white/40 text-xl">:</span>
                  <span className={`text-3xl font-black tabular-nums
                    ${awayWins ? "text-white" : "text-white/60"}`}>
                    {match.awayScore}
                  </span>
                </div>
              ) : (
                <div className="text-white/40 text-2xl font-bold">VS</div>
              )}
              {match.inProgress && (
                <div className="text-green-400 text-xs text-center mt-1 animate-pulse">
                  直播
                </div>
              )}
            </div>

            <div className="flex-1 text-center">
              <div className={`text-base font-bold leading-tight
                ${awayWins ? "text-white" : "text-white/70"}`}>
                {match.awayTeam}
              </div>
              {match.awayScorers.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {match.awayScorers.map((s, i) => (
                    <div key={i} className="text-green-300 text-xs">⚽ {s}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 未开赛时显示时间 */}
          {!match.finished && !match.inProgress && match.date && (
            <div className="text-center mt-3 text-white/50 text-xs">
              📅 {match.date} 北京时间开球
            </div>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={() => setTab("stats")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === "stats"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            📊 技术统计
          </button>
          <button
            onClick={() => setTab("events")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === "events"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            ⚡ 比赛事件
          </button>
        </div>

        {/* 内容区（可滚动） */}
        <div className="overflow-y-auto flex-1 px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : data?.noApiKey ? (
            <div className="py-8">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-amber-800 mb-1">需要配置 API Key</div>
                    <div className="text-amber-700 space-y-1.5">
                      <p>获取比赛技术统计（控球率、角球、射门等）需要配置 worldcupapi.com 的 API Key。</p>
                      <p className="font-medium">配置步骤：</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>访问 <a href="https://worldcupapi.com" target="_blank" rel="noopener noreferrer" className="underline text-amber-600">worldcupapi.com</a> 免费注册</li>
                        <li>在仪表盘获取 API Key</li>
                        <li>在项目根目录创建 <code className="bg-amber-100 px-1 rounded">.env.local</code> 文件</li>
                        <li>添加：<code className="bg-amber-100 px-1 rounded">WORLDCUPAPI_KEY=你的密钥</code></li>
                        <li>重启开发服务器</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* 无API Key时至少显示进球信息 */}
              {(match.homeScorers.length > 0 || match.awayScorers.length > 0) && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">进球信息</div>
                  <div className="space-y-1">
                    {match.homeScorers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <span>⚽</span>
                        <span className="text-blue-600 text-xs font-medium">{match.homeTeam}</span>
                        <span>{s}</span>
                      </div>
                    ))}
                    {match.awayScorers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700 justify-end">
                        <span>{s}</span>
                        <span className="text-orange-500 text-xs font-medium">{match.awayTeam}</span>
                        <span>⚽</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : data?.error ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-2xl mb-2">⚠️</div>
              <div className="text-sm">数据加载失败，请稍后重试</div>
              <button
                onClick={fetchData}
                className="mt-3 text-blue-500 text-sm hover:underline"
              >
                重新加载
              </button>
            </div>
          ) : (
            <>
              {tab === "stats" && (
                <div>
                  {!data?.stats || data.stats.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-2xl mb-2">📊</div>
                      <div className="text-sm">
                        {match.finished || match.inProgress
                          ? "暂无技术统计数据"
                          : "比赛开始后将显示实时统计"}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* 队名表头 */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                        <span className="text-sm font-bold text-blue-600">{match.homeTeam}</span>
                        <span className="text-xs text-gray-400">统计对比</span>
                        <span className="text-sm font-bold text-orange-500">{match.awayTeam}</span>
                      </div>
                      {data.stats.map((s) => (
                        <StatBar
                          key={s.key}
                          stat={s}
                          homeTeam={match.homeTeam}
                          awayTeam={match.awayTeam}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "events" && (
                <div>
                  {!data?.events || data.events.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-2xl mb-2">⚡</div>
                      <div className="text-sm">
                        {match.finished || match.inProgress
                          ? "暂无比赛事件记录"
                          : "比赛开始后将显示实时事件"}
                      </div>
                    </div>
                  ) : (
                    <EventTimeline
                      events={data.events}
                      homeTeam={match.homeTeam}
                      awayTeam={match.awayTeam}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部刷新按钮 */}
        {match.inProgress && !loading && (
          <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between bg-gray-50 flex-shrink-0">
            <span className="text-xs text-gray-400">每 60 秒自动刷新</span>
            <button
              onClick={fetchData}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            >
              <RefreshCw className="h-3 w-3" />
              立即刷新
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
