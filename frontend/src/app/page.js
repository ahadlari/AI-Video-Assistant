"use client";

import { useState, useEffect } from "react";
import LeftPane from "@/components/LeftPane";
import RightPane from "@/components/RightPane";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState("english");
  const [loading, setLoading] = useState(false);
  
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // processing, done, error
  const [jobStep, setJobStep] = useState(null);
  const [jobProgress, setJobProgress] = useState(0);

  const [metadata, setMetadata] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Poll for status when jobId is present
  useEffect(() => {
    let interval;
    if (jobId && jobStatus !== "done" && jobStatus !== "error") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/status/${jobId}`);
          if (!res.ok) {
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
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [jobId, jobStatus]);

  const fetchMetadata = async (url) => {
    try {
      const res = await fetch(`${API_URL}/api/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const handleAnalyse = async () => {
    if (!source.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setJobId(null);
    setJobStatus(null);
    setMetadata(null);

    // Try fetching metadata early for preview
    await fetchMetadata(source.trim());

    try {
      const res = await fetch(`${API_URL}/api/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          source: source.trim(), 
          audio_language: language,
          summary_language: "english"
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        // Specific handling for 429 and 403 as requested
        if (res.status === 429) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        } else if (res.status === 403) {
          throw new Error("Access forbidden or video download failed. Please try a different video or try again.");
        }
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.job_id) {
        setJobId(data.job_id);
        setJobStatus("queued");
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

  return (
    <div className="app-container">
      <div className="pane left-pane-container">
        <LeftPane
          source={source}
          setSource={setSource}
          language={language}
          setLanguage={setLanguage}
          onAnalyse={handleAnalyse}
          loading={loading || (jobId && jobStatus !== "done" && jobStatus !== "error")}
          metadata={metadata}
          error={error}
          onRetry={handleRetry}
        />
      </div>
      <div className="pane right-pane-container">
        <RightPane
          jobStatus={jobStatus}
          jobStep={jobStep}
          jobProgress={jobProgress}
          result={result}
          error={error}
        />
      </div>
    </div>
  );
}
