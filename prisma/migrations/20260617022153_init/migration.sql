-- CreateTable
CREATE TABLE "Bet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "match" TEXT NOT NULL,
    "betAmount" REAL NOT NULL,
    "odds" REAL NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'pending',
    "profit" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
