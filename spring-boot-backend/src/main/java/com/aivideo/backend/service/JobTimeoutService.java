package com.aivideo.backend.service;

import com.aivideo.backend.entity.Job;
import com.aivideo.backend.repository.JobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class JobTimeoutService {

    @Autowired
    private JobRepository jobRepository;

    // Runs every 1 minute
    @Scheduled(fixedRate = 60000)
    public void markStuckJobsAsError() {
        LocalDateTime tenMinutesAgo = LocalDateTime.now().minusMinutes(10);
        
        List<Job> stuckJobs = jobRepository.findByStatusAndUpdatedAtBefore("processing", tenMinutesAgo);
        
        for (Job job : stuckJobs) {
            job.setStatus("error");
            job.setStep(null);
            job.setError("Process incomplete: AI worker went offline or job timed out. Please retry.");
            jobRepository.save(job);
            System.out.println("Marked job " + job.getJobId() + " as error due to timeout.");
        }
    }
}
