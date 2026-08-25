import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMPANY_ID = "internal";

/**
 * 광고 수집 스위치. 프론트 src/ads/catalog.ts 와 맞출 것.
 * 판매 채널은 사방넷 예정이라 여기서 모으지 않는다.
 */
const AD_COLLECTORS: Record<string, { enabled: boolean }> = {
  naver: { enabled: true },
  coupang: { enabled: false },
  google: { enabled: false },
};

type SnapshotInsert = {
  company_id: string;
  snapshot_date: string;
  period: "daily";
  channel_id: string;
  kind: "commerce" | "sns";
  source: string;
  sales: number | null;
  orders: number | null;
  conversion_rate: number | null;
  ad_spend: number | null;
  followers: number | null;
  reach: number | null;
  engagement_rate: number | null;
  extra: Record<string, unknown>;
};

function isAdCollectorEnabled(id: string) {
  return AD_COLLECTORS[id]?.enabled === true;
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

function collectDates(requested: string | null): string[] {
  if (requested) return [requested];
  const today = kstDate(0);
  if (kstNow().getHours() !== 8) return [today];
  const yesterday = kstDate(-1);
  return yesterday === today ? [today] : [yesterday, today];
}

function snapshotHourForDate(date: string): number {
  const today = kstDate(0);
  if (date < today) return 23;
  return kstNow().getHours();
}

async function hmacSha256(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const bytes = new Uint8Array(await hmacSha256(secret, message));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const bytes = new Uint8Array(await hmacSha256(secret, message));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function apiErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.message === "string" && record.message) return record.message;
  if (typeof record.errorMessage === "string" && record.errorMessage) return record.errorMessage;
  if (typeof record.title === "string" && record.title) return record.title;
  if (typeof record.code === "string" && record.code) return record.code;
  return JSON.stringify(body).slice(0, 300) || fallback;
}

function coupangDatetime(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").slice(2);
}

type CoupangAccount = {
  channelId: "coupang_1" | "coupang_2";
  label: string;
  accessKey: string;
  secretKey: string;
  vendorId: string;
};

function envOrFallback(name: string, fallbackName?: string) {
  const value = Deno.env.get(name) || (fallbackName ? Deno.env.get(fallbackName) : undefined);
  return value?.trim();
}

function readCoupangAccounts(): CoupangAccount[] {
  const accounts: CoupangAccount[] = [];

  for (const n of [1, 2] as const) {
    const fallback = n === 1;
    const accessKey = envOrFallback(
      `COUPANG_${n}_ACCESS_KEY`,
      fallback ? "COUPANG_ACCESS_KEY" : undefined,
    );
    const secretKey = envOrFallback(
      `COUPANG_${n}_SECRET_KEY`,
      fallback ? "COUPANG_SECRET_KEY" : undefined,
    );
    const vendorId = envOrFallback(
      `COUPANG_${n}_VENDOR_ID`,
      fallback ? "COUPANG_VENDOR_ID" : undefined,
    );
    const label = Deno.env.get(`COUPANG_${n}_LABEL`) ?? `쿠팡 ${n}`;

    if (accessKey && secretKey && vendorId) {
      accounts.push({
        channelId: `coupang_${n}`,
        label,
        accessKey,
        secretKey,
        vendorId,
      });
    }
  }

  return accounts;
}

