package com.aivideo.backend.controller;

import com.aivideo.backend.repository.JobRepository;
import com.aivideo.backend.repository.SessionHistoryRepository;
import com.aivideo.backend.service.RateLimitService;
import com.aivideo.backend.util.IPUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*") // Update later
public class AuthController {

    @Autowired
    private SessionHistoryRepository historyRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private RateLimitService rateLimitService;

    @PostMapping("/api/auth/claim-session")
    @Transactional
    public ResponseEntity<?> claimSession(@RequestBody Map<String, String> payload, @AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Must be logged in to claim session"));
        }
        
        String key = jwt.getSubject();
        if (!rateLimitService.resolveBucket(key, true).tryConsume(1)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", "Rate limit exceeded"));
        }

        String sessionId = payload.get("session_id");
        if (sessionId == null || sessionId.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "session_id is required"));
        }

        String userId = jwt.getSubject();

        // Atomically update history
        int updatedHistory = historyRepository.claimSession(sessionId, userId);
        
        // Atomically update job (job might still be processing)
        jobRepository.claimJob(sessionId, userId);
        
        if (updatedHistory > 0) {
            return ResponseEntity.ok(Map.of("message", "Session successfully claimed", "session_id", sessionId));
        } else {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Session could not be claimed. It may already be owned by a user or does not exist."));
        }
    }
}
