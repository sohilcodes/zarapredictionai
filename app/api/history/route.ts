import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOSTS = [
"draw.ar-lottery01.com",
"draw.ar-lottery02.com",
"draw.ar-lottery03.com",
"draw.ar-lottery04.com",
"draw.ar-lottery05.com",
"draw.ar-lottery06.com",
];

const API_PATH =
"/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50";

export async function GET() {
const errors: string[] = [];

for (const host of HOSTS) {
try {
const response = await fetch("https://${host}${API_PATH}", {
method: "GET",
cache: "no-store",
signal: AbortSignal.timeout(8000),
headers: {
Accept: "application/json, text/plain, /",
"User-Agent":
"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
Origin: "https://${host}",
Referer: "https://${host}/",
},
});

  if (!response.ok) {
    errors.push(`${host}: HTTP ${response.status}`);
    continue;
  }

  const data: unknown = await response.json();

  return NextResponse.json(
    {
      ok: true,
      source: host,
      fetchedAt: new Date().toISOString(),
      data,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    },
  );
} catch (error) {
  errors.push(
    `${host}: ${
      error instanceof Error ? error.message : "Unknown error"
    }`,
  );
}

}

return NextResponse.json(
{
ok: false,
error: "Could not fetch WinGo history.",
details: errors.join(" | "),
fetchedAt: new Date().toISOString(),
},
{
status: 502,
headers: {
"Cache-Control": "no-store, no-cache, must-revalidate",
},
},
);
}
