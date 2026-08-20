import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMPANY_ID = "internal";

const CHANNELS = [
  { id: "makeshop", kind: "commerce", sales: 4230000, orders: 186, conversionRate: 0.032, adSpend: 420000 },
  { id: "naver", kind: "commerce", sales: 3180000, orders: 142, conversionRate: 0.028, adSpend: 310000 },
  { id: "coupang_1", kind: "commerce", sales: 1680000, orders: 118, conversionRate: 0.021, adSpend: 320000 },
  { id: "coupang_2", kind: "commerce", sales: 1210000, orders: 86, conversionRate: 0.019, adSpend: 240000 },
  { id: "elevenst", kind: "commerce", sales: 980000, orders: 54, conversionRate: 0.018, adSpend: 180000 },
  { id: "instagram", kind: "sns", followers: 28400, reach: 196000, engagementRate: 0.041, adSpend: 240000 },
  { id: "youtube", kind: "sns", followers: 12600, reach: 312000, engagementRate: 0.056, adSpend: 190000 },
  { id: "kakao", kind: "sns", followers: 9100, reach: 74000, engagementRate: 0.022, adSpend: 88000 },
  { id: "blog", kind: "sns", followers: 5400, reach: 38000, engagementRate: 0.031, adSpend: 42000 },
] as const;

function kstDate(offsetDays = 0): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const kst = new Date(utc + 9 * 60 * 60 * 1000);
  kst.setDate(kst.getDate() + offsetDays);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hash(value: string): number {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total = (total * 31 + value.charCodeAt(i)) >>> 0;
  return total;
}

function scale(base: number, date: string, salt: string): number {
  const jitter = 0.88 + (hash(`${date}:${salt}`) % 25) / 100;
  return Math.max(0, Math.round(base * jitter));
}

