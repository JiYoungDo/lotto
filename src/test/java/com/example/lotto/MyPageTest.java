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
            if (!members.existsByUsername(n)) members.save(new Member(n, encoder.encode("password123"), Member.Role.USER));
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
                .andExpect(jsonPath("$.sets[0].length()").value(6));
        mvc.perform(get("/api/my/generate").param("count", "11").with(user("buyer").roles("USER")))
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
        if (!members.existsByUsername("leaver")) members.save(new Member("leaver", encoder.encode("password123"), Member.Role.USER));
        save("leaver", "{\"sets\":[[1,2,3,4,5,6]]}").andExpect(status().isCreated());
        memberService.delete(members.findByUsername("leaver").orElseThrow().getId(), "admin");
        assertEquals(0, tickets.count());
    }
}
