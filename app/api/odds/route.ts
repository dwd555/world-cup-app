import { NextResponse } from "next/server";

// 内存缓存 5 分钟
let cache: { data: OddsEntry[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

const BASE_URL = "https://api.oddspapi.io/v4";

// OddsPapi 队名 → worldcup26.ir 英文名 规范化映射
// 确保两个数据源的队名能匹配
const TEAM_NAME_NORMALIZE: Record<string, string> = {
  "USA": "United States",
  "United States of America": "United States",
  "Korea Republic": "South Korea",
  "Republic of Korea": "South Korea",
  "IR Iran": "Iran",
  "Ivory Coast": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "Côte d'Ivoire": "Ivory Coast",
  "Bosnia Herzegovina": "Bosnia and Herzegovina",
  "Czech Republic": "Czech Republic",
  "Czechia": "Czech Republic",
  "DR Congo": "Democratic Republic of the Congo",
  "Congo DR": "Democratic Republic of the Congo",
};

function normalizeTeamName(name: string): string {
  return TEAM_NAME_NORMALIZE[name] ?? name;
}

export interface OddsEntry {
  matchKey: string; // "HomeTeamEn_vs_AwayTeamEn"
  fixtureId: string;
  homeTeamEn: string;
  awayTeamEn: string;
  commenceTime: string;
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmaker: string;
  lastUpdate: string;
}

interface OddspapiFixture {
  fixtureId: string;
  startTime: string;
  participant1Name: string;
  participant2Name: string;
  tournamentName: string;
  hasOdds: boolean;
}

// 获取 N 天后的日期字符串 YYYY-MM-DD
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 从 OddsPapi odds 响应解析 1X2 赔率
function parse1X2(
  bookmakerOdds: Record<string, unknown>,
  preferOrder = ["pinnacle", "bet365", "draftkings", "fanduel", "williamhill"]
): { home: number | null; draw: number | null; away: number | null; bookmaker: string; lastUpdate: string } {
  // 按优先顺序找庄家
  let targetSlug: string | null = null;
  for (const slug of preferOrder) {
    if (bookmakerOdds[slug]) {
      targetSlug = slug;
      break;
    }
  }
  // 如果偏好庄家都没有，用第一个可用的
  if (!targetSlug) {
    const keys = Object.keys(bookmakerOdds);
    if (keys.length > 0) targetSlug = keys[0];
  }

  if (!targetSlug) {
    return { home: null, draw: null, away: null, bookmaker: "未知", lastUpdate: "" };
  }

  try {
    const bookData = bookmakerOdds[targetSlug] as Record<string, unknown>;
    const markets = bookData["markets"] as Record<string, unknown>;
    // 市场 ID 101 = Full Time Result (1X2)
    const market101 = markets?.["101"] as Record<string, unknown> | undefined;
    if (!market101) {
      return { home: null, draw: null, away: null, bookmaker: targetSlug, lastUpdate: "" };
    }
    const outcomes = market101["outcomes"] as Record<string, unknown>;
    // 101 = Home, 102 = Draw, 103 = Away
    const getPrice = (outcomeId: string): number | null => {
      try {
        const o = (outcomes[outcomeId] as Record<string, unknown>)?.["players"] as Record<string, unknown>;
        const snap = o?.["0"] as Record<string, unknown>;
        const price = snap?.["price"];
        return price != null ? Number(price) : null;
      } catch {
        return null;
      }
    };

    const lastUpdate = (() => {
      try {
        const o = (outcomes["101"] as Record<string, unknown>)?.["players"] as Record<string, unknown>;
        const snap = o?.["0"] as Record<string, unknown>;
        return String(snap?.["createdAt"] || "");
      } catch {
        return "";
      }
    })();

    return {
      home: getPrice("101"),
      draw: getPrice("102"),
      away: getPrice("103"),
      bookmaker: targetSlug,
      lastUpdate,
    };
  } catch {
    return { home: null, draw: null, away: null, bookmaker: targetSlug, lastUpdate: "" };
  }
}

// 带速率限制的 fetch（OddsPapi 免费版需要 ~0.88s 间隔）
async function fetchWithDelay(url: string, delayMs = 900): Promise<Response> {
  await new Promise((r) => setTimeout(r, delayMs));
  return fetch(url);
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json([]);
    }

    // 世界杯 2026: 2026-06-11 ~ 2026-07-19，每次最多 10 天
    // 分 4 个窗口覆盖整个赛程
    const dateWindows = [
      { from: dateOffset(0), to: dateOffset(9) },
      { from: dateOffset(10), to: dateOffset(19) },
      { from: dateOffset(20), to: dateOffset(29) },
      { from: dateOffset(30), to: dateOffset(39) },
    ].filter((w) => {
      // 只取有意义的窗口（开始日期不超过世界杯结束）
      return w.from <= "2026-07-19";
    });

    // 也加上过去 3 天（用于查已有赔率但未开始的比赛）
    const allWindows = [
      { from: dateOffset(-3), to: dateOffset(6) },
      ...dateWindows.slice(1),
    ];

    let allFixtures: OddspapiFixture[] = [];

    for (const window of allWindows) {
      try {
        const res = await fetch(
          `${BASE_URL}/fixtures?apiKey=${apiKey}&sportId=10&from=${window.from}&to=${window.to}`,
          { next: { revalidate: 300 } }
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data)) {
          const wc = data.filter(
            (f: OddspapiFixture) =>
              f.tournamentName === "World Cup" && f.hasOdds
          );
          allFixtures = allFixtures.concat(wc);
        }
      } catch {
        // 继续下一个窗口
      }
    }

    // 去重
    const seen = new Set<string>();
    allFixtures = allFixtures.filter((f) => {
      if (seen.has(f.fixtureId)) return false;
      seen.add(f.fixtureId);
      return true;
    });

    if (allFixtures.length === 0) {
      if (cache) return NextResponse.json(cache.data);
      return NextResponse.json([]);
    }

    // 拉取每场比赛的赔率（最多并发 5 个，避免触发速率限制）
    const result: OddsEntry[] = [];
    const bookmakers = "pinnacle,bet365,williamhill,draftkings,fanduel";

    // 分批处理，每批 3 个，批次之间等待
    const batchSize = 3;
    for (let i = 0; i < allFixtures.length; i += batchSize) {
      const batch = allFixtures.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (fixture, idx) => {
          try {
            // 给每个请求不同的延迟，避免同时触发速率限制
            if (idx > 0) {
              await new Promise((r) => setTimeout(r, idx * 950));
            }
            const oddsRes = await fetch(
              `${BASE_URL}/odds?apiKey=${apiKey}&fixtureId=${fixture.fixtureId}&bookmakers=${bookmakers}`,
              { next: { revalidate: 300 } }
            );
            if (!oddsRes.ok) return null;
            const oddsData = await oddsRes.json();
            const bookmakerOdds = oddsData?.["bookmakerOdds"] as Record<string, unknown> | undefined;
            if (!bookmakerOdds) return null;

            const { home, draw, away, bookmaker, lastUpdate } = parse1X2(bookmakerOdds);

            const homeTeamEn = normalizeTeamName(fixture.participant1Name);
            const awayTeamEn = normalizeTeamName(fixture.participant2Name);
            return {
              matchKey: `${homeTeamEn}_vs_${awayTeamEn}`,
              fixtureId: fixture.fixtureId,
              homeTeamEn,
              awayTeamEn,
              commenceTime: fixture.startTime,
              home,
              draw,
              away,
              bookmaker,
              lastUpdate,
            } as OddsEntry;
          } catch {
            return null;
          }
        })
      );

      for (const r of batchResults) {
        if (r) result.push(r);
      }

      // 批次间等待
      if (i + batchSize < allFixtures.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET odds error:", error);
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json([]);
  }
}
