"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";

type Result = {
  issueNumber: string;
  number: number;
  color: string;
  premium?: string | number;
  sum?: number;
};

type ApiResponse = {
  ok?: boolean;
  source?: string;
  fetchedAt?: string;
  data?: unknown;
  error?: string;
  details?: string;
};

function extractHistory(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const obj = payload as Record<string, unknown>;

  if (Array.isArray(obj.list)) return obj.list;
  if (Array.isArray(obj.records)) return obj.records;
  if (Array.isArray(obj.data)) return obj.data;

  if (obj.data && typeof obj.data === "object") {
    const nested = obj.data as Record<string, unknown>;

    if (Array.isArray(nested.list)) return nested.list;
    if (Array.isArray(nested.records)) return nested.records;
    if (Array.isArray(nested.data)) return nested.data;
  }

  if (obj.result && typeof obj.result === "object") {
    const nested = obj.result as Record<string, unknown>;

    if (Array.isArray(nested.list)) return nested.list;
    if (Array.isArray(nested.data)) return nested.data;
  }

  return [];
}

function parseResults(payload: unknown): Result[] {
  const rows = extractHistory(payload);

  return rows
    .map((row): Result | null => {
      if (!row || typeof row !== "object") return null;

      const item = row as Record<string, unknown>;

      const issue =
        item.issueNumber ??
        item.issue ??
        item.period ??
        item.issue_number;

      const rawNumber =
        item.number ??
        item.openNumber ??
        item.result ??
        item.open_number;

      const number = Number(rawNumber);

      if (
        issue === undefined ||
        issue === null ||
        !Number.isInteger(number) ||
        number < 0 ||
        number > 9
      ) {
        return null;
      }

      return {
        issueNumber: String(issue),
        number,
        color: String(item.color ?? ""),
        premium:
          typeof item.premium === "string" ||
          typeof item.premium === "number"
            ? item.premium
            : undefined,
        sum:
          item.sum !== undefined && Number.isFinite(Number(item.sum))
            ? Number(item.sum)
            : undefined,
      };
    })
    .filter((item): item is Result => item !== null);
}

function classifyNumber(number: number): "BIG" | "SMALL" {
  return number >= 5 ? "BIG" : "SMALL";
}

function classifyColor(number: number): string {
  if (number === 0) return "RED + VIOLET";
  if (number === 5) return "GREEN + VIOLET";
  return number % 2 === 0 ? "RED" : "GREEN";
}

/**
 * Estimates the next period by adding 1 to the numeric string.
 * This avoids BigInt literals and works with older TypeScript targets.
 * The result is an estimate, not a verified current game period.
 */
function estimateNextPeriod(issue: string): string {
  if (!/^\d+$/.test(issue)) return "Waiting for period";

  const digits = issue.split("");
  let carry = 1;

  for (let i = digits.length - 1; i >= 0 && carry; i--) {
    const value = Number(digits[i]) + carry;

    digits[i] = String(value % 10);
    carry = value >= 10 ? 1 : 0;
  }

  if (carry) digits.unshift("1");

  return digits.join("");
}

function getTimeRemaining(now: number): number {
  return 60 - Math.floor((now % 60000) / 1000);
}

function formatCountdown(seconds: number): string {
  const displaySeconds = seconds === 60 ? 0 : seconds;

  return `00:${String(displaySeconds).padStart(2, "0")}`;
}

function getNumberStyle(number: number): string {
  if (number === 0) return "ball-red";
  if (number === 5) return "ball-green";
  return number % 2 === 0 ? "ball-red" : "ball-green";
}

