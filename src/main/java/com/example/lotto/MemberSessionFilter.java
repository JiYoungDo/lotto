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
            if (!members.sessionValid(auth.getName(), admin)) {
                SecurityContextHolder.clearContext();
                HttpSession session = req.getSession(false);
                if (session != null) session.invalidate();
            }
        }
        chain.doFilter(req, res);
    }
}
