"use client";

import { useCallback, useEffect, useState } from "react";
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
fetchedAt?: string;
data?: {
data?: {
list?: Record<string, unknown>[];
};
};
error?: string;
};

function classifyNumber(n: number) {
return n >= 5 ? "BIG" : "SMALL";
}

function classifyColor(n: number) {
if (n === 0) return "RED + VIOLET";
if (n === 5) return "GREEN + VIOLET";
return n % 2 === 0 ? "RED" : "GREEN";
}

function readResults(payload: ApiPayload): Result[] {
const list = payload.data?.data?.list;

if (!Array.isArray(list)) return [];

return list
.map((row) => {
const issueNumber = String(row.issueNumber ?? "");
const number = Number(row.number);

  return {
    issueNumber,
    number,
    color: String(row.color ?? ""),
    premium: row.premium as string | number | undefined,
    sum: Number.isFinite(Number(row.sum))
      ? Number(row.sum)
      : undefined,
  };
})
.filter(
  (row) =>
    row.issueNumber.length > 0 &&
    Number.isInteger(row.number) &&
    row.number >= 0 &&
    row.number <= 9
);

}

function getPeriod(issue: string) {
if (!issue) return "Waiting for API";
return issue;
}

export default function Home() {
const [results, setResults] = useState<Result[]>([]);
const [connected, setConnected] = useState(false);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [lastUpdated, setLastUpdated] = useState("");
const [seconds, setSeconds] = useState(0);
const [refreshing, setRefreshing] = useState(false);

const refreshHistory = useCallback(async () => {
setRefreshing(true);

try {
  const response = await fetch("/api/history", {
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiPayload;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "History API unavailable");
  }

  const parsed = readResults(payload);

  if (parsed.length === 0) {
    throw new Error(
      "API connected, but the expected history fields were not found."
    );
  }

  setResults(parsed);
  setConnected(true);
  setError("");
  setLastUpdated(new Date().toLocaleTimeString());
} catch (err) {
  setConnected(false);
  setError(
    err instanceof Error ? err.message : "Unable to load history."
  );
} finally {
  setLoading(false);
  setRefreshing(false);
}

}, []);

useEffect(() => {
void refreshHistory();

const refreshTimer = window.setInterval(() => {
  void refreshHistory();
}, 15000);

const clockTimer = window.setInterval(() => {
  const now = Date.now();
  setSeconds(59 - (Math.floor(now / 1000) % 60));
}, 250);

return () => {
  window.clearInterval(refreshTimer);
  window.clearInterval(clockTimer);
};

}, [refreshHistory]);

const latest = results[0];
const previous = results.slice(1, 11);

const bigCount = previous.filter(
(item) => classifyNumber(item.number) === "BIG"
).length;

const smallCount = previous.filter(
(item) => classifyNumber(item.number) === "SMALL"
).length;

const bigPercent =
previous.length > 0
? Math.round((bigCount / previous.length) * 100)
: 0;

const smallPercent =
previous.length > 0
? Math.round((smallCount / previous.length) * 100)
: 0;

const recentNumbers = previous.map((item) => item.number);

const bigRun = recentNumbers.filter((n) => n >= 5).length;
const smallRun = recentNumbers.filter((n) => n < 5).length;

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

    <div className={`connection ${connected ? "online" : "offline"}`}>
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
      Real-time game history, statistical analysis and transparent
      prediction tracking.
    </p>
  </section>

  <section className="gamebar">
    <div className="game-info">
      <div className="game-icon">
        <Activity size={25} />
      </div>
      <div>
        <h2>WinGo 1 Minute</h2>
        <p>Live history analysis</p>
      </div>
    </div>

    <div className="timer">
      <Clock3 size={16} />
      <span>00:{String(seconds).padStart(2, "0")}</span>
    </div>
  </section>

  <section className="main-grid">
    <article className="card signal-card">
      <div className="card-heading">
        <div>
          <span className="section-label">LATEST VERIFIED RESULT</span>
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
            <span>Latest result period</span>
            <strong>{getPeriod(latest.issueNumber)}</strong>
          </div>
        </>
      ) : (
        <div className="empty-state">
          {loading ? "Fetching actual results..." : "No result available"}
        </div>
      )}

      <div className="divider" />

      <div className="card-heading">
        <div>
          <span className="section-label">NEXT ROUND</span>
          <h3>Statistical outlook</h3>
        </div>
        <Zap size={20} className="accent-icon" />
      </div>

      <div className="outlook">
        <div className="outlook-badge">
          <BrainCircuit size={18} />
        </div>
        <div>
          <strong>Analysis in progress</strong>
          <p>
            {previous.length >= 5
              ? "Review the recent distribution below. No reliable next result can be guaranteed."
              : "Waiting for enough historical results to analyze."}
          </p>
        </div>
      </div>

      <p className="disclaimer">
        Historical frequency is not a prediction guarantee. The next
        round outcome may be random.
      </p>
    </article>

    <article className="card">
      <div className="card-heading">
        <div>
          <span className="section-label">HISTORICAL DISTRIBUTION</span>
          <h2>Big / Small</h2>
        </div>
        <span className="icon-box">
          <Activity size={19} />
        </span>
      </div>

      <p className="muted small">
        Based on the latest {previous.length} results
      </p>

      <div className="stat-row">
        <div className="stat-title">
          <span className="legend-dot big-dot" />
          <strong>BIG</strong>
          <span>{bigCount} results</span>
        </div>
        <strong className="stat-percent">{bigPercent}%</strong>
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
        <strong className="stat-percent">{smallPercent}%</strong>
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
          <strong>{previous.length}</strong>
        </div>
      </div>

      <p className="muted footnote">
        Frequency describes past outcomes only. It does not establish
        the probability of the next result.
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
        Refresh
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
              <td className="period-cell">{item.issueNumber}</td>
              <td>
                <span className={`number-ball table-ball n${item.number}`}>
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
                      item.number === 0 || item.number % 2 === 0
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
        <Wifi size={14} />
        {connected ? "Connected to history source" : "Waiting for connection"}
      </span>
      <span>Updated: {lastUpdated || "—"}</span>
    </div>
  </section>

  <section className="info-grid">
    <div className="info-card">
      <ShieldCheck size={22} />
      <div>
        <strong>Real Data</strong>
        <p>Results are loaded from the configured history API.</p>
      </div>
    </div>
    <div className="info-card">
      <BrainCircuit size={22} />
      <div>
        <strong>Transparent Analysis</strong>
        <p>Past frequency is shown without claiming certainty.</p>
      </div>
    </div>
  </section>

  <footer>
    <div className="footer-brand">ZARA AI PREDICTOR</div>
    <p>
      For informational purposes only. Not financial advice. No
      guaranteed outcomes. Play responsibly.
    </p>
    <span>LIVE DATA • HISTORICAL ANALYSIS • 1M</span>
  </footer>
</main>

);
}
