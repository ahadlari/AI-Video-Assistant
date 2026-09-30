import React from "react";

export default function LeftPane({
  source,
  setSource,
  language,
  setLanguage,
  onAnalyse,
  loading,
  metadata,
  error,
  onRetry,
  onReset,
  hasResult
}) {
  
  // Extract Youtube Video ID for the iframe
  const getYouTubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYouTubeId(source);
  
  return (
    <div className="left-pane glass-panel">
      
      <div className="brand-header">
        <h1 className="brand-title">AI Video <span>Assistant</span></h1>
        <p className="brand-subtitle">POWERED BY SARVAM & MISTRAL</p>
      </div>

      <div className="input-section">
        <div className="input-group">
          <input 
            type="text" 
            className="modern-input" 
            placeholder="Paste YouTube Link..." 
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={loading}
            suppressHydrationWarning
          />
        </div>

        <div className="input-group select-group">
          <select 
            className="modern-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={loading}
            suppressHydrationWarning
          >
            <option value="auto">Auto-Detect Language</option>
            <option value="english">English</option>
            <option value="hinglish">Hinglish</option>
            <option value="hindi">Hindi</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px", width: "100%" }}>
          <button 
            className="modern-button primary-btn" 
            style={{ flex: 1 }}
            onClick={onAnalyse} 
            disabled={loading || !source.trim()}
          >
            {loading ? (
              <span className="btn-content">
                <span className="spinner"></span> Processing...
              </span>
            ) : (
              "Analyze Video"
            )}
          </button>

          {hasResult && (
            <button 
              className="modern-button secondary-btn"
              style={{ 
                flex: 1, 
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}
              onClick={onReset}
            >
              Analyze New Video
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <div className="error-icon">{"\u26A0\uFE0F"}</div>
          <div className="error-content">
            <h4 className="error-title">Analysis Failed</h4>
            <p className="error-desc">{error}</p>
            <button className="retry-btn" onClick={onRetry}>Try Again</button>
          </div>
        </div>
      )}

      {/* Media Player / Preview Area */}
      <div className="media-preview-area">
        {videoId ? (
          <div className="video-wrapper glass-panel">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ) : metadata ? (
          <div className="metadata-preview glass-panel">
             {metadata.thumbnail && (
               <img src={metadata.thumbnail} alt="Thumbnail" className="meta-thumb" />
             )}
             <div className="meta-info">
               <h3 className="meta-title">{metadata.title || "Unknown Video"}</h3>
               <p className="meta-channel">{metadata.channel || "Unknown Channel"}</p>
             </div>
          </div>
        ) : (
          <div className="empty-preview glass-panel">
             <div className="empty-icon">{"\uD83C\uDFAC"}</div>
             <p>No video selected</p>
          </div>
        )}
      </div>

    </div>
  );
}
