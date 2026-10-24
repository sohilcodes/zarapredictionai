import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_HOSTS = [
  "draw.ar-lottery01.com",
  "draw.ar-lottery02.com",
  "draw.ar-lottery03.com",
  "draw.ar-lottery04.com",
  "draw.ar-lottery05.com",
  "draw.ar-lottery06.com",
];

export async function GET() {
  const errors: string[] = [];

  for (const host of API_HOSTS) {
    const url =
      `https://${host}/WinGo/WinGo_1M/GetHistoryIssuePage.json` +
      "?pageNo=1&pageSize=50";

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36",
          Referer: `https://${host}/`,
          Origin: `https://${host}`,
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
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    } catch (error) {
      errors.push(
        `${host}: ${
          error instanceof Error ? error.message : "Request failed"
        }`
      );
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "All configured history endpoints failed.",
      details: errors,
    },
    { status: 502 }
  );
}
