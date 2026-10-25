"use client";

import { useCallback, useEffect, useState } from "react";

type Result = {
issueNumber: string;
number: number;
color?: string;
};

type Signal = {
period: string;
number: number;
size: "BIG" | "SMALL";
color: string;
confidence: number;
};

type ApiResponse = {
ok?: boolean;
source?: string;
data?: unknown;
error?: string;
details?: string;
};

function extractRows(value: unknown): unknown[] {
if (Array.isArray(value)) return value;
if (!value || typeof value !== "object") return [];

const obj = value as Record<string, unknown>;

if (Array.isArray(obj.list)) return obj.list;
if (Array.isArray(obj.records)) return obj.records;
if (Array.isArray(obj.data)) return obj.data;

if (obj.data && typeof obj.data === "object") {
return extractRows(obj.data);
}

if (obj.result && typeof obj.result === "object") {
return extractRows(obj.result);
}

return [];
}

function parseHistory(value: unknown): Result[] {
return extractRows(value)
.map((row): Result | null => {
if (!row || typeof row !== "object") return null;

  const obj = row as Record<string, unknown>;

  const period =
    obj.issueNumber ??
    obj.issue_number ??
    obj.issue ??
    obj.period;

  const rawNumber =
    obj.number ??
    obj.openNumber ??
    obj.open_number ??
    obj.result;

  const number = Number(rawNumber);

  if (
    period === undefined ||
    period === null ||
    !Number.isInteger(number) ||
    number < 0 ||
    number > 9
  ) {
    return null;
  }

  return {
    issueNumber: String(period),
    number,
    color: typeof obj.color === "string" ? obj.color : "",
  };
})
.filter((item): item is Result => item !== null);

}

function incrementPeriod(period: string): string {
if (!/^\d+$/.test(period)) return "";

const digits = period.split("");
let carry = 1;

for (let i = digits.length - 1; i >= 0 && carry; i--) {
const value = Number(digits[i]) + carry;

digits[i] = String(value % 10);
carry = value >= 10 ? 1 : 0;

}

if (carry) digits.unshift("1");

return digits.join("");
}

function getSize(number: number): "BIG" | "SMALL" {
return number >= 5 ? "BIG" : "SMALL";
}

function getColor(number: number): string {
if (number === 0) return "RED + VIOLET";
if (number === 5) return "GREEN + VIOLET";
return number % 2 === 0 ? "RED" : "GREEN";
}

function getColorClass(color: string): string {
if (color.includes("VIOLET")) return "violet-text";
return color === "RED" ? "red-text" : "green-text";
}

function makeSignal(history: Result[], period: string): Signal | null {
if (!history.length || !/^\d+$/.test(period)) return null;

const recent = history.slice(0, 30);
const scores = Array(10).fill(0) as number[];

recent.forEach((item, index) => {
const weight = Math.max(0.5, 1.5 - index * 0.035);
scores[item.number] += weight;
});

const seed = period
.split("")
.reduce((total, digit) => (total + Number(digit)) % 10, 0);

const highestScore = Math.max(...scores);

const tiedNumbers = scores
.map((score, number) => ({ score, number }))
.filter((entry) => entry.score === highestScore)
.map((entry) => entry.number);

const selectedNumber = tiedNumbers[seed % tiedNumbers.length];

const totalScore = scores.reduce((sum, score) => sum + score, 0);
const frequency =
totalScore > 0 ? (scores[selectedNumber] / totalScore) * 100 : 10;

// Heuristic score only. It is not a verified winning probability.
const confidence = Math.max(
10,
Math.min(95, Math.round(20 + frequency * 2)),
);

return {
period,
number: selectedNumber,
size: getSize(selectedNumber),
color: getColor(selectedNumber),
confidence,
};
}

function countdownText(seconds: number): string {
const mins = Math.floor(seconds / 60);
const secs = seconds % 60;

return "${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}";
}

