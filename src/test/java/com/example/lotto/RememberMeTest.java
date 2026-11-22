package com.example.lotto;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 로그인 유지: 세션이 사라져도(서버 재시작·30분 쉼) 유지 쿠키만 있으면 다시 로그인된 상태가 된다 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:remember-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class RememberMeTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder encoder;

    private void ensure(String username) {
        if (!members.existsByUsername(username)) members.save(TestMembers.user(username, encoder));
    }

    @Test
    void 유지_쿠키만_있어도_다시_로그인된_상태가_된다() throws Exception {
        ensure("keep_me");
        Cookie remember = mvc.perform(post("/api/auth/login").with(csrf())
                        .param("username", "keep_me").param("password", "password123").param("remember-me", "true"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("lotto-remember");
        assertNotNull(remember, "유지 쿠키가 내려와야 한다");
        assertTrue(remember.getMaxAge() > 20 * 24 * 60 * 60, "30일 가까이 유지");
        assertTrue(remember.isHttpOnly());

        // 세션 없이 유지 쿠키만으로
        mvc.perform(get("/api/auth/me").cookie(remember))
                .andExpect(jsonPath("$.loggedIn").value(true))
                .andExpect(jsonPath("$.username").value("keep_me"));
    }

    @Test
    void 체크하지_않으면_유지_쿠키를_주지_않는다() throws Exception {
        ensure("no_keep");
        Cookie remember = mvc.perform(post("/api/auth/login").with(csrf())
                        .param("username", "no_keep").param("password", "password123"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("lotto-remember");
        assertNull(remember);
    }

    @Test
    void 정지된_회원의_유지_쿠키는_쓸_수_없다() throws Exception {
        ensure("ban_me");
        Cookie remember = mvc.perform(post("/api/auth/login").with(csrf())
                        .param("username", "ban_me").param("password", "password123").param("remember-me", "true"))
                .andReturn().getResponse().getCookie("lotto-remember");
        assertNotNull(remember);
        Member m = members.findByUsername("ban_me").orElseThrow();
        members.delete(m);   // 회원 삭제 = 더 이상 존재하지 않는 계정
        mvc.perform(get("/api/auth/me").cookie(remember)).andExpect(jsonPath("$.loggedIn").value(false));
    }
}
