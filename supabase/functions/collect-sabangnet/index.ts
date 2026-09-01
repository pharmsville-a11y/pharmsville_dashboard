import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const COMPANY_ID = "internal";
const DEFAULT_BASE = "https://api.sabangnet.co.kr";
const ORDER_PATH = "/v3/sb/order";
const TOKEN_PATH = "/oauth2/token";

const RESPONSE_ITEMS = [
  "SB_ORD_NO",
  "SHOP_ORD_NO",
  "ORDER_STATUS",
  "ORDER_DT",
  "SHOP_NM",
  "SHOP_LOGIN_ID",
  "shmaId",
  "ORDER_TOT_AMT",
  "PAY_TOT_AMT",
  "CT_SALE_COST",
  "ORD_CNT",
  "CM_EA",
  "CT_DELIVERY_COST",
] as const;

const SKIP_STATUS = new Set([
  "CANCEL_RECEIPT",
  "CANCEL_COMPLETED",
  "DISCARD",
  "RETURN_RECEIPT",
  "RETURN_COMPLETED",
]);

const DEFAULT_MALL_ALIASES: Record<string, string[]> = {
  naver: ["스마트스토어", "네이버", "smartstore", "ncp"],
  makeshop: ["메이크샵", "makeshop"],
  coupang: ["쿠팡", "coupang"],
  elevenst: ["11번가", "11st", "eleven"],
};

type SnapshotInsert = {
  company_id: string;
  snapshot_date: string;
  snapshot_hour: number;
  period: "daily";
  channel_id: string;
  kind: "commerce";
  source: "sabangnet";
  sales: number;
  orders: number;
  conversion_rate: null;
  ad_spend: null;
  followers: null;
  reach: null;
  engagement_rate: null;
  extra: Record<string, unknown>;
};

type OrderRow = Record<string, unknown>;

type TokenCache = { token: string; expiresAt: number };

let tokenCache: TokenCache | null = null;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-collect-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

function env(name: string, fallback = ""): string {
  return (Deno.env.get(name) ?? fallback).trim();
}

function money(value: unknown): number {
  if (value == null || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function ymdCompact(date: string): string {
  return date.replace(/-/g, "");
}

function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function kstToday(): string {
  return kstNow().toISOString().slice(0, 10);
}

function snapshotHourForDate(date: string): number {
  const today = kstToday();
  if (date < today) return 23;
  return kstNow().getUTCHours();
}

function parseMallMap(): Record<string, string> {
  const raw = env("SABANGNET_SHOP_MAP");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const channel = text(value);
      if (key && channel) out[key.trim().toLowerCase()] = channel;
    }
    return out;
  } catch {
    return {};
  }
}

function parseMallAliases(): Record<string, string[]> {
  const raw = env("SABANGNET_MALL_MAP");
  if (!raw) return DEFAULT_MALL_ALIASES;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string[]> = {};
    for (const [channel, value] of Object.entries(parsed)) {
      const aliases = text(value)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      if (aliases.length) out[channel] = aliases;
    }
    return Object.keys(out).length ? out : DEFAULT_MALL_ALIASES;
  } catch {
    return DEFAULT_MALL_ALIASES;
  }
}

function mapChannel(
  row: OrderRow,
  shopMap: Record<string, string>,
  aliases: Record<string, string[]>,
): string | null {
  const shopId = text(row.shmaId).toLowerCase();
  const loginId = text(row.SHOP_LOGIN_ID).toLowerCase();
  if (shopId && shopMap[shopId]) return shopMap[shopId];
  if (loginId && shopMap[loginId]) return shopMap[loginId];

  const haystack = `${text(row.SHOP_NM)} ${loginId} ${shopId}`.toLowerCase();
  for (const [channel, names] of Object.entries(aliases)) {
    if (names.some((name) => name && haystack.includes(name))) return channel;
  }
  return null;
}

function secretSign(clientCd: string, timestamp: string, secret: string): string {
  const plaintext = `${clientCd}_${timestamp}`;
  const hash = bcrypt.hashSync(plaintext, secret);
  return btoa(hash);
}

