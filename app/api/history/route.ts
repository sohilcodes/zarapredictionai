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

type HistoryRecord = Record<string, unknown>;

function extractRecords(
value: unknown,
depth = 0,
): HistoryRecord[] {
if (depth > 8 || value == null) return [];

if (Array.isArray(value)) {
if (value.length === 0) return [];

const records = value.filter(
  (item): item is HistoryRecord =>
    item !== null &&
    typeof item === "object" &&
    !Array.isArray(item),
);

return records;

}

if (typeof value !== "object") return [];

const object = value as Record<string, unknown>;

const keys = [
"list",
"records",
"results",
"rows",
"history",
"data",
"result",
];

for (const key of keys) {
if (!(key in object)) continue;

const records = extractRecords(object[key], depth + 1);

if (records.length > 0) return records;

}

return [];
}

function getText(
record: HistoryRecord,
keys: string[],
): string | null {
for (const key of keys) {
const value = record[key];

if (
  typeof value === "string" ||
  typeof value === "number"
) {
  const text = String(value).trim();

  if (text.length > 0) return text;
}

}

return null;
}

function normalizeRecord(
record: HistoryRecord,
): HistoryRecord {
const issue = getText(record, [
"issueNumber",
"issue",
"period",
"issue_number",
"periodNumber",
]);

const rawNumber = getText(record, [
"number",
"openNumber",
"result",
"openResult",
"winningNumber",
]);

const numberMatch = rawNumber?.match(/\d+/);
const number =
numberMatch ? Number(numberMatch[0]) : null;

let color = getText(record, [
"color",
"colour",
"openColor",
"resultColor",
]);

if (!color && number !== null && number >= 0 && number <= 9) {
if (number === 0 || number === 5) {
color = "VIOLET";
} else if ([1, 3, 7, 9].includes(number)) {
color = "GREEN";
} else {
color = "RED";
}
}

return {
...record,
issueNumber: issue,
number,
color,
};
}

export async function GET() {
const attempts: Attempt[] = [];

for (const host of HOSTS) {
try {
const url = new URL("${host}${API_PATH}");

  url.searchParams.set("pageNo", "1");
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("_t", String(Date.now()));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/json, text/plain, */*",
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
      preview: body.slice(0, 200),
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
      error: "Upstream returned invalid JSON",
      preview: body.slice(0, 200),
    });

    continue;
  }

  const records = extractRecords(payload);

  if (records.length === 0) {
    attempts.push({
      host,
      status: response.status,
      error: "No history records found in response",
      preview: JSON.stringify(payload).slice(0, 300),
    });

    continue;
  }

  const normalized = records.map(normalizeRecord);

  return NextResponse.json(
    {
      ok: true,
      source: host,
      fetchedAt: new Date().toISOString(),
      count: normalized.length,
      records: normalized,
      data: payload,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
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
status: 502,
headers: {
"Cache-Control": "no-store",
},
},
);
}
