"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, ChevronDown, ChevronUp, TrendingUp, Radio, Timer } from "lucide-react";
import { MatchDetail } from "./MatchDetail";

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

interface OddsEntry {
  matchKey: string;
  homeTeamEn: string;
  awayTeamEn: string;
  commenceTime: string;
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmaker: string;
  lastUpdate: string;
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

// 构建赔率查找索引（英文名匹配）
function buildOddsMap(odds: OddsEntry[]): Map<string, OddsEntry> {
  const map = new Map<string, OddsEntry>();
  for (const o of odds) {
    // key: homeTeamEn__awayTeamEn（双下划线分隔）
    map.set(`${o.homeTeamEn}__${o.awayTeamEn}`, o);
    // 也尝试反向（防止主客队顺序不一致）
    map.set(`${o.awayTeamEn}__${o.homeTeamEn}`, {
      ...o,
      homeTeamEn: o.awayTeamEn,
      awayTeamEn: o.homeTeamEn,
      home: o.away,
      away: o.home,
    });
  }
  return map;
}

function getOddsForMatch(match: Match, oddsMap: Map<string, OddsEntry>): OddsEntry | null {
  return oddsMap.get(`${match.homeTeamEn}__${match.awayTeamEn}`) ?? null;
}

// 赔率显示组件（横排主胜/平/客胜）
function OddsDisplay({
  odds,
  homeTeam,
  awayTeam,
  compact = false,
}: {
  odds: OddsEntry | null;
  homeTeam: string;
  awayTeam: string;
  compact?: boolean;
}) {
  if (!odds || (odds.home === null && odds.draw === null && odds.away === null)) {
    return null;
  }

  const fmt = (v: number | null) => (v !== null ? v.toFixed(2) : "-");

  if (compact) {
    // 紧凑版：一行三格
    return (
      <div className="flex items-center gap-0.5 mt-1">
        <div className="flex-1 text-center bg-blue-50 rounded px-1 py-0.5">
          <div className="text-[10px] text-blue-500 leading-none">主胜</div>
          <div className="text-xs font-bold text-blue-700 tabular-nums">{fmt(odds.home)}</div>
        </div>
        <div className="flex-1 text-center bg-gray-50 rounded px-1 py-0.5">
          <div className="text-[10px] text-gray-400 leading-none">平</div>
          <div className="text-xs font-bold text-gray-600 tabular-nums">{fmt(odds.draw)}</div>
        </div>
        <div className="flex-1 text-center bg-orange-50 rounded px-1 py-0.5">
          <div className="text-[10px] text-orange-500 leading-none">客胜</div>
          <div className="text-xs font-bold text-orange-700 tabular-nums">{fmt(odds.away)}</div>
        </div>
      </div>
    );
  }

  // 完整版：带队名标签
  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-gray-100">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="text-[10px] text-gray-400 font-medium">实时赔率</span>
        </div>
        <span className="text-[10px] text-gray-400">{odds.bookmaker}</span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <div className="py-2 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5 truncate px-1">{homeTeam} 胜</div>
          <div className="text-sm font-bold text-blue-700 tabular-nums">{fmt(odds.home)}</div>
        </div>
        <div className="py-2 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">平局</div>
          <div className="text-sm font-bold text-gray-600 tabular-nums">{fmt(odds.draw)}</div>
        </div>
        <div className="py-2 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5 truncate px-1">{awayTeam} 胜</div>
          <div className="text-sm font-bold text-orange-700 tabular-nums">{fmt(odds.away)}</div>
        </div>
      </div>
    </div>
  );
}

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
  return <span className="text-gray-400 text-xs">{match.date ? `${match.date} 北京` : "待定"}</span>;
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

