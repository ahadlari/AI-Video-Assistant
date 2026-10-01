package com.aivideo.backend.repository;

import com.aivideo.backend.entity.SessionHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionHistoryRepository extends JpaRepository<SessionHistory, String> {
    
    List<SessionHistory> findByUserIdOrderByCreatedAtDesc(String userId);

    @Modifying
    @Query("UPDATE SessionHistory s SET s.userId = :userId WHERE s.sessionId = :sessionId AND s.userId IS NULL")
    int claimSession(@Param("sessionId") String sessionId, @Param("userId") String userId);
}
