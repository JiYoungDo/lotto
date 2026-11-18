package com.example.lotto;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 관리자가 회원을 삭제·정지하거나 권한을 바꾸면, 그 회원이 이미 로그인해 있던 세션도 바로 끊는다.
 * (요청마다 DB의 회원 상태와 세션의 권한을 비교)
 * 지금 약관에 동의하지 않은 회원은 동의하기 전까지 조회(GET)와 /api/auth/** (동의·로그아웃·탈퇴 등)만 쓸 수 있다.
 */
public class MemberSessionFilter extends OncePerRequestFilter {

    private final MemberService members;

    public MemberSessionFilter(MemberService members) { this.members = members; }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            boolean admin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
            MemberService.SessionState state = members.sessionState(auth.getName(), admin);
            if (state == MemberService.SessionState.INVALID) {
                SecurityContextHolder.clearContext();
                HttpSession session = req.getSession(false);
                if (session != null) session.invalidate();
            } else if (state == MemberService.SessionState.TERMS_REQUIRED && blockedUntilAgreed(req)) {
                res.setStatus(403);
                res.setContentType("application/json;charset=UTF-8");
                res.getWriter().write("{\"message\":\"새 이용약관과 개인정보 처리방침에 동의해야 이용할 수 있습니다.\",\"termsRequired\":true}");
                return;
            }
        }
        chain.doFilter(req, res);
    }

    private static boolean blockedUntilAgreed(HttpServletRequest req) {
        String path = req.getRequestURI();
        return path.startsWith("/api/") && !path.startsWith("/api/auth/") && !"GET".equals(req.getMethod());
    }
}