async function fetchCoupangDay(account: CoupangAccount, date: string) {
  const method = "GET";
  const path = `/v2/providers/openapi/apis/api/v4/vendors/${account.vendorId}/ordersheets`;
  const query = `createdAtFrom=${date}T00:00&createdAtTo=${date}T23:59&maxPerPage=50`;
  const datetime = coupangDatetime();
  const signature = await hmacSha256Hex(account.secretKey, `${datetime}${method}${path}${query}`);
  const authorization =
    `CEA algorithm=HmacSHA256, access-key=${account.accessKey}, signed-date=${datetime}, signature=${signature}`;

  const response = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json;charset=UTF-8",
      "X-Requested-By": account.vendorId,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false as const,
      reason: "http-error",
      status: response.status,
      message: apiErrorMessage(body, "coupang request failed"),
    };
  }

  const data = Array.isArray(body?.data) ? body.data : [];
  let sales = 0;
  let orders = 0;
  for (const sheet of data) {
    orders += 1;
    const price = Number(sheet?.orderPrice ?? sheet?.paidPrice ?? sheet?.totalPrice ?? 0);
    if (!Number.isNaN(price)) sales += price;
  }

  return { ok: true as const, sales, orders, rawCount: data.length };
}

type NaverSaAccount = {
  label: string;
  apiKey: string;
  secretKey: string;
  customerId: string;
};

function readNaverSaAccounts(): NaverSaAccount[] {
  const accounts: NaverSaAccount[] = [];

  for (const n of [1, 2] as const) {
    const numbered = n === 1;
    const apiKey = envOrFallback(
      `NAVER_SA_${n}_API_KEY`,
      numbered ? "NAVER_SA_API_KEY" : undefined,
    );
    const secretKey = envOrFallback(
      `NAVER_SA_${n}_SECRET_KEY`,
      numbered ? "NAVER_SA_SECRET_KEY" : undefined,
    );
    const customerId = envOrFallback(
      `NAVER_SA_${n}_CUSTOMER_ID`,
      numbered ? "NAVER_SA_CUSTOMER_ID" : undefined,
    );
    const label =
      envOrFallback(`NAVER_SA_${n}_LABEL`, numbered ? "NAVER_SA_LABEL" : undefined) ??
      `네이버 SA ${n}`;

    if (apiKey && secretKey && customerId) {
      accounts.push({ label, apiKey, secretKey, customerId });
    }
  }

  return accounts;
}

async function naverSaHeaders(account: NaverSaAccount, method: string, path: string) {
  const timestamp = String(Date.now());
  const signature = await hmacSha256Base64(account.secretKey, `${timestamp}.${method}.${path}`);
  return {
    "Content-Type": "application/json; charset=UTF-8",
    "X-Timestamp": timestamp,
    "X-API-KEY": account.apiKey,
    "X-Customer": account.customerId,
    "X-Signature": signature,
  };
}

async function naverSaGet(account: NaverSaAccount, path: string, query = "") {
  const headers = await naverSaHeaders(account, "GET", path);
  const url = `https://api.searchad.naver.com${path}${query ? `?${query}` : ""}`;
  const response = await fetch(url, { method: "GET", headers });
  const body = await response.json().catch(() => null);
  return { response, body };
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.campaigns)) return record.campaigns;
  if (Array.isArray(record.items)) return record.items;
  return [];
}