export default function Home() {
  const [history, setHistory] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [now, setNow] = useState(0);

  const refreshHistory = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);

    try {
      const response = await fetch("/api/history", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.details ||
            payload.error ||
            `History request failed (${response.status})`,
        );
      }

      const results = parseResults(payload.data);

      if (results.length === 0) {
        throw new Error(
          "The API responded, but no valid WinGo results were found.",
        );
      }

      setHistory(results);
      setSource(payload.source || "WinGo History API");
      setLastUpdated(new Date().toLocaleTimeString());
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load WinGo history.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setNow(Date.now());

    const clock = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    void refreshHistory();

    const historyTimer = window.setInterval(() => {
      void refreshHistory();
    }, 15000);

    return () => {
      window.clearInterval(clock);
      window.clearInterval(historyTimer);
    };
  }, [refreshHistory]);

  const secondsRemaining = now ? getTimeRemaining(now) : 60;
  const countdown = formatCountdown(secondsRemaining);

  const latest = history[0];
  const nextPeriod = latest
    ? estimateNextPeriod(latest.issueNumber)
    : "Waiting for data";

  const bigCount = history.filter(
    (item) => classifyNumber(item.number) === "BIG",
  ).length;

  const smallCount = history.filter(
    (item) => classifyNumber(item.number) === "SMALL",
  ).length;

  const sampleSize = history.length;

  const bigPercent =
    sampleSize > 0 ? Math.round((bigCount / sampleSize) * 100) : 0;

  const smallPercent =
    sampleSize > 0 ? Math.round((smallCount / sampleSize) * 100) : 0;

  const historicalBias =
    sampleSize < 10
      ? "INSUFFICIENT DATA"
      : bigCount > smallCount
        ? "BIG MORE FREQUENT"
        : smallCount > bigCount
          ? "SMALL MORE FREQUENT"
          : "EVEN DISTRIBUTION";

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #07090d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .panel {
          background: linear-gradient(
            145deg,
            rgba(22, 28, 39, 0.96),
            rgba(12, 16, 23, 0.98)
          );
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
        }

        .muted {
          color: #8c96a8;
        }

        .green {
          color: #37e59a;
        }

        .red {
          color: #ff5b70;
        }

        .ball {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 43px;
          height: 43px;
          border-radius: 50%;
          color: white;
          font-size: 18px;
          font-weight: 800;
          box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.14);
        }

        .ball-red {
          background: linear-gradient(145deg, #ff586b, #a91d3d);
        }

        .ball-green {
          background: linear-gradient(145deg, #39efad, #07865d);
        }

        .ball-violet {
          background: linear-gradient(145deg, #bb82ff, #7138d6);
        }

        .small-badge {
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .badge-big {
          color: #ffcb6b;
          background: rgba(255, 183, 60, 0.12);
          border: 1px solid rgba(255, 183, 60, 0.2);
        }

        .badge-small {
          color: #6cb9ff;
          background: rgba(63, 155, 255, 0.12);
          border: 1px solid rgba(63, 155, 255, 0.2);
        }

        .action-button {
          border: 1px solid rgba(55, 229, 154, 0.3);
          background: rgba(55, 229, 154, 0.08);
          transition: background 0.2s ease;
        }

        .action-button:hover {
          background: rgba(55, 229, 154, 0.16);
        }

        .progress-track {
          height: 7px;
          overflow: hidden;
          border-radius: 99px;
          background: #252b36;
        }

        .progress-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.25s ease;
        }

        .table-row {
          border-bottom: 1px solid rgba(255, 255, 255, 0.055);
        }

        .table-row:last-child {
          border-bottom: none;
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Header */}
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
              <Activity className="h-7 w-7 text-emerald-400" />
            </div>

            <div>
              <h1 className="text-xl font-black tracking-wide sm:text-2xl">
                ZARA <span className="text-emerald-400">AI</span>
              </h1>
              <p className="muted mt-1 text-xs tracking-[2px]">
                WINGO 1 MIN ANALYTICS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
            {error ? (
              <>
                <WifiOff className="h-4 w-4 text-red-400" />
                <span className="text-red-300">API ISSUE</span>
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-300">
                  {loading ? "CONNECTING..." : "SYSTEM ACTIVE"}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-500/[0.07] p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

            <div className="min-w-0">
              <p className="font-semibold text-red-300">
                Unable to load live history
              </p>
              <p className="mt-1 break-words text-sm text-red-200/70">
                {error}
              </p>
              <p className="mt-2 text-xs text-white/50">
                The source API may be unavailable or blocking requests.
              </p>
            </div>
          </div>
        )}

        {/* Hero */}
        <section className="panel relative mb-5 overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/[0.08] blur-3xl" />

          <div className="relative grid gap-7 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                LIVE HISTORY MONITOR
              </div>

              <h2 className="max-w-xl text-3xl font-black leading-tight sm:text-5xl">
                Analyze the
                <span className="block text-emerald-400">
                  Next WinGo Round.
                </span>
              </h2>

              <p className="muted mt-4 max-w-lg text-sm leading-6">
                Track completed results, inspect historical Big/Small
                distribution and monitor the next estimated period in one
                dashboard.
              </p>

              <button
                type="button"
                onClick={() => void refreshHistory(true)}
                disabled={refreshing}
                className="action-button mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-emerald-300 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing..." : "Refresh History"}
              </button>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-5">
              <div className="flex items-center justify-between">
                <span className="muted text-xs font-bold tracking-widest">
                  ROUND COUNTDOWN
                </span>
                <Clock3 className="h-4 w-4 text-emerald-400" />
              </div>

              <div className="my-5 text-center">
                <div className="font-mono text-6xl font-black tracking-wider text-emerald-300 sm:text-7xl">
                  {countdown}
                </div>
                <p className="muted mt-2 text-xs">
                  Based on your device clock
                </p>
              </div>

              <div className="h-px bg-white/[0.08]" />

              <div className="mt-4">
                <p className="muted text-xs">LATEST RESULT PERIOD</p>
                <p className="mt-2 break-all font-mono text-sm font-bold">
                  {latest?.issueNumber ?? "Waiting for data"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="muted text-xs">Latest Number</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>

            <div className="flex items-center gap-3">
              {latest ? (
                <span className={`ball ${getNumberStyle(latest.number)}`}>
                  {latest.number}
                </span>
              ) : (
                <span className="ball bg-slate-700">-</span>
              )}

              <div>
                <p className="text-lg font-black">
                  {latest ? classifyNumber(latest.number) : "--"}
                </p>
                <p className="muted text-xs">
                  {latest ? classifyColor(latest.number) : "No result"}
                </p>
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="muted text-xs">History Loaded</span>
              <BarChart3 className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-3xl font-black">{sampleSize}</p>
            <p className="muted mt-1 text-xs">Available results</p>
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="muted text-xs">Big Results</span>
              <TrendingUp className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-3xl font-black text-amber-300">{bigCount}</p>
            <p className="muted mt-1 text-xs">{bigPercent}% of loaded history</p>
          </div>

          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="muted text-xs">Small Results</span>
              <BarChart3 className="h-4 w-4 text-sky-400" />
            </div>
            <p className="text-3xl font-black text-sky-300">{smallCount}</p>
            <p className="muted mt-1 text-xs">
              {smallPercent}% of loaded history
            </p>
          </div>
        </section>

        {/* Analysis */}
        <section className="mb-5 grid gap-5 md:grid-cols-2">
          <div className="panel p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold">Historical Distribution</h3>
                <p className="muted mt-1 text-xs">
                  Based on loaded completed rounds
                </p>
              </div>
              <BarChart3 className="h-5 w-5 text-emerald-400" />
            </div>

            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-amber-300">BIG (5–9)</span>
                <span>{bigCount} / {sampleSize}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill bg-amber-400"
                  style={{ width: `${bigPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-sky-300">SMALL (0–4)</span>
                <span>{smallCount} / {sampleSize}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill bg-sky-400"
                  style={{ width: `${smallPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-3">
              <p className="muted text-xs">OBSERVED DISTRIBUTION</p>
              <p className="mt-2 font-bold text-emerald-300">
                {loading ? "Loading..." : historicalBias}
              </p>
              <p className="muted mt-2 text-xs leading-5">
                This describes past results only. It does not predict the next
                winning result.
              </p>
            </div>
          </div>

          <div className="panel p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold">Next Period Monitor</h3>
                <p className="muted mt-1 text-xs">
                  Estimated from the latest issue number
                </p>
              </div>
              <Clock3 className="h-5 w-5 text-emerald-400" />
            </div>

            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
              <p className="muted text-xs">ESTIMATED NEXT PERIOD</p>
              <p className="mt-3 break-all font-mono text-xl font-black text-emerald-300">
                {nextPeriod}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Verify this period against the official game before use.
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold">Automatic history refresh</p>
                <p className="muted mt-1 text-xs leading-5">
                  The dashboard requests history every 15 seconds while this
                  page remains open.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* History table */}
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5">
            <div>
              <h3 className="font-bold">Recent WinGo Results</h3>
              <p className="muted mt-1 text-xs">
                Results returned by the history API
              </p>
            </div>

            <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-white/60">
              {sampleSize} records
            </div>
          </div>

          {loading && history.length === 0 ? (
            <div className="muted p-10 text-center text-sm">
              Loading WinGo history...
            </div>
          ) : history.length === 0 ? (
            <div className="muted p-10 text-center text-sm">
              No history available. Check the API response.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-white/[0.025]">
                  <tr className="muted text-xs">
                    <th className="px-5 py-4 font-semibold">Period</th>
                    <th className="px-5 py-4 font-semibold">Number</th>
                    <th className="px-5 py-4 font-semibold">Color</th>
                    <th className="px-5 py-4 font-semibold">Big / Small</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item, index) => (
                    <tr className="table-row" key={`${item.issueNumber}-${index}`}>
                      <td className="px-5 py-4 font-mono text-xs text-white/70">
                        {item.issueNumber}
                      </td>

                      <td className="px-5 py-3">
                        <span className={`ball ${getNumberStyle(item.number)}`}>
                          {item.number}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            classifyColor(item.number).includes("VIOLET")
                              ? "font-semibold text-purple-300"
                              : classifyColor(item.number) === "RED"
                                ? "font-semibold text-red-300"
                                : "font-semibold text-emerald-300"
                          }
                        >
                          {classifyColor(item.number)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`small-badge ${
                            classifyNumber(item.number) === "BIG"
                              ? "badge-big"
                              : "badge-small"
                          }`}
                        >
                          {classifyNumber(item.number)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-4">
            <p className="muted break-all text-xs">
              Source: {source || "Not connected"}
            </p>
            <p className="muted text-xs">
              Updated: {lastUpdated || "Not yet"}
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <footer className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-bold text-amber-200">
                Important Disclaimer
              </p>
              <p className="muted mt-1 text-xs leading-5">
                This dashboard displays historical data and estimated period
                information. It does not have a verified method to predict
                future WinGo outcomes. Past results do not guarantee future
                results. Please do not treat historical percentages as
                guaranteed signals or financial advice.
              </p>
            </div>
          </div>
        </footer>

        <p className="muted py-6 text-center text-xs">
          © {new Date().getFullYear()} Zara AI Predictor · Analytics Dashboard
        </p>
      </div>
    </main>
  );
}
