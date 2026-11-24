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

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:mypage-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class MyPageTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired TicketRepository tickets;
    @Autowired DrawRepository draws;
    @Autowired PasswordEncoder encoder;
    @Autowired MemberService memberService;
    @Autowired AnalysisService analysis;

    @BeforeEach
    void setUp() {
        tickets.deleteAllInBatch();
        draws.deleteAllInBatch();
        Random rnd = new Random(1);
        for (int r = 1; r <= 60; r++) {   // 1~60회 무작위 당첨 번호
            List<Integer> pool = new ArrayList<>();
            for (int i = 1; i <= 45; i++) pool.add(i);
            Collections.shuffle(pool, rnd);
            List<Integer> s = pool.subList(0, 6).stream().sorted().toList();
            draws.save(new Draw(r, s.get(0), s.get(1), s.get(2), s.get(3), s.get(4), s.get(5)));
        }
        for (String n : new String[]{"buyer", "other"}) {
            if (!members.existsByUsername(n)) members.save(TestMembers.user(n, encoder));
        }
    }

    private ResultActions save(String who, String body) throws Exception {
        return mvc.perform(post("/api/my/tickets").with(csrf()).with(user(who).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void 로그인해야_쓸_수_있다() throws Exception {
        mvc.perform(get("/api/my/generate")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/my/tickets")).andExpect(status().isUnauthorized());
    }

    @Test
    void 가설로_다음_회차_번호를_만든다() throws Exception {
        mvc.perform(get("/api/my/generate").param("caseNo", "4").param("count", "5").with(user("buyer").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.round").value(61))
                .andExpect(jsonPath("$.sets.length()").value(5))
                .andExpect(jsonPath("$.sets[0].length()").value(6))
                .andExpect(jsonPath("$.center").isArray());   // 마이페이지가 가운데 번호 개수를 표시함
        mvc.perform(get("/api/my/generate").param("count", "11").with(user("buyer").roles("USER")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 번호_만들기는_남은_선점_슬롯만큼만_된다() throws Exception {
        // 기본 5줄 중 3줄 저장 → 남은 2줄
        save("buyer", "{\"sets\":[[1,2,3,4,5,6],[7,8,9,10,11,12],[13,14,15,16,17,18]]}").andExpect(status().isCreated());
        mvc.perform(get("/api/my/generate").param("caseNo", "0").param("count", "3").with(user("buyer").roles("USER")))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/my/generate").param("caseNo", "0").param("count", "2").with(user("buyer").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(2))
                .andExpect(jsonPath("$.slotsLeft").value(2));

        // 다 쓰면 만들기 자체가 막힌다
        save("buyer", "{\"sets\":[[19,20,21,22,23,24],[25,26,27,28,29,30]]}").andExpect(status().isCreated());
        mvc.perform(get("/api/my/generate").param("caseNo", "0").param("count", "1").with(user("buyer").roles("USER")))
                .andExpect(status().isBadRequest());
        // 다른 회원은 그대로
        mvc.perform(get("/api/my/generate").param("caseNo", "0").param("count", "5").with(user("other").roles("USER")))
                .andExpect(status().isOk());
    }

    @Test
    void 번호판에서_뺀_번호는_만든_번호에_나오지_않는다() throws Exception {
        var next = analysis.outlook(draws.findAllByOrderByRoundAsc(), 60);
        // 케이스 1은 직전 회차를 뺀 가운데 번호만 쓴다
        List<Integer> center = next.center().stream().filter(n -> !next.prevNumbers().contains(n)).toList();
        String ex = center.get(0) + "," + center.get(1);

        String body = mvc.perform(get("/api/my/generate").param("caseNo", "1").param("count", "5")
                        .param("exclude", ex).with(user("buyer").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed.length()").value(2))
                .andExpect(jsonPath("$.usable.length()").value(center.size()))
                .andReturn().getResponse().getContentAsString();
        List<Integer> nums = com.jayway.jsonpath.JsonPath.read(body, "$.sets[*][*]");
        assertFalse(nums.isEmpty());
        assertFalse(nums.contains(center.get(0)));
        assertFalse(nums.contains(center.get(1)));

        // 미리보기: 빼면 후보 수가 줄어든다
        long full = next.candidates()[0];
        mvc.perform(get("/api/my/generate/options").param("caseNo", "1").param("exclude", ex).with(user("buyer").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidates").value(org.hamcrest.Matchers.lessThan((int) full)));

        // 범위 밖 번호는 거절
        mvc.perform(get("/api/my/generate/options").param("caseNo", "1").param("exclude", "0,46").with(user("buyer").roles("USER")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 저장하고_추첨_뒤_결과를_본다() throws Exception {
        save("buyer", "{\"sets\":[[1,2,3,4,5,6],[10,11,12,13,14,15]],\"caseNo\":1,\"conf\":60,\"memo\":\"편의점\"}")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.count").value(2));
        // 같은 번호 다시 저장은 거부
        save("buyer", "{\"sets\":[[6,5,4,3,2,1]]}").andExpect(status().isBadRequest());

        mvc.perform(get("/api/my/tickets").with(user("buyer").roles("USER")))
                .andExpect(jsonPath("$.tickets.length()").value(2))
                .andExpect(jsonPath("$.tickets[0].round").value(61))
                .andExpect(jsonPath("$.tickets[0].drawn").value(false));

        // 61회 추첨: 1,2,3,4,40,41 → 첫 줄 4개 일치(4등), 둘째 줄 0개
        draws.save(new Draw(61, 1, 2, 3, 4, 40, 41));
        mvc.perform(get("/api/my/tickets").with(user("buyer").roles("USER")))
                .andExpect(jsonPath("$.nextRound").value(62))
                .andExpect(jsonPath("$.tickets[0].drawn").value(true))
                .andExpect(jsonPath("$.tickets[0].matchCount").value(4))
                .andExpect(jsonPath("$.tickets[0].rank").value("4등"))
                .andExpect(jsonPath("$.tickets[1].matchCount").value(0))
                .andExpect(jsonPath("$.summary[0].key").value("case1"))
                .andExpect(jsonPath("$.summary[0].wins").value(1));
    }

    @Test
    void 잘못된_번호와_회차는_거부() throws Exception {
        save("buyer", "{\"sets\":[[1,2,3,4,5,46]]}").andExpect(status().isBadRequest());
        save("buyer", "{\"sets\":[[1,1,2,3,4,5]]}").andExpect(status().isBadRequest());
        save("buyer", "{\"round\":99,\"sets\":[[1,2,3,4,5,6]]}").andExpect(status().isBadRequest());   // 다음 회차(61)보다 미래
    }

    @Test
    void 남의_번호는_지우거나_고칠_수_없다() throws Exception {
        save("buyer", "{\"sets\":[[7,8,9,10,11,12]]}").andExpect(status().isCreated());
        Long id = tickets.findAll().get(0).getId();
        mvc.perform(delete("/api/my/tickets/" + id).with(csrf()).with(user("other").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(patch("/api/my/tickets/" + id).with(csrf()).with(user("buyer").roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"memo\":\"자동\"}")).andExpect(status().isOk());
        assertEquals("자동", tickets.findById(id).orElseThrow().getMemo());
        mvc.perform(delete("/api/my/tickets/" + id).with(csrf()).with(user("buyer").roles("USER"))).andExpect(status().isOk());
        assertEquals(0, tickets.count());
    }

    @Test
    void 회원을_삭제하면_구매_번호도_지워진다() throws Exception {
        if (!members.existsByUsername("leaver")) members.save(TestMembers.user("leaver", encoder));
        save("leaver", "{\"sets\":[[1,2,3,4,5,6]]}").andExpect(status().isCreated());
        memberService.delete(members.findByUsername("leaver").orElseThrow().getId(), "admin");
        assertEquals(0, tickets.count());
    }

    @Test
    void 다른_회원이_저장한_조합은_저장할_수_없다() throws Exception {
        save("buyer", "{\"sets\":[[3,9,15,22,30,41]]}").andExpect(status().isCreated());
        save("other", "{\"sets\":[[41,30,22,15,9,3]]}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("다른 회원이 이미 저장한 조합")));
        // 다른 회차라면 같은 조합도 가능
        save("other", "{\"round\":60,\"sets\":[[3,9,15,22,30,41]]}").andExpect(status().isCreated());
    }

    @Test
    void DB도_같은_회차_같은_조합을_막는다() {
        Long a = members.findByUsername("buyer").orElseThrow().getId();
        Long b = members.findByUsername("other").orElseThrow().getId();
        tickets.saveAndFlush(new Ticket(a, 61, List.of(1, 2, 3, 4, 5, 6), null, null, null));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> tickets.saveAndFlush(new Ticket(b, 61, List.of(1, 2, 3, 4, 5, 6), null, null, null)));
    }

    @Test
    void 조합_현황은_누구나_보고_저장하면_소진된다() throws Exception {
        var next = analysis.outlook(draws.findAllByOrderByRoundAsc(), 60);
        // 케이스 1 조건(직전 회차를 뺀 가운데 번호 6개)을 만족하는 조합 하나
        List<Integer> c1 = NumberGenerator.generate(1, next.center(), next.high(), next.prevNumbers(), new Random(3));
        long total1 = next.candidates()[0];                   // 제외 조합(과거 당첨·모양 조합)을 뺀 후보 수
        long random = 8145060L - next.excluded();

        mvc.perform(get("/api/draws/pool"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.round").value(61))
                .andExpect(jsonPath("$.cases[0].remaining").value(random))
                .andExpect(jsonPath("$.cases[1].used").value(0));

        save("buyer", "{\"sets\":[" + c1 + "]}").andExpect(status().isCreated());

        mvc.perform(get("/api/draws/pool"))
                .andExpect(jsonPath("$.savedTickets").value(1))
                .andExpect(jsonPath("$.cases[0].used").value(1))
                .andExpect(jsonPath("$.cases[0].remaining").value(random - 1))
                .andExpect(jsonPath("$.cases[1].used").value(1))
                .andExpect(jsonPath("$.cases[1].remaining").value(total1 - 1))
                .andExpect(jsonPath("$.cases[4].used").value(0));   // 케이스 4(가운데 4 + 많은 양끝 2)에는 해당 없음

        // 번호 만들기에도 남은 수가 반영되고, 저장된 조합은 나오지 않는다
        mvc.perform(get("/api/my/generate").param("caseNo", "1").param("count", "5").with(user("other").roles("USER")))
                .andExpect(jsonPath("$.used").value(1))
                .andExpect(jsonPath("$.remaining").value(total1 - 1))
                .andExpect(jsonPath("$.sets[?(@ == " + c1 + ")]").isEmpty());
    }
}
