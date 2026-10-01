package com.aivideo.backend.service;

import com.aivideo.backend.entity.Job;
import com.aivideo.backend.entity.SessionHistory;
import com.aivideo.backend.repository.JobRepository;
import com.aivideo.backend.repository.SessionHistoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class CleanupService {

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private SessionHistoryRepository sessionHistoryRepository;
    
    @Autowired
    private VectorDatabaseService vectorDatabaseService;

    @Value("${app.cleanup.anonymous.retention-hours:24}")
    private int retentionHours;

    @Scheduled(cron = "0 0 * * * *") // Run every hour
    public void cleanupAnonymousData() {
        LocalDateTime threshold = LocalDateTime.now().minusHours(retentionHours);
        
        // Find anonymous jobs older than threshold that are NOT processing
        // Since we don't have a complex query yet, we will fetch all and filter in memory for simplicity/batching
        // In production, write a JPQL query for this.
        
        System.out.println("[Cleanup] Starting anonymous data cleanup...");
        List<Job> allJobs = jobRepository.findAll();
        
        int deletedCount = 0;
        for (Job job : allJobs) {
            if (job.getUserId() == null && job.getCreatedAt().isBefore(threshold)) {
                if (!"processing".equalsIgnoreCase(job.getStatus())) {
                    // Delete vectors
                    try {
                        vectorDatabaseService.deleteVectorsBySession(job.getSessionId());
                    } catch (Exception e) {
                        System.err.println("[Cleanup] Failed to delete vectors for " + maskUuid(job.getSessionId()));
                    }
                    
                    // Delete History
                    sessionHistoryRepository.findById(job.getSessionId()).ifPresent(sessionHistoryRepository::delete);
                    
                    // Delete Job
                    jobRepository.delete(job);
                    
                    deletedCount++;
                    System.out.println("[Cleanup] Deleted anonymous session " + maskUuid(job.getSessionId()));
                }
            }
        }
        System.out.println("[Cleanup] Completed. Deleted " + deletedCount + " expired anonymous sessions.");
    }
    
    private String maskUuid(String uuid) {
        if (uuid == null || uuid.length() < 8) return uuid;
        return uuid.substring(0, 8) + "...";
    }
}
