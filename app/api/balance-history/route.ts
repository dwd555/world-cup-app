import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = searchParams.get("limit");

    let records;
    if (userId) {
      records = db
        .prepare(
          "SELECT * FROM BalanceChange WHERE userId = ? ORDER BY createdAt DESC LIMIT ?"
        )
        .all(Number(userId), limit ? Number(limit) : 200);
    } else {
      records = db
        .prepare(
          "SELECT * FROM BalanceChange ORDER BY createdAt DESC LIMIT ?"
        )
        .all(limit ? Number(limit) : 200);
    }

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET balance history error:", error);
    return NextResponse.json(
      { error: "获取余额变更记录失败" },
      { status: 500 }
    );
  }
}
