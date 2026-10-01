package com.aivideo.backend.repository;

import com.aivideo.backend.entity.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface JobRepository extends JpaRepository<Job, String> {
    
    List<Job> findByStatusAndUpdatedAtBefore(String status, LocalDateTime time);

    @Modifying
    @Query("UPDATE Job j SET j.userId = :userId WHERE j.sessionId = :sessionId AND j.userId IS NULL")
    int claimJob(@Param("sessionId") String sessionId, @Param("userId") String userId);
}
