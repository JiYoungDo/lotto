package com.example.lotto;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인·회원가입 시도 횟수 제한 (무차별 대입, 가입 도배 방지).
 * - 서버 메모리에서 센다. 서버를 다시 시작하면 초기화된다. (서버 1대 운영 기준)
 * - 한도를 넘으면 429 응답을 돌려주고, 시간이 지나면 자동으로 풀린다.
 * - 클라이언트 IP는 request.getRemoteAddr()를 쓴다.
 *   (운영에서는 server.forward-headers-strategy=framework 설정으로 Caddy가 넘긴 실제 IP가 들어온다.)
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String LOGIN = "/api/auth/login";
    private static final String SIGNUP = "/api/auth/signup";
    private static final String TRY_PREFIX = "/api/try/";   // 가입 없이 번호 만들어 보기 (GET)

    private static final long MIN = 60_000L;

    // 로그인: IP당 5분에 15번, 같은 아이디는 10분에 10번
    private static final Rule LOGIN_IP = new Rule(15, 5 * MIN);
    private static final Rule LOGIN_USER = new Rule(10, 10 * MIN);
    // 회원가입: IP당 1시간에 5번
    private static final Rule SIGNUP_IP = new Rule(5, 60 * MIN);
    // 가입 없이 번호 만들어 보기: 계산이 무거워서 IP당 5분에 120번 (번호판에서 번호를 누를 때마다 미리보기를 다시 계산함)
    private static final Rule TRY_IP = new Rule(120, 5 * MIN);

    private static final int CLEANUP_SIZE = 5_000;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if ("GET".equals(request.getMethod())) return !path.startsWith(TRY_PREFIX);
        if (!"POST".equals(request.getMethod())) return true;
        return !(LOGIN.equals(path) || SIGNUP.equals(path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        long now = System.currentTimeMillis();
        long retryAfterMs = 0;

        if (request.getRequestURI().startsWith(TRY_PREFIX)) {
            retryAfterMs = hit("try-ip:" + ip, TRY_IP, now);
        } else if (LOGIN.equals(request.getRequestURI())) {
            retryAfterMs = Math.max(retryAfterMs, hit("login-ip:" + ip, LOGIN_IP, now));
            String username = request.getParameter("username");
            if (username != null && !username.isBlank()) {
                retryAfterMs = Math.max(retryAfterMs,
                        hit("login-user:" + username.trim().toLowerCase(), LOGIN_USER, now));
            }
        } else {
            retryAfterMs = hit("signup-ip:" + ip, SIGNUP_IP, now);
        }

        if (retryAfterMs > 0) {
            long seconds = Math.max(1, (retryAfterMs + 999) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(seconds));
            response.setContentType("application/json;charset=UTF-8");
            long minutes = Math.max(1, (seconds + 59) / 60);
            response.getWriter().write("{\"message\":\"시도 횟수가 너무 많습니다. " + minutes + "분 뒤에 다시 시도하세요.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    /** 이번 시도를 센다. 한도를 넘었으면 풀릴 때까지 남은 시간(ms)을, 아니면 0을 돌려준다. */
    private long hit(String key, Rule rule, long now) {
        if (windows.size() > CLEANUP_SIZE) {
            windows.values().removeIf(w -> w.expiresAt <= now);
        }
        Window w = windows.compute(key, (k, old) -> {
            if (old == null || old.expiresAt <= now) return new Window(now + rule.windowMs, 1);
            old.count++;
            return old;
        });
        return w.count > rule.max ? w.expiresAt - now : 0;
    }

    private record Rule(int max, long windowMs) {}

    private static final class Window {
        final long expiresAt;
        int count;
        Window(long expiresAt, int count) { this.expiresAt = expiresAt; this.count = count; }
    }
}
