package com.sentinel.common.web;

import jakarta.servlet.*;
import jakarta.servlet.http.*;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.*;

@Component
public class KycBodyLimitFilter extends OncePerRequestFilter {
    private static final int MAXIMUM = 16000000;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod())
                || !(request.getRequestURI().startsWith("/api/kyc/hosted/")
                        || request.getRequestURI().startsWith("/api/integration/kyc/"))
                || !request.getRequestURI().endsWith("/submit");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (request.getContentLengthLong() > MAXIMUM) {
            reject(response);
            return;
        }
        byte[] body = request.getInputStream().readNBytes(MAXIMUM + 1);
        if (body.length > MAXIMUM) {
            reject(response);
            return;
        }
        chain.doFilter(
                new HttpServletRequestWrapper(request) {
                    @Override
                    public ServletInputStream getInputStream() {
                        var input = new ByteArrayInputStream(body);
                        return new ServletInputStream() {
                            public int read() {
                                return input.read();
                            }

                            public int read(byte[] data, int offset, int length) {
                                return input.read(data, offset, length);
                            }

                            public boolean isFinished() {
                                return input.available() == 0;
                            }

                            public boolean isReady() {
                                return true;
                            }

                            public void setReadListener(ReadListener listener) {
                                throw new UnsupportedOperationException(
                                        "Asynchronous body reads are unavailable");
                            }
                        };
                    }

                    @Override
                    public BufferedReader getReader() {
                        return new BufferedReader(
                                new InputStreamReader(
                                        getInputStream(), java.nio.charset.StandardCharsets.UTF_8));
                    }
                },
                response);
    }

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(413);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"KYC request exceeds 16 MB\"}");
    }
}
