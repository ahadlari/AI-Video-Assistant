package com.aivideo.backend.util;

import jakarta.servlet.http.HttpServletRequest;

public class IPUtils {

    /**
     * Extracts the client IP from trusted proxy headers (e.g., in Render/AWS).
     * Falls back to remote address if no header is present.
     */
    public static String getClientIp(HttpServletRequest request) {
        // In production (Render/AWS), the Load Balancer explicitly sets this.
        // We only trust the first IP in the list (the original client).
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }
}
