package com.example.lotto;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

import java.io.IOException;

/**
 * 보안 설정.
 * - 회차 조회(GET /api/draws)와 분석(GET /api/analysis)은 누구나 볼 수 있다.
 * - 회원가입(POST /api/auth/signup)은 누구나 할 수 있다. 회원 정보는 DB(member 테이블)에 저장된다.
 * - 커뮤니티 글 읽기·실시간 스트림은 누구나, 글쓰기·삭제는 로그인한 회원만 할 수 있다.
 * - 마이페이지(/api/my/**: 번호 생성, 구매 번호 관리)는 로그인한 회원 본인만 쓸 수 있다.
 * - 관리자 채팅(/api/chat/**)은 로그인한 회원 중 당첨 기록이 있는 회원만 (ChatService에서 확인).
 * - 회차 추가·엑셀 업로드 등 나머지 /api 요청은 관리자(ROLE_ADMIN)만 할 수 있다.
 * - 로그인은 세션 쿠키 방식이고, 변경 요청에는 CSRF 토큰(XSRF-TOKEN 쿠키 → X-XSRF-TOKEN 헤더)이 필요하다.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, MemberService members) throws Exception {
        var h2Console = PathPatternRequestMatcher.withDefaults().matcher("/h2-console/**");
        http
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()   // 실시간 스트림(SSE)·오류 응답
                .requestMatchers(HttpMethod.GET, "/api/draws", "/api/draws/pool", "/api/draws/stream", "/api/analysis", "/api/auth/me", "/api/auth/available", "/api/community/**",
                        "/api/game/*/ranking", "/api/game/stream").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/signup").permitAll()
                .requestMatchers("/api/auth/password", "/api/auth/nickname", "/api/auth/withdraw", "/api/auth/agree", "/api/community/**", "/api/my/**", "/api/chat/**", "/api/game/**").authenticated()   // 로그인한 회원
                .requestMatchers("/api/**").hasRole("ADMIN")
                .requestMatchers(h2Console).hasRole("ADMIN")                                 // DB 웹 화면은 관리자만
                .anyRequest().permitAll())
            .csrf(csrf -> csrf.spa().ignoringRequestMatchers(h2Console))   // H2 콘솔은 자체 폼이라 CSRF 토큰을 못 보냄
            .headers(h -> h.frameOptions(f -> f.sameOrigin()))             // H2 콘솔은 같은 사이트 안의 frame을 씀
            .formLogin(form -> form
                .loginPage("/admin")                       // React 관리자 화면 (기본 로그인 페이지를 쓰지 않음)
                .loginProcessingUrl("/api/auth/login")
                .successHandler((req, res, a) -> {
                    members.recordLogin(a.getName());
                    json(res, 200, "{\"message\":\"로그인했습니다.\"}");
                })
                .failureHandler((req, res, e) -> json(res, 401, e instanceof DisabledException
                        ? "{\"message\":\"정지된 계정입니다. 관리자에게 문의하세요.\"}"
                        : "{\"message\":\"아이디 또는 비밀번호가 맞지 않습니다.\"}"))
                .permitAll())
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((req, res, a) -> json(res, 200, "{\"message\":\"로그아웃했습니다.\"}")))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) -> {
                    if (h2Console.matches(req)) res.sendRedirect("/login");   // DB 화면은 로그인 화면으로 보냄
                    else json(res, 401, "{\"message\":\"로그인이 필요합니다.\"}");
                })
                .accessDeniedHandler((req, res, e) -> json(res, 403, "{\"message\":\"권한이 없거나 보안 토큰이 만료되었습니다. 새로고침 후 다시 시도하세요.\"}")));
        // 삭제·정지·권한 변경된 회원의 기존 세션을 끊는 필터
        http.addFilterBefore(new MemberSessionFilter(members), AuthorizationFilter.class);
        // 로그인·회원가입 시도 횟수 제한 (CSRF 검사보다 먼저 돌아서 모든 시도를 센다)
        http.addFilterBefore(new RateLimitFilter(), CsrfFilter.class);
        return http.build();
    }

    private static void json(HttpServletResponse res, int status, String body) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write(body);
    }
}
