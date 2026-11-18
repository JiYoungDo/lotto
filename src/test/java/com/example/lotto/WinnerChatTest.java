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

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:winner-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class WinnerChatTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired TicketRepository tickets;
    @Autowired DrawRepository draws;
    @Autowired ChatMessageRepository chats;
    @Autowired PasswordEncoder encoder;
    @Autowired MemberService memberService;
    @Autowired PostRepository posts;

    Long winner, loser;

    @BeforeEach
    void setUp() {
        chats.deleteAllInBatch();
        posts.deleteAllInBatch();
        tickets.deleteAllInBatch();
        draws.deleteAllInBatch();
        for (String n : new String[]{"winner1", "loser1"}) {
            if (!members.existsByUsername(n)) members.save(TestMembers.user(n, encoder));
        }
        winner = members.findByUsername("winner1").orElseThrow().getId();
        loser = members.findByUsername("loser1").orElseThrow().getId();

        draws.save(new Draw(10, 1, 2, 3, 4, 5, 6));                                       // 10회 당첨 번호
        tickets.save(new Ticket(winner, 10, List.of(1, 2, 3, 4, 20, 30), 1, 60.0, null)); // 4개 일치 → 4등
        tickets.save(new Ticket(winner, 10, List.of(1, 2, 3, 21, 22, 23), 4, 60.0, null)); // 3개 → 5등
        tickets.save(new Ticket(loser, 10, List.of(1, 2, 40, 41, 42, 43), null, null, null)); // 2개 → 낙첨
        tickets.save(new Ticket(loser, 11, List.of(1, 2, 3, 4, 5, 6), null, null, null));     // 11회는 추첨 전
    }

    private ResultActions memberSend(String who, String text) throws Exception {
        return mvc.perform(post("/api/chat/me").with(csrf()).with(user(who).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + text + "\"}"));
    }

    private ResultActions adminSend(Long memberId, String text) throws Exception {
        return mvc.perform(post("/api/admin/chats/" + memberId).with(csrf()).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + text + "\"}"));
    }

    @Test
    void 관리자는_회차별_당첨자를_본다() throws Exception {
        mvc.perform(get("/api/admin/winners").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))   // 추첨된 10회만
                .andExpect(jsonPath("$[0].round").value(10))
                .andExpect(jsonPath("$[0].tickets").value(3))
                .andExpect(jsonPath("$[0].winnerTickets").value(2))
                .andExpect(jsonPath("$[0].winnerMembers").value(1))
                .andExpect(jsonPath("$[0].byRank['4등']").value(1))
                .andExpect(jsonPath("$[0].byRank['5등']").value(1));

        mvc.perform(get("/api/admin/winners/10").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$.winners.length()").value(2))
                .andExpect(jsonPath("$.winners[0].username").value("winner1"))
                .andExpect(jsonPath("$.winners[0].matchCount").value(4))
                .andExpect(jsonPath("$.winners[0].rank").value("4등"));
    }

    @Test
    void 일반_회원은_당첨자_목록을_볼_수_없다() throws Exception {
        mvc.perform(get("/api/admin/winners").with(user("winner1").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/chats").with(user("winner1").roles("USER"))).andExpect(status().isForbidden());
    }

    @Test
    void 당첨_회원만_관리자와_채팅한다() throws Exception {
        mvc.perform(get("/api/chat/me").with(user("loser1").roles("USER")))
                .andExpect(jsonPath("$.eligible").value(false));
        memberSend("loser1", "안녕하세요").andExpect(status().isForbidden());
        adminSend(loser, "안녕하세요").andExpect(status().isBadRequest());

        mvc.perform(get("/api/chat/me").with(user("winner1").roles("USER")))
                .andExpect(jsonPath("$.eligible").value(true))
                .andExpect(jsonPath("$.wins.length()").value(2));
        memberSend("winner1", "4등 당첨됐어요").andExpect(status().isCreated());
        adminSend(winner, "축하드립니다").andExpect(status().isCreated()).andExpect(jsonPath("$.fromAdmin").value(true));
    }

    @Test
    void 안_읽은_메시지_수와_읽음_처리() throws Exception {
        memberSend("winner1", "문의드려요").andExpect(status().isCreated());
        mvc.perform(get("/api/admin/chats").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$[0].username").value("winner1"))
                .andExpect(jsonPath("$[0].unread").value(1));
        mvc.perform(get("/api/admin/winners/10").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$.winners[0].unread").value(1));

        mvc.perform(get("/api/admin/chats/" + winner).with(user("admin").roles("ADMIN")))   // 열면 읽음
                .andExpect(jsonPath("$.messages.length()").value(1));
        mvc.perform(get("/api/admin/chats").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$[0].unread").value(0));

        adminSend(winner, "답변입니다").andExpect(status().isCreated());
        mvc.perform(get("/api/chat/me").with(user("winner1").roles("USER"))).andExpect(jsonPath("$.unread").value(1));
        mvc.perform(post("/api/chat/me/read").with(csrf()).with(user("winner1").roles("USER"))).andExpect(status().isOk());
        mvc.perform(get("/api/chat/me").with(user("winner1").roles("USER"))).andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void 빈_메시지는_거부하고_회원_삭제시_대화도_지운다() throws Exception {
        memberSend("winner1", "   ").andExpect(status().isBadRequest());
        if (!members.existsByUsername("gone_win")) members.save(TestMembers.user("gone_win", encoder));
        Long gone = members.findByUsername("gone_win").orElseThrow().getId();
        tickets.save(new Ticket(gone, 10, List.of(1, 2, 3, 4, 5, 7), null, null, null));
        memberSend("gone_win", "hi").andExpect(status().isCreated());
        memberService.delete(gone, "admin");
        assertTrue(chats.findByMemberIdOrderByIdAsc(gone).isEmpty());
    }

    @Test
    void 알림용_안_읽은_수() throws Exception {
        mvc.perform(get("/api/chat/unread")).andExpect(status().isUnauthorized());
        memberSend("winner1", "질문 있어요").andExpect(status().isCreated());
        mvc.perform(get("/api/chat/unread").with(user("admin").roles("ADMIN"))).andExpect(jsonPath("$.count").value(1));
        mvc.perform(get("/api/chat/unread").with(user("winner1").roles("USER"))).andExpect(jsonPath("$.count").value(0));
        adminSend(winner, "답변").andExpect(status().isCreated());   // 답장하면 관리자 쪽은 읽음
        mvc.perform(get("/api/chat/unread").with(user("admin").roles("ADMIN"))).andExpect(jsonPath("$.count").value(0));
        mvc.perform(get("/api/chat/unread").with(user("winner1").roles("USER"))).andExpect(jsonPath("$.count").value(1));
        mvc.perform(get("/api/chat/unread").with(user("loser1").roles("USER"))).andExpect(jsonPath("$.count").value(0));
    }

    // ---------- 커뮤니티 당첨 인증 ----------

    private ResultActions share(String who, String content, Long ticketId) throws Exception {
        return mvc.perform(post("/api/community/posts").with(csrf()).with(user(who).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"" + content + "\",\"ticketId\":" + ticketId + "}"));
    }

    private Long ticketOf(Long memberId, int matchFirst) {
        return tickets.findByMemberIdOrderByRoundDescIdAsc(memberId).stream()
                .filter(t -> t.getRound() == 10 && t.numbers().get(3) == matchFirst).findFirst().orElseThrow().getId();
    }

    @Test
    void 당첨_회원은_자기_당첨_번호로_인증글을_올린다() throws Exception {
        mvc.perform(get("/api/my/wins").with(user("winner1").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wins.length()").value(2))
                .andExpect(jsonPath("$.wins[0].ticketId").isNumber());

        Long fourth = ticketOf(winner, 4);   // 1,2,3,4,20,30 → 4등
        share("winner1", "", fourth)          // 메시지 없이 인증만 올려도 된다
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value(""))
                .andExpect(jsonPath("$.win.round").value(10))
                .andExpect(jsonPath("$.win.rank").value("4등"))
                .andExpect(jsonPath("$.win.matched.length()").value(4))
                .andExpect(jsonPath("$.win.winning[5]").value(6));

        // 번호를 지워도 인증 글은 그대로 남는다
        tickets.deleteById(fourth);
        mvc.perform(get("/api/community/posts"))
                .andExpect(jsonPath("$.posts[0].win.rank").value("4등"));
    }

    @Test
    void 남의_번호나_낙첨_번호로는_인증할_수_없다() throws Exception {
        Long winnersTicket = ticketOf(winner, 4);
        share("loser1", "내 거임", winnersTicket).andExpect(status().isBadRequest());

        Long losing = ticketOf(loser, 41);   // 2개 일치 → 낙첨
        share("loser1", "됐다", losing).andExpect(status().isBadRequest());

        mvc.perform(get("/api/my/wins").with(user("loser1").roles("USER"))).andExpect(jsonPath("$.wins.length()").value(0));
        mvc.perform(get("/api/my/wins")).andExpect(status().isUnauthorized());
        assertEquals(0, posts.count());
    }
}
