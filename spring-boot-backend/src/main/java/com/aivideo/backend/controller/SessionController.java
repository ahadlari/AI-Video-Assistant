package com.aivideo.backend.controller;

import com.aivideo.backend.entity.SessionHistory;
import com.aivideo.backend.repository.SessionHistoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@CrossOrigin(origins = "*") // Update this later to frontend URL
public class SessionController {

    @Autowired
    private SessionHistoryRepository historyRepository;

    // 1. Get all history for the user
    @GetMapping("/api/history")
    public ResponseEntity<?> getHistory(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Sign in required to view history"));
        }
        
        String userId = jwt.getSubject();
        List<SessionHistory> history = historyRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(history);
    }

    // 2. Get specific session details
    @GetMapping("/api/session/{sessionId}")
    public ResponseEntity<?> getSessionDetails(@PathVariable String sessionId, @AuthenticationPrincipal Jwt jwt) {
        Optional<SessionHistory> sessionOpt = historyRepository.findById(sessionId);
        
        if (sessionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Session not found"));
        }
        
        SessionHistory session = sessionOpt.get();
        
        // Ownership check
        if (session.getUserId() != null) {
            if (jwt == null || !session.getUserId().equals(jwt.getSubject())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Session not found"));
            }
        }
        
        return ResponseEntity.ok(session);
    }
}