async function issueToken(notes: string[]): Promise<string | null> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 5 * 60_000 > now) return tokenCache.token;

  const clientCd = env("SABANGNET_CLIENT_CD");
  const secret = env("SABANGNET_SECRET");
  const clientType = env("SABANGNET_CLIENT_TYPE", "SB_APP");
  const authMode = env("SABANGNET_AUTH_MODE", "PRODUCTION");
  const base = env("SABANGNET_BASE_URL", DEFAULT_BASE).replace(/\/$/, "");
  if (!clientCd || !secret) {
    notes.push("사방넷 키가 없어 매출 수집을 건너뜁니다. SABANGNET_CLIENT_CD / SABANGNET_SECRET 을 넣으세요.");
    return null;
  }

  const timestamp = String(now);
  let sign: string;
  try {
    sign = secretSign(clientCd, timestamp, secret);
  } catch (error) {
    notes.push(
      `사방넷 secretSign 생성 실패: ${error instanceof Error ? error.message : "error"}. 시크릿이 BCrypt salt 형식인지 확인하세요.`,
    );
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    clientType,
    clientCd,
    timestamp,
    secretSign: sign,
    authMode,
  });

  const response = await fetch(`${base}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    code?: string;
    message?: string;
  } | null;

  if (!response.ok || !payload?.access_token) {
    notes.push(
      `사방넷 토큰 실패: ${payload?.code ?? payload?.error ?? payload?.message ?? `http ${response.status}`}`,
    );
    return null;
  }

  const ttl = Number(payload.expires_in ?? 10800) * 1000;
  tokenCache = { token: payload.access_token, expiresAt: now + Math.max(60_000, ttl) };
  return payload.access_token;
}

async function searchOrders(
  token: string,
  date: string,
  page: number,
): Promise<{ rows: OrderRow[]; hasNext: boolean; error?: string }> {
  const base = env("SABANGNET_BASE_URL", DEFAULT_BASE).replace(/\/$/, "");
  const svc = env("SABANGNET_SVC_ACNT_ID");
  const compact = ymdCompact(date);
  const response = await fetch(`${base}${ORDER_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Svc-Acnt-Id": svc,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      dateSearchCondition: 2,
      startDate: compact,
      endDate: compact,
      updateOrderStsYn: "N",
      page,
      perPage: 200,
      responseItems: [...RESPONSE_ITEMS],
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    results?: OrderRow[];
    hasNext?: boolean;
    isLast?: boolean;
    code?: string;
    message?: string;
    error?: string;
  } | null;

  if (!response.ok) {
    return {
      rows: [],
      hasNext: false,
      error: payload?.code ?? payload?.error ?? payload?.message ?? `http ${response.status}`,
    };
  }

  const rows = Array.isArray(payload?.results) ? payload.results : [];
  const hasNext =
    payload?.hasNext === true ||
    payload?.isLast === false ||
    (rows.length >= 200 && payload?.isLast !== true && payload?.hasNext !== false);
  return { rows, hasNext };
}

