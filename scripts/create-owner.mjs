import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const remote = process.argv.includes("--remote");
if (!remote) {
  console.error("Refusing to create an owner without --remote. Use: pnpm owner:create -- --remote");
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error("Run this command in an interactive terminal.");
  process.exit(1);
}

const ask = (label, hidden = false) => new Promise((resolve, reject) => {
  process.stdout.write(label);
  let value = "";
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const onData = (buffer) => {
    const input = buffer.toString("utf8");
    for (const character of input) {
      if (character === "\u0003") { cleanup(); reject(new Error("Cancelled.")); return; }
      if (character === "\r" || character === "\n") { process.stdout.write("\n"); cleanup(); resolve(value); return; }
      if (character === "\u007f" || character === "\b") { if (value.length) { value = value.slice(0, -1); if (!hidden) process.stdout.write("\b \b"); } continue; }
      if (character >= " ") { value += character; if (!hidden) process.stdout.write(character); }
    }
  };
  const cleanup = () => { process.stdin.off("data", onData); process.stdin.setRawMode(Boolean(wasRaw)); process.stdin.pause(); };
  process.stdin.on("data", onData);
});

const email = String(await ask("Owner email: ")).trim().toLowerCase();
const displayName = String(await ask("Display name: ")).trim();
const password = String(await ask("Password (hidden, 12+ characters): ", true));
const confirmation = String(await ask("Confirm password (hidden): ", true));
if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
if (!displayName || displayName.length > 100) throw new Error("Display name must contain 1 to 100 characters.");
if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
if (password !== confirmation) throw new Error("Passwords do not match.");

const escapeSql = (value) => value.replaceAll("'", "''");
const salt = randomBytes(24).toString("hex");
const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
const id = `usr_${randomUUID().replaceAll("-", "")}`;
const now = new Date().toISOString();
const sql = `INSERT INTO users(id,email,display_name,password_salt,password_hash,status,created_at,updated_at) VALUES('${id}','${escapeSql(email)}','${escapeSql(displayName)}','${salt}','${hash}','active','${now}','${now}');\n`;
const temporary = mkdtempSync(join(tmpdir(), "zimaxx-owner-"));
const sqlPath = join(temporary, "owner.sql");
writeFileSync(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
const wranglerCli = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const command = spawnSync(process.execPath, [wranglerCli, "d1", "execute", "zimaxx-qr", "--remote", "--file", sqlPath], { cwd: root, stdio: "inherit" });
rmSync(temporary, { recursive: true, force: true });
if (command.status !== 0) process.exit(command.status ?? 1);
console.log(`Production owner created: ${email}`);
