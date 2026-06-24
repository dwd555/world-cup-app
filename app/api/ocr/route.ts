import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";
import path from "path";
import sharp from "sharp";

interface OcrMatch {
  name: string;
  odds: string | null;
}

interface OcrResult {
  parlayType: string | null;
  matches: OcrMatch[];
  betAmount: string | null;
  winAmount: string | null;
  rawText: string;
}

function parseOcrText(text: string): OcrResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let parlayType: string | null = null;
  const matches: OcrMatch[] = [];
  let betAmount: string | null = null;
  let winAmount: string | null = null;

  // ===== 串关类型 =====
  // OCR: "3 吕 10" → 应解析为 "3串1"（"0" 是 "x1" 的一部分，只取第一位数字）
  const parlayMatch =
    text.match(/(\d+)\s*[串吕]\s*(\d)/) ??
    text.match(/(\d+)\s*串\s*(\d)/);
  if (parlayMatch) {
    parlayType = `${parlayMatch[1]}串${parlayMatch[2]}`;
  }

  // ===== 金额解析：三遍策略 =====
  // OCR 可能在中文字之间插入空格，如 "投注 额" 而非 "投注额"
  // OCR 可能把"额"识别成"客"或"倾"（字形相近）

  // 第一遍：标签和金额在同一行（允许标签内空格 + 额/客/倾 变体）
  const betSameLine = text.match(/投\s*注\s*[额金客倾][：:.\s]*([\d][\d.]*[.\d])\s*元/);
  if (betSameLine) betAmount = betSameLine[1];

  const winSameLine = text.match(/可\s*赢\s*[额金客倾][：:.\s]*([\d][\d.]*[.\d])\s*元/);
  if (winSameLine) winAmount = winSameLine[1];

  // 第二遍：标签和金额分在两行（逐行状态机）
  if (!betAmount || !winAmount) {
    let pendingLabel: "bet" | "win" | null = null;
    const amtPattern = /^([\d][\d.]*[.\d])\s*元$/;

    for (const line of lines) {
      const isBetLabel = /投\s*注\s*[额金客倾]/.test(line) && !/投注单/.test(line) && !/投注时/.test(line);
      const isWinLabel = /可\s*赢\s*[额金客倾]/.test(line);

      if (isBetLabel) {
        const inline = line.match(/([\d][\d.]*[.\d])\s*元/);
        if (inline && !betAmount) {
          betAmount = inline[1];
          pendingLabel = null;
        } else {
          pendingLabel = "bet";
        }
      } else if (isWinLabel) {
        const inline = line.match(/([\d][\d.]*[.\d])\s*元/);
        if (inline && !winAmount) {
          winAmount = inline[1];
          pendingLabel = null;
        } else {
          pendingLabel = "win";
        }
      } else if (pendingLabel) {
        const m = line.match(amtPattern);
        if (m) {
          if (pendingLabel === "bet" && !betAmount) betAmount = m[1];
          else if (pendingLabel === "win" && !winAmount) winAmount = m[1];
          pendingLabel = null;
        }
      }
    }
  }

  // 第三遍：兜底 — 收集独立金额行
  if (!betAmount || !winAmount) {
    const allAmounts: string[] = [];
    for (const line of lines) {
      const m = line.match(/^([\d][\d.]*[.\d])\s*元$/);
      if (m) allAmounts.push(m[1]);
    }
    if (!betAmount && allAmounts.length > 0) betAmount = allAmounts[0];
    if (!winAmount) {
      const idx = allAmounts[0] === betAmount ? 1 : 0;
      if (allAmounts.length > idx) winAmount = allAmounts[idx];
    }
  }

  // ===== 赔率格式化：修复 OCR 把 "." 识别成 "l" 的问题 =====
  // 例如 "l11" → "1.11"，"l154" → "1.54"，"1154" → "1.54"
  const normalizeOdds = (raw: string): string => {
    // 先把 l/I/i/| 替换为 1
    let s = raw.replace(/[lIi|]/g, "1");
    // 去掉多余的点
    s = s.replace(/\./g, "");
    // 按长度插入小数点：2位 → X.X，3位 → X.XX，4位 → X.XXX
    if (s.length === 3) s = s[0] + "." + s.slice(1);
    else if (s.length === 4) s = s[0] + "." + s.slice(1);
    else if (s.length === 2) s = s[0] + "." + s[1];
    return s;
  };

  // ===== 逐行解析比赛信息 =====
  for (const line of lines) {
    // 匹配 @赔率（容忍 OCR 把 "." 识别成 "l"）
    const rawOdds = line.match(/[@＠]([\dl|Ii][\d.l|Ii]*)/);
    // 排除非比赛行
    const isBetLine =
      rawOdds &&
      !line.includes("投注") &&
      !line.includes("可赢") &&
      !line.includes("注单") &&
      !line.includes("开赛") &&
      !line.includes("世界杯") &&
      !line.includes("足球") &&
      !line.includes("全场") &&
      !line.includes("已结算") &&
      !line.includes("已确认") &&
      !line.includes("串关") &&
      !line.includes("冠军");

    if (isBetLine) {
      const fixedOdds = normalizeOdds(rawOdds[1]);
      const oddsNum = parseFloat(fixedOdds);
      // 验证是合法赔率（1.01 ~ 100）
      if (!isNaN(oddsNum) && oddsNum > 1 && oddsNum < 100) {
        const namePart = line.split(/[@＠]/)[0].trim();
        const cleanName = namePart
          .replace(/^[\s·•\-\|,，。>\》\d]+\s*/, "") // 去掉前导噪点
          .replace(/[\s·•\-\|]+$/, "")
          .replace(/\s+/g, "") // 去掉中间空格（OCR 在中文之间插空格）
          .trim();
        if (cleanName.length >= 2 && cleanName.length <= 30) {
          matches.push({
            name: cleanName,
            odds: fixedOdds,
          });
        }
      }
    }
  }

  // ===== 从 "X VS Y" 标题行提取场次（当 @赔率 行被 OCR 漏掉时） =====
  if (matches.length === 0) {
    for (const line of lines) {
      // 匹配 "队名 VS 队名" 或 "队名 vs 队名" 格式
      const vsMatch = line.match(/^(.+?)\s*[Vv][Ss]\s*(.+?)(?:\s*[\[@]|$)/);
      if (vsMatch) {
        const home = vsMatch[1].replace(/\s+/g, "").trim();
        const away = vsMatch[2].replace(/\s+/g, "").replace(/[\])）].*$/, "").trim();
        if (home.length >= 2 && away.length >= 2) {
          matches.push({ name: `${home} VS ${away}`, odds: null });
          break; // 只取第一个 VS 行
        }
      }
    }
  }

  // ===== 兜底：用赔率计算可赢额 =====
  if (!winAmount && betAmount && matches.length > 0) {
    const bet = parseFloat(betAmount);
    if (!isNaN(bet) && bet > 0) {
      if (matches.length === 1) {
        const odds = parseFloat(matches[0].odds ?? "0");
        if (!isNaN(odds) && odds > 1) {
          winAmount = (bet * (odds - 1)).toFixed(2);
        }
      } else if (matches.length >= 2) {
        const combinedOdds = matches.reduce((acc, m) => {
          const o = parseFloat(m.odds ?? "0");
          return isNaN(o) ? acc : acc * o;
        }, 1);
        if (combinedOdds > 1) {
          winAmount = (bet * (combinedOdds - 1)).toFixed(2);
        }
      }
    }
  }

  return { parlayType, matches, betAmount, winAmount, rawText: text };
}

