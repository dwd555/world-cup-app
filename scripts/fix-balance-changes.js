// 修复历史上的 BalanceChange 记录中 oldBalance/newBalance 错误
// Bug 原因：recordBalanceChange 在余额已被 UPDATE 之后才读 user.balance，
// 导致 oldBalance 实际是变更后的值，newBalance 又多算了一次 changeAmount

const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "dev.db");
const db = new Database(dbPath);

// 开启事务
const fix = db.transaction(() => {
  // 先看看有哪些记录
  const all = db.prepare("SELECT id, userId, changeAmount, oldBalance, newBalance, type, reason FROM BalanceChange ORDER BY id").all();

  console.log(`共 ${all.length} 条记录\n`);

  let fixed = 0;

  for (const row of all) {
    // 正确的 newBalance = 存储的 oldBalance（它实际上就是变更后的余额）
    // 正确的 oldBalance = correctNewBalance - changeAmount
    const correctNewBalance = row.oldBalance;
    const correctOldBalance = correctNewBalance - row.changeAmount;

    // 检查是否需要修复（数值可能有浮点误差，用 0.01 容差）
    const needFix = Math.abs(row.oldBalance - correctOldBalance) > 0.01 ||
                    Math.abs(row.newBalance - correctNewBalance) > 0.01;

    if (needFix) {
      console.log(`[修复] id=${row.id}  type=${row.type}  changeAmount=${row.changeAmount}`);
      console.log(`  旧值: oldBalance=${row.oldBalance}  newBalance=${row.newBalance}`);
      console.log(`  新值: oldBalance=${correctOldBalance}  newBalance=${correctNewBalance}`);

      db.prepare("UPDATE BalanceChange SET oldBalance = ?, newBalance = ? WHERE id = ?")
        .run(correctOldBalance, correctNewBalance, row.id);
      fixed++;
    }
  }

  console.log(`\n修复完成，共修正 ${fixed} 条记录`);
});

fix();
db.close();
