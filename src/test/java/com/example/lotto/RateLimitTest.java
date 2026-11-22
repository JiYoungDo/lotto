package com.example.lotto;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** 가입 시도 제한: 같은 IP에서 1시간에 5번을 넘기면 429 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:rate-limit-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass",
        "lotto.rate-limit.enabled=true"
})
@AutoConfigureMockMvc
class RateLimitTest {

    @Autowired MockMvc mvc;

    @Test
    void 가입_시도가_한도를_넘으면_429() throws Exception {
        int last = 0;
        for (int i = 0; i < 6; i++) {
            // CSRF 토큰 없이 보내도 제한 필터가 먼저 동작한다 (필터가 CsrfFilter 앞에 있음)
            last = mvc.perform(post("/api/auth/signup")).andReturn().getResponse().getStatus();
        }
        assertEquals(429, last);
    }
}
