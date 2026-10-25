import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const HOSTS = [
"https://draw.ar-lottery01.com",
"https://draw.ar-lottery02.com",
"https://draw.ar-lottery03.com",
"https://draw.ar-lottery04.com",
"https://draw.ar-lottery05.com",
"https://draw.ar-lottery06.com",
];

const API_PATH = "/WinGo/WinGo_1M/GetHistoryIssuePage.json";

function findRecords(payload: unknown): unknown[] {
if (Array.isArray(payload)) {
return payload;
}

if (!payload || typeof payload !== "object") {
return [];
}

const object = payload as Record<string, unknown>;

// Check common history list keys.
for (const key of [
"list",
"records",
"results",
"rows",
"history",
"data",
]) {
const value = object[key];

if (Array.isArray(value)) {
  return value;
}

if (value && typeof value === "object") {
  const nested = findRecords(value);

  if (nested.length > 0) {
    return nested;
  }
}

}

return [];
}

export async function GET() {
const attempts: Array<{
host: string;
status?: number;
error?: string;
contentType?: string;
preview?: string;
}> = [];

for (const host of HOSTS) {
const url = new URL("${host}${API_PATH}");

url.searchParams.set("pageNo", "1");
url.searchParams.set("pageSize", "20");
url.searchParams.set("_t", String(Date.now()));

try {
  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: "application/json, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/131.0.0.0 Safari/537.36",
      Referer: `${host}/`,
    },
  });

  const contentType =
    response.headers.get("content-type") || "";

  // Read the body once so errors can be diagnosed.
  const body = await response.text();

  if (!response.ok) {
    attempts.push({
      host,
      status: response.status,
      contentType,
      preview: body.slice(0, 250),
    });
    continue;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    attempts.push({
      host,
      status: response.status,
      contentType,
      error: "Response body is not valid JSON",
      preview: body.slice(0, 250),
    });
    continue;
  }

  const records = findRecords(payload);

  if (records.length === 0) {
    attempts.push({
      host,
      status: response.status,
      contentType,
      error: "JSON received, but no recognized history array was found",
      preview: JSON.stringify(payload).slice(0, 350),
    });
    continue;
  }

  return NextResponse.json(
    {
      ok: true,
      source: host,
      fetchedAt: new Date().toISOString(),
      count: records.length,
      records,
      data: payload,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
} catch (error) {
  attempts.push({
    host,
    error:
      error instanceof Error
        ? error.message
        : "Unknown network error",
  });
}

}

return NextResponse.json(
{
ok: false,
message:
"No history source returned usable records. Check the diagnostic details.",
details: attempts,
},
{
status: 502,
headers: {
"Cache-Control": "no-store",
},
},
);
}
