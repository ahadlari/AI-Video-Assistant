package com.aivideo.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class InternalKeyFilter extends OncePerRequestFilter {

    private final String internalApiKey;

    public InternalKeyFilter(String internalApiKey) {
        this.internalApiKey = internalApiKey;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String requestKey = request.getHeader("X-Internal-Key");
        
        if (internalApiKey == null || !internalApiKey.equals(requestKey)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.getWriter().write("Forbidden: Invalid Internal Key");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
