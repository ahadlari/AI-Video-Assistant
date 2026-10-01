package com.aivideo.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "jobs")
public class Job {

    @Id
    @Column(name = "job_id", nullable = false, unique = true)
    private String jobId;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "user_id", nullable = true)
    private String userId; // Nullable for anonymous sessions if needed


    @Column(name = "status")
    private String status; // queued, processing, done, error

    @Column(name = "step")
    private String step; // downloading, transcribing, summarizing, indexing

    @Column(name = "progress")
    private Integer progress; // 0 to 100

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String error;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStep() { return step; }
    public void setStep(String step) { this.step = step; }
    public Integer getProgress() { return progress; }
    public void setProgress(Integer progress) { this.progress = progress; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
