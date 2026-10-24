"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Activity,
  BrainCircuit,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Signal,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

type Result = {
  issueNumber: string;
  number: number;
  color: string;
  premium?: string | number;
  sum?: number;
};

type ApiPayload = {
  ok: boolean;
  source?: string;
  fetchedAt?: string;
  error?: string;
  details?: string[];
  data?: unknown;
};

function extractHistory(data: unknown): unknown[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const root = data as Record<string, unknown>;

  // Handle the common WinGo response:
  // { data: { list: [...] } }
  const nested = root.data;

  if (nested && typeof nested === "object") {
    const nestedObject = nested as Record<string, unknown>;

    if (Array.isArray(nestedObject.list)) {
      return nestedObject.list;
    }

    // Some providers return { data: [...] }
    if (Array.isArray(nested)) {
      return nested;
    }

    // Also support { data: { data: { list: [...] } } }
    const inner = nestedObject.data;

    if (inner && typeof inner === "object") {
      const innerObject = inner as Record<string, unknown>;

      if (Array.isArray(innerObject.list)) {
        return innerObject.list;
      }
    }
  }

  // Alternative shape: { list: [...] }
  if (Array.isArray(root.list)) {
    return root.list;
  }

  return [];
}

function parseResults(data: unknown): Result[] {
  const rows = extractHistory(data);

  return rows
    .map((item): Result | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;

      const issueNumber = String(row.issueNumber ?? "");
      const number = Number(row.number);

      if (
        !issueNumber ||
        !Number.isInteger(number) ||
        number < 0 ||
        number > 9
      ) {
        return null;
      }

      return {
        issueNumber,
        number,
        color: String(row.color ?? ""),
        premium:
          typeof row.premium === "string" ||
          typeof row.premium === "number"
            ? row.premium
            : undefined,
        sum:
          row.sum !== undefined && Number.isFinite(Number(row.sum))
            ? Number(row.sum)
            : undefined,
      };
    })
    .filter((item): item is Result => item !== null);
}

function classifyNumber(number: number): "BIG" | "SMALL" {
  return number >= 5 ? "BIG" : "SMALL";
}

/*
 * Common WinGo color mapping:
 * 0 = Red + Violet
 * 5 = Green + Violet
 * 2,4,6,8 = Red
 * 1,3,7,9 = Green
 *
 * Confirm this mapping against the provider's actual game rules.
 */
function classifyColor(number: number): string {
  if (number === 0) return "RED + VIOLET";
  if (number === 5) return "GREEN + VIOLET";

  return number % 2 === 0 ? "RED" : "GREEN";
}

/*
 * Estimate the next issue ID only when the latest ID is numeric.
 * This assumes consecutive issue IDs, which must be verified.
 */
function estimateNextPeriod(issue: string): string | null {
  if (!/^\d+$/.test(issue)) {
    return null;
  }

  try {
    const next = (BigInt(issue) + 1n).toString();

    return next.padStart(issue.length, "0");
  } catch {
    return null;
  }
}

function getErrorMessage(payload: ApiPayload): string {
  if (payload.error) {
    const details = payload.details?.slice(0, 3).join(" | ");

    return details
      ? `${payload.error} ${details}`
      : payload.error;
  }

  return "Unable to load history.";
}

