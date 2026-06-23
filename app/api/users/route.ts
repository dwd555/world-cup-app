import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const users = db.prepare("SELECT * FROM User ORDER BY createdAt DESC").all();
    return NextResponse.json(users);
  } catch (error) {
    console.error("GET users error:", error);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, balance } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "用户名不能为空" },
        { status: 400 }
      );
    }

    const initBalance = balance != null ? Number(balance) : 1000;

    const stmt = db.prepare("INSERT INTO User (name, balance) VALUES (?, ?)");
    const result = stmt.run(name.trim(), initBalance);

    const user = db.prepare("SELECT * FROM User WHERE id = ?").get(result.lastInsertRowid);

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
    }
    console.error("POST user error:", error);
    return NextResponse.json({ error: "创建用户失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, balance } = body;

    if (!id || balance == null) {
      return NextResponse.json(
        { error: "缺少必要字段: id, balance" },
        { status: 400 }
      );
    }

    const user = db.prepare("SELECT * FROM User WHERE id = ?").get(Number(id));
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    db.prepare("UPDATE User SET balance = ? WHERE id = ?")
      .run(Number(balance), Number(id));

    const updated = db.prepare("SELECT * FROM User WHERE id = ?").get(Number(id));
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH user error:", error);
    return NextResponse.json({ error: "更新用户余额失败" }, { status: 500 });
  }
}