export default function Home() {
const [history, setHistory] = useState<Result[]>([]);
const [signal, setSignal] = useState<Signal | null>(null);
const [seconds, setSeconds] = useState(59);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState("");
const [source, setSource] = useState("");
const [updated, setUpdated] = useState("");

const refresh = useCallback(async (manual = false) => {
if (manual) setRefreshing(true);

try {
  const response = await fetch("/api/history", {
    cache: "no-store",
  });

  const json = (await response.json()) as ApiResponse;

  if (!response.ok || !json.ok) {
    throw new Error(
      json.details || json.error || `Request failed: ${response.status}`,
    );
  }

  const rows = parseHistory(json.data);

  if (!rows.length) {
    throw new Error("API returned no readable WinGo results.");
  }

  setHistory(rows);
  setSource(json.source || "WinGo History API");
  setUpdated(new Date().toLocaleTimeString());
  setError("");
} catch (err) {
  setError(
    err instanceof Error ? err.message : "Unable to load history.",
  );
} finally {
  setLoading(false);
  setRefreshing(false);
}

}, []);

useEffect(() => {
const updateClock = () => {
const now = new Date();
setSeconds(59 - now.getSeconds());
};

updateClock();

const clock = window.setInterval(updateClock, 250);
const timer = window.setInterval(() => void refresh(), 10000);

void refresh();

return () => {
  window.clearInterval(clock);
  window.clearInterval(timer);
};

}, [refresh]);

const latest = history[0] ?? null;

// This period is estimated from the latest returned result.
// It is not confirmed by an official current-period endpoint.
const currentPeriod = latest
? incrementPeriod(latest.issueNumber)
: "";

useEffect(() => {
if (!currentPeriod) {
setSignal(null);
return;
}

setSignal(makeSignal(history, currentPeriod));

}, [history, currentPeriod]);

const actual = history.find(
(item) => item.issueNumber === signal?.period,
);

let verification: "PENDING" | "WIN" | "LOSS" = "PENDING";

if (signal && actual) {
verification =
actual.number === signal.number ? "WIN" : "LOSS";
}

const bigCount = history.filter((item) => item.number >= 5).length;
const smallCount = history.length - bigCount;

const colorClass = signal ? getColorClass(signal.color) : "";

return (
<main className="app-shell">
<div className="background-glow background-glow-one" />
<div className="background-glow background-glow-two" />

  <div className="dashboard">
    <header className="topbar">
      <div className="brand">
        <div className="brand-logo">Z</div>
        <div>
          <h1>ZARA <span>AI</span></h1>
          <p>WINGO 1 MIN PREDICTOR</p>
        </div>
      </div>

      <div className={`connection ${error ? "offline" : ""}`}>
        <span className="status-dot" />
        {error ? "API ISSUE" : loading ? "CONNECTING" : "SYSTEM ACTIVE"}
      </div>
    </header>

    {error && (
      <div className="error-banner">
        <span>⚠</span>
        <div>
          <strong>History connection issue</strong>
          <p>{error}</p>
        </div>
      </div>
    )}

    <section className="hero panel">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="live-dot" />
          LIVE ANALYTICS DASHBOARD
        </div>

        <h2>
          Read the data.
          <br />
          <span>Study the next round.</span>
        </h2>

        <p>
          Experimental history-based signals, automatic result
          verification and live round monitoring.
        </p>

        <button
          className="refresh-button"
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
        >
          <span className={refreshing ? "spin" : ""}>↻</span>
          {refreshing ? "Refreshing..." : "Refresh History"}
        </button>
      </div>

      <div className="clock-card">
        <div className="card-label">
          <span>ROUND COUNTDOWN</span>
          <span>◷</span>
        </div>

        <div className="countdown">{countdownText(seconds)}</div>
        <p className="muted">Based on your device clock</p>

        <div className="divider" />

        <p className="card-label">LATEST COMPLETED PERIOD</p>

        <div className="period-number">
          {latest?.issueNumber || "Waiting for data"}
        </div>
      </div>
    </section>

    <section className="stats-grid">
      <div className="stat-card panel">
        <div className="stat-heading">
          <span>Latest Number</span>
          <span className="stat-icon">◉</span>
        </div>

        <div className="stat-main">
          <div
            className={`number-ball ${
              latest
                ? latest.number === 0
                  ? "ball-red"
                  : latest.number === 5
                    ? "ball-violet"
                    : latest.number % 2 === 0
                      ? "ball-red"
                      : "ball-green"
                : ""
            }`}
          >
            {latest ? latest.number : "—"}
          </div>

          <div>
            <strong>{latest ? getSize(latest.number) : "--"}</strong>
            <p className={latest ? getColorClass(getColor(latest.number)) : "muted"}>
              {latest ? getColor(latest.number) : "No result"}
            </p>
          </div>
        </div>
      </div>

      <div className="stat-card panel">
        <div className="stat-heading">
          <span>History Loaded</span>
          <span className="stat-icon">▤</span>
        </div>
        <div className="stat-value">{history.length}</div>
        <p className="muted">Completed results</p>
      </div>

      <div className="stat-card panel">
        <div className="stat-heading">
          <span>Big Results</span>
          <span className="stat-icon amber">↗</span>
        </div>
        <div className="stat-value amber">{bigCount}</div>
        <p className="muted">Numbers 5–9</p>
      </div>

      <div className="stat-card panel">
        <div className="stat-heading">
          <span>Small Results</span>
          <span className="stat-icon blue">↘</span>
        </div>
        <div className="stat-value blue">{smallCount}</div>
        <p className="muted">Numbers 0–4</p>
      </div>
    </section>

    <section className="signal-section panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            EXPERIMENTAL SIGNAL
          </div>
          <h3>Current Period Prediction</h3>
          <p className="muted">
            Calculated from recent completed results
          </p>
        </div>

        <div className="ai-badge">ZARA AI</div>
      </div>

      <div className="signal-period">
        <span className="muted">ESTIMATED TARGET PERIOD</span>
        <strong>{signal?.period || "Waiting for history..."}</strong>
      </div>

      {signal ? (
        <>
          <div className="signal-grid">
            <div className="signal-tile">
              <span className="tile-label">BIG / SMALL</span>
              <strong className={signal.size === "BIG" ? "amber" : "blue"}>
                {signal.size}
              </strong>
              <span className="tile-caption">
                {signal.size === "BIG" ? "Range 5–9" : "Range 0–4"}
              </span>
            </div>

            <div className="signal-tile">
              <span className="tile-label">COLOR SIGNAL</span>
              <strong className={colorClass}>{signal.color}</strong>
              <span className="tile-caption">Based on selected number</span>
            </div>

            <div className="signal-tile number-tile">
              <span className="tile-label">NUMBER SIGNAL</span>
              <div
                className={`number-ball large ${
                  signal.number === 0
                    ? "ball-red"
                    : signal.number === 5
                      ? "ball-violet"
                      : signal.number % 2 === 0
                        ? "ball-red"
                        : "ball-green"
                }`}
              >
                {signal.number}
              </div>
            </div>
          </div>

          <div className="confidence-box">
            <div className="confidence-heading">
              <span>HEURISTIC SCORE</span>
              <strong>{signal.confidence}%</strong>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${signal.confidence}%` }}
              />
            </div>

            <p className="muted">
              Historical-frequency score only—not a verified probability
              of winning.
            </p>
          </div>

          <div className={`verification ${verification.toLowerCase()}`}>
            <div className="verification-icon">
              {verification === "WIN"
                ? "✓"
                : verification === "LOSS"
                  ? "×"
                  : "◷"}
            </div>

            <div className="verification-copy">
              <strong>
                {verification === "PENDING"
                  ? "WAITING FOR RESULT"
                  : verification === "WIN"
                    ? "NUMBER MATCHED"
                    : "NUMBER NOT MATCHED"}
              </strong>

              <p>
                {verification === "PENDING"
                  ? "Waiting for the target period to appear in the fetched history."
                  : `Signal number ${signal.number} · Actual number ${actual?.number}`}
              </p>
            </div>

            <span className="verification-status">{verification}</span>
          </div>
        </>
      ) : (
        <div className="empty-state">
          {loading
            ? "Loading history and preparing signal..."
            : "A signal is unavailable until valid history loads."}
        </div>
      )}
    </section>

    <section className="two-column">
      <div className="panel content-card">
        <div className="section-heading compact">
          <div>
            <h3>Historical Distribution</h3>
            <p className="muted">Loaded results only</p>
          </div>
          <span className="stat-icon">▥</span>
        </div>

        <div className="distribution-item">
          <div className="distribution-heading">
            <span className="amber">BIG</span>
            <strong>
              {history.length
                ? Math.round((bigCount / history.length) * 100)
                : 0}%
            </strong>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill amber-fill"
              style={{
                width: `${history.length ? (bigCount / history.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="distribution-item">
          <div className="distribution-heading">
            <span className="blue">SMALL</span>
            <strong>
              {history.length
                ? Math.round((smallCount / history.length) * 100)
                : 0}%
            </strong>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill blue-fill"
              style={{
                width: `${history.length ? (smallCount / history.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="info-note">
          Historical frequency does not guarantee the next outcome.
        </div>
      </div>

      <div className="panel content-card">
        <div className="section-heading compact">
          <div>
            <h3>System Monitor</h3>
            <p className="muted">Data connection status</p>
          </div>
          <span className="stat-icon">⌁</span>
        </div>

        <div className="monitor-row">
          <span>History API</span>
          <strong className={error ? "red-text" : "green-text"}>
            {error ? "CHECK CONNECTION" : loading ? "CONNECTING" : "CONNECTED"}
          </strong>
        </div>

        <div className="monitor-row">
          <span>Refresh interval</span>
          <strong>10 seconds</strong>
        </div>

        <div className="monitor-row">
          <span>Last update</span>
          <strong>{updated || "Waiting..."}</strong>
        </div>

        <div className="monitor-row">
          <span>Signal mode</span>
          <strong>EXPERIMENTAL</strong>
        </div>

        <p className="source-text">
          Source: {source || "Not connected"}
        </p>
      </div>
    </section>

    <section className="panel history-section">
      <div className="section-heading">
        <div>
          <h3>Recent WinGo Results</h3>
          <p className="muted">
            Actual completed results returned by the API
          </p>
        </div>
        <span className="count-badge">{history.length} RESULTS</span>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          {loading
            ? "Loading results..."
            : "No results available. Check the API connection."}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="history-table">
            <thead>
              <tr>
                <th>PERIOD</th>
                <th>NUMBER</th>
                <th>COLOR</th>
                <th>SIZE</th>
              </tr>
            </thead>

            <tbody>
              {history.map((item, index) => (
                <tr key={`${item.issueNumber}-${index}`}>
                  <td className="period-cell">{item.issueNumber}</td>
                  <td>
                    <span
                      className={`number-ball table-ball ${
                        item.number === 0
                          ? "ball-red"
                          : item.number === 5
                            ? "ball-violet"
                            : item.number % 2 === 0
                              ? "ball-red"
                              : "ball-green"
                      }`}
                    >
                      {item.number}
                    </span>
                  </td>
                  <td className={getColorClass(getColor(item.number))}>
                    {getColor(item.number)}
                  </td>
                  <td>
                    <span
                      className={`size-badge ${
                        getSize(item.number) === "BIG"
                          ? "big-badge"
                          : "small-badge"
                      }`}
                    >
                      {getSize(item.number)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>

    <footer className="disclaimer">
      <strong>⚠ Responsible Use</strong>
      <p>
        This dashboard provides experimental statistics, not guaranteed
        predictions. The score is not a real winning probability. The
        target period is estimated from the latest completed result,
        and the countdown follows your device clock.
      </p>
    </footer>

    <div className="footer-bottom">
      ZARA AI PREDICTOR <span>•</span> ANALYTICS DASHBOARD
    </div>
  </div>
</main>

);
}
