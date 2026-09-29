import React, { useState } from "react";
import ChatPanel from "./ChatPanel";

export default function RightPane({ jobStatus, jobStep, jobProgress, result, error }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!jobStatus && !result && !error) {
    return (
      <div className="right-pane empty-pane glass-panel">
        <div className="empty-content">
          <div className="empty-icon">{"\u2728"}</div>
          <h2>Ready to Analyze</h2>
          <p>Paste a video link and click analyze to generate insights.</p>
        </div>
      </div>
    );
  }

  if (jobStatus && jobStatus !== "done" && jobStatus !== "error") {
    // Pipeline Progress Simulator/Visualizer
    const steps = [
      { id: "downloading", label: "Downloading Audio" },
      { id: "transcribing", label: "Transcribing (Sarvam/Whisper)" },
      { id: "summarizing", label: "Summarizing (Mistral)" },
      { id: "indexing", label: "Indexing for Chat" }
    ];

    return (
      <div className="right-pane progress-pane glass-panel">
        <h2 className="progress-title">Analyzing Video...</h2>
        <div className="progress-steps">
          {steps.map((step, idx) => {
            let state = "pending";
            if (step.id === jobStep) state = "active";
            else if (
              steps.findIndex(s => s.id === jobStep) > idx || 
              (jobProgress === 100 && jobStep === null)
            ) {
              state = "done";
            }
            return (
              <div key={step.id} className={`step-item ${state}`}>
                <div className="step-indicator">
                  {state === "done" ? "\u2713" : state === "active" ? <span className="spinner-small" /> : idx + 1}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
            );
          })}
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${jobProgress}%` }}></div>
        </div>
      </div>
    );
  }

  if (error || jobStatus === "error") {
    return null; // Handled in LeftPane
  }

  if (result) {
    return (
      <div className="right-pane results-pane glass-panel">
        <div className="tabs-header">
          <button 
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === "transcript" ? "active" : ""}`}
            onClick={() => setActiveTab("transcript")}
          >
            Transcript
          </button>
          <button 
            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
        </div>

        <div className="tab-content scrollable">
          {activeTab === "overview" && (
            <div className="overview-tab">
              <h2 className="result-title">{result.title}</h2>
              <div className="badge type-badge">{result.video_type}</div>
              
              <div className="tldr-section section-box">
                <h3>TL;DR</h3>
                <p>{result.tldr}</p>
              </div>

              <div className="keypoints-section section-box">
                <h3>Key Points</h3>
                <ul>
                  {result.key_points?.map((kp, idx) => (
                    <li key={idx}>{kp.text}</li>
                  ))}
                </ul>
              </div>

              {result.sections?.length > 0 && (
                <div className="dynamic-sections">
                  {result.sections.map((sec, idx) => (
                    <div key={idx} className="section-box">
                      <h3>{sec.heading}</h3>
                      <ul>
                        {sec.items?.map((item, i) => (
                          <li key={i}>{item.text}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "transcript" && (
            <div className="transcript-tab">
              <div className="transcript-notice">
                <p>Transcript view is currently not provided by the API schema.</p>
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <ChatPanel sessionId={result.session_id} initialQuestions={result.suggested_questions} />
          )}
        </div>
      </div>
    );
  }

  return null;
}
