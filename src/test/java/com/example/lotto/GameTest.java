package com.example.lotto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:game-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class GameTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired GameScoreRepository scores;
    @Autowired PasswordEncoder encoder;

    @BeforeEach
    void setUp() {
        scores.deleteAllInBatch();
        for (int i = 1; i <= 6; i++) {
            String n = "runner" + i;
            if (!members.existsByUsername(n)) members.save(new Member(n, encoder.encode("password123"), Member.Role.USER));
        }
    }

    private String start(String who) throws Exception {
        String body = mvc.perform(post("/api/game/runs").with(csrf()).with(user(who).roles("USER")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return body.replaceAll(".*\"runId\":\"([^\"]+)\".*", "$1");
    }

    private ResultActions submit(String who, String runId, int score) throws Exception {
        return mvc.perform(post("/api/game/scores").with(csrf()).with(user(who).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"runId\":\"" + runId + "\",\"score\":" + score + "}"));
    }

    @Test
    void 점수를_내면_최고_기록과_순위가_남는다() throws Exception {
        submit("runner1", start("runner1"), 12).andExpect(status().isOk())
                .andExpect(jsonPath("$.newBest").value(true))
                .andExpect(jsonPath("$.best").value(12))
                .andExpect(jsonPath("$.rank").value(1));
        // 더 낮은 점수는 최고 기록을 바꾸지 않는다
        submit("runner1", start("runner1"), 5).andExpect(status().isOk())
                .andExpect(jsonPath("$.newBest").value(false))
                .andExpect(jsonPath("$.best").value(12))
                .andExpect(jsonPath("$.plays").value(2));

        mvc.perform(get("/api/game/ranking")).andExpect(status().isOk())
                .andExpect(jsonPath("$.ranking[0].username").value("runner1"))
                .andExpect(jsonPath("$.ranking[0].best").value(12));
    }

    @Test
    void 순위는_5위까지만_높은_점수_순() throws Exception {
        for (int i = 1; i <= 6; i++) submit("runner" + i, start("runner" + i), i * 3).andExpect(status().isOk());
        mvc.perform(get("/api/game/ranking"))
                .andExpect(jsonPath("$.ranking.length()").value(5))
                .andExpect(jsonPath("$.ranking[0].username").value("runner6"))
                .andExpect(jsonPath("$.ranking[4].username").value("runner2"));
        mvc.perform(get("/api/game/me").with(user("runner1").roles("USER")))
                .andExpect(jsonPath("$.rank").value(6));
    }

    @Test
    void 같은_판을_두_번_내거나_시간에_비해_높은_점수는_거절() throws Exception {
        String run = start("runner1");
        submit("runner1", run, 10).andExpect(status().isOk());
        submit("runner1", run, 10).andExpect(status().isBadRequest());

        submit("runner1", start("runner1"), 99_999).andExpect(status().isBadRequest());
        submit("runner1", "made-up", 5).andExpect(status().isBadRequest());
    }

    @Test
    void 비회원은_순위만_보고_점수는_못_낸다() throws Exception {
        mvc.perform(get("/api/game/ranking")).andExpect(status().isOk());
        mvc.perform(post("/api/game/runs").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/game/me")).andExpect(status().isUnauthorized());
    }
}