function idText(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function campaignIdOf(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  return idText(record.nccCampaignId ?? record.campaignId ?? record.id);
}

function campaignTpOf(item: unknown): string {
  if (!item || typeof item !== "object") return "UNKNOWN";
  const record = item as Record<string, unknown>;
  const raw = record.campaignTp ?? record.campaignType ?? record.tp;
  if (typeof raw === "string" && raw) return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "UNKNOWN";
}

function campaignNameOf(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const record = item as Record<string, unknown>;
  return typeof record.name === "string" ? record.name : "";
}

function pickMeta(item: unknown, keys: string[]): Record<string, unknown> {
  if (!item || typeof item !== "object") return {};
  const record = item as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  return out;
}

const CAMPAIGN_META_KEYS = [
  "name",
  "userLock",
  "status",
  "statusReason",
  "dailyBudget",
  "useDailyBudget",
  "deliveryMethod",
  "usePeriod",
  "periodStartDt",
  "periodEndDt",
  "sharedBudgetId",
];

const ADGROUP_META_KEYS = [
  "name",
  "nccCampaignId",
  "userLock",
  "status",
  "statusReason",
  "bidAmt",
  "useDailyBudget",
  "dailyBudget",
  "adgroupType",
];

function campaignProduct(tp: string): "sa" | "da" {
  const value = tp.toUpperCase();
  if (value === "WEB_SITE" || value === "SHOPPING" || value === "1" || value === "2") return "sa";
  return "da";
}

/** 검색광고 /stats 공식 지표. 합산 가능 값과 비율·순위 값을 나눈다. */
const NAVER_STAT_FIELDS = [
  "impCnt",
  "clkCnt",
  "ctr",
  "cpc",
  "salesAmt",
  "ccnt",
  "crto",
  "convAmt",
  "ror",
  "cpConv",
  "avgRnk",
  "pcNxAvgRnk",
  "mblNxAvgRnk",
  "recentAvgRnk",
  "recentAvgCpc",
  "viewCnt",
] as const;

const NAVER_STAT_FIELDS_FALLBACK = NAVER_STAT_FIELDS.filter((key) => key !== "recentAvgCpc");

type WeightAcc = { weighted: number; weight: number };

function emptyWeight(): WeightAcc {
  return { weighted: 0, weight: 0 };
}

function addWeighted(acc: WeightAcc, value: number, weight: number) {
  if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) return;
  acc.weighted += value * weight;
  acc.weight += weight;
}

function weightAvg(acc: WeightAcc): number | null {
  if (acc.weight <= 0) return null;
  return acc.weighted / acc.weight;
}

