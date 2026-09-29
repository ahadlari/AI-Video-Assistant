"use client";

export default function Sidebar({
  source,
  setSource,
  language,
  setLanguage,
  onAnalyse,
  loading,
  pipelineDone,
  pipelineSteps,
}) {
  const steps = [
    { key: "audio", icon: "\uD83D\uDD0A", label: "Audio Processing" },
    { key: "transcript", icon: "\uD83D\uDCDD", label: "Transcription" },
    { key: "title", icon: "\uD83C\uDFF7\uFE0F", label: "Title Generation" },
    { key: "summary", icon: "\uD83D\uDCCB", label: "Summarisation" },
    { key: "extract", icon: "\uD83D\uDD0D", label: "Extraction" },
    { key: "rag", icon: "\uD83E\uDDE0", label: "RAG Engine" },
  ];

  const getDotClass = (key) => {
    const state = pipelineSteps[key];
    if (state === "active") return "step-dot step-dot-active";
    if (state === "done") return "step-dot step-dot-done";
    return "step-dot";
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <h1>{"\uD83C\uDFAC"} AI Video</h1>
        <span>Meeting Intelligence</span>
      </div>

      <div className="sidebar-divider" />

      {/* Input Section */}
      <div>
        <span className="badge badge-purple">Input</span>
      </div>

      <div className="form-group">
        <label className="form-label">YouTube URL or File Path</label>
        <input
          className="form-input"
          type="text"
          placeholder="https://youtube.com/watch?v=..."
          value={source}
          onChange={(e) => setSource(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Language</label>
        <select
          className="form-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={loading}
        >
          <option value="english">English</option>
          <option value="hinglish">Hinglish</option>
        </select>
      </div>

      <button
        className="btn-primary"
        onClick={onAnalyse}
        disabled={loading || !source.trim()}
      >
        {loading ? (
          <>
            <span className="spinner" /> Processing...
          </>
        ) : (
          <>{"\u26A1"} Analyse</>
        )}
      </button>

      {/* Pipeline Status */}
      {(loading || pipelineDone) && (
        <>
          <div className="sidebar-divider" />
          <div>
            <span className="badge badge-green">Pipeline Status</span>
          </div>
          <div className="pipeline-status">
            {steps.map((step) => (
              <div key={step.key} className="step-bar">
                <div className={getDotClass(step.key)} />
                <span>
                  {step.icon} {step.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
