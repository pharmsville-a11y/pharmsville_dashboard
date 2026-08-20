import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function kstDate(offsetDays = 0) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const kst = new Date(utc + 9 * 60 * 60 * 1000);
  kst.setDate(kst.getDate() + offsetDays);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseArgs(argv) {
  let date = null;
  let days = 1;
  for (const arg of argv) {
    if (arg.startsWith("--date=")) date = arg.slice("--date=".length);
    if (arg.startsWith("--days=")) days = Math.max(1, Number(arg.slice("--days=".length)) || 1);
  }
  if (date) return [date];
  return Array.from({ length: days }, (_, index) => kstDate(-index)).reverse();
}

async function collect(url, secret, date) {
  const target = new URL(url);
  target.searchParams.set("date", date);
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-collect-secret": secret,
    },
    body: "{}",
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

loadEnv();

const url = process.env.COLLECT_URL?.trim();
const secret = process.env.COLLECT_SECRET?.trim();
if (!url || !secret || url.includes("YOUR_PROJECT_REF")) {
  console.error("프로젝트 루트에 .env.local 을 만들고 COLLECT_URL 과 COLLECT_SECRET 을 넣으세요.");
  console.error("예시는 .env.example 을 보세요.");
  process.exit(1);
}

const dates = parseArgs(process.argv.slice(2));
let failed = false;

for (const date of dates) {
  const result = await collect(url, secret, date);
  console.log(`\n[${date}] HTTP ${result.status}`);
  console.log(JSON.stringify(result.body, null, 2));
  if (!result.ok || result.body?.ok !== true) failed = true;
  if (dates.length > 1) await new Promise((resolveWait) => setTimeout(resolveWait, 800));
}

process.exit(failed ? 1 : 0);
