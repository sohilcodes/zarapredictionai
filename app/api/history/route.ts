import { NextResponse } from "next/server";

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

export async function GET() {
  const attempts: string[] = [];

  for (const host of HOSTS) {
    const url =
      `${host}/WinGo/WinGo_1M/GetHistoryIssuePage.json` +
      `?pageNo=1&pageSize=20&_t=${Date.now()}`;

    try {
      const response = await fetch(url, {
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
          Origin: host,
        },
      });

      if (!response.ok) {
        attempts.push(`${host}: HTTP ${response.status}`);
        continue;
      }

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.toLowerCase().includes("json")) {
        attempts.push(`${host}: Response was not JSON`);
        continue;
      }

      const payload: unknown = await response.json();

      if (!payload || typeof payload !== "object") {
        attempts.push(`${host}: Invalid response`);
        continue;
      }

      const root = payload as Record<string, unknown>;
      const data = root.data;

      let records: unknown[] = [];

      if (Array.isArray(data)) {
        records = data;
      } else if (data && typeof data === "object") {
        const dataObject = data as Record<string, unknown>;

        if (Array.isArray(dataObject.list)) {
          records = dataObject.list;
        } else if (Array.isArray(dataObject.records)) {
          records = dataObject.records;
        } else if (Array.isArray(dataObject.results)) {
          records = dataObject.results;
        }
      }

      if (records.length === 0) {
        attempts.push(`${host}: No history records in response`);
        continue;
      }

      return NextResponse.json(
        {
          ok: true,
          source: host,
          fetchedAt: new Date().toISOString(),
          data: payload,
        },
        {
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      attempts.push(`${host}: ${message}`);
    }
  }

  return NextResponse.json(
    {
      ok: false,
      message: "All history API sources failed.",
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
