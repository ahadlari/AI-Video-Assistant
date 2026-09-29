import React, { useState, useEffect } from "react";
import ChatPanel from "./ChatPanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RightPane({ jobStatus, jobStep, jobProgress, result, error }) {
  const [activeTab, setActiveTab] = useState("overview");
  
  // Translation state
  const [overviewData, setOverviewData] = useState(result);
  const [targetLang, setTargetLang] = useState("english");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCache, setTranslationCache] = useState({});

  // Reset local state when result prop changes (new video analyzed)
  useEffect(() => {
    if (result) {
      setOverviewData(result);
      setTranslationCache({ "original": result });
    }
  }, [result]);

  const handleTranslate = async (lang) => {
    if (!result || !result.session_id) return;
    setTargetLang(lang);
    
    // Check local cache
    if (translationCache[lang]) {
      setOverviewData(translationCache[lang]);
      return;
    }

    setIsTranslating(true);
    try {
      const res = await fetch(`${API_URL}/api/translate_overview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: result.session_id,
          target_language: lang
        }),
      });

      if (!res.ok) throw new Error("Translation failed");

      const translatedData = await res.json();
      
      // Update data and cache
      setOverviewData({ ...result, ...translatedData });
      setTranslationCache(prev => ({ ...prev, [lang]: translatedData }));
    } catch (err) {
      console.error(err);
      // Fallback to original
      setTargetLang("original");
      setOverviewData(result);
      alert("Failed to translate overview. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

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
      { id: "downloading", label: "Understanding your video" },
      { id: "transcribing", label: "Generating transcript" },
      { id: "summarizing", label: "Creating your summary" },
      { id: "indexing", label: "Preparing chat" }
    ];

    return (
      <div className="right-pane progress-pane glass-panel">
        <h2 className="progress-title">Analyzing your video...</h2>
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

  if (result && overviewData) {
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
            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
        </div>

        <div className="tab-content scrollable">
          {activeTab === "overview" && (
            <div className="overview-tab">
              
              {/* Header with Title and Translate Dropdown */}
              <div className="overview-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div>
                  <h2 className="result-title">{overviewData.title}</h2>
                  <div className="badge type-badge">{overviewData.video_type}</div>
                </div>
                
                <div className="translation-controls" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {isTranslating && <span className="spinner-small" style={{ borderColor: "rgba(255,255,255,0.5)", borderTopColor: "white" }}></span>}
                  <select 
                    className="modern-select" 
                    value={targetLang}
                    onChange={(e) => handleTranslate(e.target.value)}
                    disabled={isTranslating}
                    style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", width: "120px" }}
                    suppressHydrationWarning
                  >
                    <option value="original">Original</option>
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                    <option value="hinglish">Hinglish</option>
                  </select>
                </div>
              </div>
              
              <div className="tldr-section section-box" style={{ opacity: isTranslating ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <h3>Quick Summary</h3>
                <p>{overviewData.tldr}</p>
              </div>

              <div className="keypoints-section section-box" style={{ opacity: isTranslating ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <h3>Key Points</h3>
                <ul>
                  {overviewData.key_points?.map((kp, idx) => (
                    <li key={idx}>{kp.text}</li>
                  ))}
                </ul>
              </div>

              {overviewData.sections?.length > 0 && (
                <div className="dynamic-sections" style={{ opacity: isTranslating ? 0.5 : 1, transition: "opacity 0.2s" }}>
                  {overviewData.sections.map((sec, idx) => (
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

          {activeTab === "chat" && (
            <ChatPanel sessionId={result.session_id} initialQuestions={result.suggested_questions} />
          )}
        </div>
      </div>
    );
  }

  return null;
}
