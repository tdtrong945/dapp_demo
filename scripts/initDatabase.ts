import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.cwd(), process.env.DATABASE_PATH);
  }

  return path.resolve(__dirname, "../sql/dapp.sqlite");
}

function main(): void {
  const schemaPath = path.resolve(__dirname, "../sql/schema.sql");
  const databasePath = resolveDatabasePath();

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Khong tim thay schema file: ${schemaPath}`);
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const db = new Database(databasePath);

  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.exec(schemaSql);

    console.log("Da khoi tao database thanh cong");
    console.log(`Database path: ${databasePath}`);
  } finally {
    db.close();
  }
}

main();
