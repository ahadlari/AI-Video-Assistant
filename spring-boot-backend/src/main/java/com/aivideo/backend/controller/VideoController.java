package com.aivideo.backend.controller;

import com.aivideo.backend.entity.Job;
import com.aivideo.backend.repository.JobRepository;
import com.aivideo.backend.service.AIWorkerRoutingService;
import com.aivideo.backend.service.RateLimitService;
import com.aivideo.backend.util.IPUtils;
import io.github.bucket4j.Bucket;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@CrossOrigin(origins = "*") // Update this later to specific frontend URL
public class VideoController {

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private AIWorkerRoutingService routingService;
    
    @Autowired
    private RateLimitService rateLimitService;

    @Value("${INTERNAL_API_KEY:your_dev_secret_key_123}")
    private String internalApiKey;
    
    @Value("${app.limits.global.concurrent-jobs:50}")
    private int globalConcurrentJobsCap;

    private final RestTemplate restTemplate = new RestTemplate();
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    // Check rate limit and consume token
    private boolean checkRateLimit(Jwt jwt, HttpServletRequest request) {
        String key = jwt != null ? jwt.getSubject() : IPUtils.getClientIp(request);
        Bucket bucket = rateLimitService.resolveBucket(key, jwt != null);
        return bucket.tryConsume(1);
    }

    // 1. Analyse Endpoint - Accepts JSON (for YouTube URLs)
    @PostMapping(value = "/api/analyse", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> startAnalysisJson(
            @RequestBody Map<String, Object> body, 
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request) {
        
        if (!checkRateLimit(jwt, request)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", "Rate limit exceeded."));
        }
            
        String source = (String) body.get("source");
        String audioLanguage = body.get("audio_language") != null ? (String) body.get("audio_language") : "auto";
        String summaryLanguage = body.get("summary_language") != null ? (String) body.get("summary_language") : "english";
        return processAnalysis(source, audioLanguage, summaryLanguage, null, jwt);
    }

    // 1b. Analyse Endpoint - Accepts Multipart Form (for File Uploads)
    @PostMapping(value = "/api/analyse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> startAnalysisMultipart(
            @RequestParam(value = "source", required = false) String source,
            @RequestParam(value = "audio_language", required = false, defaultValue = "auto") String audioLanguage,
            @RequestParam(value = "summary_language", required = false, defaultValue = "english") String summaryLanguage,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest request) {
            
        if (!checkRateLimit(jwt, request)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", "Rate limit exceeded."));
        }
        
        return processAnalysis(source, audioLanguage, summaryLanguage, file, jwt);
    }

    private ResponseEntity<?> processAnalysis(String source, String audioLanguage, String summaryLanguage, MultipartFile file, Jwt jwt) {
        try {
            // Concurrent jobs cap
            long activeJobs = jobRepository.findAll().stream().filter(j -> "processing".equalsIgnoreCase(j.getStatus())).count();
            if (activeJobs >= globalConcurrentJobsCap) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "System is at maximum capacity. Please try again later."));
            }

            boolean isFileUpload = (file != null && !file.isEmpty());
            String userId = jwt != null ? jwt.getSubject() : null; // Strictly NULL for anonymous
            
            // 1. Determine Worker URL
            String targetWorkerUrl = routingService.getTargetWorkerUrl(source, isFileUpload);
            
            // 2. Create Job in DB
            String jobId = "job_" + UUID.randomUUID().toString();
            String sessionId = "sess_" + UUID.randomUUID().toString();

            Job job = new Job();
            job.setJobId(jobId);
            job.setSessionId(sessionId);
            job.setUserId(userId);
            job.setStatus("queued");
            job.setProgress(0);
            jobRepository.save(job);

