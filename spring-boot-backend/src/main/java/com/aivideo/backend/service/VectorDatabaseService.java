package com.aivideo.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class VectorDatabaseService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public void createTableIfNotExists() {
        // Ensure pgvector extension and table exist
        jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS video_chunks (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                chunk_index INTEGER,
                chunk_text TEXT,
                embedding vector(1024)
            )
        """);
    }

    public void saveVectors(String sessionId, List<Map<String, Object>> vectorChunks) {
        if (vectorChunks == null || vectorChunks.isEmpty()) {
            return;
        }

        String sql = "INSERT INTO video_chunks (session_id, chunk_index, chunk_text, embedding) VALUES (?, ?, ?, ?::vector)";

        for (Map<String, Object> chunk : vectorChunks) {
            Integer index = (Integer) chunk.get("chunk_index");
            String text = (String) chunk.get("chunk_text");
            List<Double> embeddingList = (List<Double>) chunk.get("embedding");
            
            // Convert List<Double> to string format "[0.1, 0.2, ...]" for pgvector
            String embeddingStr = embeddingList.toString();

            jdbcTemplate.update(sql, sessionId, index, text, embeddingStr);
        }
        System.out.println("Saved " + vectorChunks.size() + " vector chunks for session: " + sessionId);
    }

    public void deleteVectorsBySession(String sessionId) {
        String sql = "DELETE FROM video_chunks WHERE session_id = ?";
        int deleted = jdbcTemplate.update(sql, sessionId);
        System.out.println("Deleted " + deleted + " vector chunks for session: " + sessionId);
    }
}
