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

const TIMEOUT_MS = 8000;

export async function GET() {
  const errors: string[] = [];

  for (const host of API_HOSTS) {
    const url =
      `https://${host}/WinGo/WinGo_1M/GetHistoryIssuePage.json` +
      "?pageNo=1&pageSize=50";

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
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
      const message =
        error instanceof Error ? error.message : "Request failed";

      errors.push(`${host}: ${message}`);
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Unable to fetch WinGo history from configured hosts.",
      details: errors,
      fetchedAt: new Date().toISOString(),
    },
    {
      status: 502,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