/**
 * 图片预处理：放大 + 灰度 + 增强对比度
 * 显著提高 Tesseract.js 对中文截图的识别率
 */
async function preprocessImage(base64Data: string): Promise<string> {
  // 去掉 data URL 前缀
  const base64Content = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;
  const buffer = Buffer.from(base64Content, "base64");

  // 获取原始尺寸
  const metadata = await sharp(buffer).metadata();
  const origWidth = metadata.width ?? 0;
  const origHeight = metadata.height ?? 0;

  // 放大 2 倍（小图对 OCR 很不友好）
  const resizeWidth = Math.max(origWidth * 2, 2000);

  const processed = await sharp(buffer)
    .resize(resizeWidth, null, {
      // 等比缩放，使用 Lanczos3 算法（最适合文字放大）
      kernel: "lanczos3",
    })
    .grayscale() // 转灰度，去掉颜色干扰
    .sharpen({ sigma: 0.5 }) // 轻微锐化，让文字边缘更清晰
    .png() // 输出 PNG（无损，比 JPEG 更适合文字）
    .toBuffer();

  // 转回 base64 data URL
  return `data:image/png;base64,${processed.toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: "缺少图片数据" }, { status: 400 });
    }

    // 图片预处理：放大 + 灰度 + 增强对比度
    const processedImage = await preprocessImage(image);

    // 显式指定 workerPath，避免 Next.js standalone 模式下 __dirname 路径错误
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "tesseract.js",
      "src",
      "worker-script",
      "node",
      "index.js"
    );

    // 创建 OCR worker，支持中文+英文
    const worker = await createWorker("chi_sim+eng", undefined, {
      workerPath,
    });

    try {
      // 识别预处理后的图片
      const {
        data: { text },
      } = await worker.recognize(processedImage);

      // 解析文本
      const result = parseOcrText(text);

      // 开发环境下输出原始 OCR 文本，便于调试
      if (process.env.NODE_ENV !== "production") {
        console.log("=== OCR Raw Text ===");
        console.log(text);
        console.log("=== Parsed Result ===");
        console.log(JSON.stringify(result, null, 2));
      }

      return NextResponse.json(result);
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json(
      { error: "图片识别失败，请重试" },
      { status: 500 }
    );
  }
}
