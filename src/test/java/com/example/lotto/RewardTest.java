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

import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:reward-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass",
        "lotto.reward.catch-score=50",
        "lotto.reward.runner-score=20"   // 러너는 시작 직후 30점까지만 낼 수 있음
})
@AutoConfigureMockMvc
class RewardTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired TicketRepository tickets;
    @Autowired DrawRepository draws;
    @Autowired GameScoreRepository scores;
    @Autowired RewardSlotRepository rewards;
    @Autowired MemberService memberService;
    @Autowired PasswordEncoder encoder;

    private int line = 0;   // 저장할 서로 다른 조합을 만들 때 씀

    @BeforeEach
    void setUp() {
        tickets.deleteAllInBatch();
        rewards.deleteAllInBatch();
        scores.deleteAllInBatch();
        draws.deleteAllInBatch();
        draws.save(new Draw(1, 1, 2, 3, 4, 5, 6));
        draws.save(new Draw(2, 7, 8, 9, 10, 11, 12));   // 다음 회차는 3회
        for (String n : new String[]{"gamer", "leaver2"}) {
            if (!members.existsByUsername(n)) members.save(TestMembers.user(n, encoder));
        }
    }

    private String lines(int n) {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < n; i++, line++) out.add("[1,2,3,4,5," + (6 + line) + "]");
        return String.join(",", out);
    }

    private ResultActions save(String who, Integer round, int n) throws Exception {
        String r = round == null ? "" : "\"round\":" + round + ",";
        return mvc.perform(post("/api/my/tickets").with(csrf()).with(user(who).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{" + r + "\"sets\":[" + lines(n) + "]}"));
    }

    private ResultActions attend(String who) throws Exception {
        return mvc.perform(post("/api/my/rewards/attend").with(csrf()).with(user(who).roles("USER")));
    }

    private ResultActions play(String game, String who, int score) throws Exception {
        String body = mvc.perform(post("/api/game/" + game + "/runs").with(csrf()).with(user(who).roles("USER")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String runId = body.replaceAll(".*\"runId\":\"([^\"]+)\".*", "$1");
        return mvc.perform(post("/api/game/" + game + "/scores").with(csrf()).with(user(who).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"runId\":\"" + runId + "\",\"score\":" + score + "}"));
    }

    @Test
    void 기본은_다음_회차_5줄까지() throws Exception {
        mvc.perform(get("/api/my/rewards").with(user("gamer").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.round").value(3))
                .andExpect(jsonPath("$.limit").value(5))
                .andExpect(jsonPath("$.today[0].done").value(false));
        save("gamer", null, 5).andExpect(status().isCreated());
        save("gamer", null, 1).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("5줄까지")));
        // 지난 회차 기록은 보상과 상관없이 100줄까지
        save("gamer", 2, 10).andExpect(status().isCreated());
    }

    @Test
    void 출석은_하루_한_번_한_줄() throws Exception {
        attend("gamer").andExpect(status().isOk())
                .andExpect(jsonPath("$.granted").value(true))
                .andExpect(jsonPath("$.limit").value(6))
                .andExpect(jsonPath("$.today[0].done").value(true));
        attend("gamer").andExpect(jsonPath("$.granted").value(false)).andExpect(jsonPath("$.limit").value(6));
        save("gamer", null, 6).andExpect(status().isCreated());
        save("gamer", null, 1).andExpect(status().isBadRequest());
    }

    @Test
    void 게임_목표_점수를_넘기면_두_줄_게임마다_하루_한_번() throws Exception {
        play("catch", "gamer", 49).andExpect(status().isOk())
                .andExpect(jsonPath("$.reward.granted").value(false))
                .andExpect(jsonPath("$.reward.goal").value(50));
        play("catch", "gamer", 50).andExpect(status().isOk())
                .andExpect(jsonPath("$.reward.granted").value(true))
                .andExpect(jsonPath("$.reward.slots").value(2))
                .andExpect(jsonPath("$.reward.round").value(3))
                .andExpect(jsonPath("$.reward.limit").value(7));
        play("catch", "gamer", 55).andExpect(jsonPath("$.reward.granted").value(false))
                .andExpect(jsonPath("$.reward.claimedToday").value(true));
        play("runner", "gamer", 25).andExpect(jsonPath("$.reward.granted").value(true))
                .andExpect(jsonPath("$.reward.limit").value(9));

        mvc.perform(get("/api/my/tickets").with(user("gamer").roles("USER"))).andExpect(jsonPath("$.nextLimit").value(9));
        save("gamer", null, 9).andExpect(status().isCreated());
        save("gamer", null, 1).andExpect(status().isBadRequest());
    }

    @Test
    void 추첨이_끝나면_보상은_다음_회차에_넘어가지_않는다() throws Exception {
        attend("gamer").andExpect(jsonPath("$.limit").value(6));
        draws.save(new Draw(3, 13, 14, 15, 16, 17, 18));
        mvc.perform(get("/api/my/rewards").with(user("gamer").roles("USER")))
                .andExpect(jsonPath("$.round").value(4))
                .andExpect(jsonPath("$.limit").value(5))
                .andExpect(jsonPath("$.today[0].done").value(true));   // 오늘 출석은 이미 함
    }

    @Test
    void 탈퇴하면_보상_기록도_지워진다() throws Exception {
        attend("leaver2").andExpect(status().isOk());
        memberService.delete(members.findByUsername("leaver2").orElseThrow().getId(), "admin");
        assertEquals(0, rewards.count());
    }

    @Test
    void 로그인해야_보상을_받는다() throws Exception {
        mvc.perform(get("/api/my/rewards")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/my/rewards/attend").with(csrf())).andExpect(status().isUnauthorized());
    }
}
