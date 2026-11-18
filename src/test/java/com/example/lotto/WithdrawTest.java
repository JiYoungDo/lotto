package com.example.lotto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:withdraw-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class WithdrawTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired TicketRepository tickets;
    @Autowired ChatMessageRepository chats;
    @Autowired GameScoreRepository scores;
    @Autowired PostRepository posts;

    @BeforeEach
    void setUp() {
        posts.deleteAllInBatch();
        tickets.deleteAllInBatch();
    }

    private Long signUp(String username) throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"nickname\":\"" + username + "\",\"password\":\"password123\",\"adult\":true,\"agreeTerms\":true,\"agreePrivacy\":true}"))
                .andExpect(status().isCreated());
        Long id = members.findByUsername(username).orElseThrow().getId();
        tickets.save(new Ticket(id, id.intValue(), List.of(1, 2, 3, 4, 5, 6), 0, 60.0, "메모"));   // 회차를 회원마다 달리해 조합 중복을 피함
        chats.save(new ChatMessage(id, false, username, "안녕하세요"));
        scores.save(new GameScore("runner", id, username));
        posts.save(new Post(username, false, "글"));
        return id;
    }

    private ResultActions withdraw(String username, String password, boolean deletePosts, String role) throws Exception {
        return mvc.perform(post("/api/auth/withdraw").with(csrf()).with(user(username).roles(role))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"" + password + "\",\"deletePosts\":" + deletePosts + "}"));
    }

    @Test
    void 비밀번호가_틀리면_탈퇴되지_않는다() throws Exception {
        signUp("wd_wrong");
        withdraw("wd_wrong", "nope12345", false, "USER").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("비밀번호가 맞지 않습니다."));
        assertTrue(members.findByUsername("wd_wrong").isPresent());
    }

    @Test
    void 탈퇴하면_기록이_지워지고_글은_선택에_따라_남는다() throws Exception {
        Long id = signUp("wd_keep");
        withdraw("wd_keep", "password123", false, "USER").andExpect(status().isOk());
        assertTrue(members.findByUsername("wd_keep").isEmpty());
        assertTrue(tickets.findByMemberIdOrderByRoundDescIdAsc(id).isEmpty());
        assertTrue(chats.findByMemberIdOrderByIdAsc(id).isEmpty());
        assertTrue(scores.findAll().stream().noneMatch(s -> id.equals(s.getMemberId())));
        assertEquals(1, posts.findByAuthor("wd_keep").size());

        signUp("wd_posts");
        withdraw("wd_posts", "password123", true, "USER").andExpect(status().isOk());
        assertTrue(posts.findByAuthor("wd_posts").isEmpty());
    }

    @Test
    void 관리자와_로그인하지_않은_사용자는_탈퇴할_수_없다() throws Exception {
        withdraw("admin", "test-pass", false, "ADMIN").andExpect(status().isBadRequest());
        assertTrue(members.findByUsername("admin").isPresent());
        mvc.perform(post("/api/auth/withdraw").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
