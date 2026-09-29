"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import ResultsDashboard from "@/components/ResultsDashboard";
import ChatPanel from "@/components/ChatPanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState("english");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState({});

  const handleAnalyse = async () => {
    if (!source.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSessionId(null);
    setPipelineDone(false);

    // Simulate pipeline progress on the frontend
    const steps = ["audio", "transcript", "title", "summary", "extract", "rag"];
    const stepDurations = [2000, 8000, 4000, 6000, 8000, 3000];

    let currentStepIndex = 0;
    const newSteps = {};

    const progressInterval = setInterval(() => {
      if (currentStepIndex < steps.length) {
        // Mark previous step as done
        if (currentStepIndex > 0) {
          newSteps[steps[currentStepIndex - 1]] = "done";
        }
        // Mark current step as active
        newSteps[steps[currentStepIndex]] = "active";
        setPipelineSteps({ ...newSteps });
        currentStepIndex++;
      }
    }, 3000);

    try {
      const res = await fetch(`${API_URL}/api/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: source.trim(), language }),
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();

      // Mark all steps as done
      const doneSteps = {};
      steps.forEach((s) => (doneSteps[s] = "done"));
      setPipelineSteps(doneSteps);

      setResult(data);
      setSessionId(data.session_id);
      setPipelineDone(true);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message);
      setPipelineSteps({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        source={source}
        setSource={setSource}
        language={language}
        setLanguage={setLanguage}
        onAnalyse={handleAnalyse}
        loading={loading}
        pipelineDone={pipelineDone}
        pipelineSteps={pipelineSteps}
      />

      <main className="main-content">
        {/* Hero */}
        <div className="hero">
          <h1 className="hero-title">AI Video Assistant</h1>
          <p className="hero-sub">
            Transcribe &middot; Summarise &middot; Chat with your meetings
          </p>
          <div className="hero-divider" />
        </div>

        {/* Error */}
        {error && (
          <div className="error-banner">
            {"\u274C"} Error: {error}
          </div>
        )}

        {/* Results */}
        {result ? (
          <>
            <ResultsDashboard result={result} />
            <div className="section-divider" />
            <ChatPanel sessionId={sessionId} />
          </>
        ) : (
          /* Empty State */
          <div className="empty-state">
            <div className="empty-state-icon">{"\uD83C\uDFAC"}</div>
            <div className="empty-state-title">Ready to Analyse</div>
            <div className="empty-state-desc">
              Paste a YouTube URL or local file path in the sidebar, choose your
              language, and hit <strong>Analyse</strong> to get started.
            </div>
            <div className="empty-state-badges">
              <span className="badge badge-purple">Transcription</span>
              <span className="badge badge-cyan">Summarisation</span>
              <span className="badge badge-green">RAG Chat</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
