package com.example.lotto;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 가입 없이 번호 만들어 보기: 로그인 없이 뽑을 수 있고, 저장 기능(/api/my)은 여전히 로그인이 필요하다 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:try-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class TryTest {

    @Autowired MockMvc mvc;

    @Test
    void 로그인_없이_무작위_번호를_뽑을_수_있다() throws Exception {
        mvc.perform(get("/api/try/generate?caseNo=0&count=3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(3))
                .andExpect(jsonPath("$.sets[0].length()").value(6));
    }

    @Test
    void 번호판_미리보기도_로그인_없이_볼_수_있다() throws Exception {
        mvc.perform(get("/api/try/generate/options?caseNo=0")).andExpect(status().isOk());
    }

    @Test
    void 가입_없이는_한_번에_5줄까지만() throws Exception {
        mvc.perform(get("/api/try/generate?caseNo=0&count=6")).andExpect(status().isBadRequest());
    }

    @Test
    void 저장과_회원용_주소는_여전히_로그인이_필요하다() throws Exception {
        mvc.perform(get("/api/my/generate?caseNo=0")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/my/tickets")).andExpect(status().isUnauthorized());
    }
}