export default function Home() {
  const [results, setResults] = useState<Result[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [source, setSource] = useState("");
  const [seconds, setSeconds] = useState(59);
  const [now, setNow] = useState(Date.now());

  const lastMinuteRef = useRef(
    Math.floor(Date.now() / 60000)
  );

  const requestInProgressRef = useRef(false);

  const refreshHistory = useCallback(async () => {
    if (requestInProgressRef.current) {
      return;
    }

    requestInProgressRef.current = true;
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/history?_=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const payload = (await response.json()) as ApiPayload;

      if (!response.ok || !payload.ok) {
        throw new Error(getErrorMessage(payload));
      }

      const parsed = parseResults(payload.data);

      if (parsed.length === 0) {
        throw new Error(
          "API responded, but no valid result records were found. Check the response structure."
        );
      }

      setResults(parsed);
      setConnected(true);
      setError("");
      setSource(payload.source ?? "WinGo history API");
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setConnected(false);

      setError(
        err instanceof Error
          ? err.message
          : "Unexpected history API error."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refreshHistory();

    const clockTimer = window.setInterval(() => {
      const timestamp = Date.now();

      setNow(timestamp);

      const currentMinute = Math.floor(timestamp / 60000);

      setSeconds(
        59 - Math.floor((timestamp % 60000) / 1000)
      );

      if (currentMinute !== lastMinuteRef.current) {
        lastMinuteRef.current = currentMinute;
        void refreshHistory();
      }
    }, 250);

    const refreshTimer = window.setInterval(() => {
      void refreshHistory();
    }, 15000);

    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refreshHistory]);

  const latest = results[0];

  /*
   * The history API contains completed rounds.
   * The next period is an estimate, not a verified current game period.
   */
  const estimatedNextPeriod = latest
    ? estimateNextPeriod(latest.issueNumber)
    : null;

  const sample = results.slice(0, 20);

  const bigCount = sample.filter(
    (item) => classifyNumber(item.number) === "BIG"
  ).length;

  const smallCount = sample.filter(
    (item) => classifyNumber(item.number) === "SMALL"
  ).length;

  const bigPercent =
    sample.length > 0
      ? Math.round((bigCount / sample.length) * 100)
      : 0;

  const smallPercent =
    sample.length > 0
      ? Math.round((smallCount / sample.length) * 100)
      : 0;

  /*
   * Descriptive historical tendency only.
   * This is not a trained or validated prediction model.
   */
  const historicalBias =
    sample.length < 10
      ? "INSUFFICIENT DATA"
      : bigCount === smallCount
        ? "BALANCED"
        : bigCount > smallCount
          ? "BIG MORE FREQUENT"
          : "SMALL MORE FREQUENT";

  const remaining =
    60 - Math.floor((now % 60000) / 1000);

  const countdown = `00:${String(
    remaining === 60 ? 0 : remaining
  ).padStart(2, "0")}`;

  return (
    <main className="dashboard">
      <header className="topbar">
        <a href="#" className="brand">
          <span className="brand-icon">
            <BrainCircuit size={24} />
          </span>

          <span>
            <strong>ZARA AI</strong>
            <small>PREDICTOR</small>
          </span>
        </a>

        <div
          className={`connection ${
            connected ? "online" : "offline"
          }`}
        >
          <span className="connection-dot" />
          {connected ? "API CONNECTED" : "API DISCONNECTED"}
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <span className="live-dot" />
          WINGO INTELLIGENCE SYSTEM
        </div>

        <h1>
          Predict smarter.
          <br />
          <span>Analyze every round.</span>
        </h1>

        <p>
          Automatic history refresh, live countdown and transparent
          historical analysis.
        </p>
      </section>

      <section className="gamebar">
        <div className="game-info">
          <div className="game-icon">
            <Activity size={25} />
          </div>

          <div>
            <h2>WinGo 1 Minute</h2>
            <p>Historical data analysis</p>
          </div>
        </div>

        <div className="timer">
          <Clock3 size={16} />
          <span>{countdown}</span>
        </div>
      </section>

      <section className="main-grid">
        <article className="card signal-card">
          <div className="card-heading">
            <div>
              <span className="section-label">
                LATEST COMPLETED RESULT
              </span>
              <h2>Live Result</h2>
            </div>

            <span className="icon-box">
              <Signal size={19} />
            </span>
          </div>

          {latest ? (
            <>
              <div className="result-number">
                <span className={`number-ball n${latest.number}`}>
                  {latest.number}
                </span>

                <div>
                  <strong>{classifyNumber(latest.number)}</strong>
                  <span className="muted">
                    {classifyColor(latest.number)}
                  </span>
                </div>
              </div>

              <div className="period-box">
                <span>Latest completed period</span>
                <strong>{latest.issueNumber}</strong>
              </div>
            </>
          ) : (
            <div className="empty-state">
              {loading
                ? "Fetching actual results..."
                : "No result available"}
            </div>
          )}

          <div className="divider" />

          <div className="card-heading">
            <div>
              <span className="section-label">
                NEXT ROUND
              </span>
              <h3>Estimated period</h3>
            </div>

            <Zap size={20} className="accent-icon" />
          </div>

          <div className="period-box next-period">
            <span>Estimated next issue</span>

            <strong>
              {estimatedNextPeriod ?? "Waiting for valid period ID"}
            </strong>
          </div>

          <div className="outlook">
            <div className="outlook-badge">
              <BrainCircuit size={18} />
            </div>

            <div>
              <strong>{historicalBias}</strong>

              <p>
                {sample.length < 10
                  ? "At least 10 completed results are needed for this basic frequency summary."
                  : `In the latest ${sample.length} completed results, BIG occurred ${bigCount} times and SMALL occurred ${smallCount} times.`}
              </p>
            </div>
          </div>

          <p className="disclaimer">
            The next issue is estimated from the last result ID.
            Verify the actual game sequence. Historical frequency
            cannot guarantee the next outcome.
          </p>
        </article>

        <article className="card">
          <div className="card-heading">
            <div>
              <span className="section-label">
                HISTORICAL DISTRIBUTION
              </span>
              <h2>Big / Small</h2>
            </div>

            <span className="icon-box">
              <Activity size={19} />
            </span>
          </div>

          <p className="muted small">
            Latest {sample.length} completed results
          </p>

          <div className="stat-row">
            <div className="stat-title">
              <span className="legend-dot big-dot" />
              <strong>BIG</strong>
              <span>{bigCount} results</span>
            </div>

            <strong className="stat-percent">
              {bigPercent}%
            </strong>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill big-fill"
              style={{ width: `${bigPercent}%` }}
            />
          </div>

          <div className="stat-row">
            <div className="stat-title">
              <span className="legend-dot small-dot" />
              <strong>SMALL</strong>
              <span>{smallCount} results</span>
            </div>

            <strong className="stat-percent">
              {smallPercent}%
            </strong>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill small-fill"
              style={{ width: `${smallPercent}%` }}
            />
          </div>

          <div className="mini-stats">
            <div>
              <span>Big numbers</span>
              <strong>{bigCount}</strong>
            </div>

            <div>
              <span>Small numbers</span>
              <strong>{smallCount}</strong>
            </div>

            <div>
              <span>Sample size</span>
              <strong>{sample.length}</strong>
            </div>
          </div>

          <p className="muted footnote">
            Past frequency describes previous results, not the
            probability of the next result.
          </p>
        </article>
      </section>

      <section className="card history-card">
        <div className="card-heading">
          <div>
            <span className="section-label">LIVE DATA FEED</span>
            <h2>Recent History</h2>
          </div>

          <button
            className="refresh-button"
            onClick={() => void refreshHistory()}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "spin" : ""}
            />

            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <WifiOff size={17} />

            <span>{error}</span>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PERIOD</th>
                <th>NUMBER</th>
                <th>BIG / SMALL</th>
                <th>COLOR</th>
              </tr>
            </thead>

            <tbody>
              {results.map((item) => (
                <tr key={item.issueNumber}>
                  <td className="period-cell">
                    {item.issueNumber}
                  </td>

                  <td>
                    <span
                      className={`number-ball table-ball n${item.number}`}
                    >
                      {item.number}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`size-tag ${
                        classifyNumber(item.number) === "BIG"
                          ? "tag-big"
                          : "tag-small"
                      }`}
                    >
                      {classifyNumber(item.number)}
                    </span>
                  </td>

                  <td>
                    <span className="color-cell">
                      <span
                        className={`legend-dot ${
                          item.number === 0 ||
                          item.number % 2 === 0
                            ? "big-dot"
                            : "small-dot"
                        }`}
                      />

                      {classifyColor(item.number)}
                    </span>
                  </td>
                </tr>
              ))}

              {results.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-table">
                    {loading
                      ? "Loading real history..."
                      : "No history loaded. Check the API connection."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="history-footer">
          <span>
            {connected ? (
              <Wifi size={14} />
            ) : (
              <WifiOff size={14} />
            )}

            {connected
              ? `Connected: ${source}`
              : "Waiting for connection"}
          </span>

          <span>Updated: {lastUpdated || "—"}</span>
        </div>
      </section>

      <section className="info-grid">
        <div className="info-card">
          <ShieldCheck size={22} />

          <div>
            <strong>Real Data</strong>
            <p>
              Actual completed results are loaded from the configured
              history API when available.
            </p>
          </div>
        </div>

        <div className="info-card">
          <BrainCircuit size={22} />

          <div>
            <strong>Transparent Analysis</strong>
            <p>
              Historical frequencies are shown without claiming
              guaranteed future results.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-brand">ZARA AI PREDICTOR</div>

        <p>
          Informational analysis only. Predictions are uncertain.
          No guaranteed outcomes. Play responsibly.
        </p>

        <span>LIVE DATA • HISTORICAL ANALYSIS • 1M</span>
      </footer>
    </main>
  );
}