function statNumber(record: Record<string, unknown>, key: string): number {
  const value = Number(record[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function deriveRates(impressions: number, clicks: number, spend: number, conversions: number, convAmt: number) {
  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    crto: clicks > 0 ? (conversions / clicks) * 100 : 0,
    ror: spend > 0 ? (convAmt / spend) * 100 : 0,
    cpConv: conversions > 0 ? spend / conversions : 0,
  };
}

type EntityStats = {
  impCnt: number;
  clkCnt: number;
  salesAmt: number;
  ccnt: number;
  convAmt: number;
  viewCnt: number;
  wAvgRnk: WeightAcc;
  wPcNxAvgRnk: WeightAcc;
  wMblNxAvgRnk: WeightAcc;
  wRecentAvgRnk: WeightAcc;
  wRecentAvgCpc: WeightAcc;
};

function emptyEntityStats(): EntityStats {
  return {
    impCnt: 0,
    clkCnt: 0,
    salesAmt: 0,
    ccnt: 0,
    convAmt: 0,
    viewCnt: 0,
    wAvgRnk: emptyWeight(),
    wPcNxAvgRnk: emptyWeight(),
    wMblNxAvgRnk: emptyWeight(),
    wRecentAvgRnk: emptyWeight(),
    wRecentAvgCpc: emptyWeight(),
  };
}

function addStatInto(target: EntityStats, stat: unknown) {
  if (!stat || typeof stat !== "object") return;
  const record = stat as Record<string, unknown>;
  const impressions = statNumber(record, "impCnt");
  const clicks = statNumber(record, "clkCnt");
  target.impCnt += impressions;
  target.clkCnt += clicks;
  target.salesAmt += statNumber(record, "salesAmt");
  target.ccnt += statNumber(record, "ccnt");
  target.convAmt += statNumber(record, "convAmt");
  target.viewCnt += statNumber(record, "viewCnt");
  addWeighted(target.wAvgRnk, statNumber(record, "avgRnk"), impressions);
  addWeighted(target.wPcNxAvgRnk, statNumber(record, "pcNxAvgRnk"), impressions);
  addWeighted(target.wMblNxAvgRnk, statNumber(record, "mblNxAvgRnk"), impressions);
  addWeighted(target.wRecentAvgRnk, statNumber(record, "recentAvgRnk"), impressions);
  addWeighted(target.wRecentAvgCpc, statNumber(record, "recentAvgCpc"), clicks);
}

function mergeEntityStats(target: EntityStats, next: EntityStats) {
  target.impCnt += next.impCnt;
  target.clkCnt += next.clkCnt;
  target.salesAmt += next.salesAmt;
  target.ccnt += next.ccnt;
  target.convAmt += next.convAmt;
  target.viewCnt += next.viewCnt;
  target.wAvgRnk.weighted += next.wAvgRnk.weighted;
  target.wAvgRnk.weight += next.wAvgRnk.weight;
  target.wPcNxAvgRnk.weighted += next.wPcNxAvgRnk.weighted;
  target.wPcNxAvgRnk.weight += next.wPcNxAvgRnk.weight;
  target.wMblNxAvgRnk.weighted += next.wMblNxAvgRnk.weighted;
  target.wMblNxAvgRnk.weight += next.wMblNxAvgRnk.weight;
  target.wRecentAvgRnk.weighted += next.wRecentAvgRnk.weighted;
  target.wRecentAvgRnk.weight += next.wRecentAvgRnk.weight;
  target.wRecentAvgCpc.weighted += next.wRecentAvgCpc.weighted;
  target.wRecentAvgCpc.weight += next.wRecentAvgCpc.weight;
}

function snapshotFromEntity(stats: EntityStats): Record<string, number | null> {
  const rates = deriveRates(stats.impCnt, stats.clkCnt, stats.salesAmt, stats.ccnt, stats.convAmt);
  return {
    impCnt: stats.impCnt,
    clkCnt: stats.clkCnt,
    salesAmt: stats.salesAmt,
    ccnt: stats.ccnt,
    convAmt: stats.convAmt,
    viewCnt: stats.viewCnt,
    ...rates,
    avgRnk: weightAvg(stats.wAvgRnk),
    pcNxAvgRnk: weightAvg(stats.wPcNxAvgRnk),
    mblNxAvgRnk: weightAvg(stats.wMblNxAvgRnk),
    recentAvgRnk: weightAvg(stats.wRecentAvgRnk),
    recentAvgCpc: weightAvg(stats.wRecentAvgCpc),
  };
}

type CampaignRef = {
  id: string;
  campaignTp: string;
  name: string;
  meta: Record<string, unknown>;
  stats: EntityStats;
};

type AdgroupRef = {
  id: string;
  campaignId: string;
  name: string;
  meta: Record<string, unknown>;
  stats: EntityStats;
};

type AdMetrics = EntityStats & {
  campaignCount: number;
  campaignTypes: Record<string, number>;
  campaigns: CampaignRef[];
  adgroups: AdgroupRef[];
};

function emptyAdMetrics(): AdMetrics {
  return {
    ...emptyEntityStats(),
    campaignCount: 0,
    campaignTypes: {},
    campaigns: [],
    adgroups: [],
  };
}

function addStatNumbers(target: AdMetrics, stat: unknown) {
  addStatInto(target, stat);
}

async function listPaged(
  account: NaverSaAccount,
  path: string,
  extraQuery = "",
  idOf: (item: unknown) => string | null,
) {
  const rows: unknown[] = [];
  let baseSearchId = "";

  for (let page = 0; page < 50; page += 1) {
    const parts = [extraQuery, baseSearchId ? `baseSearchId=${encodeURIComponent(baseSearchId)}` : ""]
      .filter(Boolean);
    const { response, body } = await naverSaGet(account, path, parts.join("&"));
    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        message: apiErrorMessage(body, `${path} failed`),
        rows,
      };
    }

    const pageRows = asArray(body);
    if (pageRows.length === 0) break;
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
    const lastId = idOf(pageRows[pageRows.length - 1]);
    if (!lastId || lastId === baseSearchId) break;
    baseSearchId = lastId;
  }

  return { ok: true as const, rows };
}

