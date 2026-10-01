import React, { useState, useEffect } from "react";
import ChatPanel from "./ChatPanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function RightPane({ jobStatus, jobStep, jobProgress, result, error, getToken }) {
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
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/translate_overview`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
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
          <div className="empty-hero-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <h2>Ready To <span>Analyze</span></h2>
          <p>
            Paste a YouTube link or upload your media file on the left. The AI pipeline will transcribe, summarize, and index your content for instant Q&A.
          </p>
        </div>
      </div>
    );
  }

  if (jobStatus && jobStatus !== "done" && jobStatus !== "error") {
    // Pipeline Progress Simulator/Visualizer
    const steps = [
      { id: "downloading", num: "01", label: "Understanding your video" },
      { id: "transcribing", num: "02", label: "Generating transcript" },
      { id: "summarizing", num: "03", label: "Creating your summary" },
      { id: "indexing", num: "04", label: "Preparing chat" }
    ];

    return (
      <div className="right-pane progress-pane glass-panel">
        <div className="progress-header-box">
          <span className="progress-tag">PIPELINE EXECUTION</span>
          <h2 className="progress-title">Analyzing your video...</h2>
        </div>

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
                <span className="step-index-badge">{step.num}</span>
                <span className="step-label">{step.label}</span>
                <div className="step-status-icon">
                  {state === "done" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : state === "active" ? (
                    <span className="spinner-small" />
                  ) : (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "inline-block" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${Math.max(jobProgress, 12)}%` }}></div>
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
            Chat & Questions
          </button>
        </div>

        <div className="tab-content scrollable">
          {activeTab === "overview" && (
            <div className="overview-tab">
              
              {/* Header with Title and Translate Dropdown */}
              <div className="overview-header">
                <div>
                  <h2 className="result-title">{overviewData.title}</h2>
                  <span className="type-badge">{overviewData.video_type || "ANALYZED CONTENT"}</span>
                </div>
                
                <div className="translation-controls" style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                  {isTranslating && <span className="spinner-small"></span>}
                  <select 
                    className="modern-select" 
                    value={targetLang}
                    onChange={(e) => handleTranslate(e.target.value)}
                    disabled={isTranslating}
                    style={{ padding: "0.55rem 1rem", fontSize: "0.85rem", width: "130px", borderRadius: "9999px" }}
                    suppressHydrationWarning
                  >
                    <option value="original">Original</option>
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                    <option value="hinglish">Hinglish</option>
                  </select>
                </div>
              </div>
              
              <div className="section-box" style={{ opacity: isTranslating ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <h3>Quick Summary</h3>
                <p>{overviewData.tldr}</p>
              </div>

              <div className="section-box" style={{ opacity: isTranslating ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <h3>Key Takeaways</h3>
                <ul>
                  {overviewData.key_points?.map((kp, idx) => (
                    <li key={idx}>{kp.text}</li>
                  ))}
                </ul>
              </div>

              {overviewData.sections?.length > 0 && (
                <div className="dynamic-sections" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", opacity: isTranslating ? 0.5 : 1 }}>
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
            <ChatPanel sessionId={result.session_id} initialQuestions={result.suggested_questions} getToken={getToken} />
          )}
        </div>
      </div>
    );
  }

  return null;
}
