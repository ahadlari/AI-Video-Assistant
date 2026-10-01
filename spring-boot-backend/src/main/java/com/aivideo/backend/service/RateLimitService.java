package com.aivideo.backend.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class RateLimitService {

    @Value("${app.limits.anonymous.requests-per-hour:10}")
    private int anonymousLimit;

    @Value("${app.limits.loggedin.requests-per-hour:50}")
    private int loggedInLimit;

    // Cache with eviction to prevent memory leaks
    private final Cache<String, Bucket> bucketCache = Caffeine.newBuilder()
            .maximumSize(10000)
            .expireAfterAccess(Duration.ofHours(1))
            .build();

    public Bucket resolveBucket(String key, boolean isLoggedIn) {
        return bucketCache.get(key, k -> createNewBucket(isLoggedIn));
    }

    private Bucket createNewBucket(boolean isLoggedIn) {
        int limit = isLoggedIn ? loggedInLimit : anonymousLimit;
        Bandwidth limitRule = Bandwidth.classic(limit, Refill.greedy(limit, Duration.ofHours(1)));
        return Bucket.builder().addLimit(limitRule).build();
    }
}
