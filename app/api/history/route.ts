import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_URL =
"https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=50";

export async function GET() {
try {
const response = await fetch(API_URL, {
cache: "no-store",
signal: AbortSignal.timeout(10000),
headers: {
Accept: "application/json",
},
});

if (!response.ok) {
  return NextResponse.json(
    {
      ok: false,
      error: `History provider returned HTTP ${response.status}`,
    },
    { status: 502 }
  );
}

const data: unknown = await response.json();

return NextResponse.json(
  {
    ok: true,
    fetchedAt: new Date().toISOString(),
    data,
  },
  {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  }
);

} catch {
return NextResponse.json(
{
ok: false,
error: "History API unavailable. Please retry.",
},
{ status: 502 }
);
}
}
