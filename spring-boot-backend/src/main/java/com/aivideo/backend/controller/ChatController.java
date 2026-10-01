package com.aivideo.backend.controller;

import com.aivideo.backend.entity.SessionHistory;
import com.aivideo.backend.repository.SessionHistoryRepository;
import com.aivideo.backend.service.AIWorkerRoutingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

import com.aivideo.backend.util.IPUtils;
import com.aivideo.backend.service.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@CrossOrigin(origins = "*") // Adjust later for security
public class ChatController {

    @Autowired
    private AIWorkerRoutingService routingService;

    @Autowired
    private SessionHistoryRepository sessionHistoryRepository;
    
    @Autowired
    private RateLimitService rateLimitService;

    @Value("${INTERNAL_API_KEY:your_dev_secret_key_123}")
    private String internalApiKey;

    @Value("${app.limits.chat.max-length:500}")
    private int maxChatLength;

    private final RestTemplate restTemplate = new RestTemplate();

    private boolean isOwner(String entityUserId, Jwt jwt) {
        if (entityUserId == null) return true; 
        if (jwt == null) return false; 
        return entityUserId.equals(jwt.getSubject());
    }

    @PostMapping("/api/chat")
    public ResponseEntity<?> handleChat(@RequestBody Map<String, Object> chatRequest, @AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        try {
            // Check Rate Limit
            String key = jwt != null ? jwt.getSubject() : IPUtils.getClientIp(request);
            if (!rateLimitService.resolveBucket(key, jwt != null).tryConsume(1)) {
                return ResponseEntity.status(429).body(Map.of("error", "Rate limit exceeded."));
            }

            String sessionId = (String) chatRequest.get("session_id");
            if (sessionId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "session_id is required"));
            }
            
            // Check Character Limit
            String question = (String) chatRequest.get("question");
            if (question != null && question.length() > maxChatLength) {
                return ResponseEntity.badRequest().body(Map.of("error", "Question exceeds maximum allowed length of " + maxChatLength + " characters."));
            }

            // Verify strict ownership
            Optional<SessionHistory> historyOpt = sessionHistoryRepository.findById(sessionId);
            if (historyOpt.isEmpty() || !isOwner(historyOpt.get().getUserId(), jwt)) {
                return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
            }

            // Chat requests always go to the Cloud Worker
            String chatWorkerUrl = routingService.getChatWorkerUrl();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Internal-Key", internalApiKey);

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(chatRequest, headers);

            // Synchronous forward to Cloud Worker
            ResponseEntity<Map> response = restTemplate.postForEntity(chatWorkerUrl, requestEntity, Map.class);
            
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to communicate with AI Chat Worker: " + e.getMessage()));
        }
    }
}

