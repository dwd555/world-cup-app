"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

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

interface Standing {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

const typeOrder = ["r32", "r16", "qf", "sf", "third", "final"];
const typeLabel: Record<string, string> = {
  r32: "32强赛",
  r16: "16强赛",
  qf: "四分之一决赛",
  sf: "半决赛",
  third: "三四名决赛",
  final: "决赛",
};

function calcStandings(matches: Match[]): Record<string, Standing[]> {
  const groups: Record<string, Record<string, Standing>> = {};

  for (const m of matches) {
    if (m.type !== "group" || !m.group) continue;
    const g = m.group;
    if (!groups[g]) groups[g] = {};

    const initTeam = (name: string) => {
      if (!groups[g][name]) {
        groups[g][name] = {
          team: name, played: 0, won: 0, drawn: 0, lost: 0,
          goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
        };
      }
    };
    initTeam(m.homeTeam);
    initTeam(m.awayTeam);

    if (!m.finished || m.homeScore === null || m.awayScore === null) continue;

    const hs = parseInt(m.homeScore);
    const as_ = parseInt(m.awayScore);
    if (isNaN(hs) || isNaN(as_)) continue;

    const home = groups[g][m.homeTeam];
    const away = groups[g][m.awayTeam];

    home.played++;
    away.played++;
    home.goalsFor += hs;
    home.goalsAgainst += as_;
    away.goalsFor += as_;
    away.goalsAgainst += hs;

    if (hs > as_) {
      home.won++; home.points += 3;
      away.lost++;
    } else if (hs < as_) {
      away.won++; away.points += 3;
      home.lost++;
    } else {
      home.drawn++; home.points++;
      away.drawn++; away.points++;
    }
    home.goalDiff = home.goalsFor - home.goalsAgainst;
    away.goalDiff = away.goalsFor - away.goalsAgainst;
  }

  const result: Record<string, Standing[]> = {};
  for (const g of Object.keys(groups).sort()) {
    result[g] = Object.values(groups[g]).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });
  }
  return result;
}

function ScoreCell({ match }: { match: Match }) {
  if (match.inProgress) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 font-bold">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
        {match.homeScore ?? "?"} : {match.awayScore ?? "?"}
      </span>
    );
  }
  if (match.finished && match.homeScore !== null) {
    return (
      <span className="font-bold text-gray-800">
        {match.homeScore} : {match.awayScore}
      </span>
    );
  }
  return <span className="text-gray-400 text-xs">{match.date.slice(0, 10) || "待定"}</span>;
}

