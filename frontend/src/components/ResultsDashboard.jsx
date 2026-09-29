"use client";

import { useState } from "react";

export default function ResultsDashboard({ result }) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div>
      {/* Title Banner */}
      <div className="title-banner">
        <div className="title-banner-label">{"\uD83D\uDCCC"} Session Title</div>
        <div className="title-banner-text">{result.title}</div>
      </div>

      {/* Summary + Transcript Row */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">{"\uD83D\uDCCB"} Summary</div>
          <div
            className="card-content"
            dangerouslySetInnerHTML={{
              __html: formatText(result.summary),
            }}
          />
        </div>

        <div className="card">
          <div
            className="transcript-toggle"
            onClick={() => setShowTranscript(!showTranscript)}
          >
            <span>{"\uD83D\uDCDD"} Full Transcript</span>
            <span>{showTranscript ? "\u25B2" : "\u25BC"}</span>
          </div>
          {showTranscript && (
            <div className="transcript-box">{result.transcript}</div>
          )}
        </div>
      </div>

      {/* Action Items, Decisions, Questions */}
      <div className="grid-3">
        <div className="card">
          <div className="card-title">{"\u2705"} Action Items</div>
          <div
            className="card-content"
            dangerouslySetInnerHTML={{
              __html: formatText(result.action_items),
            }}
          />
        </div>

        <div className="card">
          <div className="card-title">{"\uD83D\uDD11"} Key Decisions</div>
          <div
            className="card-content"
            dangerouslySetInnerHTML={{
              __html: formatText(result.key_decisions),
            }}
          />
        </div>

        <div className="card">
          <div className="card-title">{"\u2753"} Open Questions</div>
          <div
            className="card-content"
            dangerouslySetInnerHTML={{
              __html: formatText(result.open_questions),
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Convert line breaks and numbered lists into basic HTML */
function formatText(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}