async function listCampaigns(account: NaverSaAccount) {
  const listed = await listPaged(account, "/ncc/campaigns", "", campaignIdOf);
  if (!listed.ok) {
    return {
      ok: false as const,
      status: listed.status,
      message: listed.message,
      campaigns: [] as CampaignRef[],
    };
  }

  const campaigns: CampaignRef[] = [];
  for (const row of listed.rows) {
    const id = campaignIdOf(row);
    if (!id) continue;
    campaigns.push({
      id,
      campaignTp: campaignTpOf(row),
      name: campaignNameOf(row),
      meta: pickMeta(row, CAMPAIGN_META_KEYS),
      stats: emptyEntityStats(),
    });
  }
  return { ok: true as const, campaigns };
}

function adgroupIdOf(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  return idText(record.nccAdgroupId ?? record.adgroupId ?? record.id);
}

async function listAdgroups(account: NaverSaAccount) {
  const listed = await listPaged(account, "/ncc/adgroups", "", adgroupIdOf);
  if (!listed.ok) return { ok: false as const, adgroups: [] as AdgroupRef[], message: listed.message };
  const adgroups: AdgroupRef[] = [];
  for (const row of listed.rows) {
    const id = adgroupIdOf(row);
    if (!id) continue;
    const record = row as Record<string, unknown>;
    adgroups.push({
      id,
      campaignId: idText(record.nccCampaignId ?? record.campaignId) ?? "",
      name: campaignNameOf(row),
      meta: pickMeta(row, ADGROUP_META_KEYS),
      stats: emptyEntityStats(),
    });
  }
  return { ok: true as const, adgroups };
}

function linkedCustomerIdOf(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  return idText(
    record.clientCustomerId ??
      record.customerId ??
      record.nccCustomerId ??
      record.adAccountNo ??
      record.loginId,
  );
}

async function listLinkedCustomerIds(account: NaverSaAccount) {
  const { response, body } = await naverSaGet(account, "/customer-links", "type=MYCLIENTS");
  if (!response.ok) return [] as string[];
  const ids = asArray(body).map(linkedCustomerIdOf).filter((id): id is string => Boolean(id));
  return [...new Set(ids)].filter((id) => id !== account.customerId);
}

function statItemsOf(item: unknown): unknown[] {
  if (!item || typeof item !== "object") return [];
  const record = item as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data;
  if (record.stats && typeof record.stats === "object") return [record.stats];
  return [record];
}

function applyCampaignStats(
  body: unknown,
  campaignsById: Map<string, CampaignRef>,
  productOf: Map<string, "sa" | "da">,
  sa: AdMetrics,
  da: AdMetrics,
) {
  for (const item of asArray(body)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = idText(record.id ?? record.nccCampaignId ?? record.campaignId);
    const campaign = id ? campaignsById.get(id) : undefined;
    const bucket = (id ? productOf.get(id) : undefined) ?? "sa";
    const target = bucket === "da" ? da : sa;
    for (const stat of statItemsOf(item)) {
      addStatNumbers(target, stat);
      if (campaign) addStatInto(campaign.stats, stat);
    }
  }
}

function applyAdgroupStats(
  body: unknown,
  adgroupsById: Map<string, AdgroupRef>,
  productOf: Map<string, "sa" | "da">,
) {
  for (const item of asArray(body)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = idText(record.id ?? record.nccAdgroupId ?? record.adgroupId);
    const adgroup = id ? adgroupsById.get(id) : undefined;
    if (!adgroup) continue;
    const bucket = productOf.get(adgroup.campaignId) ?? "sa";
    if (bucket !== "sa" && bucket !== "da") continue;
    for (const stat of statItemsOf(item)) addStatInto(adgroup.stats, stat);
  }
}