            // 3. Forward request to AI Worker asynchronously
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.set("X-Internal-Key", internalApiKey);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("job_id", jobId);
            body.add("session_id", sessionId);
            body.add("audio_language", audioLanguage != null ? audioLanguage : "auto");
            body.add("summary_language", summaryLanguage != null ? summaryLanguage : "english");
            if (source != null && !source.isEmpty()) {
                body.add("source", source);
            }
            if (isFileUpload) {
                body.add("file", file.getResource());
            }

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            
            new Thread(() -> {
                try {
                    restTemplate.postForEntity(targetWorkerUrl, requestEntity, String.class);
                } catch (Exception e) {
                    System.err.println("Failed to forward request to worker: " + e.getMessage());
                }
            }).start();

            return ResponseEntity.accepted().body(Map.of(
                    "job_id", jobId,
                    "session_id", sessionId,
                    "status", "queued"
            ));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // Strict ownership check (returns 404 uniformly for invalid user or missing token)
    private boolean isOwner(String entityUserId, Jwt jwt) {
        if (entityUserId == null) return true; // Anonymous session (owned by whoever knows the UUID)
        if (jwt == null) return false; // Protected session but no token
        return entityUserId.equals(jwt.getSubject());
    }

    // 2. Status Polling Endpoint (Frontend calls this)
    @GetMapping("/api/status/{jobId}")
    public ResponseEntity<?> getJobStatus(@PathVariable String jobId, @AuthenticationPrincipal Jwt jwt) {
        Optional<Job> jobOpt = jobRepository.findById(jobId);
        
        if (jobOpt.isEmpty() || !isOwner(jobOpt.get().getUserId(), jwt)) {
            // Uniform 404 to prevent enumeration
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Job not found"));
        }
        
        Job job = jobOpt.get();
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("job_id", job.getJobId());
        response.put("session_id", job.getSessionId());
        response.put("status", job.getStatus());
        response.put("step", job.getStep() != null ? job.getStep() : "");
        response.put("progress", job.getProgress() != null ? job.getProgress() : 0);
        response.put("error", job.getError() != null ? job.getError() : "");

        if ("done".equalsIgnoreCase(job.getStatus())) {
            Optional<com.aivideo.backend.entity.SessionHistory> historyOpt = historyRepository.findById(job.getSessionId());
            if (historyOpt.isPresent()) {
                com.aivideo.backend.entity.SessionHistory history = historyOpt.get();
                try {
                    Map<String, Object> analysis = objectMapper.readValue(history.getSummaryJson(), Map.class);
                    analysis.put("session_id", history.getSessionId());
                    if (!analysis.containsKey("title") && history.getTitle() != null) {
                        analysis.put("title", history.getTitle());
                    }
                    response.put("result", analysis);
                } catch (Exception e) {
                    Map<String, Object> fallback = new java.util.HashMap<>();
                    fallback.put("session_id", history.getSessionId());
                    fallback.put("title", history.getTitle());
                    fallback.put("tldr", "Summary is ready.");
                    response.put("result", fallback);
                }
            }
        }

        return ResponseEntity.ok(response);
    }

    // 3. YouTube/Media Metadata Preview Endpoint
    @PostMapping("/api/metadata")
    public ResponseEntity<?> getMetadata(@RequestBody Map<String, Object> req, @AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        if (!checkRateLimit(jwt, request)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", "Rate limit exceeded."));
        }

        String source = (String) req.get("source");
        if (source == null || !source.startsWith("http")) {
            return ResponseEntity.ok(Map.of(
                "title", "Uploaded Video/Audio",
                "channel", "Direct Upload",
                "thumbnail", ""
            ));
        }

        try {
            String oembedUrl = "https://www.youtube.com/oembed?url=" + java.net.URLEncoder.encode(source, java.nio.charset.StandardCharsets.UTF_8) + "&format=json";
            ResponseEntity<Map> oembedRes = restTemplate.getForEntity(oembedUrl, Map.class);
            if (oembedRes.getStatusCode().is2xxSuccessful() && oembedRes.getBody() != null) {
                Map body = oembedRes.getBody();
                return ResponseEntity.ok(Map.of(
                    "title", body.getOrDefault("title", "YouTube Video"),
                    "channel", body.getOrDefault("author_name", "YouTube Channel"),
                    "thumbnail", body.getOrDefault("thumbnail_url", "")
                ));
            }
        } catch (Exception e) {
            // fallback gracefully
        }
        return ResponseEntity.ok(Map.of(
            "title", "YouTube Video",
            "channel", "YouTube",
            "thumbnail", ""
        ));
    }