function aggregate(
  date: string,
  rows: OrderRow[],
): { snapshots: SnapshotInsert[]; notes: string[] } {
  const shopMap = parseMallMap();
  const aliases = parseMallAliases();
  const buckets = new Map<
    string,
    { sales: number; orders: Set<string>; lines: number; shops: Map<string, { sales: number; orders: Set<string> }> }
  >();
  const unmapped = new Map<string, number>();
  const orderAmtSeen = new Set<string>();

  for (const row of rows) {
    const status = text(row.ORDER_STATUS);
    if (SKIP_STATUS.has(status)) continue;

    const channel = mapChannel(row, shopMap, aliases);
    const shopLabel = text(row.SHOP_NM) || text(row.shmaId) || text(row.SHOP_LOGIN_ID) || "unknown";
    if (!channel) {
      unmapped.set(shopLabel, (unmapped.get(shopLabel) ?? 0) + 1);
      continue;
    }

    const orderId = text(row.SB_ORD_NO) || text(row.SHOP_ORD_NO);
    const orderAmt = money(row.PAY_TOT_AMT) || money(row.ORDER_TOT_AMT);
    const lineAmt = money(row.CT_SALE_COST);
    let add = 0;
    if (orderId && orderAmt && !orderAmtSeen.has(`${channel}:${orderId}`)) {
      orderAmtSeen.add(`${channel}:${orderId}`);
      add = orderAmt;
    } else if (!orderAmt) {
      add = lineAmt;
    }

    let bucket = buckets.get(channel);
    if (!bucket) {
      bucket = { sales: 0, orders: new Set(), lines: 0, shops: new Map() };
      buckets.set(channel, bucket);
    }
    bucket.sales += add;
    bucket.lines += 1;
    if (orderId) bucket.orders.add(orderId);

    let shop = bucket.shops.get(shopLabel);
    if (!shop) {
      shop = { sales: 0, orders: new Set() };
      bucket.shops.set(shopLabel, shop);
    }
    shop.sales += add;
    if (orderId) shop.orders.add(orderId);
  }

  const snapshots: SnapshotInsert[] = [...buckets.entries()].map(([channel_id, bucket]) => ({
    company_id: COMPANY_ID,
    snapshot_date: date,
    snapshot_hour: snapshotHourForDate(date),
    period: "daily",
    channel_id,
    kind: "commerce",
    source: "sabangnet",
    sales: Math.round(bucket.sales),
    orders: bucket.orders.size,
    conversion_rate: null,
    ad_spend: null,
    followers: null,
    reach: null,
    engagement_rate: null,
    extra: {
      lines: bucket.lines,
      shops: [...bucket.shops.entries()].map(([name, shop]) => ({
        name,
        sales: Math.round(shop.sales),
        orders: shop.orders.size,
      })),
    },
  }));

  const notes: string[] = [];
  if (unmapped.size > 0) {
    notes.push(
      `사방넷 매핑 안 된 쇼핑몰: ${[...unmapped.entries()]
        .map(([name, count]) => `${name} ${count}줄`)
        .join(", ")}. SABANGNET_SHOP_MAP 또는 SABANGNET_MALL_MAP 을 넣으세요.`,
    );
  }
  return { snapshots, notes };
}

async function collectSabangnet(date: string): Promise<{
  rows: SnapshotInsert[];
  notes: string[];
  orderRows: number;
}> {
  const notes: string[] = [];
  if (!env("SABANGNET_SVC_ACNT_ID")) {
    notes.push("SABANGNET_SVC_ACNT_ID(서비스코드)가 없어 매출 수집을 건너뜁니다.");
    return { rows: [], notes, orderRows: 0 };
  }

  const token = await issueToken(notes);
  if (!token) return { rows: [], notes, orderRows: 0 };

  const all: OrderRow[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const pageResult = await searchOrders(token, date, page);
    if (pageResult.error) {
      notes.push(`사방넷 주문조회 실패(${date} p${page}): ${pageResult.error}`);
      break;
    }
    all.push(...pageResult.rows);
    if (!pageResult.hasNext || pageResult.rows.length === 0) break;
  }

  if (all.length === 0) {
    notes.push(
      `사방넷 ${date}: 주문 0건. 확정 주문만 조회됩니다. updateOrderStsYn=N 이라 신규주문을 건드리지 않습니다.`,
    );
  } else {
    notes.push(`사방넷 ${date}: 주문줄 ${all.length}건`);
  }

  const aggregated = aggregate(date, all);
  notes.push(...aggregated.notes);
  for (const row of aggregated.snapshots) {
    notes.push(`${row.channel_id}: sales=${row.sales} orders=${row.orders}`);
  }
  return { rows: aggregated.snapshots, notes, orderRows: all.length };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (request.method !== "POST" && request.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }

  const expected = Deno.env.get("COLLECT_SECRET");
  const given = request.headers.get("x-collect-secret");
  if (expected && given !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const date =
    url.searchParams.get("date") ??
    new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing supabase env" }, 500);
  }

  const collected = await collectSabangnet(date);
  if (collected.rows.length > 0) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const write = await supabase.from("channel_snapshots").upsert(collected.rows, {
      onConflict: "company_id,channel_id,snapshot_date,snapshot_hour,period",
    });
    if (write.error) return json({ error: write.error.message, notes: collected.notes }, 500);
  }

  return json({
    ok: true,
    snapshot_date: date,
    rows: collected.rows.length,
    order_rows: collected.orderRows,
    notes: collected.notes,
  });
});
