"use client";

import { useCallback, useEffect, useState } from "react";

type HistoryItem = {
  issueNumber: string;
  number: number;
  color: string;
};

type ApiResponse = {
  ok?: boolean;
  source?: string;
  data?: unknown;
  message?: string;
};

type Signal = {
  prediction: string;
  number: number;
  confidence: number;
  reason: string;
};

function extractHistory(payload: unknown): HistoryItem[] {
  const result: HistoryItem[] = [];

  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    const obj = value as Record<string, unknown>;

    const issue =
      obj.issueNumber ??
      obj.issue ??
      obj.period ??
      obj.issue_number;

    const rawNumber =
      obj.number ??
      obj.openNumber ??
      obj.result ??
      obj.openResult;

    const parsedNumber = Number(rawNumber);

    if (
      issue !== undefined &&
      issue !== null &&
      rawNumber !== undefined &&
      Number.isFinite(parsedNumber) &&
      parsedNumber >= 0 &&
      parsedNumber <= 9
    ) {
      const rawColor = String(obj.color ?? "").toLowerCase();

      const color = rawColor.includes("violet")
        ? "violet"
        : rawColor.includes("red")
          ? "red"
          : rawColor.includes("green")
            ? "green"
            : [0, 5].includes(parsedNumber)
              ? "violet"
              : parsedNumber % 2 === 0
                ? "red"
                : "green";

      result.push({
        issueNumber: String(issue),
        number: parsedNumber,
        color,
      });

      return;
    }

    Object.values(obj).forEach(walk);
  }

  walk(payload);

  const unique = new Map<string, HistoryItem>();

  result.forEach((item) => {
    if (!unique.has(item.issueNumber)) {
      unique.set(item.issueNumber, item);
    }
  });

  return Array.from(unique.values());
}

