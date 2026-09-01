import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMPANY_ID = "internal";
const WAREHOUSE_TYPE = "0000";
const ORDER_TYPES = [
  "order",
  "out",
  "cancel",
  "exchange",
  "return_complete",
  "noout",
] as const;

type OrderType = (typeof ORDER_TYPES)[number];

type PlusclEnvelope = {
  r_code?: string | number;
  r_msg?: string;
  data?: unknown;
  http?: number;
};

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

function kstNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 9 * 60 * 60 * 1000);
}

function kstDate(offsetDays = 0): string {
  const kst = kstNow();
  kst.setDate(kst.getDate() + offsetDays);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function compactDate(ymd: string): string {
  return ymd.replaceAll("-", "");
}

function snapshotHourForDate(date: string): number {
  const today = kstDate(0);
  if (date < today) return 23;
  return kstHourNow();
}

function kstHourNow(): number {
  return kstNow().getHours();
}

const PLUSCL_EXCLUDE_NEEDLES = ["사방넷_apple6", "사방넷apple6", "cj직배", "자사주문", "샘플_팜스빌"];

function isExcludedPlusclCompany(name: string, code = ""): boolean {
  const hay = `${name} ${code}`.replace(/\s+/g, "").toLowerCase();
  return PLUSCL_EXCLUDE_NEEDLES.some((needle) => hay.includes(needle.replace(/_/g, "")));
}

function plusclChannelId(name: string): string {
  const slug = name.trim().replace(/\s+/g, "_") || "offline";
  return `pluscl_${slug}`;
}

function eventHourKst(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  const compact = trimmed.replace(/\D/g, "");
  if (compact.length >= 10) {
    const hour = Number(compact.slice(8, 10));
    if (Number.isFinite(hour)) return Math.min(23, Math.max(0, hour));
  }
  const match = trimmed.match(/(?:T|\s)(\d{2}):/);
  if (match) {
    const hour = Number(match[1]);
    if (Number.isFinite(hour)) return Math.min(23, Math.max(0, hour));
  }
  return null;
}

type PlusclOrderSnapshotRow = {
  ord_comp_code: string;
  ord_comp_name: string;
  ord_no1: string;
  amount: number;
  event_at: string | null;
};

type ChannelSnapshotInsert = {
  company_id: string;
  snapshot_date: string;
  snapshot_hour: number;
  period: string;
  channel_id: string;
  kind: string;
  source: string;
  sales: number;
  orders: number;
  conversion_rate: null;
  ad_spend: null;
  followers: null;
  reach: null;
  engagement_rate: null;
  extra: Record<string, unknown>;
  captured_at: string;
};

function aggregatePlusclOrders(
  date: string,
  rows: PlusclOrderSnapshotRow[],
  opts?: { snapshotHour?: number; maxHour?: number },
): ChannelSnapshotInsert[] {
  const buckets = new Map<string, { sales: number; orders: Set<string>; lines: number }>();
  const capturedAt = new Date().toISOString();

  for (const row of rows) {
    if (isExcludedPlusclCompany(row.ord_comp_name, row.ord_comp_code)) continue;
    const rowHour = eventHourKst(row.event_at) ?? 0;
    if (opts?.maxHour != null && rowHour > opts.maxHour) continue;

    const name = row.ord_comp_name || row.ord_comp_code || "기타";
    const channelId = plusclChannelId(name);
    let bucket = buckets.get(channelId);
    if (!bucket) {
      bucket = { sales: 0, orders: new Set(), lines: 0 };
      buckets.set(channelId, bucket);
    }
    bucket.sales += row.amount;
    bucket.lines += 1;
    if (row.ord_no1) bucket.orders.add(row.ord_no1);
  }

  const snapshotHour = opts?.snapshotHour ?? snapshotHourForDate(date);
  return [...buckets.entries()].map(([channel_id, bucket]) => ({
    company_id: COMPANY_ID,
    snapshot_date: date,
    snapshot_hour: snapshotHour,
    period: "daily",
    channel_id,
    kind: "commerce",
    source: "pluscl",
    sales: Math.round(bucket.sales),
    orders: bucket.orders.size,
    conversion_rate: null,
    ad_spend: null,
    followers: null,
    reach: null,
    engagement_rate: null,
    extra: { lines: bucket.lines, source: "pluscl" },
    captured_at: capturedAt,
  }));
}

function buildPlusclHourlySnapshots(date: string, rows: PlusclOrderSnapshotRow[]): ChannelSnapshotInsert[] {
  const today = kstDate(0);
  const lastHour = date < today ? 23 : kstHourNow();
  const snapshots: ChannelSnapshotInsert[] = [];
  for (let hour = 0; hour <= lastHour; hour += 1) {
    snapshots.push(...aggregatePlusclOrders(date, rows, { snapshotHour: hour, maxHour: hour }));
  }
  return snapshots;
}

async function syncPlusclChannelSnapshots(
  supabase: ReturnType<typeof createClient>,
  fromDate: string,
  toDate: string,
  notes: string[],
): Promise<number> {
  const { data, error } = await supabase
    .from("pluscl_order_lines")
    .select("ord_date, ord_comp_code, ord_comp_name, ord_no1, amount, event_at")
    .eq("company_id", COMPANY_ID)
    .eq("report_type", "order")
    .gte("ord_date", fromDate)
    .lte("ord_date", toDate);
  if (error) {
    notes.push(`PlusCL 채널 스냅샷 조회 실패: ${error.message}`);
    return 0;
  }

  const byDate = new Map<string, PlusclOrderSnapshotRow[]>();
  for (const row of data ?? []) {
    const date = String(row.ord_date ?? "").slice(0, 10);
    if (!date) continue;
    const bucket = byDate.get(date) ?? [];
    bucket.push({
      ord_comp_code: text(row.ord_comp_code),
      ord_comp_name: text(row.ord_comp_name),
      ord_no1: text(row.ord_no1),
      amount: num(row.amount),
      event_at: text(row.event_at) || null,
    });
    byDate.set(date, bucket);
  }

  const today = kstDate(0);
  const snapshots: ChannelSnapshotInsert[] = [];
  for (const [date, lines] of byDate) {
    if (date === today) snapshots.push(...buildPlusclHourlySnapshots(date, lines));
    else if (date < today) snapshots.push(...aggregatePlusclOrders(date, lines, { snapshotHour: 23, maxHour: 23 }));
  }

  if (snapshots.length === 0) return 0;
  const write = await supabase.from("channel_snapshots").upsert(snapshots, {
    onConflict: "company_id,channel_id,snapshot_date,snapshot_hour,period",
  });
  if (write.error) {
    notes.push(`PlusCL 채널 스냅샷 저장 실패: ${write.error.message}`);
    return 0;
  }
  notes.push(`PlusCL 채널 스냅샷 ${snapshots.length}행 (${fromDate}~${toDate})`);
  return snapshots.length;
}

function asList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  if (value && typeof value === "object") return [value as Record<string, unknown>];
  return [];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function int(value: unknown): number {
  return Math.round(num(value));
}

function ymdFromCompact(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const ymd = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(`${ymd}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return ymd;
}

function addShelfLife(ymd: string, life: number, unit: string): string | null {
  if (life <= 0) return null;
  const date = new Date(`${ymd}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  const kind = unit.toUpperCase();
  if (kind === "Y") date.setUTCFullYear(date.getUTCFullYear() + life);
  else if (kind === "M") date.setUTCMonth(date.getUTCMonth() + life);
  else date.setUTCDate(date.getUTCDate() + life);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pickShelf(row: Record<string, unknown>, fallback?: { life: number; unit: string }) {
  const life = int(row.SheifLift ?? row.sheiflift ?? row.shelf_life);
  const unit = text(row.SheifLift_Unit ?? row.sheiflift_unit ?? row.shelf_life_unit).toUpperCase();
  if (life > 0) return { life, unit: unit || "D" };
  return fallback ?? { life: 0, unit: "" };
}

type ShelfMap = Map<string, { life: number; unit: string }>

function isOk(code: string | number | undefined): boolean {
  return String(code ?? "") === "0";
}

async function plusclPost(path: string, body: unknown): Promise<PlusclEnvelope> {
  const base = env("PLUSCL_BASE_URL", "https://service.pluscl.com").replace(/\/$/, "");
  const auth = env("PLUSCL_AUTH_KEY");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      auth_key: auth,
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: PlusclEnvelope | null = null;
  try {
    payload = JSON.parse(raw) as PlusclEnvelope;
  } catch {
    payload = null;
  }
  if (!payload) {
    return { r_code: String(response.status), r_msg: `http ${response.status}`, data: [], http: response.status };
  }
  return { ...payload, http: response.status };
}

type Codes = {
  apiCompanyId: string
  company: string
  warehouse: string
  warehouses: string[]
  seller: string
  userId: string
}

type OrderEndpoint = {
  path: string
  withUser: boolean
  withWarehouseList: boolean
  useCompanyId: boolean
}

let orderEndpoint: OrderEndpoint | null = null;

function failText(response: PlusclEnvelope): string {
  return `http=${response.http ?? "?"} r_code=${String(response.r_code ?? "")} r_msg=${text(response.r_msg) || "(empty)"}`;
}

function wmsBody(codes: Codes, warehouse: string, extra: Record<string, unknown> = {}, withUser = false) {
  const body: Record<string, unknown> = {
    company_code: codes.company,
    warehouse_code: warehouse,
    warehouse_type_code: WAREHOUSE_TYPE,
    seller_code: codes.seller,
    ...extra,
  };
  if (withUser && codes.userId) body.user_id = codes.userId;
  return body;
}

const BASE_TYPES = [
  "seller",
  "warehouse_type",
  "order_company",
  "delivery",
  "deal_company",
] as const;

type BaseKind = (typeof BASE_TYPES)[number];

async function fetchBase(type: BaseKind | "common_code", companyId: string | null): Promise<PlusclEnvelope> {
  const body: Record<string, unknown> = {
    job_type: "search",
    type,
    data: "",
  };
  if (companyId) body.company_id = companyId;
  return await plusclPost("/open/base_data", body);
}

function mapBaseRows(kind: BaseKind, rows: Record<string, unknown>[]) {
  return rows.map((row, index) => {
    let code = "";
    let name = "";
    const extra: Record<string, unknown> = {};
    if (kind === "seller") {
      code = text(row.seller_code);
      name = text(row.seller_name);
      extra.seller_kind = text(row.seller_kind);
      extra.use_flag = row.use_flag ?? null;
    } else if (kind === "warehouse_type") {
      code = `${text(row.warehouse_code)}:${text(row.warehouse_type_code) || WAREHOUSE_TYPE}`;
      name = text(row.warehouse_type_name) || text(row.warehouse_code);
      extra.warehouse_code = text(row.warehouse_code);
      extra.warehouse_type_code = text(row.warehouse_type_code);
    } else if (kind === "order_company" || kind === "delivery") {
      code = text(row.comp_code);
      name = text(row.comp_name);
      if (kind === "delivery") extra.homepage = text(row.homepage);
      if (kind === "order_company") extra.direct_yn = text(row.direct_yn);
    } else {
      code = text(row.comp_code);
      name = text(row.comp_name);
      extra.seller_code = text(row.seller_code);
      extra.comp_gubun = text(row.comp_gubun);
    }
    return {
      company_id: COMPANY_ID,
      kind,
      code: code || `${kind}-${index + 1}`,
      name,
      extra,
    };
  });
}

async function collectBase(notes: string[]): Promise<{ codes: Codes; rows: ReturnType<typeof mapBaseRows> }> {
  const apiCompanyId = env("PLUSCL_COMPANY_CODE") || env("PLUSCL_COMPANY_ID");
  const codes: Codes = {
    apiCompanyId,
    company: "",
    warehouse: env("PLUSCL_WAREHOUSE_CODE"),
    warehouses: [],
    seller: env("PLUSCL_SELLER_CODE"),
    userId: env("PLUSCL_USER_ID"),
  };
  const companyCandidates: Array<string | null> = [];
  if (apiCompanyId) companyCandidates.push(apiCompanyId);
  companyCandidates.push(null);

  const collected: ReturnType<typeof mapBaseRows> = [];
  let usedCompany: string | null = codes.company || null;

  for (const candidate of companyCandidates) {
    notes.push(candidate ? "기초정보: company_id 포함 요청" : "기초정보: company_id 없이 auth_key만 요청");
    let gotAny = false;
    for (const kind of BASE_TYPES) {
      const response = await fetchBase(kind, candidate);
      const list = asList(response.data);
      if (!isOk(response.r_code)) {
        const dataShape = Array.isArray(response.data)
          ? `array:${list.length}`
          : response.data == null
            ? "null"
            : typeof response.data;
        notes.push(
          `기초정보 ${kind}: r_code=${String(response.r_code ?? "")} r_msg=${response.r_msg ?? ""} data=${dataShape}`,
        );
        continue;
      }
      gotAny = true;
      const mapped = mapBaseRows(kind, list);
      collected.push(...mapped);
      notes.push(`기초정보 ${kind}: ${mapped.length}건`);
    }
    if (gotAny) {
      usedCompany = candidate;
      break;
    }
  }

  const seller = collected.find((row) => row.kind === "seller");
  const warehouseRows = collected.filter((row) => row.kind === "warehouse_type");
  const preferredWarehouse = warehouseRows.find((row) => text(row.extra.warehouse_type_code) === WAREHOUSE_TYPE)
    ?? warehouseRows[0];
  if (!codes.seller && seller) codes.seller = seller.code;
  const warehouses = [...new Set(
    warehouseRows.map((row) => text(row.extra.warehouse_code)).filter(Boolean),
  )];
  if (codes.warehouse && !warehouses.includes(codes.warehouse)) warehouses.unshift(codes.warehouse);
  codes.warehouses = warehouses;
  if (!codes.warehouse && preferredWarehouse) codes.warehouse = text(preferredWarehouse.extra.warehouse_code);
  if (!codes.warehouse && warehouses[0]) codes.warehouse = warehouses[0];
  // 재고·주문은 company_id(업체등록번호)가 아니라 화주/창고 코드(company_code)를 쓴다.
  codes.company = codes.seller || codes.warehouse;
  if (!codes.userId && codes.seller) codes.userId = codes.seller;
  notes.push(
    `요청 식별: wms_company=${codes.company || "없음"} warehouse=${codes.warehouse || "없음"} seller=${codes.seller || "없음"} warehouses=${codes.warehouses.length} base_company_id=${usedCompany ? "있음" : "없음"}`,
  );
  return { codes, rows: collected };
}

function mapStockRows(
  date: string,
  hour: number,
  warehouse: string,
  seller: string,
  list: Record<string, unknown>[],
  shelves: ShelfMap,
) {
  return list.map((row) => {
    const itemCode = text(row.item_code) || "unknown";
    const lotNo = text(row.lot_no);
    const shelf = pickShelf(row, shelves.get(itemCode));
    const lotDate = ymdFromCompact(lotNo);
    let manufacturedOn: string | null = null;
    let expireDate: string | null = null;
    if (lotDate && shelf.life > 0) {
      manufacturedOn = lotDate;
      expireDate = addShelfLife(lotDate, shelf.life, shelf.unit);
    } else if (lotDate) {
      expireDate = lotDate;
    }
    return {
      company_id: COMPANY_ID,
      snapshot_date: date,
      snapshot_hour: hour,
      warehouse_code: warehouse || text(row.warehouse_code),
      seller_code: seller,
      item_code: itemCode,
      item_name: text(row.item_name),
      option_name: text(row.option_name),
      category_name1: text(row.category_name1),
      category_name2: text(row.category_name2),
      rack_code: text(row.rack_code),
      lot_no: lotNo,
      qty: int(row.qty),
      item_state: text(row.item_state),
      manufactured_on: manufacturedOn,
      shelf_life: shelf.life,
      shelf_life_unit: shelf.unit,
      expire_date: expireDate,
    };
  });
}

async function fetchItemShelves(codes: Codes, warehouse: string, notes: string[]): Promise<{ itemCodes: string[]; shelves: ShelfMap }> {
  const shelves: ShelfMap = new Map();
  const response = await plusclPost("/open/items", wmsBody(codes, warehouse, {
    job_type: "search",
    type: "manager",
    IsOld: "Y",
    data: {
      item_code: "",
      item_name: "",
      item_opt: "",
      style: "",
      brand: "",
      event: "",
      deal_comp: "",
      category_name1: "",
      category_name2: "",
    },
  }, true));
  if (!isOk(response.r_code)) {
    notes.push(`상품목록 실패(${warehouse}): ${failText(response)}`);
    return { itemCodes: [], shelves };
  }
  const rows = asList(response.data);
  for (const row of rows) {
    const code = text(row.item_code);
    if (!code) continue;
    const shelf = pickShelf(row);
    if (shelf.life > 0) shelves.set(code, shelf);
  }
  const itemCodes = [...new Set(rows.map((row) => text(row.item_code)).filter(Boolean))];
  notes.push(`상품목록 ${warehouse}: ${itemCodes.length}건 유통기간 ${shelves.size}건`);
  return { itemCodes, shelves };
}

async function collectStock(date: string, hour: number, codes: Codes, notes: string[]) {
  const warehouses = codes.warehouses.length ? codes.warehouses : [codes.warehouse].filter(Boolean);
  const rows: ReturnType<typeof mapStockRows> = [];
  const shelves: ShelfMap = new Map();

  for (const warehouse of warehouses) {
    const catalog = await fetchItemShelves(codes, warehouse, notes);
    for (const [code, shelf] of catalog.shelves) shelves.set(code, shelf);

    const variants: unknown[] = [
      wmsBody(codes, warehouse),
      wmsBody(codes, warehouse, { data: {} }),
      wmsBody(codes, warehouse, { data: "" }),
    ];
    let got = false;
    for (const body of variants) {
      const response = await plusclPost("/open/stock_qty", body);
      if (!isOk(response.r_code)) continue;
      const mapped = mapStockRows(date, hour, warehouse, codes.seller, asList(response.data), shelves);
      rows.push(...mapped);
      notes.push(`현재고 ${warehouse}: ${mapped.length}행`);
      got = true;
      break;
    }
    if (got) continue;

    if (catalog.itemCodes.length === 0) {
      notes.push(`현재고 ${warehouse} 실패: 빈 조건·상품코드 모두 실패`);
      continue;
    }
    for (let i = 0; i < catalog.itemCodes.length; i += 80) {
      const batch = catalog.itemCodes.slice(i, i + 80);
      const response = await plusclPost("/open/stock_qty", wmsBody(codes, warehouse, {
        data: { item_code: batch },
      }));
      if (!isOk(response.r_code)) {
        notes.push(`현재고 ${warehouse} 배치 실패: ${failText(response)}`);
        break;
      }
      rows.push(...mapStockRows(date, hour, warehouse, codes.seller, asList(response.data), shelves));
    }
    notes.push(`현재고 ${warehouse} 상품코드 조회 후 ${rows.filter((row) => row.warehouse_code === warehouse).length}행`);
  }

  const dated = rows.filter((row) => row.expire_date).length;
  notes.push(`현재고 합계 ${rows.length}행 유통기한 ${dated}행`);
  return rows;
}

function orderData(codes: Codes, from: string, to: string, page: number, withWarehouseList: boolean) {
  const data: Record<string, unknown> = {
    begin_date: compactDate(from),
    end_date: compactDate(to),
    page: String(page),
  };
  if (withWarehouseList) {
    data.warehouse_list = (codes.warehouses.length ? codes.warehouses : [codes.warehouse]).filter(Boolean).join(", ");
  }
  return data;
}

async function probeOrderEndpoint(codes: Codes, from: string, to: string, notes: string[]): Promise<OrderEndpoint | null> {
  if (orderEndpoint) return orderEndpoint;
  const paths = ["/open/order_report", "/open/report"];
  for (const path of paths) {
    for (const withWarehouseList of [false, true]) {
      for (const withUser of [true, false]) {
        const response = await plusclPost(path, wmsBody(codes, codes.warehouse, {
          job_type: "search",
          type: "order",
          data: orderData(codes, from, to, 1, withWarehouseList),
        }, withUser));
        if (isOk(response.r_code)) {
          orderEndpoint = { path, withUser, withWarehouseList, useCompanyId: false };
          notes.push(`주문 엔드포인트: ${path} user=${withUser ? "Y" : "N"} warehouse_list=${withWarehouseList ? "Y" : "N"}`);
          return orderEndpoint;
        }
        notes.push(`주문 probe ${path} user=${withUser ? "Y" : "N"} list=${withWarehouseList ? "Y" : "N"}: ${failText(response)}`);
      }
    }
  }
  if (codes.apiCompanyId) {
    for (const path of paths) {
      const response = await plusclPost(path, {
        company_id: codes.apiCompanyId,
        job_type: "search",
        type: "order",
        data: orderData(codes, from, to, 1, true),
      });
      if (isOk(response.r_code)) {
        orderEndpoint = { path, withUser: false, withWarehouseList: true, useCompanyId: true };
        notes.push(`주문 엔드포인트: ${path} company_id 형식`);
        return orderEndpoint;
      }
      notes.push(`주문 probe ${path} company_id: ${failText(response)}`);
    }
  }
  return null;
}

async function collectReport(
  type: OrderType,
  from: string,
  to: string,
  codes: Codes,
  notes: string[],
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const endpoint = await probeOrderEndpoint(codes, from, to, notes);
  if (!endpoint) {
    notes.push(`주문 ${type} 실패: 사용 가능한 주문 API 경로 없음`);
    return 0;
  }

  let saved = 0;
  let page = 1;
  while (page <= 8) {
    const body = endpoint.useCompanyId
      ? {
        company_id: codes.apiCompanyId,
        job_type: "search",
        type,
        data: orderData(codes, from, to, page, endpoint.withWarehouseList),
      }
      : wmsBody(codes, codes.warehouse, {
        job_type: "search",
        type,
        data: orderData(codes, from, to, page, endpoint.withWarehouseList),
      }, endpoint.withUser);
    const response = await plusclPost(endpoint.path, body);
    if (!isOk(response.r_code)) {
      notes.push(`주문 ${type} 실패: ${failText(response)}`);
      break;
    }
    const chunk = asList(response.data);
    const mapped = [];
    for (const row of chunk) {
      const inner = int(row.ord_inner_seq);
      if (!inner) continue;
      mapped.push({
        company_id: COMPANY_ID,
        report_type: type,
        ord_inner_seq: inner,
        item_seq: int(row.item_seq) || 1,
        ord_date: ymdFromCompact(row.ord_date) ?? from,
        ord_comp_code: text(row.ord_comp_code),
        ord_comp_name: text(row.ord_comp_name),
        ord_no1: text(row.ord_no1),
        item_code: text(row.item_code),
        item_name: text(row.item_name),
        option_name: text(row.option_name || row.ord_item_opt1),
        qty: int(row.qty),
        amount: num(row.amount),
        fare_price: num(row.fare_price),
        invoice_no: text(row.invoice_no),
        event_at: text(row.regdatetime_dt) || null,
      });
    }
    const unique = new Map<string, typeof mapped[number]>();
    for (const row of mapped) {
      unique.set(`${row.report_type}:${row.ord_inner_seq}:${row.item_seq}`, row);
    }
    const toSave = [...unique.values()];
    if (toSave.length > 0) {
      const write = await supabase.from("pluscl_order_lines").upsert(toSave, {
        onConflict: "company_id,report_type,ord_inner_seq,item_seq",
      });
      if (write.error) {
        notes.push(`주문 ${type} 저장 실패: ${write.error.message}`);
        break;
      }
      saved += mapped.length;
    }
    if (chunk.length < 1000) break;
    page += 1;
  }

  notes.push(`주문 ${type} ${saved}행`);
  return saved;
}

async function collectFlow(from: string, to: string, codes: Codes, notes: string[]) {
  const jobs: Array<{ kind: "in_plan" | "out_plan" | "in_doc" | "out_doc"; path: string }> = [
    { kind: "in_plan", path: "/open/item_in_plan" },
    { kind: "out_plan", path: "/open/item_out_plan" },
    { kind: "in_doc", path: "/open/item_in" },
    { kind: "out_doc", path: "/open/item_out" },
  ];
  const rows = [];
  const snapshotDate = to;
  for (const job of jobs) {
    const response = await plusclPost(job.path, wmsBody(codes, codes.warehouse, {
      job_type: "search",
      type: "doc",
      IsOld: "Y",
      data: { begin_date: compactDate(from), end_date: compactDate(to) },
    }, true));
    if (!isOk(response.r_code)) {
      notes.push(`${job.kind} 실패: ${failText(response)}`);
      continue;
    }
    const docs = asList(response.data).length;
    rows.push({
      company_id: COMPANY_ID,
      snapshot_date: snapshotDate,
      kind: job.kind,
      docs,
    });
    notes.push(`${job.kind} ${docs}건`);
  }
  return rows;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST" && request.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }

  const expected = env("COLLECT_SECRET");
  const given = request.headers.get("x-collect-secret") ?? "";
  if (expected && given !== expected) return json({ error: "unauthorized" }, 401);

  if (!env("PLUSCL_AUTH_KEY")) {
    return json({
      ok: false,
      error: "pluscl not configured",
      notes: ["PLUSCL_AUTH_KEY 를 Edge Function Secrets 에 넣으세요."],
    }, 400);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "missing supabase env" }, 500);

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const days = Math.min(31, Math.max(1, Number(url.searchParams.get("days") || "7") || 7));
  const toDate = dateParam || kstDate(0);
  const fromDate = dateParam ? dateParam : kstDate(1 - days);
  const supabase = createClient(supabaseUrl, serviceKey);
  const notes: string[] = [];
  const base = await collectBase(notes);
  const codes = base.codes;
  let baseRows = 0;
  if (base.rows.length > 0) {
    const write = await supabase.from("pluscl_base_rows").upsert(base.rows, {
      onConflict: "company_id,kind,code",
    });
    if (write.error) notes.push(`기초정보 저장 실패: ${write.error.message}`);
    else baseRows = base.rows.length;
  }

  const stage = url.searchParams.get("stage") ?? "base";
  let stockRows = 0;
  let orderRows = 0;
  let flowRows = 0;

  if (stage === "base") {
    return json({
      ok: true,
      stage: "base",
      base_rows: baseRows,
      stock_rows: 0,
      order_rows: 0,
      flow_rows: 0,
      notes,
    });
  }

  const hour = snapshotHourForDate(toDate);
  notes.push(`--- ${fromDate} ~ ${toDate} ${String(hour).padStart(2, "0")}시 ---`);
  orderEndpoint = null;

  if (stage !== "orders") {
    const stock = await collectStock(toDate, hour, codes, notes);
    if (stock.length > 0) {
      const write = await supabase.from("pluscl_stock_snapshots").upsert(stock, {
        onConflict: "company_id,snapshot_date,snapshot_hour,warehouse_code,item_code,rack_code,lot_no",
      });
      if (write.error) notes.push(`재고 저장 실패: ${write.error.message}`);
      else stockRows += stock.length;
    }
  }

  if (stage !== "stock") {
    for (const type of ORDER_TYPES) {
      orderRows += await collectReport(type, fromDate, toDate, codes, notes, supabase);
    }
    await syncPlusclChannelSnapshots(supabase, fromDate, toDate, notes);
  }

  if (stage === "full") {
    const flow = await collectFlow(fromDate, toDate, codes, notes);
    if (flow.length > 0) {
      const write = await supabase.from("pluscl_flow_daily").upsert(flow, {
        onConflict: "company_id,snapshot_date,kind",
      });
      if (write.error) notes.push(`입출고 현황 저장 실패: ${write.error.message}`);
      else flowRows += flow.length;
    }
  }

  return json({
    ok: true,
    snapshot_dates: fromDate === toDate ? [toDate] : [fromDate, toDate],
    from: fromDate,
    to: toDate,
    base_rows: baseRows,
    stock_rows: stockRows,
    order_rows: orderRows,
    flow_rows: flowRows,
    notes,
  });
});