async function fetchStats(
  account: NaverSaAccount,
  ids: string,
  date: string,
  idType?: string,
) {
  const timeRange = JSON.stringify({ since: date, until: date });
  const idTypeQuery = idType ? `&idType=${encodeURIComponent(idType)}` : "";
  const attempts = [NAVER_STAT_FIELDS, NAVER_STAT_FIELDS_FALLBACK];

  let lastStatus = 0;
  let lastBody: unknown = null;
  for (const fieldList of attempts) {
    const fields = JSON.stringify(fieldList);
    const query =
      `ids=${encodeURIComponent(ids)}` +
      `&fields=${encodeURIComponent(fields)}` +
      `&timeRange=${encodeURIComponent(timeRange)}` +
      idTypeQuery;
    const { response, body } = await naverSaGet(account, "/stats", query);
    if (response.ok) return { ok: true as const, body };
    lastStatus = response.status;
    lastBody = body;
    if (response.status !== 400) break;
  }

  return {
    ok: false as const,
    status: lastStatus,
    message: apiErrorMessage(lastBody, "naver sa stats failed"),
  };
}

async function fetchNaverAdsDay(account: NaverSaAccount, date: string) {
  const targets: NaverSaAccount[] = [account];
  const first = await listCampaigns(account);
  if (!first.ok) {
    return {
      ok: false as const,
      reason: "http-error",
      status: first.status,
      message: first.message,
    };
  }

  if (first.campaigns.length === 0) {
    const linkedIds = await listLinkedCustomerIds(account);
    for (const customerId of linkedIds) {
      targets.push({ ...account, customerId });
    }
  }

  const sa = emptyAdMetrics();
  const da = emptyAdMetrics();
  const chunkSize = 20;

  for (const target of targets) {
    const listed = target === account && first.campaigns.length > 0
      ? first
      : await listCampaigns(target);
    if (!listed.ok) continue;

    const productOf = new Map<string, "sa" | "da">();
    const campaignsById = new Map<string, CampaignRef>();
    for (const campaign of listed.campaigns) {
      const product = campaignProduct(campaign.campaignTp);
      productOf.set(campaign.id, product);
      campaignsById.set(campaign.id, campaign);
      const bucket = product === "da" ? da : sa;
      bucket.campaignCount += 1;
      bucket.campaignTypes[campaign.campaignTp] = (bucket.campaignTypes[campaign.campaignTp] ?? 0) + 1;
      bucket.campaigns.push(campaign);
    }

    for (let i = 0; i < listed.campaigns.length; i += chunkSize) {
      const ids = listed.campaigns.slice(i, i + chunkSize).map((item) => item.id).join(",");
      const stats = await fetchStats(target, ids, date);
      if (!stats.ok) {
        return {
          ok: false as const,
          reason: "http-error",
          status: stats.status,
          message: stats.message,
        };
      }
      applyCampaignStats(stats.body, campaignsById, productOf, sa, da);
    }

    const grouped = await listAdgroups(target);
    if (grouped.ok) {
      const adgroupsById = new Map<string, AdgroupRef>();
      for (const adgroup of grouped.adgroups) {
        const product = productOf.get(adgroup.campaignId);
        if (!product) continue;
        adgroupsById.set(adgroup.id, adgroup);
        (product === "da" ? da : sa).adgroups.push(adgroup);
      }
      const ids = [...adgroupsById.keys()];
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize).join(",");
        const stats = await fetchStats(target, chunk, date, "nccAdgroupId");
        if (!stats.ok) break;
        applyAdgroupStats(stats.body, adgroupsById, productOf);
      }
    }
  }

  return {
    ok: true as const,
    sa,
    da,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

type AdInsert = {
  company_id: string;
  snapshot_date: string;
  snapshot_hour: number;
  period: "daily";
  platform: "naver" | "coupang" | "google";
  product: "sa" | "da";
  source: string;
  ad_spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conv_amt: number;
  extra: Record<string, unknown>;
};

function serializeCampaign(campaign: CampaignRef) {
  return {
    id: campaign.id,
    name: campaign.name,
    campaignTp: campaign.campaignTp,
    ...campaign.meta,
    ...snapshotFromEntity(campaign.stats),
  };
}

function serializeAdgroup(adgroup: AdgroupRef) {
  return {
    id: adgroup.id,
    campaignId: adgroup.campaignId,
    name: adgroup.name,
    ...adgroup.meta,
    ...snapshotFromEntity(adgroup.stats),
  };
}

function mergeAdMetrics(target: AdMetrics, next: AdMetrics) {
  mergeEntityStats(target, next);
  target.campaignCount += next.campaignCount;
  target.campaigns.push(...next.campaigns);
  target.adgroups.push(...next.adgroups);
  for (const [key, value] of Object.entries(next.campaignTypes)) {
    target.campaignTypes[key] = (target.campaignTypes[key] ?? 0) + value;
  }
}

function adRow(date: string, product: "sa" | "da", metrics: AdMetrics): AdInsert {
  const stats = snapshotFromEntity(metrics);
  return {
    company_id: COMPANY_ID,
    snapshot_date: date,
    snapshot_hour: snapshotHourForDate(date),
    period: "daily",
    platform: "naver",
    product,
    source: "naver_searchad",
    ad_spend: metrics.salesAmt,
    impressions: metrics.impCnt,
    clicks: metrics.clkCnt,
    conversions: metrics.ccnt,
    conv_amt: metrics.convAmt,
    extra: {
      campaign_count: metrics.campaignCount,
      campaign_types: metrics.campaignTypes,
      adgroup_count: metrics.adgroups.length,
      stats,
      campaigns: metrics.campaigns
        .map(serializeCampaign)
        .sort((left, right) => Number(right.salesAmt ?? 0) - Number(left.salesAmt ?? 0)),
      adgroups: metrics.adgroups
        .map(serializeAdgroup)
        .sort((left, right) => Number(right.salesAmt ?? 0) - Number(left.salesAmt ?? 0)),
    },
  };
}

function adToChannelCompat(row: AdInsert): SnapshotInsert {
  return {
    company_id: row.company_id,
    snapshot_date: row.snapshot_date,
    period: "daily",
    channel_id: `${row.platform}_${row.product}`,
    kind: "commerce",
    source: row.source,
    sales: null,
    orders: null,
    conversion_rate: null,
    ad_spend: row.ad_spend,
    followers: null,
    reach: null,
    engagement_rate: null,
    extra: {
      platform: row.platform,
      product: row.product,
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: row.conversions,
      conv_amt: row.conv_amt,
      stats: row.extra.stats,
      campaign_count: row.extra.campaign_count,
      campaign_types: row.extra.campaign_types,
    },
  };
}

async function collectNaverAds(date: string): Promise<{ rows: AdInsert[]; notes: string[] }> {
  const notes: string[] = [];
  const accounts = readNaverSaAccounts();
  if (accounts.length === 0) {
    notes.push("네이버 검색광고 시크릿이 없습니다. 광고 행을 쓰지 않았습니다.");
    return { rows: [], notes };
  }

  const sa = emptyAdMetrics();
  const da = emptyAdMetrics();
  let live = false;

  for (const account of accounts) {
    try {
      const naver = await fetchNaverAdsDay(account, date);
      if (naver.ok) {
        live = true;
        mergeAdMetrics(sa, naver.sa);
        mergeAdMetrics(da, naver.da);
        notes.push(
          `naver (${account.label}) SA: ad_spend=${naver.sa.salesAmt}, campaigns=${naver.sa.campaignCount}, adgroups=${naver.sa.adgroups.length}; DA: ad_spend=${naver.da.salesAmt}, campaigns=${naver.da.campaignCount}, adgroups=${naver.da.adgroups.length}`,
        );
        if (naver.sa.campaignCount + naver.da.campaignCount === 0) {
          notes.push(
            "네이버 캠페인이 0개입니다. NAVER_SA_CUSTOMER_ID가 검색광고 광고주 ID인지 확인하세요.",
          );
        }
      } else {
        notes.push(
          `naver (${account.label}) 호출 실패(${naver.status ?? naver.reason}): ${naver.message}`,
        );
      }
    } catch (error) {
      notes.push(
        `naver (${account.label}) 예외: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  if (!live) return { rows: [], notes };
  return { notes, rows: [adRow(date, "sa", sa), adRow(date, "da", da)] };
}

async function collectCoupang(date: string): Promise<{ rows: SnapshotInsert[]; notes: string[] }> {
  const notes: string[] = [];
  const rows: SnapshotInsert[] = [];
  const accounts = readCoupangAccounts();
  if (accounts.length === 0) {
    notes.push("켜 둔 쿠팡 채널에 계정 시크릿이 없습니다.");
    return { rows, notes };
  }

  for (const account of accounts) {
    try {
      const coupang = await fetchCoupangDay(account, date);
      if (coupang.ok) {
        rows.push({
          company_id: COMPANY_ID,
          snapshot_date: date,
          period: "daily",
          channel_id: account.channelId,
          kind: "commerce",
          source: "coupang",
          sales: coupang.sales,
          orders: coupang.orders,
          conversion_rate: null,
          ad_spend: null,
          followers: null,
          reach: null,
          engagement_rate: null,
          extra: {
            label: account.label,
            vendor_id: account.vendorId,
          },
        });
        notes.push(
          `${account.channelId} (${account.label}) live: sales=${coupang.sales}, orders=${coupang.orders}`,
        );
      } else {
        notes.push(
          `${account.channelId} 호출 실패(${coupang.status ?? coupang.reason}): ${coupang.message}`,
        );
      }
    } catch (error) {
      notes.push(
        `${account.channelId} 예외: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return { rows, notes };
}

async function collectEnabled(date: string) {
  const notes: string[] = [];
  const rows: AdInsert[] = [];
  const skipped = Object.entries(AD_COLLECTORS)
    .filter(([, meta]) => !meta.enabled)
    .map(([id]) => id);

  if (isAdCollectorEnabled("naver")) {
    const naver = await collectNaverAds(date);
    notes.push(...naver.notes);
    rows.push(...naver.rows);
  }

  if (skipped.length > 0) {
    notes.push(`광고 수집 안 함(대기): ${skipped.join(", ")}`);
  }

  notes.push("판매 채널은 사방넷 연동 후 channel_snapshots 에 저장합니다.");
  return { notes, rows };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
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
  const dates = collectDates(url.searchParams.get("date"));
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing supabase env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const notes: string[] = [];
  const rows: AdInsert[] = [];

  for (const date of dates) {
    const collected = await collectEnabled(date);
    notes.push(`--- ${date} ---`, ...collected.notes);
    rows.push(...collected.rows);
  }

  if (rows.length === 0) {
    return json({
      ok: true,
      snapshot_date: dates.at(-1),
      snapshot_dates: dates,
      rows: 0,
      sources: {},
      notes: [...notes, "실측 광고 행이 없어 DB에 쓰지 않았습니다."],
    });
  }

  const adWrite = await supabase.from("ad_snapshots").upsert(rows, {
    onConflict: "company_id,platform,product,snapshot_date,snapshot_hour,period",
  });
  if (adWrite.error) {
    notes.push(`ad_snapshots 저장 실패: ${adWrite.error.message}. 003_ad_snapshots.sql 을 실행했는지 확인하세요.`);
  }

  const compat = rows.map(adToChannelCompat);
  const channelWrite = await supabase.from("channel_snapshots").upsert(compat, {
    onConflict: "company_id,channel_id,snapshot_date,period",
  });
  if (channelWrite.error) return json({ error: channelWrite.error.message, notes }, 500);

  return json({
    ok: true,
    snapshot_date: dates.at(-1),
    snapshot_dates: dates,
    rows: rows.length,
    sources: Object.fromEntries(rows.map((row) => [`${row.platform}_${row.product}`, row.source])),
    notes,
  });
});