function estimateNextPeriod(history: HistoryItem[]): string {
  if (history.length === 0) return "Waiting for API";

  const latest = history[0].issueNumber;

  if (!/^\d+$/.test(latest)) {
    return "Period unavailable";
  }

  try {
    return (BigInt(latest) + BigInt(1)).toString();
  } catch {
    return "Period unavailable";
  }
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  // IMPORTANT: Template strings ke liye backticks use hote hain.
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function makeSignal(history: HistoryItem[]): Signal {
  if (history.length < 5) {
    return {
      prediction: "ANALYZING",
      number: 0,
      confidence: 0,
      reason: "Waiting for sufficient result history",
    };
  }

  const recent = history.slice(0, 20);

  let bigCount = 0;
  let smallCount = 0;
  const numberCounts = Array(10).fill(0);

  recent.forEach((item) => {
    numberCounts[item.number]++;

    if (item.number >= 5) {
      bigCount++;
    } else {
      smallCount++;
    }
  });

  const bigScore = bigCount / recent.length;
  const smallScore = smallCount / recent.length;

  const prediction = bigScore >= smallScore ? "BIG" : "SMALL";

  let selectedNumber = 0;
  let highestFrequency = -1;

  numberCounts.forEach((count, number) => {
    const matchesPrediction =
      prediction === "BIG" ? number >= 5 : number < 5;

    if (matchesPrediction && count > highestFrequency) {
      highestFrequency = count;
      selectedNumber = number;
    }
  });

  const confidence = Math.round(
    Math.max(bigScore, smallScore) * 100,
  );

  return {
    prediction,
    number: selectedNumber,
    confidence,
    reason:
      "Based on recent historical frequency; not a guaranteed prediction",
  };
}

export default function Home() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState("CONNECTING");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/history", {
        cache: "no-store",
      });

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.message || "History API request failed",
        );
      }

      const parsed = extractHistory(payload.data ?? payload);

      if (parsed.length === 0) {
        throw new Error("API returned no readable results");
      }

      setHistory(parsed);
      setSource(payload.source || "History API");
      setApiStatus("CONNECTED");
      setError("");
      setLastUpdated(new Date().toLocaleTimeString());
      setRefreshCount((previous) => previous + 1);
    } catch (err) {
      setApiStatus("RETRYING");
      setError(
        err instanceof Error ? err.message : "Unable to load history",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();

    const refreshTimer = window.setInterval(() => {
      void loadHistory();
    }, 15000);

    return () => window.clearInterval(refreshTimer);
  }, [loadHistory]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((previous) => (previous <= 1 ? 59 : previous - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const signal = makeSignal(history);
  const nextPeriod = estimateNextPeriod(history);
  const latestResult = history[0];

  const bigCount = history.filter((item) => item.number >= 5).length;
  const smallCount = history.filter((item) => item.number < 5).length;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a href="/" className="brand">
          <div className="brand-logo">
            <span>Z</span>
          </div>

          <div className="brand-copy">
            <strong>ZARA AI</strong>
            <span>PREDICTOR</span>
          </div>
        </a>

        <div className="header-right">
          <span className="live-dot" />
          <span className="header-status">
            {apiStatus === "CONNECTED" ? "SYSTEM ONLINE" : apiStatus}
          </span>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrow-icon">✦</span>
          WIN GO · 1 MINUTE
        </div>

        <h1>
          Smart Analysis.
          <br />
          <span>Clear Insights.</span>
        </h1>

        <p className="hero-description">
          Track recent results, monitor the countdown, and explore
          experimental BIG/SMALL signals based on historical data.
        </p>

        <div className="hero-tags">
          <span>◈ History Analysis</span>
          <span>◷ Auto Refresh</span>
          <span>⌁ Live Dashboard</span>
        </div>
      </section>

      <section className="dashboard">
        <div className="section-heading">
          <div>
            <span className="section-kicker">YOUR DASHBOARD</span>
            <h2>Live Overview</h2>
          </div>

          <button
            className="refresh-button"
            onClick={() => void loadHistory()}
            disabled={loading}
          >
            <span className={loading ? "spin" : ""}>↻</span>
            Refresh
          </button>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">
              <span className="stat-label">API STATUS</span>
              <span className="stat-icon green-icon">⌁</span>
            </div>

            <div
              className={`stat-value ${
                apiStatus === "CONNECTED" ? "green-text" : ""
              }`}
            >
              {apiStatus === "CONNECTED" ? "Online" : apiStatus}
            </div>

            <div className="stat-foot">
              {source || "Connecting to history API"}
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span className="stat-label">BIG RESULTS</span>
              <span className="stat-icon purple-icon">↗</span>
            </div>

            <div className="stat-value">{bigCount}</div>
            <div className="stat-foot">Loaded history records</div>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span className="stat-label">SMALL RESULTS</span>
              <span className="stat-icon orange-icon">↘</span>
            </div>

            <div className="stat-value">{smallCount}</div>
            <div className="stat-foot">Loaded history records</div>
          </article>
        </div>

        <div className="main-grid">
          <article className="panel signal-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">EXPERIMENTAL SIGNAL</span>
                <h3>Next Round Analysis</h3>
              </div>

              <span className="analysis-badge">BETA</span>
            </div>

            <div className="period-box">
              <span className="muted-label">ESTIMATED NEXT PERIOD</span>
              <strong className="period-number">{nextPeriod}</strong>
            </div>

            <div className="countdown-row">
              <div>
                <span className="muted-label">ROUND TIMER</span>
                <div className="countdown">
                  {formatCountdown(countdown)}
                </div>
              </div>

              <div className="timer-icon">◷</div>
            </div>

            <div className="signal-divider" />

            <div className="signal-result">
              <div>
                <span className="muted-label">HISTORICAL TREND SIGNAL</span>

                <div
                  className={`signal-pill ${
                    signal.prediction === "BIG"
                      ? "big-pill"
                      : signal.prediction === "SMALL"
                        ? "small-pill"
                        : "waiting-pill"
                  }`}
                >
                  {loading && history.length === 0
                    ? "LOADING"
                    : signal.prediction}
                </div>
              </div>

              <div className="signal-number">
                <span className="muted-label">FREQUENT NUMBER</span>
                <div className="number-orb">
                  {history.length ? signal.number : "—"}
                </div>
              </div>
            </div>

            <div className="confidence-box">
              <div className="confidence-heading">
                <span>Historical Frequency Share</span>
                <strong>
                  {history.length ? `${signal.confidence}%` : "—"}
                </strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${history.length ? signal.confidence : 0}%`,
                  }}
                />
              </div>

              <p className="signal-note">{signal.reason}</p>
            </div>

            <div className="disclaimer">
              <span>ⓘ</span>
              <p>
                This is an experimental statistical indicator, not a
                verified AI prediction. Past results do not determine
                future outcomes. No win is guaranteed.
              </p>
            </div>
          </article>

          <article className="panel latest-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">MOST RECENT DATA</span>
                <h3>Latest Result</h3>
              </div>

              <span className="live-label">
                <span className="live-dot" />
                HISTORY
              </span>
            </div>

            {latestResult ? (
              <>
                <div className="latest-orb-wrap">
                  <div
                    className={`latest-orb ${latestResult.color}`}
                  >
                    {latestResult.number}
                  </div>
                </div>

                <div className="latest-color">
                  <span
                    className={`color-dot ${latestResult.color}`}
                  />
                  {latestResult.color.toUpperCase()}
                </div>

                <div className="latest-period">
                  <span className="muted-label">PERIOD NUMBER</span>
                  <strong>{latestResult.issueNumber}</strong>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-symbol">◌</div>
                <strong>
                  {loading ? "Loading results..." : "No result available"}
                </strong>
                <span>
                  {error || "Waiting for the history API"}
                </span>
              </div>
            )}

            <div className="latest-footer">
              <span>Last update</span>
              <strong>{lastUpdated || "Waiting..."}</strong>
            </div>
          </article>
        </div>

        <article className="panel history-panel">
          <div className="panel-heading history-heading">
            <div>
              <span className="panel-kicker">REAL API DATA</span>
              <h3>Recent History</h3>
            </div>

            <span className="records-badge">
              {history.length} RECORDS
            </span>
          </div>

          {error && (
            <div className="error-banner">
              <span>!</span>
              <div>
                <strong>History API unavailable</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {history.length > 0 ? (
            <div className="history-list">
              {history.slice(0, 10).map((item, index) => (
                <div className="history-row" key={item.issueNumber}>
                  <div className="history-index">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="history-period">
                    <strong>{item.issueNumber}</strong>
                    <span>{index === 0 ? "Latest result" : "Completed round"}</span>
                  </div>

                  <div className="history-color">
                    <span className={`color-dot ${item.color}`} />
                    <span>{item.color.toUpperCase()}</span>
                  </div>

                  <div className={`history-number ${item.color}`}>
                    {item.number}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="history-empty">
              {loading
                ? "Connecting to the history API..."
                : "No history records could be loaded."}
            </div>
          )}

          <div className="history-footer">
            <span>
              Auto refresh every 15 seconds · Refresh #{refreshCount}
            </span>
            <span>Source: {source || "Not connected"}</span>
          </div>
        </article>
      </section>

      <footer className="footer">
        <a href="/" className="footer-brand">
          <span className="footer-logo">Z</span>
          ZARA AI PREDICTOR
        </a>

        <p>Independent statistical analysis dashboard.</p>

        <p className="footer-disclaimer">
          For informational purposes only. Not financial advice.
          Outcomes are uncertain.
        </p>

        <span className="copyright">
          © {new Date().getFullYear()} Zara AI
        </span>
      </footer>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap");

        :root {
          color-scheme: dark;
          --bg: #080b12;
          --panel: rgba(17, 22, 34, 0.9);
          --border: rgba(156, 174, 211, 0.13);
          --text: #f5f7ff;
          --muted: #8791a9;
          --green: #37e6a2;
          --purple: #a78bfa;
        }

        * {
          box-sizing: border-box;
        }

        html {
          min-height: 100%;
          background: var(--bg);
        }

        body {
          margin: 0;
          color: var(--text);
          font-family: "DM Sans", sans-serif;
          background:
            radial-gradient(
              ellipse at 50% 0%,
              rgba(70, 83, 159, 0.12),
              transparent 48%
            ),
            var(--bg);
        }

        button,
        a {
          font: inherit;
        }

        button {
          color: inherit;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .app-shell {
          position: relative;
          isolation: isolate;
          min-height: 100vh;
          overflow: hidden;
          padding: 0 24px;
        }

        .ambient {
          position: absolute;
          z-index: -1;
          width: 400px;
          height: 400px;
          pointer-events: none;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.1;
        }

        .ambient-one {
          top: 400px;
          left: -280px;
          background: #15dca0;
        }

        .ambient-two {
          top: 750px;
          right: -300px;
          background: #8b5cf6;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1160px;
          height: 84px;
          margin: 0 auto;
          border-bottom: 1px solid var(--border);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          display: grid;
          width: 43px;
          height: 43px;
          place-items: center;
          border: 1px solid rgba(55, 230, 162, 0.42);
          border-radius: 14px;
          background: linear-gradient(
            145deg,
            rgba(55, 230, 162, 0.17),
            rgba(55, 230, 162, 0.025)
          );
          box-shadow: 0 0 30px rgba(55, 230, 162, 0.06);
        }

        .brand-logo span {
          color: var(--green);
          font-family: "Space Grotesk", sans-serif;
          font-size: 26px;
          font-weight: 700;
        }

        .brand-copy {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .brand-copy strong {
          font-family: "Space Grotesk", sans-serif;
          font-size: 15px;
          letter-spacing: 1.3px;
        }

        .brand-copy span {
          color: var(--muted);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 3px;
        }

        .header-right,
        .live-label {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .header-status {
          color: #aab4c9;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .live-dot {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--green);
          box-shadow: 0 0 12px rgba(55, 230, 162, 0.6);
        }

        .hero {
          max-width: 800px;
          margin: 0 auto;
          padding: 76px 0 65px;
          text-align: center;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          border: 1px solid rgba(55, 230, 162, 0.18);
          border-radius: 100px;
          background: rgba(55, 230, 162, 0.06);
          color: var(--green);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.8px;
        }

        .eyebrow-icon {
          font-size: 14px;
        }

        .hero h1 {
          margin: 24px 0 16px;
          font-family: "Space Grotesk", sans-serif;
          font-size: clamp(39px, 7vw, 68px);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -3px;
        }

        .hero h1 span {
          color: transparent;
          background: linear-gradient(
            100deg,
            #37e6a2 0%,
            #91f4d0 45%,
            #a78bfa 100%
          );
          background-clip: text;
          -webkit-background-clip: text;
        }

        .hero-description {
          max-width: 580px;
          margin: 0 auto;
          color: #929bb0;
          font-size: 14px;
          line-height: 1.9;
        }

        .hero-tags {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 26px;
        }

        .hero-tags span {
          padding: 9px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          color: #aab4c9;
          font-size: 10px;
        }

        .dashboard {
          max-width: 1100px;
          margin: 0 auto;
        }

        .section-heading,
        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .section-heading {
          margin-bottom: 20px;
        }

        .section-kicker,
        .panel-kicker {
          color: var(--green);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .section-heading h2 {
          margin: 7px 0 0;
          font-family: "Space Grotesk", sans-serif;
          font-size: 25px;
          letter-spacing: -0.8px;
        }

        .refresh-button {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 15px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: #141a27;
          color: #dce4f4;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }

        .refresh-button:hover {
          border-color: rgba(55, 230, 162, 0.5);
          background: #182328;
        }

        .refresh-button:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .refresh-button span {
          color: var(--green);
          font-size: 18px;
        }

        .spin {
          animation: rotate 1s linear infinite;
        }

        @keyframes rotate {
          to {
            transform: rotate(360deg);
          }
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .stat-card,
        .panel {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--panel);
          box-shadow: 0 15px 45px rgba(0, 0, 0, 0.08);
          backdrop-filter: blur(15px);
        }

        .stat-card {
          padding: 21px;
        }

        .stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .stat-label,
        .muted-label {
          color: var(--muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .stat-icon {
          display: grid;
          width: 31px;
          height: 31px;
          place-items: center;
          border-radius: 10px;
          font-size: 19px;
        }

        .green-icon {
          color: var(--green);
          background: rgba(55, 230, 162, 0.09);
        }

        .purple-icon {
          color: var(--purple);
          background: rgba(167, 139, 250, 0.1);
        }

        .orange-icon {
          color: #ffb86b;
          background: rgba(255, 184, 107, 0.1);
        }

        .stat-value {
          margin-top: 18px;
          font-family: "Space Grotesk", sans-serif;
          font-size: 28px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .green-text {
          color: var(--green);
        }

        .stat-foot {
          margin-top: 8px;
          color: #768197;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          align-items: stretch;
          gap: 18px;
          margin-bottom: 18px;
        }

        .panel {
          min-width: 0;
          padding: 24px;
        }

        .panel-heading {
          margin-bottom: 23px;
        }

        .panel-heading h3 {
          margin: 7px 0 0;
          font-family: "Space Grotesk", sans-serif;
          font-size: 19px;
          letter-spacing: -0.4px;
        }

        .analysis-badge,
        .records-badge {
          padding: 7px 9px;
          border: 1px solid rgba(167, 139, 250, 0.23);
          border-radius: 7px;
          background: rgba(167, 139, 250, 0.07);
          color: #c5b4ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .period-box {
          display: flex;
          flex-direction: column;
          gap: 9px;
          padding: 15px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: rgba(5, 9, 16, 0.4);
        }

        .period-number {
          font-family: "Space Grotesk", sans-serif;
          font-size: clamp(17px, 2.5vw, 24px);
          overflow-wrap: anywhere;
        }

        .countdown-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 23px;
        }

        .countdown {
          margin-top: 7px;
          color: var(--green);
          font-family: "Space Grotesk", sans-serif;
          font-size: 36px;
          font-weight: 700;
          letter-spacing: 2px;
          font-variant-numeric: tabular-nums;
        }

        .timer-icon {
          display: grid;
          width: 49px;
          height: 49px;
          place-items: center;
          border: 1px solid rgba(55, 230, 162, 0.17);
          border-radius: 15px;
          background: rgba(55, 230, 162, 0.055);
          color: var(--green);
          font-size: 27px;
        }

        .signal-divider {
          height: 1px;
          margin: 22px 0;
          background: var(--border);
        }

        .signal-result {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .signal-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 110px;
          margin-top: 12px;
          padding: 11px 18px;
          border: 1px solid transparent;
          border-radius: 9px;
          font-family: "Space Grotesk", sans-serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .big-pill {
          border-color: rgba(55, 230, 162, 0.24);
          background: rgba(55, 230, 162, 0.1);
          color: var(--green);
        }

        .small-pill {
          border-color: rgba(167, 139, 250, 0.25);
          background: rgba(167, 139, 250, 0.1);
          color: #c5b4ff;
        }

        .waiting-pill {
          border-color: var(--border);
          background: rgba(255, 255, 255, 0.03);
          color: #aab4c9;
        }

        .signal-number {
          text-align: right;
        }

        .number-orb {
          display: grid;
          width: 48px;
          height: 48px;
          margin: 8px 0 0 auto;
          place-items: center;
          border: 1px solid rgba(55, 230, 162, 0.3);
          border-radius: 50%;
          background: rgba(55, 230, 162, 0.08);
          color: var(--green);
          font-family: "Space Grotesk", sans-serif;
          font-size: 22px;
          font-weight: 700;
        }

        .confidence-box {
          margin-top: 23px;
        }

        .confidence-heading {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
          color: #aab4c9;
          font-size: 10px;
        }

        .confidence-heading strong {
          color: var(--green);
        }

        .progress-track {
          height: 6px;
          overflow: hidden;
          border-radius: 10px;
          background: #252b39;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #26bc87, #37e6a2);
          transition: width 0.3s ease;
        }

        .signal-note {
          margin: 10px 0 0;
          color: #778197;
          font-size: 10px;
          line-height: 1.6;
        }

        .disclaimer {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 20px;
          padding: 12px;
          border: 1px solid rgba(255, 184, 107, 0.15);
          border-radius: 10px;
          background: rgba(255, 184, 107, 0.045);
          color: #ffcc8d;
        }

        .disclaimer > span {
          font-size: 15px;
        }

        .disclaimer p {
          margin: 0;
          color: #b5a58f;
          font-size: 10px;
          line-height: 1.7;
        }

        .live-label {
          color: #9da8bc;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .latest-orb-wrap {
          display: grid;
          min-height: 160px;
          place-items: center;
          margin-top: 4px;
          background: radial-gradient(
            circle,
            rgba(55, 230, 162, 0.055),
            transparent 65%
          );
        }

        .latest-orb {
          display: grid;
          width: 105px;
          height: 105px;
          place-items: center;
          border: 2px solid rgba(55, 230, 162, 0.45);
          border-radius: 50%;
          background: linear-gradient(
            145deg,
            rgba(55, 230, 162, 0.15),
            rgba(55, 230, 162, 0.025)
          );
          box-shadow:
            0 0 0 9px rgba(55, 230, 162, 0.025),
            0 0 50px rgba(55, 230, 162, 0.1);
          color: var(--green);
          font-family: "Space Grotesk", sans-serif;
          font-size: 44px;
          font-weight: 700;
        }

        .latest-orb.red {
          border-color: rgba(255, 92, 114, 0.45);
          background: rgba(255, 92, 114, 0.09);
          color: #ff7286;
          box-shadow: 0 0 40px rgba(255, 92, 114, 0.08);
        }

        .latest-orb.violet {
          border-color: rgba(167, 139, 250, 0.5);
          background: rgba(167, 139, 250, 0.09);
          color: #c5b4ff;
          box-shadow: 0 0 40px rgba(167, 139, 250, 0.08);
        }

        .latest-color {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 3px 0 25px;
          color: #d8deec;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.6px;
        }

        .color-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          flex: 0 0 auto;
          border-radius: 50%;
        }

        .color-dot.green {
          background: var(--green);
          box-shadow: 0 0 9px rgba(55, 230, 162, 0.3);
        }

        .color-dot.red {
          background: #ff657c;
          box-shadow: 0 0 9px rgba(255, 101, 124, 0.3);
        }

        .color-dot.violet {
          background: #ad8cff;
          box-shadow: 0 0 9px rgba(173, 140, 255, 0.3);
        }

        .latest-period {
          display: flex;
          flex-direction: column;
          gap: 9px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: rgba(5, 9, 16, 0.35);
        }

        .latest-period strong {
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .latest-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
          color: #78849a;
          font-size: 10px;
        }

        .latest-footer strong {
          color: #b5bfd2;
          font-weight: 500;
        }

        .empty-state {
          display: flex;
          min-height: 310px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-align: center;
        }

        .empty-symbol {
          color: var(--green);
          font-size: 42px;
        }

        .empty-state strong {
          font-size: 13px;
        }

        .empty-state span {
          max-width: 260px;
          color: var(--muted);
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .history-panel {
          margin-bottom: 25px;
        }

        .history-heading {
          margin-bottom: 20px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
        }

        .history-row {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) 100px 40px;
          align-items: center;
          gap: 13px;
          min-width: 0;
          padding: 15px 0;
          border-bottom: 1px solid rgba(156, 174, 211, 0.09);
        }

        .history-row:last-child {
          border-bottom: 0;
        }

        .history-index {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border: 1px solid var(--border);
          border-radius: 9px;
          color: #778197;
          font-size: 10px;
        }

        .history-period {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 5px;
        }

        .history-period strong {
          font-size: 11px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .history-period span {
          color: #78849a;
          font-size: 9px;
        }

        .history-color {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #aab4c9;
          font-size: 9px;
          font-weight: 700;
        }

        .history-number {
          display: grid;
          width: 35px;
          height: 35px;
          place-items: center;
          border: 1px solid var(--border);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.025);
          font-family: "Space Grotesk", sans-serif;
          font-size: 17px;
          font-weight: 700;
        }

        .history-number.green {
          color: var(--green);
        }

        .history-number.red {
          color: #ff7286;
        }

        .history-number.violet {
          color: #c5b4ff;
        }

        .history-footer {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 15px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
          color: #778197;
          font-size: 9px;
          overflow-wrap: anywhere;
        }

        .history-empty {
          padding: 35px 10px;
          color: var(--muted);
          font-size: 12px;
          text-align: center;
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 12px;
          padding: 13px;
          border: 1px solid rgba(255, 101, 124, 0.2);
          border-radius: 10px;
          background: rgba(255, 101, 124, 0.05);
        }

        .error-banner > span {
          display: grid;
          width: 22px;
          height: 22px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 101, 124, 0.13);
          color: #ff7286;
          font-weight: 800;
        }

        .error-banner strong {
          color: #ff9aa9;
          font-size: 11px;
        }

        .error-banner p {
          margin: 5px 0 0;
          color: #b7a0a7;
          font-size: 10px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .footer {
          display: flex;
          max-width: 1100px;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin: 0 auto;
          padding: 35px 0 30px;
          border-top: 1px solid var(--border);
          text-align: center;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          font-family: "Space Grotesk", sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .footer-logo {
          display: grid;
          width: 26px;
          height: 26px;
          place-items: center;
          border: 1px solid rgba(55, 230, 162, 0.3);
          border-radius: 8px;
          color: var(--green);
        }

        .footer p {
          margin: 0;
          color: #78849a;
          font-size: 10px;
          line-height: 1.7;
        }

        .footer .footer-disclaimer {
          max-width: 480px;
          color: #a38d77;
        }

        .copyright {
          margin-top: 4px;
          color: #5f6a80;
          font-size: 9px;
        }

        @media (max-width: 760px) {
          .app-shell {
            padding: 0 16px;
          }

          .topbar {
            height: 72px;
          }

          .brand-logo {
            width: 38px;
            height: 38px;
          }

          .brand-copy strong {
            font-size: 13px;
          }

          .brand-copy span {
            font-size: 9px;
          }

          .header-status {
            font-size: 8px;
            letter-spacing: 0.7px;
          }

          .hero {
            padding: 60px 0 48px;
          }

          .hero h1 {
            letter-spacing: -1.8px;
          }

          .hero-description {
            font-size: 13px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .stat-card {
            padding: 16px;
          }

          .stat-value {
            margin-top: 12px;
            font-size: 24px;
          }

          .main-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .panel {
            padding: 19px;
          }

          .history-row {
            grid-template-columns: 29px minmax(0, 1fr) 70px 35px;
            gap: 8px;
          }

          .history-index {
            width: 27px;
            height: 27px;
          }

          .history-period strong {
            font-size: 10px;
          }

          .history-color {
            gap: 5px;
            font-size: 8px;
          }

          .history-number {
            width: 32px;
            height: 32px;
          }
        }

        @media (max-width: 380px) {
          .app-shell {
            padding: 0 11px;
          }

          .brand {
            gap: 8px;
          }

          .brand-copy strong {
            font-size: 11px;
          }

          .header-status {
            font-size: 7px;
          }

          .panel {
            padding: 15px;
          }

          .history-row {
            grid-template-columns: 25px minmax(0, 1fr) 31px;
          }

          .history-color {
            display: none;
          }

          .history-index {
            width: 24px;
            height: 24px;
          }

          .period-number {
            font-size: 16px;
          }

          .countdown {
            font-size: 31px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}
