import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMPANY_ID = "internal";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-query-secret, x-collect-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function ymdKst(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const utc = value.getTime() + value.getTimezoneOffset() * 60_000;
    const kst = new Date(utc + 9 * 60 * 60 * 1000);
    const y = kst.getFullYear();
    const m = String(kst.getMonth() + 1).padStart(2, "0");
    const d = String(kst.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (match?.[1]) return match[1];
  const compact = raw.replace(/\D/g, "");
  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw || null;
  const utc = parsed.getTime() + parsed.getTimezoneOffset() * 60_000;
  const kst = new Date(utc + 9 * 60 * 60 * 1000);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function kstToday(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const kst = new Date(utc + 9 * 60 * 60 * 1000);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysUntil(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00+09:00`);
  const end = Date.parse(`${to}T00:00:00+09:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function latestStockCapturedAt(rows: Record<string, unknown>[]): string | null {
  let latest: string | null = null;
  let latestMs = -1;
  for (const row of rows) {
    const raw = row.captured_at;
    if (raw == null || raw === "") continue;
    const ms = new Date(String(raw)).getTime();
    if (!Number.isFinite(ms) || ms <= latestMs) continue;
    latestMs = ms;
    latest = String(raw);
  }
  return latest;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST" && request.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }

  const expected = Deno.env.get("QUERY_SECRET") ?? Deno.env.get("COLLECT_SECRET");
  const given = request.headers.get("x-query-secret") ?? request.headers.get("x-collect-secret");
  if (request.method !== "GET" && expected && given !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "missing supabase env" }, 500);

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "2020-01-01";
  const to = url.searchParams.get("to") ?? "2099-12-31";

  const supabase = createClient(supabaseUrl, serviceKey);

  const orderTypes = ["order", "out", "cancel", "exchange", "return_complete", "noout"];
  const orderSelect =
    "report_type, ord_inner_seq, item_seq, ord_date, ord_comp_code, ord_comp_name, ord_no1, item_code, item_name, option_name, qty, amount, fare_price, invoice_no, event_at, captured_at";

  const [orderBatches, stockMeta, flowRes, baseRes] = await Promise.all([
    Promise.all(
      orderTypes.map((type) =>
        supabase
          .from("pluscl_order_lines")
          .select(orderSelect)
          .eq("company_id", COMPANY_ID)
          .eq("report_type", type)
          .gte("ord_date", from)
          .lte("ord_date", to)
          .order("ord_date", { ascending: false })
          .limit(3000),
      ),
    ),
    supabase
      .from("pluscl_stock_snapshots")
      .select("snapshot_date, snapshot_hour")
      .eq("company_id", COMPANY_ID)
      .order("snapshot_date", { ascending: false })
      .order("snapshot_hour", { ascending: false })
      .limit(1),
    supabase
      .from("pluscl_flow_daily")
      .select("snapshot_date, kind, docs")
      .eq("company_id", COMPANY_ID)
      .gte("snapshot_date", from)
      .lte("snapshot_date", to)
      .order("snapshot_date", { ascending: false }),
    supabase
      .from("pluscl_base_rows")
      .select("kind, code, name, extra, captured_at")
      .eq("company_id", COMPANY_ID)
      .order("kind", { ascending: true })
      .limit(2000),
  ]);

  const ordersRes = orderBatches.find((batch) => batch.error);
  if (ordersRes?.error) return json({ error: ordersRes.error.message }, 500);
  if (stockMeta.error) return json({ error: stockMeta.error.message }, 500);
  if (flowRes.error) return json({ error: flowRes.error.message }, 500);
  if (baseRes.error) return json({ error: baseRes.error.message }, 500);

  const latest = stockMeta.data?.[0] as
    | { snapshot_date?: string; snapshot_hour?: number }
    | undefined;
  let stockRows: Record<string, unknown>[] = [];
  if (latest?.snapshot_date != null && latest.snapshot_hour != null) {
    const stockRes = await supabase
      .from("pluscl_stock_snapshots")
      .select(
        "snapshot_date, snapshot_hour, warehouse_code, item_code, item_name, option_name, category_name1, category_name2, rack_code, lot_no, qty, item_state, manufactured_on, shelf_life, shelf_life_unit, expire_date, captured_at",
      )
      .eq("company_id", COMPANY_ID)
      .eq("snapshot_date", latest.snapshot_date)
      .eq("snapshot_hour", latest.snapshot_hour)
      .order("item_name", { ascending: true })
      .limit(20000);
    if (stockRes.error) return json({ error: stockRes.error.message }, 500);
    stockRows = stockRes.data ?? [];
  }

  const orderLines = orderBatches
    .flatMap((batch) => batch.data ?? [])
    .sort((a, b) => String(b.ord_date ?? "").localeCompare(String(a.ord_date ?? "")));
  const byType: Record<string, { lines: number; qty: number; amount: number }> = {};
  const byChannel = new Map<string, { name: string; lines: number; qty: number; amount: number }>();

  for (const row of orderLines) {
    const type = text(row.report_type) || "order";
    const qty = num(row.qty);
    const amount = num(row.amount);
    const bucket = byType[type] ?? { lines: 0, qty: 0, amount: 0 };
    bucket.lines += 1;
    bucket.qty += qty;
    bucket.amount += amount;
    byType[type] = bucket;

    const name = text(row.ord_comp_name) || text(row.ord_comp_code) || "기타";
    const channel = byChannel.get(name) ?? { name, lines: 0, qty: 0, amount: 0 };
    channel.lines += 1;
    channel.qty += qty;
    channel.amount += amount;
    byChannel.set(name, channel);
  }

  const today = kstToday();
  const stockByLot = new Map<string, {
    item_code: string;
    item_name: string;
    option_name: string;
    category_name1: string;
    category_name2: string;
    warehouse_code: string;
    lot_no: string;
    manufactured_on: string | null;
    expire_date: string | null;
    shelf_life: number;
    shelf_life_unit: string;
    remaining_days: number | null;
    qty: number;
    locations: number;
  }>();
  for (const row of stockRows) {
    const code = text(row.item_code);
    const expire = ymdKst(row.expire_date);
    const manufactured = ymdKst(row.manufactured_on);
    const key = `${code}|${text(row.option_name)}|${text(row.lot_no)}|${expire ?? ""}`;
    const item = stockByLot.get(key) ?? {
      item_code: code,
      item_name: text(row.item_name),
      option_name: text(row.option_name),
      category_name1: text(row.category_name1),
      category_name2: text(row.category_name2),
      warehouse_code: text(row.warehouse_code),
      lot_no: text(row.lot_no),
      manufactured_on: manufactured,
      expire_date: expire,
      shelf_life: num(row.shelf_life),
      shelf_life_unit: text(row.shelf_life_unit),
      remaining_days: expire ? daysUntil(today, expire) : null,
      qty: 0,
      locations: 0,
    };
    item.qty += num(row.qty);
    item.locations += 1;
    stockByLot.set(key, item);
  }

  const flow = { in_plan: 0, out_plan: 0, in_doc: 0, out_doc: 0 };
  for (const row of flowRes.data ?? []) {
    const kind = text(row.kind) as keyof typeof flow;
    if (kind in flow) flow[kind] += num(row.docs);
  }

  const stockList = [...stockByLot.values()].sort((a, b) => {
    if (a.expire_date && b.expire_date) return a.expire_date.localeCompare(b.expire_date);
    if (a.expire_date) return -1;
    if (b.expire_date) return 1;
    return b.qty - a.qty;
  });
  const expire6m = { lines: 0, qty: 0 };
  const expire1y = { lines: 0, qty: 0 };
  const expireUnknown = { lines: 0, qty: 0 };
  for (const row of stockList) {
    if (row.remaining_days == null) {
      expireUnknown.lines += 1;
      expireUnknown.qty += row.qty;
      continue;
    }
    if (row.remaining_days <= 365) {
      expire1y.lines += 1;
      expire1y.qty += row.qty;
    }
    if (row.remaining_days <= 183) {
      expire6m.lines += 1;
      expire6m.qty += row.qty;
    }
  }
  const channels = [...byChannel.values()].sort((a, b) => b.lines - a.lines);

  return json({
    ok: true,
    from,
    to,
    captured_at: latestStockCapturedAt(stockRows),
    stock_as_of: latest
      ? { date: latest.snapshot_date, hour: latest.snapshot_hour }
      : null,
    summary: {
      orders: byType.order ?? { lines: 0, qty: 0, amount: 0 },
      shipped: byType.out ?? { lines: 0, qty: 0, amount: 0 },
      cancelled: byType.cancel ?? { lines: 0, qty: 0, amount: 0 },
      exchanged: byType.exchange ?? { lines: 0, qty: 0, amount: 0 },
      returned: byType.return_complete ?? { lines: 0, qty: 0, amount: 0 },
      unshipped: byType.noout ?? { lines: 0, qty: 0, amount: 0 },
      stock_sku: new Set(stockList.map((row) => `${row.item_code}|${row.option_name}`)).size,
      stock_qty: stockList.reduce((sum, row) => sum + row.qty, 0),
      stock_expire: {
        within_6m: expire6m,
        within_1y: expire1y,
        unknown: expireUnknown,
      },
      flow,
    },
    channels,
    base: (baseRes.data ?? []).map((row) => ({
      kind: text(row.kind),
      code: text(row.code),
      name: text(row.name),
      extra: row.extra ?? {},
    })),
    orders: orderLines.slice(0, 1500),
    stock: stockList.slice(0, 1500),
  });
});
