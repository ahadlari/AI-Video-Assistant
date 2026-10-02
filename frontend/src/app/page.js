"use client";

import { useState, useEffect } from "react";
import { SignInButton, SignUpButton, useAuth, UserButton } from "@clerk/nextjs";
import LeftPane from "@/components/LeftPane";
import RightPane from "@/components/RightPane";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function Home() {
  const { getToken, isLoaded, userId } = useAuth();
  
  const [inputType, setInputType] = useState("youtube"); // "youtube" | "file"
  const [source, setSource] = useState("");
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState("english");
  const [loading, setLoading] = useState(false);
  
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // queued, processing, done, error
  const [jobStep, setJobStep] = useState(null);
  const [jobProgress, setJobProgress] = useState(0);

  const [metadata, setMetadata] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [showGuestBanner, setShowGuestBanner] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Helper to safely get headers based on auth state
  const getAuthHeaders = async () => {
    if (!isLoaded) throw new Error("Auth is not loaded yet.");
    if (!userId) return {}; // Anonymous request

    const token = await getToken();
    if (!token) {
      throw new Error("Authentication failed. Please sign in again.");
    }
    return { Authorization: `Bearer ${token}` };
  };

  // Check for unclaimed anonymous session when user logs in
  useEffect(() => {
    const claimSession = async () => {
      if (isLoaded && userId) {
        const anonSessionId = sessionStorage.getItem("anon_session_id");
        if (anonSessionId) {
          try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/auth/claim-session`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({ session_id: anonSessionId })
            });
            
            if (res.ok) {
              console.log("Session claimed successfully!");
            }
          } catch (e) {
            console.error("Failed to claim session", e);
          } finally {
            // Clear it so we don't try again
            sessionStorage.removeItem("anon_session_id");
          }
        }
      }
    };
    claimSession();
  }, [isLoaded, userId, getToken]);

  // Poll for status when jobId is present
  useEffect(() => {
    let interval;
    if (jobId && jobStatus !== "done" && jobStatus !== "error") {
      interval = setInterval(async () => {
        try {
          const authHeaders = await getAuthHeaders();
          const res = await fetch(`${API_URL}/api/status/${jobId}`, {
            headers: authHeaders
          });
          
          if (!res.ok) {
            if (res.status === 404 || res.status === 401) {
                clearInterval(interval);
                throw new Error("Session not found or access denied.");
            }
            throw new Error(`Server error: ${res.status}`);
          }
          const data = await res.json();
          setJobStatus(data.status);
          setJobStep(data.step);
          setJobProgress(data.progress || 0);

          if (data.status === "done") {
            setResult(data.result);
          } else if (data.status === "error") {
            setError(data.error || "An unknown error occurred during processing.");
          }
        } catch (err) {
          setError(`Failed to fetch status: ${err.message}`);
          setJobStatus("error");
          clearInterval(interval);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [jobId, jobStatus, isLoaded, userId, getToken]);

  const fetchMetadata = async (url) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/metadata`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({ source: url })
      });
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
      }
    } catch (e) {
      console.error("Failed to fetch metadata", e);
    }
  };

  const fetchHistory = async () => {
    if (!userId) return;
    setLoadingHistory(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/history`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadHistorySession = (session) => {
    try {
      let analysis = JSON.parse(session.summaryJson);
      analysis.session_id = session.sessionId;
      if (!analysis.title && session.title) {
        analysis.title = session.title;
      }
      setResult(analysis);
      setJobStatus("done");
      setJobId(session.sessionId);
      setShowHistory(false);
    } catch (e) {
      console.error("Failed to load history session", e);
    }
  };

  const handleAnalyse = async () => {
    if (inputType === "youtube" && !source.trim()) return;
    if (inputType === "file" && !file) return;
    if (loading) return;
    if (!isLoaded) return; // Wait for auth state to be ready

    setLoading(true);
    setError(null);
    setResult(null);
    setJobId(null);
    setJobStatus(null);

    if (inputType === "youtube") {
      setMetadata(null);
      await fetchMetadata(source.trim());
    } else {
      setMetadata({
        title: file.name,
        channel: `${(file.size / (1024 * 1024)).toFixed(1)} MB • Direct Upload`,
        thumbnail: null
      });
    }

    try {
      let res;
      const authHeaders = await getAuthHeaders();
      
      if (inputType === "file") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("audio_language", language);
        formData.append("summary_language", "english");

        res = await fetch(`${API_URL}/api/analyse`, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });
      } else {
        res = await fetch(`${API_URL}/api/analyse`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({ 
            source: source.trim(), 
            audio_language: language,
            summary_language: "english"
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        } else if (res.status === 403 || res.status === 404) {
          throw new Error("Access forbidden or session not found.");
        }
        throw new Error(errData.detail || errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.job_id) {
        setJobId(data.job_id);
        setJobStatus("queued");
        
        // If anonymous, store session id to allow claiming later
        if (!userId) {
            sessionStorage.setItem("anon_session_id", data.session_id);
        }
      }
    } catch (err) {
      setError(err.message);
      setJobStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    handleAnalyse();
  };

  const handleReset = () => {
    setSource("");
    setFile(null);
    setLanguage("english");
    setLoading(false);
    setJobId(null);
    setJobStatus(null);
    setJobStep(null);
    setJobProgress(0);
    setMetadata(null);
    setResult(null);
    setError(null);
  };

  if (!isLoaded) {
    return <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><span className="spinner"></span></div>;
  }

  return (
    <div className="app-layout-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '1.5rem', paddingTop: !userId ? '80px' : '1.5rem', overflow: 'hidden', gap: '20px' }}>
      
      {/* Anonymous Mode Banner */}
      {!userId && showGuestBanner && (
        <div style={{
          position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', 
          background: 'rgba(242, 184, 36, 0.1)', 
          border: '1px solid rgba(242, 184, 36, 0.3)',
          color: '#f2b824', padding: '12px 24px', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '24px', zIndex: 1000, fontWeight: '400', fontSize: '0.9rem',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
          width: 'max-content',
          maxWidth: '90%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>You're in <strong>Guest Mode</strong>. Your session won't be saved permanently. Sign in to keep your conversations.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SignInButton mode="modal">
              <button style={{ 
                background: '#f2b824', color: '#0d071b', border: 'none', 
                padding: '8px 18px', borderRadius: '8px', cursor: 'pointer',
                fontWeight: '600', fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(242, 184, 36, 0.2)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                Sign In to Save
              </button>
            </SignInButton>
            <button 
              onClick={() => setShowGuestBanner(false)} 
              style={{ background: 'transparent', border: 'none', color: '#f2b824', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}>
              ×
            </button>
          </div>
        </div>
      )}

      {showHistory && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: '#0d071b', border: '1px solid rgba(242, 184, 36, 0.2)',
            borderRadius: '12px', width: '500px', maxWidth: '90%', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: '#f2b824' }}>My History</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '20px' }}><span className="spinner"></span></div>
              ) : historyList.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9b90af' }}>No saved sessions found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {historyList.map(session => (
                    <div key={session.sessionId} onClick={() => loadHistorySession(session)} style={{
                      padding: '12px', background: 'rgba(25, 17, 44, 0.5)', borderRadius: '8px',
                      cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex', gap: '12px', alignItems: 'center'
                    }}>
                      {session.thumbnailUrl ? (
                        <img src={session.thumbnailUrl} style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} alt="" />
                      ) : (
                        <div style={{ width: '60px', height: '40px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}></div>
                      )}
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500', fontSize: '0.9rem', color: '#fff' }}>
                          {session.title || "Unknown Video"}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9b90af' }}>
                          {new Date(session.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* GLOBAL NAVBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
        <div className="brand-header" style={{ margin: 0, padding: 0 }}>
          <h1 className="brand-title" style={{ fontSize: '2.5rem', margin: 0 }}>AI Video <span>Assistant</span></h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {userId ? (
            <>
              <button 
                className="premium-btn"
                onClick={() => { setShowHistory(true); fetchHistory(); }}
                style={{
                  background: 'rgba(25, 17, 44, 0.6)', border: '1px solid rgba(242, 184, 36, 0.3)',
                  color: '#f2b824', padding: '8px 18px', borderRadius: '999px', cursor: 'pointer',
                  fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'all 0.2s ease', backdropFilter: 'blur(10px)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(242, 184, 36, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(25, 17, 44, 0.6)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                </svg>
                My History
              </button>
              <div style={{ 
                background: 'rgba(25, 17, 44, 0.6)', padding: '4px', borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.1)', display: 'flex',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)'
              }}>
                <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: { width: '32px', height: '32px' } } }} />
              </div>
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <button 
                  className="premium-btn"
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#f2b824', padding: '8px 12px', cursor: 'pointer',
                    fontWeight: '600', fontSize: '0.85rem', transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#ffca43'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#f2b824'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button 
                  className="premium-btn"
                  style={{
                    background: 'rgba(25, 17, 44, 0.6)', border: '1px solid rgba(242, 184, 36, 0.3)',
                    color: '#f2b824', padding: '8px 18px', borderRadius: '999px', cursor: 'pointer',
                    fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'all 0.2s ease', backdropFilter: 'blur(10px)'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(242, 184, 36, 0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(25, 17, 44, 0.6)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  Sign Up
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </div>

      <div className="app-panes-wrapper" style={{ display: 'flex', gap: '1.5rem', flex: 1, height: 'auto', minHeight: 0 }}>
        <div className="pane left-pane-container">
          <LeftPane
            inputType={inputType}
            setInputType={setInputType}
            source={source}
            setSource={setSource}
            file={file}
            setFile={setFile}
            language={language}
            setLanguage={setLanguage}
            onAnalyse={handleAnalyse}
            loading={loading || (jobId && jobStatus !== "done" && jobStatus !== "error")}
            metadata={metadata}
            error={error}
            onRetry={handleRetry}
            onReset={handleReset}
            hasResult={!!result}
          />
        </div>
        <div className="pane right-pane-container">
          <RightPane
            jobStatus={jobStatus}
            jobStep={jobStep}
            jobProgress={jobProgress}
            result={result}
            error={error}
            getToken={getToken}
            userId={userId}
          />
        </div>
      </div>
    </div>
  );
}
