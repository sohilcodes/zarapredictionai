import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOSTS = [
"https://draw.ar-lottery01.com",
"https://draw.ar-lottery02.com",
"https://draw.ar-lottery03.com",
"https://draw.ar-lottery04.com",
"https://draw.ar-lottery05.com",
"https://draw.ar-lottery06.com",
];

const API_PATH = "/WinGo/WinGo_1M/GetHistoryIssuePage.json";

type Attempt = {
host: string;
status?: number;
error?: string;
preview?: string;
};

function extractRecords(value: unknown, depth = 0): unknown[] {
if (depth > 6 || value == null) return [];

if (Array.isArray(value)) {
if (value.length === 0) return [];

const first = value[0];

if (
  first &&
  typeof first === "object" &&
  !Array.isArray(first)
) {
  return value;
}

return [];

}

if (typeof value !== "object") return [];

const object = value as Record<string, unknown>;

for (const key of [
"list",
"records",
"results",
"rows",
"history",
"data",
]) {
const result = extractRecords(object[key], depth + 1);

if (result.length > 0) return result;

}

return [];
}

export async function GET() {
const attempts: Attempt[] = [];

try {
for (const host of HOSTS) {
try {
// Correct URL construction: template literals use backticks.
const url = new URL("${host}${API_PATH}");

    url.searchParams.set("pageNo", "1");
    url.searchParams.set("pageSize", "20");
    url.searchParams.set("_t", String(Date.now()));

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/131.0.0.0 Safari/537.36",
        Referer: `${host}/`,
      },
    });

    const body = await response.text();

    if (!response.ok) {
      attempts.push({
        host,
        status: response.status,
        error: `Upstream HTTP ${response.status}`,
        preview: body.slice(0, 160),
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
        error: "Upstream did not return valid JSON",
        preview: body.slice(0, 160),
      });
      continue;
    }

    const records = extractRecords(payload);

    if (records.length === 0) {
      attempts.push({
        host,
        status: response.status,
        error: "No recognizable history records found",
        preview: JSON.stringify(payload).slice(0, 240),
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
        status: 200,
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
          : "Unknown upstream request error",
    });
  }
}

return NextResponse.json(
  {
    ok: false,
    message: "All upstream history sources failed.",
    details: attempts,
  },
  {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  },
);

} catch (error) {
return NextResponse.json(
{
ok: false,
message: "History route encountered an unexpected error.",
error:
error instanceof Error
? error.message
: "Unknown internal error",
},
{
status: 200,
headers: {
"Cache-Control": "no-store",
},
},
);
}
}
