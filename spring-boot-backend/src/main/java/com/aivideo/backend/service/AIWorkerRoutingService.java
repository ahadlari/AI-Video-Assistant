package com.aivideo.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class AIWorkerRoutingService {

    @Value("${WORKER_LOCAL_URL:http://localhost:8000}")
    private String localWorkerUrl;

    @Value("${WORKER_CLOUD_URL:https://ai-video-assistant-39ar.onrender.com}")
    private String cloudWorkerUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public boolean isLocalWorkerHealthy() {
        try {
            // Using /health which is public on the worker
            ResponseEntity<String> response = restTemplate.getForEntity(localWorkerUrl + "/health", String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }

    public String getTargetWorkerUrl(String source, boolean isFileUpload) {
        if (source != null && !source.isEmpty()) {
            if (isLocalWorkerHealthy()) {
                return localWorkerUrl + "/internal/process-video";
            } else {
                throw new IllegalStateException("YouTube link service abhi offline hai, kripya file upload karein.");
            }
        } else if (isFileUpload) {
            return cloudWorkerUrl + "/internal/process-video";
        }
        throw new IllegalArgumentException("Invalid request: Provide either a YouTube link or a file upload.");
    }
    
    public String getChatWorkerUrl() {
        return cloudWorkerUrl + "/internal/chat";
    }
}
