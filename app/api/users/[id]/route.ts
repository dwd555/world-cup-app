import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = Number(id);

    const user = db.prepare("SELECT * FROM User WHERE id = ?").get(userId);
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 级联删除该用户的所有投注记录
    db.prepare("DELETE FROM Bet WHERE userId = ?").run(userId);

    // 删除用户
    db.prepare("DELETE FROM User WHERE id = ?").run(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE user error:", error);
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 });
  }
}