function MatchRow({
  match: m,
  oddsEntry,
  onMatchClick,
}: {
  match: Match;
  oddsEntry?: OddsEntry | null;
  onMatchClick?: (match: Match) => void;
}) {
  const [showScorers, setShowScorers] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const hasScorers =
    (m.homeScorers && m.homeScorers.length > 0) ||
    (m.awayScorers && m.awayScorers.length > 0);
  const hasOdds = oddsEntry && (oddsEntry.home !== null || oddsEntry.draw !== null || oddsEntry.away !== null);

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
        {/* 比分 - 点击进入详情 */}
        <div
          className="flex-shrink-0 w-20 text-center cursor-pointer hover:opacity-75 transition-opacity"
          onClick={() => onMatchClick?.(m)}
          title="点击查看比赛详情"
        >
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
        {/* 操作按钮 */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {hasOdds && !m.finished && (
            <button
              onClick={() => setShowOdds(!showOdds)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                showOdds
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600"
              }`}
              title="查看赔率"
            >
              <TrendingUp className="h-3 w-3" />
              赔率
            </button>
          )}
          <button
            onClick={() => onMatchClick?.(m)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="查看比赛详情"
          >
            详情
          </button>
          {hasScorers && m.finished && (
            <button
              onClick={() => setShowScorers(!showScorers)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              {showScorers ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 赔率展开区 */}
      {showOdds && hasOdds && (
        <div className="mt-1.5 px-1">
          <OddsDisplay
            odds={oddsEntry}
            homeTeam={m.homeTeam}
            awayTeam={m.awayTeam}
          />
        </div>
      )}

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
      {/* 比赛时间（北京时间） */}
      {!m.finished && !m.inProgress && m.date && (
        <div className="text-xs text-gray-400 text-center mt-0.5">{m.date} 北京时间</div>
      )}
    </div>
  );
}

function GroupResults({ matches, oddsMap, onMatchClick }: { matches: Match[]; oddsMap: Map<string, OddsEntry>; onMatchClick?: (m: Match) => void }) {
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
                  <MatchRow key={m.id} match={m} oddsEntry={getOddsForMatch(m, oddsMap)} onMatchClick={onMatchClick} />
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
// 实时赔率页 - 展示所有未完赛比赛的赔率
// ────────────────────────────────────────────────────────────
function OddsPage({
  matches,
  odds,
  oddsMap,
  oddsLoading,
  noApiKey,
  onMatchClick,
}: {
  matches: Match[];
  odds: OddsEntry[];
  oddsMap: Map<string, OddsEntry>;
  oddsLoading: boolean;
  noApiKey: boolean;
  onMatchClick?: (m: Match) => void;
}) {
  if (oddsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        加载赔率数据...
      </div>
    );
  }

  if (noApiKey) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
        <div className="text-3xl">🔑</div>
        <div className="font-semibold text-amber-800 text-sm">需要配置赔率 API Key</div>
        <div className="text-xs text-amber-700 max-w-sm mx-auto">
          实时赔率数据由 <strong>The Odds API</strong> 提供，每月 500 次免费额度。
          请在项目根目录新建 <code className="bg-amber-100 px-1 rounded">.env.local</code> 文件并添加：
        </div>
        <div className="bg-white border border-amber-200 rounded-lg px-4 py-2 text-xs font-mono text-left inline-block">
          ODDS_API_KEY=你的API密钥
        </div>
        <div className="text-xs text-amber-600">
          前往{" "}
          <a
            href="https://the-odds-api.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-800"
          >
            the-odds-api.com
          </a>{" "}
          免费注册获取 Key
        </div>
      </div>
    );
  }

  if (odds.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-3">📊</div>
        <div className="text-sm">暂无赔率数据</div>
      </div>
    );
  }

  // 按轮次分组展示
  const upcomingMatches = matches.filter((m) => !m.finished);

  // 把有赔率的未开赛比赛按类型分组
  const byType: Record<string, { match: Match; odds: OddsEntry }[]> = {};
  for (const m of upcomingMatches) {
    const o = getOddsForMatch(m, oddsMap);
    if (!o) continue;
    const t = m.type === "group" ? (m.group ? `${m.group}组` : "小组赛") : (typeLabel[m.type] || m.type);
    if (!byType[t]) byType[t] = [];
    byType[t].push({ match: m, odds: o });
  }

  const sortedKeys = Object.keys(byType).sort((a, b) => {
    // 小组赛按组字母排序，淘汰赛按 typeOrder 排后面
    const aIsGroup = a.includes("组") && a.length <= 3;
    const bIsGroup = b.includes("组") && b.length <= 3;
    if (aIsGroup && bIsGroup) return a.localeCompare(b);
    if (aIsGroup) return -1;
    if (bIsGroup) return 1;
    return 0;
  });

  if (sortedKeys.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-3">✅</div>
        <div className="text-sm">所有比赛均已结束，无待开赛赔率</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 说明栏 */}
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
        <TrendingUp className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
        <span>赔率来源：{odds[0]?.bookmaker || "实时数据"}，仅供参考，不构成投注建议</span>
      </div>

      {sortedKeys.map((key) => (
        <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-teal-600">
            <h3 className="text-white font-bold text-sm">{key}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {byType[key].map(({ match: m, odds: o }) => (
              <div key={m.id} className="px-4 py-3">
                {/* 比赛标题行 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex-1 text-right text-sm font-medium text-gray-800">{m.homeTeam}</span>
                  <div className="flex flex-col items-center flex-shrink-0 gap-0.5">
                    <span className="text-xs text-gray-400">
                      {m.date ? `${m.date} 北京` : ""}
                      {m.inProgress && (
                        <span className="ml-1 text-green-600">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> 进行中
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onMatchClick?.(m)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                    >
                      详情
                    </button>
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-gray-800">{m.awayTeam}</span>
                </div>
                {/* 赔率三格 */}
                <OddsDisplay odds={o} homeTeam={m.homeTeam} awayTeam={m.awayTeam} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 淘汰赛对阵图
// ────────────────────────────────────────────────────────────

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

function BracketMatch({ match, oddsEntry }: { match: Match | null; oddsEntry?: OddsEntry | null }) {
  const [showOdds, setShowOdds] = useState(false);

  if (!match) {
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
  const hasOdds = oddsEntry && (oddsEntry.home !== null || oddsEntry.away !== null);

  return (
    <div className="flex flex-col">
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
        {hasOdds && !match.finished && (
          <button
            onClick={() => setShowOdds(!showOdds)}
            className="w-full flex items-center justify-center gap-0.5 py-0.5 bg-green-50 hover:bg-green-100 transition-colors border-t border-gray-100"
          >
            <TrendingUp className="h-2.5 w-2.5 text-green-500" />
            <span className="text-[9px] text-green-600">赔率</span>
          </button>
        )}
      </div>
      {showOdds && hasOdds && (
        <div className="w-[110px] mt-1">
          <OddsDisplay odds={oddsEntry} homeTeam={match.homeTeam} awayTeam={match.awayTeam} compact />
        </div>
      )}
    </div>
  );
}

function BracketRound({
  label,
  matches,
  color,
  oddsMap,
}: {
  label: string;
  matches: (Match | null)[];
  color: string;
  oddsMap: Map<string, OddsEntry>;
}) {
  return (
    <div className="flex flex-col items-center gap-0">
      <div
        className={`text-[10px] font-bold text-white px-2 py-0.5 rounded mb-2 whitespace-nowrap ${color}`}
      >
        {label}
      </div>
      <div
        className="flex flex-col justify-around"
        style={{ gap: 8, flex: 1 }}
      >
        {matches.map((m, i) => (
          <BracketMatch
            key={m?.id ?? `placeholder-${i}`}
            match={m}
            oddsEntry={m ? getOddsForMatch(m, oddsMap) : null}
          />
        ))}
      </div>
    </div>
  );
}

function KnockoutBracket({ matches, oddsMap, onMatchClick }: { matches: Match[]; oddsMap: Map<string, OddsEntry>; onMatchClick?: (m: Match) => void }) {
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

  const rounds: { key: string; label: string; color: string; count: number }[] = [
    { key: "r32", label: "32强", color: "bg-slate-500", count: 16 },
    { key: "r16", label: "16强", color: "bg-blue-500", count: 8 },
    { key: "qf", label: "四分之一决赛", color: "bg-violet-500", count: 4 },
    { key: "sf", label: "半决赛", color: "bg-orange-500", count: 2 },
    { key: "final", label: "决赛", color: "bg-rose-500", count: 1 },
  ];

  const visibleRounds = rounds.filter(
    (r) => byType[r.key] && byType[r.key].length > 0
  );

  const roundsToShow = visibleRounds.length > 0 ? visibleRounds : rounds.slice(0, 1);

  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto">
          <div className="flex items-start gap-0 min-w-max">
            {roundsToShow.map((round, roundIdx) => {
              const roundMatches = byType[round.key] || [];
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
                    oddsMap={oddsMap}
                  />
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

          {byType["third"] && byType["third"].length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded bg-teal-500">
                  三四名决赛
                </span>
                <BracketMatch
                  match={byType["third"][0]}
                  oddsEntry={getOddsForMatch(byType["third"][0], oddsMap)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

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
                    <MatchRow key={m.id} match={m} oddsEntry={getOddsForMatch(m, oddsMap)} onMatchClick={onMatchClick} />
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

// ────────────────────────────────────────────────────────────
// 实时赛况 - 正在进行中的比赛详情
// ────────────────────────────────────────────────────────────

function LiveMatchCard({ match: m, oddsEntry, onMatchClick }: { match: Match; oddsEntry?: OddsEntry | null; onMatchClick?: (m: Match) => void }) {
  const [showOdds, setShowOdds] = useState(false);
  const hs = m.homeScore !== null ? parseInt(m.homeScore) : null;
  const as_ = m.awayScore !== null ? parseInt(m.awayScore) : null;
  const homeLeading = hs !== null && as_ !== null && hs > as_;
  const awayLeading = hs !== null && as_ !== null && as_ > hs;
  const tied = hs !== null && as_ !== null && hs === as_;
  const hasOdds = oddsEntry && (oddsEntry.home !== null || oddsEntry.away !== null);

  return (
    <div className="bg-white rounded-2xl border-2 border-green-400 shadow-lg shadow-green-100 overflow-hidden">
      {/* 顶部直播标签 */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-white animate-pulse" />
          <span className="text-white text-xs font-bold tracking-wide">LIVE</span>
          {m.timeElapsed && m.timeElapsed !== "live" && (
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {m.timeElapsed}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-white/80 text-xs">
            {m.type === "group" && m.group ? `${m.group}组 第${m.matchday}轮` : m.type}
          </div>
          <button
            onClick={() => onMatchClick?.(m)}
            className="text-white/70 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full transition-colors"
          >
            详情
          </button>
        </div>
      </div>

      {/* 比赛核心区 */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          {/* 主队 */}
          <div className={`flex-1 text-right ${homeLeading ? "text-green-700" : "text-gray-700"}`}>
            <div className={`text-lg font-bold leading-tight ${homeLeading ? "text-green-700" : ""}`}>
              {m.homeTeam}
            </div>
            {homeLeading && <div className="text-xs text-green-600 mt-0.5">领先</div>}
          </div>

          {/* 比分 */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-2 shadow-inner">
              <span className={`text-3xl font-black tabular-nums leading-none ${homeLeading ? "text-green-400" : tied ? "text-yellow-400" : "text-white"}`}>
                {m.homeScore ?? "?"}
              </span>
              <span className="text-gray-500 text-2xl font-light">:</span>
              <span className={`text-3xl font-black tabular-nums leading-none ${awayLeading ? "text-green-400" : tied ? "text-yellow-400" : "text-white"}`}>
                {m.awayScore ?? "?"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              <span className="text-xs font-medium">实时</span>
            </div>
          </div>

          {/* 客队 */}
          <div className={`flex-1 text-left ${awayLeading ? "text-green-700" : "text-gray-700"}`}>
            <div className={`text-lg font-bold leading-tight ${awayLeading ? "text-green-700" : ""}`}>
              {m.awayTeam}
            </div>
            {awayLeading && <div className="text-xs text-green-600 mt-0.5">领先</div>}
          </div>
        </div>

        {/* 进球事件 */}
        {(m.homeScorers.length > 0 || m.awayScorers.length > 0) && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex gap-4">
              <div className="flex-1">
                {m.homeScorers.map((s, i) => (
                  <div key={i} className="flex items-center justify-end gap-1 text-xs text-gray-600 mb-1">
                    <span>{s}</span>
                    <span className="text-green-600">⚽</span>
                  </div>
                ))}
              </div>
              <div className="w-px bg-gray-100 flex-shrink-0" />
              <div className="flex-1">
                {m.awayScorers.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    <span className="text-green-600">⚽</span>
                    <span>{s}</span>
                  </div>
                ))}
                {m.awayScorers.length === 0 && m.homeScorers.length > 0 && (
                  <div className="text-xs text-gray-300 text-center">—</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 赔率参考 */}
        {hasOdds && (
          <div className="mt-3">
            <button
              onClick={() => setShowOdds(!showOdds)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-green-700 text-xs font-medium"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              {showOdds ? "收起赔率" : "查看实时赔率"}
            </button>
            {showOdds && (
              <div className="mt-2">
                <OddsDisplay odds={oddsEntry} homeTeam={m.homeTeam} awayTeam={m.awayTeam} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部场馆/时间 */}
      <div className="px-4 pb-3 text-xs text-gray-400 text-center">
        {m.date} 北京时间开球
        {m.region && ` · ${m.region}`}
      </div>
    </div>
  );
}

function LiveMatchesPage({
  matches,
  oddsMap,
  loading,
  onRefresh,
  onMatchClick,
}: {
  matches: Match[];
  oddsMap: Map<string, OddsEntry>;
  loading: boolean;
  onRefresh: () => void;
  onMatchClick?: (m: Match) => void;
}) {
  const liveMatches = matches.filter((m) => m.inProgress);
  const [countdown, setCountdown] = useState(30);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          onRefreshRef.current();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        加载中...
      </div>
    );
  }

  if (liveMatches.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-5xl">⏰</div>
        <div className="text-gray-500 font-medium">当前没有正在进行的比赛</div>
        <div className="text-gray-400 text-sm">比赛开始后将在此显示实时赛况</div>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-4">
          <RefreshCw className="h-3 w-3" />
          <span>{countdown} 秒后自动刷新</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 自动刷新提示 */}
      <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2 text-green-700">
          <Radio className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-medium">
            {liveMatches.length} 场比赛正在进行
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-600">
          <Timer className="h-3.5 w-3.5" />
          <span>{countdown}s 后刷新</span>
          <button
            onClick={() => { onRefreshRef.current(); setCountdown(30); }}
            className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-0.5 rounded-md transition-colors"
          >
            立即刷新
          </button>
        </div>
      </div>

      {/* 比赛卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {liveMatches.map((m) => (
          <LiveMatchCard key={m.id} match={m} oddsEntry={getOddsForMatch(m, oddsMap)} onMatchClick={onMatchClick} />
        ))}
      </div>

      {/* 即将开赛提示 */}
      {(() => {
        const upcoming = matches.filter((m) => !m.finished && !m.inProgress).slice(0, 3);
        if (upcoming.length === 0) return null;
        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">即将开赛</span>
            </div>
            <div className="divide-y divide-gray-100">
              {upcoming.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="flex-1 text-right text-sm text-gray-700 font-medium">{m.homeTeam}</span>
                  <span className="flex-shrink-0 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-lg whitespace-nowrap">
                    {m.date} 北京
                  </span>
                  <span className="flex-1 text-left text-sm text-gray-700 font-medium">{m.awayTeam}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

type TabType = "live" | "standings" | "results" | "knockout" | "odds";

export function MatchCenter() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [odds, setOdds] = useState<OddsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [oddsLoading, setOddsLoading] = useState(true);
  const [noApiKey, setNoApiKey] = useState(false);
  const [tab, setTab] = useState<TabType>("live");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const initialTabSet = useRef(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("failed");
      const data: Match[] = await res.json();
      setMatches(data);
      setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
      // 首次加载：如果没有进行中的比赛，默认跳到积分榜
      if (!initialTabSet.current) {
        initialTabSet.current = true;
        const hasLive = data.some((m) => m.inProgress);
        if (!hasLive) setTab("standings");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOdds = useCallback(async () => {
    setOddsLoading(true);
    try {
      const res = await fetch("/api/odds");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) {
        setNoApiKey(true);
      } else {
        setNoApiKey(false);
      }
      setOdds(data);
    } catch {
      setNoApiKey(true);
    } finally {
      setOddsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    fetchOdds();
  }, [fetchMatches, fetchOdds]);

  const oddsMap = buildOddsMap(odds);

  const handleRefresh = useCallback(() => {
    fetchMatches();
    fetchOdds();
  }, [fetchMatches, fetchOdds]);

  const standings = calcStandings(matches);
  const groupMatches = matches.filter((m) => m.type === "group");
  const knockoutMatches = matches.filter((m) => m.type !== "group");
  const liveMatches = matches.filter((m) => m.inProgress);
  const upcomingWithOdds = matches.filter(
    (m) => !m.finished && getOddsForMatch(m, oddsMap)
  ).length;

  const tabs: { key: TabType; label: string; count?: number; icon?: string; live?: boolean }[] = [
    { key: "live", label: "直播", count: liveMatches.length, live: liveMatches.length > 0 },
    { key: "standings", label: "积分榜" },
    { key: "results", label: "小组赛", count: groupMatches.filter((m) => m.finished).length },
    { key: "knockout", label: "淘汰赛", count: knockoutMatches.length },
    { key: "odds", label: "赔率", count: noApiKey ? undefined : upcomingWithOdds, icon: "📊" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab 头部 + 刷新 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? t.live
                    ? "bg-green-500 text-white shadow-sm shadow-green-200"
                    : "bg-white text-gray-900 shadow-sm"
                  : t.live
                  ? "text-green-600 hover:text-green-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon && <span className="mr-1">{t.icon}</span>}
              {t.live && (
                <span className={`mr-1 inline-flex items-center gap-0.5 ${tab === t.key ? "text-white" : "text-green-500"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block" />
                </span>
              )}
              {t.label}
              {t.count !== undefined && (
                <span className={`ml-1 text-xs ${
                  tab === t.key
                    ? t.live ? "text-white/80" : "text-blue-600"
                    : t.live ? "text-green-500" : "text-gray-400"
                }`}>
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
            onClick={handleRefresh}
            disabled={loading || oddsLoading}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(loading || oddsLoading) ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 内容 */}
      {loading && tab !== "live" ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          加载中...
        </div>
      ) : (
        <>
          {tab === "live" && (
            <LiveMatchesPage
              matches={matches}
              oddsMap={oddsMap}
              loading={loading}
              onRefresh={handleRefresh}
              onMatchClick={setSelectedMatch}
            />
          )}
          {tab === "standings" && <GroupStandings standings={standings} />}
          {tab === "results" && (
            <GroupResults
              matches={matches}
              oddsMap={oddsMap}
              onMatchClick={setSelectedMatch}
            />
          )}
          {tab === "knockout" && (
            <KnockoutBracket
              matches={matches}
              oddsMap={oddsMap}
              onMatchClick={setSelectedMatch}
            />
          )}
          {tab === "odds" && (
            <OddsPage
              matches={matches}
              odds={odds}
              oddsMap={oddsMap}
              oddsLoading={oddsLoading}
              noApiKey={noApiKey}
              onMatchClick={setSelectedMatch}
            />
          )}
        </>
      )}

      {/* 比赛详情弹窗 */}
      {selectedMatch && (
        <MatchDetail
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
