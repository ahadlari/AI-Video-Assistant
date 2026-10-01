import React, { useRef, useMemo } from "react";

export default function LeftPane({
  inputType,
  setInputType,
  source,
  setSource,
  file,
  setFile,
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
  const fileInputRef = useRef(null);

  // Extract Youtube Video ID for the iframe
  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = inputType === "youtube" ? getYouTubeId(source) : null;

  // Local object URL for file preview
  const filePreviewUrl = useMemo(() => {
    if (inputType === "file" && file) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file, inputType]);

  const isAnalyseDisabled = loading || (inputType === "youtube" ? !source.trim() : !file);
  
  return (
    <div className="left-pane glass-panel">

      <div className="input-section">
        {/* Mode Switcher Tabs (Pill style) */}
        <div className="input-tabs">
          <button
            type="button"
            className={`input-tab ${inputType === "youtube" ? "active" : ""}`}
            onClick={() => setInputType("youtube")}
            disabled={loading}
          >
            {/* SVG Link Icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            YouTube Link
          </button>
          <button
            type="button"
            className={`input-tab ${inputType === "file" ? "active" : ""}`}
            onClick={() => setInputType("file")}
            disabled={loading}
          >
            {/* SVG Upload Icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload File
          </button>
        </div>

        {/* Input area */}
        {inputType === "youtube" ? (
          <div className="input-group">
            <input 
              type="text" 
              className="modern-input" 
              placeholder="Paste YouTube Link (e.g. https://youtu.be/...)" 
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={loading}
              suppressHydrationWarning
            />
          </div>
        ) : (
          <div 
            className={`file-dropzone ${file ? "has-file" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                setFile(e.dataTransfer.files[0]);
              }
            }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }}
              accept="video/*,audio/*,.mp4,.mp3,.wav,.m4a,.webm,.mov,.mkv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
              }}
              disabled={loading}
            />
            {file ? (
              <div className="file-info-card">
                <div className="file-icon-badge">
                  {/* SVG File Icon */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                </div>
                <div className="file-meta">
                  <span className="file-title">{file.name}</span>
                  <span className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB • READY</span>
                </div>
                <button 
                  type="button"
                  className="clear-file-btn" 
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  disabled={loading}
                  title="Remove file"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ) : (
              <div className="dropzone-inner">
                <div className="dropzone-icon-box">
                  {/* SVG Upload Cloud */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
                    <polyline points="12 13 12 9 10 11"></polyline>
                    <polyline points="12 13 14 11"></polyline>
                  </svg>
                </div>
                <p className="dropzone-text">Click or drag & drop video or audio</p>
                <span className="dropzone-hint">Supports MP4, MP3, WAV, M4A, MOV</span>
              </div>
            )}
          </div>
        )}

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
            disabled={isAnalyseDisabled}
          >
            {loading ? (
              <>
                <span className="spinner"></span> Processing...
              </>
            ) : (
              <>
                {inputType === "file" ? "Analyze File" : "Analyze Video"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </>
            )}
          </button>

          {hasResult && (
            <button 
              className="modern-button secondary-btn"
              style={{ flex: 1 }}
              onClick={onReset}
            >
              Analyze New
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-alert">
          <div className="error-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
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
        ) : filePreviewUrl ? (
          <div className="metadata-preview glass-panel" style={{ padding: "1rem", alignItems: "center" }}>
            {file && file.type.startsWith("video") ? (
              <video controls src={filePreviewUrl} className="preview-media-player" />
            ) : (
              <div style={{ width: "100%", textAlign: "center", padding: "1.5rem" }}>
                <div className="empty-icon-box" style={{ margin: "0 auto 1rem" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                  </svg>
                </div>
                <p style={{ fontWeight: 600, color: "#fff" }}>{file?.name}</p>
                <audio controls src={filePreviewUrl} style={{ width: "100%", marginTop: "1rem" }} />
              </div>
            )}
          </div>
        ) : metadata ? (
          <div className="metadata-preview glass-panel">
             {metadata.thumbnail && (
               <img src={metadata.thumbnail} alt="Thumbnail" className="meta-thumb" />
             )}
             <div className="meta-info">
               <h3>{metadata.title || "Uploaded Video/Audio"}</h3>
               <p>{metadata.channel || "Direct Upload"}</p>
             </div>
          </div>
        ) : (
          <div className="empty-preview glass-panel">
             <div className="empty-icon-box">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                 <line x1="7" y1="2" x2="7" y2="22"></line>
                 <line x1="17" y1="2" x2="17" y2="22"></line>
                 <line x1="2" y1="12" x2="22" y2="12"></line>
                 <line x1="2" y1="7" x2="7" y2="7"></line>
                 <line x1="2" y1="17" x2="7" y2="17"></line>
                 <line x1="17" y1="17" x2="22" y2="17"></line>
                 <line x1="17" y1="7" x2="22" y2="7"></line>
               </svg>
             </div>
             <p>{inputType === "file" ? "No file selected" : "No video selected"}</p>
          </div>
        )}
      </div>

    </div>
  );
}