    // 4. Translate Overview Endpoint
    @PostMapping("/api/translate_overview")
    public ResponseEntity<?> translateOverview(@RequestBody Map<String, Object> req, @AuthenticationPrincipal Jwt jwt, HttpServletRequest request) {
        if (!checkRateLimit(jwt, request)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", "Rate limit exceeded."));
        }

        String sessionId = (String) req.get("session_id");
        if (sessionId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "session_id is required"));
        }
        
        Optional<com.aivideo.backend.entity.SessionHistory> historyOpt = historyRepository.findById(sessionId);
        
        if (historyOpt.isEmpty() || !isOwner(historyOpt.get().getUserId(), jwt)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Session not found"));
        }
        
        try {
            Map<String, Object> analysis = objectMapper.readValue(historyOpt.get().getSummaryJson(), Map.class);
            analysis.put("session_id", sessionId);
            return ResponseEntity.ok(analysis);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to parse summary"));
        }
    }

    @Autowired
    private com.aivideo.backend.service.VectorDatabaseService vectorDatabaseService;

    @Autowired
    private com.aivideo.backend.repository.SessionHistoryRepository historyRepository;

    // 5. Internal Callback (AI Worker calls this)
    @PostMapping("/internal/callback/{jobId}")
    public ResponseEntity<?> workerCallback(
            @PathVariable String jobId,
            @RequestHeader("X-Internal-Key") String authKey,
            @RequestBody Map<String, Object> payload) {
        
        if (!internalApiKey.equals(authKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Invalid Internal Key");
        }

        Optional<Job> jobOpt = jobRepository.findById(jobId);
        if (jobOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Job not found");
        }

        Job job = jobOpt.get();
        String status = (String) payload.get("status"); 
        String step = (String) payload.get("step");
        Integer progress = payload.get("progress") != null ? (Integer) payload.get("progress") : job.getProgress();

        job.setStatus(status);
        job.setStep(step);
        job.setProgress(progress);

        if ("error".equals(status)) {
            job.setError((String) payload.get("error"));
        } 
        else if ("done".equals(status)) {
            Map<String, Object> result = (Map<String, Object>) payload.get("result");
            
            // 1. Save Vectors
            List<Map<String, Object>> vectorChunks = (List<Map<String, Object>>) result.get("vector_chunks");
            vectorDatabaseService.createTableIfNotExists();
            vectorDatabaseService.saveVectors(job.getSessionId(), vectorChunks);
            
            // 2. Save Summary JSON to history table
            try {
                Map<String, Object> metadata = (Map<String, Object>) result.get("metadata");
                Map<String, Object> analysis = (Map<String, Object>) result.get("analysis");
                
                com.aivideo.backend.entity.SessionHistory history = new com.aivideo.backend.entity.SessionHistory();
                history.setSessionId(job.getSessionId());
                history.setTitle((String) metadata.get("title"));
                history.setSource(metadata.get("channel") != null ? (String) metadata.get("channel") : "File Upload");
                history.setThumbnailUrl((String) metadata.get("thumbnail"));
                history.setSummaryJson(objectMapper.writeValueAsString(analysis));
                
                // Keep the exact same userId (null for anonymous)
                history.setUserId(job.getUserId()); 
                
                historyRepository.save(history);
            } catch (Exception e) {
                job.setError("Failed to save history: " + e.getMessage());
                job.setStatus("error");
            }
        }

        jobRepository.save(job);
        return ResponseEntity.ok("Callback received successfully");
    }
}
