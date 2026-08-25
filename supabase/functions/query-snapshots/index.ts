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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (request.method !== "POST" && request.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }

  const expected = Deno.env.get("QUERY_SECRET") ?? Deno.env.get("COLLECT_SECRET");
  const given =
    request.headers.get("x-query-secret") ?? request.headers.get("x-collect-secret");
  if (expected && given !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing supabase env" }, 500);
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "2020-01-01";
  const to = url.searchParams.get("to") ?? "2099-12-31";
  const channelsParam = url.searchParams.get("channels");
  const channelIds = channelsParam
    ? channelsParam.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  const supabase = createClient(supabaseUrl, serviceKey);
  let query = supabase
    .from("channel_snapshots")
    .select(
      "snapshot_date, channel_id, kind, source, sales, orders, conversion_rate, ad_spend, followers, reach, engagement_rate, extra, captured_at",
    )
    .eq("company_id", COMPANY_ID)
    .eq("period", "daily")
    .gte("snapshot_date", from)
    .lte("snapshot_date", to)
    .order("snapshot_date", { ascending: true })
    .limit(5000);

  if (channelIds.length > 0) {
    query = query.in("channel_id", channelIds);
  }

  const { data, error } = await query;

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, from, to, rows: data ?? [] });
});