function mockRow(channel: (typeof CHANNELS)[number], date: string) {
  if (channel.kind === "commerce") {
    return {
      company_id: COMPANY_ID,
      snapshot_date: date,
      period: "daily",
      channel_id: channel.id,
      kind: channel.kind,
      source: "mock",
      sales: scale(channel.sales, date, `${channel.id}:sales`),
      orders: scale(channel.orders, date, `${channel.id}:orders`),
      conversion_rate: channel.conversionRate,
      ad_spend: scale(channel.adSpend, date, `${channel.id}:ad`),
      followers: null,
      reach: null,
      engagement_rate: null,
      extra: {},
    };
  }

  return {
    company_id: COMPANY_ID,
    snapshot_date: date,
    period: "daily",
    channel_id: channel.id,
    kind: channel.kind,
    source: "mock",
    sales: null,
    orders: null,
    conversion_rate: null,
    ad_spend: scale(channel.adSpend, date, `${channel.id}:ad`),
    followers: scale(channel.followers, date, `${channel.id}:followers`),
    reach: scale(channel.reach, date, `${channel.id}:reach`),
    engagement_rate: channel.engagementRate,
    extra: {},
  };
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

function addStatNumbers(target: { adSpend: number; impressions: number; clicks: number; conversions: number; convAmt: number }, stat: unknown) {
  if (!stat || typeof stat !== "object") return;
  const record = stat as Record<string, unknown>;
  const num = (key: string) => {
    const value = Number(record[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  target.adSpend += num("salesAmt");
  target.impressions += num("impCnt");
  target.clicks += num("clkCnt");
  target.conversions += num("ccnt");
  target.convAmt += num("convAmt");
}

async function listCampaignIds(account: NaverSaAccount) {
  const campaigns: string[] = [];
  let baseSearchId = "";

  for (let page = 0; page < 20; page += 1) {
    const query = baseSearchId ? `baseSearchId=${encodeURIComponent(baseSearchId)}` : "";
    const { response, body } = await naverSaGet(account, "/ncc/campaigns", query);
    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        message: apiErrorMessage(body, "naver sa campaigns failed"),
        campaigns,
      };
    }

    const rows = asArray(body);
    if (rows.length === 0) break;
    for (const row of rows) {
      const id = campaignIdOf(row);
      if (id) campaigns.push(id);
    }
    if (rows.length < 100) break;
    const lastId = campaignIdOf(rows[rows.length - 1]);
    if (!lastId || lastId === baseSearchId) break;
    baseSearchId = lastId;
  }

  return { ok: true as const, campaigns };
}

async function listLinkedCustomerIds(account: NaverSaAccount) {
  const { response, body } = await naverSaGet(account, "/customer-links", "type=MYCLIENTS");
  if (!response.ok) return [] as string[];
  const ids = asArray(body).map(linkedCustomerIdOf).filter((id): id is string => Boolean(id));
  return [...new Set(ids)].filter((id) => id !== account.customerId);
}

async function fetchNaverSaDay(account: NaverSaAccount, date: string) {
  const targets: NaverSaAccount[] = [account];
  const first = await listCampaignIds(account);
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

  const totals = { adSpend: 0, impressions: 0, clicks: 0, conversions: 0, convAmt: 0 };
  const chunkSize = 20;
  const fields = '["impCnt","clkCnt","salesAmt","ccnt","convAmt"]';
  const timeRange = JSON.stringify({ since: date, until: date });
  let campaignCount = 0;

  for (const target of targets) {
    const listed = target === account && first.campaigns.length > 0
      ? first
      : await listCampaignIds(target);
    if (!listed.ok) continue;
    campaignCount += listed.campaigns.length;

    for (let i = 0; i < listed.campaigns.length; i += chunkSize) {
      const ids = listed.campaigns.slice(i, i + chunkSize).join(",");
      const query =
        `ids=${encodeURIComponent(ids)}` +
        `&fields=${encodeURIComponent(fields)}` +
        `&timeRange=${encodeURIComponent(timeRange)}`;
      const { response, body } = await naverSaGet(target, "/stats", query);
      if (!response.ok) {
        return {
          ok: false as const,
          reason: "http-error",
          status: response.status,
          message: apiErrorMessage(body, "naver sa stats failed"),
        };
      }

      for (const item of asArray(body)) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        if (Array.isArray(record.data)) {
          for (const stat of record.data) addStatNumbers(totals, stat);
        } else if (record.stats && typeof record.stats === "object") {
          addStatNumbers(totals, record.stats);
        } else {
          addStatNumbers(totals, record);
        }
      }
    }
  }

  return {
    ok: true as const,
    ...totals,
    campaignCount,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
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
  const date = url.searchParams.get("date") ?? kstDate(0);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing supabase env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const rows = CHANNELS.map((channel) => mockRow(channel, date));
  const notes: string[] = [];
  const accounts = readCoupangAccounts();

  if (accounts.length === 0) {
    notes.push("쿠팡 계정 시크릿이 없습니다. coupang_1 / coupang_2 모두 mock으로 저장했습니다.");
  }

  for (const account of accounts) {
    try {
      const coupang = await fetchCoupangDay(account, date);
      if (coupang.ok) {
        const index = rows.findIndex((row) => row.channel_id === account.channelId);
        if (index >= 0) {
          rows[index] = {
            ...rows[index],
            source: "coupang",
            sales: coupang.sales,
            orders: coupang.orders,
            extra: {
              label: account.label,
              vendor_id: account.vendorId,
            },
          };
        }
        notes.push(
          `${account.channelId} (${account.label}) live: sales=${coupang.sales}, orders=${coupang.orders}`,
        );
      } else {
        notes.push(
          `${account.channelId} 호출 실패(${coupang.status ?? coupang.reason}): ${coupang.message}. mock 값으로 저장했습니다.`,
        );
      }
    } catch (error) {
      notes.push(
        `${account.channelId} 예외: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  const naverAccounts = readNaverSaAccounts();
  if (naverAccounts.length === 0) {
    notes.push("네이버 SA 시크릿이 없습니다. naver 광고비는 mock으로 저장했습니다.");
  } else {
    let adSpend = 0;
    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let convAmt = 0;
    let live = false;

    for (const account of naverAccounts) {
      try {
        const naver = await fetchNaverSaDay(account, date);
        if (naver.ok) {
          live = true;
          adSpend += naver.adSpend;
          impressions += naver.impressions;
          clicks += naver.clicks;
          conversions += naver.conversions;
          convAmt += naver.convAmt;
          notes.push(
            `naver SA (${account.label}) live: ad_spend=${naver.adSpend}, campaigns=${naver.campaignCount}`,
          );
          if (naver.campaignCount === 0) {
            notes.push(
              "네이버 캠페인이 0개입니다. Secrets의 NAVER_SA_CUSTOMER_ID가 검색광고 광고주 ID(숫자)인지, 그 계정에 캠페인이 있는지 확인하세요. 검색광고 → 도구/내정보에서 계정 ID를 볼 수 있습니다.",
            );
          }
        } else {
          notes.push(
            `naver SA (${account.label}) 호출 실패(${naver.status ?? naver.reason}): ${naver.message}. mock 광고비를 유지합니다.`,
          );
        }
      } catch (error) {
        notes.push(
          `naver SA (${account.label}) 예외: ${error instanceof Error ? error.message : "unknown"}`,
        );
      }
    }

    if (live) {
      const index = rows.findIndex((row) => row.channel_id === "naver");
      if (index >= 0) {
        rows[index] = {
          ...rows[index],
          source: "naver_sa",
          ad_spend: adSpend,
          extra: {
            ...((rows[index].extra as Record<string, unknown> | undefined) ?? {}),
            naver_sa: {
              ad_spend: adSpend,
              impressions,
              clicks,
              conversions,
              conv_amt: convAmt,
            },
          },
        };
      }
    }
  }

  const { error } = await supabase.from("channel_snapshots").upsert(rows, {
    onConflict: "company_id,channel_id,snapshot_date,period",
  });

  if (error) return json({ error: error.message }, 500);

  return json({
    ok: true,
    snapshot_date: date,
    rows: rows.length,
    notes,
  });
});
