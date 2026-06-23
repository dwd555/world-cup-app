import { NextResponse } from "next/server";

// worldcupapi.com 统计数据格式
interface MatchStats {
  yellow_cards?: string;
  red_cards?: string;
  substitutions?: string;
  possesion?: string; // API 拼写是 possesion（单 s）
  free_kicks?: string;
  goal_kicks?: string;
  throw_ins?: string;
  offsides?: string;
  corners?: string;
  shots_on_target?: string;
  shots_off_target?: string;
  attempts_on_goal?: string;
  saves?: string;
  fauls?: string; // API 拼写是 fauls
  treatments?: string;
  penalties?: string;
  shots_blocked?: string;
  dangerous_attacks?: string;
  attacks?: string;
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

interface Fixture {
  id: number;
  home: { name: string };
  away: { name: string };
}

// 内存缓存
const statsCache = new Map<string, { data: unknown; timestamp: number; live: boolean }>();
const fixturesCache: { data: Fixture[]; timestamp: number } | null = null;
const CACHE_TTL_LIVE = 60 * 1000;       // 1分钟（进行中）
const CACHE_TTL_DONE = 5 * 60 * 1000;  // 5分钟（已结束）
const FIXTURES_CACHE_TTL = 60 * 60 * 1000; // 1小时（fixtures 列表）

function parseStat(val: string | undefined): [number, number] | null {
  if (!val) return null;
  const parts = val.split(":");
  if (parts.length !== 2) return null;
  const a = parseInt(parts[0]);
  const b = parseInt(parts[1]);
  if (isNaN(a) || isNaN(b)) return null;
  return [a, b];
}

// 规范化队名（用于跨数据源匹配）
function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

// 获取 fixtures 列表（带缓存）
async function getFixtures(apiKey: string): Promise<Fixture[]> {
  if (fixturesCache && Date.now() - fixturesCache.timestamp < FIXTURES_CACHE_TTL) {
    return fixturesCache.data;
  }
  const res = await fetch(`https://api.worldcupapi.com/fixtures?key=${apiKey}`);
  if (!res.ok) throw new Error(`fixtures failed: ${res.status}`);
  const data = await res.json();
  const fixtures: Fixture[] = Array.isArray(data) ? data : (data.data || []);
  // 建立 name → fixture 索引（双向，主客队都索引）
  fixturesCache.data = fixtures;
  fixturesCache.timestamp = Date.now();
  return fixtures;
}

// 根据队名找到 worldcupapi.com 的 match_id
function findMatchId(
  fixtures: Fixture[],
  homeTeamEn: string,
  awayTeamEn: string,
): number | null {
  const homeNorm = normalizeTeamName(homeTeamEn);
  const awayNorm = normalizeTeamName(awayTeamEn);

  for (const f of fixtures) {
    const fHomeNorm = normalizeTeamName(f.home.name);
    const fAwayNorm = normalizeTeamName(f.away.name);
    // 正序或反序匹配
    if (
      (fHomeNorm === homeNorm && fAwayNorm === awayNorm) ||
      (fHomeNorm === awayNorm && fAwayNorm === homeNorm)
    ) {
      return f.id;
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const homeTeamEn = searchParams.get("home") || "";
  const awayTeamEn = searchParams.get("away") || "";
  const apiKey = process.env.WORLDCUPAPI_KEY;

  // 检查缓存（用 worldcup26.ir 的 id 做 key）
  const cached = statsCache.get(id);
  if (cached) {
    const ttl = cached.live ? CACHE_TTL_LIVE : CACHE_TTL_DONE;
    if (Date.now() - cached.timestamp < ttl) {
      return NextResponse.json(cached.data);
    }
  }

  // 没有配置 API Key，返回空结构（优雅降级）
  if (!apiKey) {
    return NextResponse.json({ noApiKey: true, stats: null, events: [] });
  }

  try {
    // 第一步：获取 fixtures 找到正确的 match_id
    let matchId: number | null = null;
    if (homeTeamEn && awayTeamEn) {
      const fixtures = await getFixtures(apiKey);
      matchId = findMatchId(fixtures, homeTeamEn, awayTeamEn);
    }
    // 如果队名匹配失败，降级：直接用传入的 id（兼容 possible 未来 ID 一致的情况）
    const queryMatchId = matchId ?? id;

    const BASE = "https://api.worldcupapi.com";

    // 并行请求统计和事件
    const [statsRes, eventsRes] = await Promise.allSettled([
      fetch(`${BASE}/statistics?key=${apiKey}&match_id=${queryMatchId}`),
      fetch(`${BASE}/events?key=${apiKey}&match_id=${queryMatchId}`),
    ]);

    let stats: MatchStats | null = null;
    let events: MatchEvent[] = [];
    let isLive = false;

    if (statsRes.status === "fulfilled" && statsRes.value.ok) {
      const raw = await statsRes.value.json();
      stats = (raw.data || raw) as MatchStats;
    }

    if (eventsRes.status === "fulfilled" && eventsRes.value.ok) {
      const raw = await eventsRes.value.json();
      const matchData = raw.match || {};
      isLive = matchData.status === "LIVE" || matchData.time === "LIVE";
      events = Array.isArray(raw.event) ? raw.event : [];
    }

    // 格式化统计数据
    const formattedStats = stats
      ? [
          { label: "控球率 %", key: "possesion", value: parseStat(stats.possesion), unit: "%" },
          { label: "射门总数", key: "attempts_on_goal", value: parseStat(stats.attempts_on_goal) },
          { label: "射正", key: "shots_on_target", value: parseStat(stats.shots_on_target) },
          { label: "射偏", key: "shots_off_target", value: parseStat(stats.shots_off_target) },
          { label: "被封堵射门", key: "shots_blocked", value: parseStat(stats.shots_blocked) },
          { label: "角球", key: "corners", value: parseStat(stats.corners) },
          { label: "越位", key: "offsides", value: parseStat(stats.offsides) },
          { label: "犯规", key: "fauls", value: parseStat(stats.fauls) },
          { label: "黄牌", key: "yellow_cards", value: parseStat(stats.yellow_cards) },
          { label: "红牌", key: "red_cards", value: parseStat(stats.red_cards) },
          { label: "扑救", key: "saves", value: parseStat(stats.saves) },
          { label: "任意球", key: "free_kicks", value: parseStat(stats.free_kicks) },
          { label: "危险进攻", key: "dangerous_attacks", value: parseStat(stats.dangerous_attacks) },
          { label: "进攻次数", key: "attacks", value: parseStat(stats.attacks) },
        ].filter(s => s.value !== null)
      : [];

    const result = {
      noApiKey: false,
      stats: formattedStats,
      events,
      isLive,
    };

    statsCache.set(id, { data: result, timestamp: Date.now(), live: isLive });
    return NextResponse.json(result);
  } catch (error) {
    console.error("match-detail error:", error);
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ noApiKey: false, stats: null, events: [], error: true });
  }
}
