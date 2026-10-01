package com.aivideo.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "session_history")
public class SessionHistory {

    @Id
    @Column(name = "session_id", nullable = false, unique = true)
    private String sessionId;

    @Column(name = "user_id") // Optional for anonymous users, populated if logged in via Clerk
    private String userId;

    @Column(name = "title")
    private String title;

    @Column(name = "source", length = 1000)
    private String source;

    @Column(name = "thumbnail_url", length = 1000)
    private String thumbnailUrl;

    @Column(name = "summary_json", columnDefinition = "TEXT")
    private String summaryJson;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }
    public String getSummaryJson() { return summaryJson; }
    public void setSummaryJson(String summaryJson) { this.summaryJson = summaryJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
