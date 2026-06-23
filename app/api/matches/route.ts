import { NextResponse } from "next/server";

// 简单的内存缓存，5分钟过期
let cache: { data: Match[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface Match {
  id: string;
  homeTeam: string; // 中文名（主显示）
  awayTeam: string; // 中文名（主显示）
  homeTeamEn: string; // 英文名（备用）
  awayTeamEn: string; // 英文名（备用）
  homeScore: string | null;
  awayScore: string | null;
  homeScorers: string[];
  awayScorers: string[];
  date: string; // "06/11/2026 13:00"
  group: string | null;
  matchday: string | null;
  type: string; // group, r32, r16, qf, sf, third, final
  finished: boolean;
  inProgress: boolean;
  timeElapsed: string;
  displayName: string;
  stadiumId: string | null;
}

// 世界杯2026参赛队中文翻译
const teamNameZh: Record<string, string> = {
  // A 组
  Mexico: "墨西哥",
  "South Africa": "南非",
  "South Korea": "韩国",
  "Czech Republic": "捷克",
  // B 组
  Spain: "西班牙",
  Argentina: "阿根廷",
  "New Zealand": "新西兰",
  Morocco: "摩洛哥",
  // C 组
  France: "法国",
  "United States": "美国",
  Belgium: "比利时",
  Uruguay: "乌拉圭",
  // D 组
  Germany: "德国",
  Japan: "日本",
  "Costa Rica": "哥斯达黎加",
  Portugal: "葡萄牙",
  // E 组
  England: "英格兰",
  Brazil: "巴西",
  Australia: "澳大利亚",
  Colombia: "哥伦比亚",
  // F 组
  Netherlands: "荷兰",
  Italy: "意大利",
  Turkey: "土耳其",
  Ecuador: "厄瓜多尔",
  // G 组
  Croatia: "克罗地亚",
  Poland: "波兰",
  "Saudi Arabia": "沙特阿拉伯",
  Cameroon: "喀麦隆",
  // H 组
  Switzerland: "瑞士",
  Chile: "智利",
  Serbia: "塞尔维亚",
  Ukraine: "乌克兰",
  // I 组
  Denmark: "丹麦",
  Egypt: "埃及",
  Nigeria: "尼日利亚",
  Indonesia: "印度尼西亚",
  // J 组
  Iran: "伊朗",
  Senegal: "塞内加尔",
  Ghana: "加纳",
  "Ivory Coast": "科特迪瓦",
  // K 组
  Canada: "加拿大",
  Algeria: "阿尔及利亚",
  Qatar: "卡塔尔",
  Paraguay: "巴拉圭",
  // L 组
  "New Caledonia": "新喀里多尼亚",
  Slovenia: "斯洛文尼亚",
  Venezuela: "委内瑞拉",
  Scotland: "苏格兰",
  // 常见备选
  USA: "美国",
  Korea: "韩国",
  "Republic of Korea": "韩国",
  Czechia: "捷克",
  "Ivory Coast (Côte d'Ivoire)": "科特迪瓦",
  "Côte d'Ivoire": "科特迪瓦",
  TBD: "待定",
  Austria: "奥地利",
  Jordan: "约旦",
  Norway: "挪威",
  "Cape Verde": "佛得角共和国",
  Haiti: "海地",
  "Bosnia and Herzegovina": "波黑",
  Sweden: "瑞典",
  Iraq: "伊拉克",
  "Democratic Republic of the Congo": "刚果民主共和国",
  Uzbekistan: "乌兹别克斯坦",
  Panama: "巴拿马",
  Tunisia: "突尼斯",
  Curaçao: "库拉索",
};

function toZh(enName: string): string {
  return teamNameZh[enName] || enName;
}

const typeLabel: Record<string, string> = {
  group: "小组赛",
  r32: "32强",
  r16: "16强",
  qf: "四分之一决赛",
  sf: "半决赛",
  third: "季军赛",
  final: "决赛",
};

function parseScorers(raw: unknown): string[] {
  if (!raw || raw === "null") return [];
  const s = String(raw).replace(/^\{/, "").replace(/\}$/, "");
  return s
    .split(",")
    .map(x => x.trim().replace(/^"/, "").replace(/"$/, ""))
    .filter(Boolean);
}

function buildDisplayName(m: Match): string {
  const stage =
    m.type === "group" && m.group && m.matchday
      ? `${m.group}组 第${m.matchday}轮`
      : typeLabel[m.type] || m.type;
  return `${m.homeTeam} vs ${m.awayTeam}  [${stage}]`;
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const res = await fetch("https://worldcup26.ir/get/games", {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`upstream error: ${res.status}`);
    }

    const raw = await res.json();
    const games: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : raw.games || [];

    const matches: Match[] = games.map(g => {
      const homeTeamEn = String(
        g.home_team_name_en || g.home_team_label || "TBD",
      );
      const awayTeamEn = String(
        g.away_team_name_en || g.away_team_label || "TBD",
      );
      const homeTeam = toZh(homeTeamEn);
      const awayTeam = toZh(awayTeamEn);
      const finished =
        String(g.finished).toUpperCase() === "TRUE" ||
        g.time_elapsed === "finished";
      const inProgress =
        !finished &&
        g.time_elapsed !== "notstarted" &&
        g.time_elapsed != null &&
        String(g.time_elapsed) !== "";

      const m: Match = {
        id: String(g.id),
        homeTeam,
        awayTeam,
        homeTeamEn,
        awayTeamEn,
        homeScore:
          g.home_score != null && String(g.home_score) !== "null"
            ? String(g.home_score)
            : null,
        awayScore:
          g.away_score != null && String(g.away_score) !== "null"
            ? String(g.away_score)
            : null,
        homeScorers: parseScorers(g.home_scorers),
        awayScorers: parseScorers(g.away_scorers),
        date: String(g.local_date || ""),
        group: g.group ? String(g.group) : null,
        matchday: g.matchday ? String(g.matchday) : null,
        type: String(g.type || "group"),
        finished,
        inProgress,
        timeElapsed: String(g.time_elapsed || "notstarted"),
        displayName: "",
        stadiumId: g.stadium_id ? String(g.stadium_id) : null,
      };
      m.displayName = buildDisplayName(m);
      return m;
    });

    cache = { data: matches, timestamp: now };
    return NextResponse.json(matches);
  } catch (error) {
    console.error("GET matches error:", error);
    // 如果 API 挂了但有缓存，返回缓存数据
    if (cache) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json({ error: "获取赛程失败" }, { status: 500 });
  }
}