function GroupStandings({ standings }: { standings: Record<string, Standing[]> }) {
  const groups = Object.keys(standings);
  if (groups.length === 0) {
    return <div className="text-gray-400 text-sm text-center py-8">暂无积分数据</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groups.map((g) => (
        <div key={g} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2">
            <h3 className="text-white font-bold text-sm">{g} 组</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-3 py-2 font-medium">球队</th>
                <th className="text-center px-1.5 py-2 font-medium w-7">赛</th>
                <th className="text-center px-1.5 py-2 font-medium w-7">胜</th>
                <th className="text-center px-1.5 py-2 font-medium w-7">平</th>
                <th className="text-center px-1.5 py-2 font-medium w-7">负</th>
                <th className="text-center px-1.5 py-2 font-medium w-9">净胜</th>
                <th className="text-center px-1.5 py-2 font-medium w-9 text-blue-700">积分</th>
              </tr>
            </thead>
            <tbody>
              {standings[g].map((s, i) => (
                <tr
                  key={s.team}
                  className={`border-t border-gray-100 ${i < 2 ? "bg-blue-50/40" : ""}`}
                >
                  <td className="px-3 py-2 font-medium text-gray-800">
                    <span className={`inline-block w-4 text-center mr-1 text-gray-400 ${i < 2 ? "text-blue-600" : ""}`}>
                      {i + 1}
                    </span>
                    {s.team}
                  </td>
                  <td className="text-center px-1.5 py-2 text-gray-600">{s.played}</td>
                  <td className="text-center px-1.5 py-2 text-gray-600">{s.won}</td>
                  <td className="text-center px-1.5 py-2 text-gray-600">{s.drawn}</td>
                  <td className="text-center px-1.5 py-2 text-gray-600">{s.lost}</td>
                  <td className={`text-center px-1.5 py-2 ${s.goalDiff > 0 ? "text-green-600" : s.goalDiff < 0 ? "text-red-500" : "text-gray-500"}`}>
                    {s.goalDiff > 0 ? "+" : ""}{s.goalDiff}
                  </td>
                  <td className="text-center px-1.5 py-2 font-bold text-blue-700">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
            蓝色底部为晋级区（前2名）
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupResults({ matches }: { matches: Match[] }) {
  const groupMatches = matches.filter((m) => m.type === "group" && m.group);
  const byGroup: Record<string, Match[]> = {};
  for (const m of groupMatches) {
    const g = m.group!;
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(m);
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (g: string) => setExpanded((prev) => ({ ...prev, [g]: !prev[g] }));

  return (
    <div className="space-y-3">
      {Object.keys(byGroup).sort().map((g) => {
        const isOpen = expanded[g] !== false; // default open
        return (
          <div key={g} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              onClick={() => toggle(g)}
            >
              <span className="font-semibold text-gray-800 text-sm">{g} 组比赛</span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                {byGroup[g].filter((m) => m.finished).length}/{byGroup[g].length} 场已完成
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {isOpen && (
              <div className="divide-y divide-gray-100">
                {byGroup[g].map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 淘汰赛对阵图 — 整体横向对阵树
// ────────────────────────────────────────────────────────────

// 单个球队卡片（对阵图节点中的一行）
function BracketTeam({
  name,
  score,
  isWinner,
  isPending,
}: {
  name: string;
  score: string | null;
  isWinner: boolean;
  isPending: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-2 py-1 text-xs leading-tight gap-1
        ${isWinner ? "bg-amber-50 text-amber-800 font-bold" : isPending ? "text-gray-400" : "text-gray-600"}
      `}
    >
      <span className="truncate max-w-[80px]">{name || "待定"}</span>
      {score !== null && (
        <span
          className={`ml-1 tabular-nums font-bold flex-shrink-0 ${isWinner ? "text-amber-700" : "text-gray-500"}`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// 单场比赛卡片（对阵图节点）
function BracketMatch({ match }: { match: Match | null }) {
  if (!match) {
    // 占位卡片（轮次还没数据时）
    return (
      <div className="w-[110px] border border-dashed border-gray-200 rounded bg-gray-50 overflow-hidden">
        <div className="px-2 py-1 text-xs text-gray-300 leading-tight">待定</div>
        <div className="border-t border-dashed border-gray-200 px-2 py-1 text-xs text-gray-300 leading-tight">待定</div>
      </div>
    );
  }

  const hs = match.homeScore !== null ? parseInt(match.homeScore) : null;
  const as_ = match.awayScore !== null ? parseInt(match.awayScore) : null;
  const homeWin = hs !== null && as_ !== null && hs > as_;
  const awayWin = hs !== null && as_ !== null && as_ > hs;

  return (
    <div
      className={`w-[110px] border rounded overflow-hidden shadow-sm
        ${match.inProgress ? "border-green-400 ring-1 ring-green-300" : "border-gray-200"}
        ${match.finished ? "bg-white" : "bg-gray-50/80"}
      `}
    >
      <BracketTeam
        name={match.homeTeam}
        score={match.homeScore}
        isWinner={homeWin}
        isPending={!match.finished && !match.inProgress}
      />
      <div className="border-t border-gray-100" />
      <BracketTeam
        name={match.awayTeam}
        score={match.awayScore}
        isWinner={awayWin}
        isPending={!match.finished && !match.inProgress}
      />
      {match.inProgress && (
        <div className="px-2 py-0.5 bg-green-50 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
          <span className="text-green-600 text-[10px]">进行中</span>
        </div>
      )}
    </div>
  );
}

// 连接线 SVG（向右延伸，连接两个节点到一个父节点）
function ConnectorLines({ count }: { count: number }) {
  // count: 这一侧有多少个子节点需要连到一个父节点
  // 渲染 count/2 组连线（每两个子节点合并到一个父节点）
  const pairs = Math.ceil(count / 2);
  return (
    <div className="flex flex-col justify-around" style={{ width: 20 }}>
      {Array.from({ length: pairs }).map((_, i) => (
        <svg key={i} width="20" height="60" className="overflow-visible">
          {/* 上半线：从上子节点中心向右 → 向下到中点 */}
          <polyline
            points="0,15 10,15 10,30 20,30"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1.5"
          />
          {/* 下半线：从下子节点中心向右 → 向上到中点 */}
          <polyline
            points="0,45 10,45 10,30 20,30"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1.5"
          />
        </svg>
      ))}
    </div>
  );
}

// 一个轮次列（含标题 + 若干比赛卡片）
function BracketRound({
  label,
  matches,
  color,
}: {
  label: string;
  matches: (Match | null)[];
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0">
      {/* 轮次标题 */}
      <div
        className={`text-[10px] font-bold text-white px-2 py-0.5 rounded mb-2 whitespace-nowrap ${color}`}
      >
        {label}
      </div>
      {/* 比赛卡片，均匀分布 */}
      <div
        className="flex flex-col justify-around"
        style={{ gap: 8, flex: 1 }}
      >
        {matches.map((m, i) => (
          <BracketMatch key={m?.id ?? `placeholder-${i}`} match={m} />
        ))}
      </div>
    </div>
  );
}

function KnockoutBracket({ matches }: { matches: Match[] }) {
  const knockoutMatches = matches.filter((m) => m.type !== "group");

  const byType: Record<string, Match[]> = {};
  for (const m of knockoutMatches) {
    const t = m.type.toLowerCase();
    if (!byType[t]) byType[t] = [];
    byType[t].push(m);
  }

  const hasAnyData = knockoutMatches.length > 0;

  if (!hasAnyData) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-3">🏆</div>
        <div className="text-sm">淘汰赛尚未开始，小组赛结束后更新</div>
      </div>
    );
  }

  // 轮次配置（从左到右）
  const rounds: { key: string; label: string; color: string; count: number }[] = [
    { key: "r32", label: "32强", color: "bg-slate-500", count: 16 },
    { key: "r16", label: "16强", color: "bg-blue-500", count: 8 },
    { key: "qf", label: "四分之一决赛", color: "bg-violet-500", count: 4 },
    { key: "sf", label: "半决赛", color: "bg-orange-500", count: 2 },
    { key: "final", label: "决赛", color: "bg-rose-500", count: 1 },
  ];

  // 只展示有数据的轮次（或全部，占位显示）
  const visibleRounds = rounds.filter(
    (r) => byType[r.key] && byType[r.key].length > 0
  );

  // 如果没有任何淘汰赛数据，按上面逻辑已经返回了；这里至少有一轮
  const roundsToShow = visibleRounds.length > 0 ? visibleRounds : rounds.slice(0, 1);

  // 渲染方案：
  // - 屏幕较宽时：横向对阵图（桌面）
  // - 手机：竖向列表分组

  return (
    <div className="space-y-4">
      {/* 桌面横向对阵图 */}
      <div className="hidden md:block">
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto">
          <div className="flex items-start gap-0 min-w-max">
            {roundsToShow.map((round, roundIdx) => {
              const roundMatches = byType[round.key] || [];
              // 填充到目标数量（不足时用 null 占位）
              const padded: (Match | null)[] = Array.from(
                { length: round.count },
                (_, i) => roundMatches[i] ?? null
              );
              return (
                <div key={round.key} className="flex items-center">
                  <BracketRound
                    label={round.label}
                    matches={padded}
                    color={round.color}
                  />
                  {/* 连接线：不是最后一轮才画 */}
                  {roundIdx < roundsToShow.length - 1 && (
                    <div
                      className="flex flex-col justify-around"
                      style={{
                        height: round.count * 68 + (round.count - 1) * 8,
                        width: 28,
                        flexShrink: 0,
                      }}
                    >
                      {Array.from({ length: round.count / 2 }).map((_, i) => (
                        <svg
                          key={i}
                          width="28"
                          height="136"
                          className="overflow-visible"
                          style={{ display: "block" }}
                        >
                          <polyline
                            points="0,34 14,34 14,68 28,68"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="1.5"
                          />
                          <polyline
                            points="0,102 14,102 14,68 28,68"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="1.5"
                          />
                        </svg>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 季军赛（独立展示在图下方） */}
          {byType["third"] && byType["third"].length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded bg-teal-500">
                  三四名决赛
                </span>
                <BracketMatch match={byType["third"][0]} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 移动端：竖向分组列表 */}
      <div className="md:hidden space-y-3">
        {[...roundsToShow, ...(byType["third"] ? [{ key: "third", label: "三四名决赛", color: "bg-teal-500", count: 1 }] : [])].map(
          (round) => {
            const roundMatches = byType[round.key] || [];
            return (
              <div key={round.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`px-4 py-2 ${round.color}`}>
                  <h3 className="text-white font-bold text-sm">{round.label}</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {roundMatches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                  {roundMatches.length === 0 && (
                    <div className="px-4 py-4 text-center text-gray-400 text-sm">
                      对阵待定
                    </div>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

function MatchRow({ match: m }: { match: Match }) {
  const [showScorers, setShowScorers] = useState(false);
  const hasScorers =
    (m.homeScorers && m.homeScorers.length > 0) ||
    (m.awayScorers && m.awayScorers.length > 0);

  return (
    <div className="px-3 py-2.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-2">
        {/* 主队 */}
        <span className={`flex-1 text-right text-sm font-medium truncate ${
          m.finished && m.homeScore !== null && m.awayScore !== null &&
          parseInt(m.homeScore) > parseInt(m.awayScore)
            ? "text-green-700 font-bold"
            : "text-gray-800"
        }`}>
          {m.homeTeam}
        </span>
        {/* 比分 */}
        <div className="flex-shrink-0 w-20 text-center">
          <ScoreCell match={m} />
        </div>
        {/* 客队 */}
        <span className={`flex-1 text-left text-sm font-medium truncate ${
          m.finished && m.homeScore !== null && m.awayScore !== null &&
          parseInt(m.awayScore) > parseInt(m.homeScore)
            ? "text-green-700 font-bold"
            : "text-gray-800"
        }`}>
          {m.awayTeam}
        </span>
        {/* 进球展开按钮 */}
        {hasScorers && m.finished && (
          <button
            onClick={() => setShowScorers(!showScorers)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            {showScorers ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {/* 进球详情 */}
      {showScorers && hasScorers && (
        <div className="mt-1.5 flex gap-2 text-xs text-gray-500 pl-2">
          <div className="flex-1 text-right">
            {m.homeScorers.map((s, i) => (
              <div key={i} className="text-green-700">⚽ {s}</div>
            ))}
          </div>
          <div className="w-4" />
          <div className="flex-1 text-left">
            {m.awayScorers.map((s, i) => (
              <div key={i} className="text-green-700">⚽ {s}</div>
            ))}
          </div>
        </div>
      )}
      {/* 比赛时间 */}
      <div className="text-xs text-gray-400 text-center mt-0.5">{m.date.slice(0, 10)}</div>
    </div>
  );
}

type TabType = "standings" | "results" | "knockout";

export function MatchCenter() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("standings");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setMatches(data);
      setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const standings = calcStandings(matches);
  const groupMatches = matches.filter((m) => m.type === "group");
  const knockoutMatches = matches.filter((m) => m.type !== "group");

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "standings", label: "积分榜" },
    { key: "results", label: "小组赛", count: groupMatches.filter((m) => m.finished).length },
    { key: "knockout", label: "淘汰赛", count: knockoutMatches.length },
  ];

  return (
    <div className="space-y-4">
      {/* Tab 头部 + 刷新 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={`ml-1 text-xs ${tab === t.key ? "text-blue-600" : "text-gray-400"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">更新于 {lastUpdated}</span>
          )}
          <button
            onClick={fetchMatches}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 内容 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          加载中...
        </div>
      ) : (
        <>
          {tab === "standings" && <GroupStandings standings={standings} />}
          {tab === "results" && <GroupResults matches={matches} />}
          {tab === "knockout" && <KnockoutBracket matches={matches} />}
        </>
      )}
    </div>
  );
}
