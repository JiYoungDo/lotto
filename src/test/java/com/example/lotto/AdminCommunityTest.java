package com.example.lotto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:security-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class AdminCommunityTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired PostRepository posts;
    @Autowired PasswordEncoder encoder;
    @Autowired CommunityService community;

    @BeforeEach
    void setUp() {
        for (String name : new String[]{"alice", "bob_1"}) {
            if (!members.existsByUsername(name)) members.save(TestMembers.user(name, encoder));
        }
        posts.deleteAllInBatch();
    }

    private Long id(String username) { return members.findByUsername(username).orElseThrow().getId(); }

    private MockHttpSession login(String username, String password) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf()).param("username", username).param("password", password))
                .andExpect(status().isOk()).andReturn().getRequest().getSession();
    }

    private ResultActions write(String content, String username) throws Exception {
        return mvc.perform(post("/api/community/posts").with(csrf()).with(user(username).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + content + "\"}"));
    }

    // ---------- 회원 관리 ----------

    @Test
    void 가입_통계() throws Exception {
        mvc.perform(get("/api/admin/members/stats").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.today").isNumber())
                .andExpect(jsonPath("$.thisWeek").isNumber())
                .andExpect(jsonPath("$.daily.length()").value(14));
        mvc.perform(get("/api/admin/members/stats").with(user("alice").roles("USER"))).andExpect(status().isForbidden());
    }

    @Test
    void 정지된_회원은_로그인할_수_없고_기존_세션도_끊긴다() throws Exception {
        if (!members.existsByUsername("carol")) members.save(TestMembers.user("carol", encoder));
        MockHttpSession s = login("carol", "password123");

        mvc.perform(patch("/api/admin/members/" + id("carol") + "/suspend").with(csrf()).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"suspended\":true}")).andExpect(status().isOk());

        mvc.perform(get("/api/auth/me").session(s)).andExpect(jsonPath("$.loggedIn").value(false));
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "carol").param("password", "password123"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("정지된 계정입니다. 관리자에게 문의하세요."));
    }

    @Test
    void 권한_변경_비밀번호_초기화_삭제() throws Exception {
        if (!members.existsByUsername("dave")) members.save(TestMembers.user("dave", encoder));
        Long dave = id("dave");

        mvc.perform(patch("/api/admin/members/" + dave + "/role").with(csrf()).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ADMIN\"}")).andExpect(status().isOk());
        assertEquals(Member.Role.ADMIN, members.findById(dave).orElseThrow().getRole());

        String body = mvc.perform(post("/api/admin/members/" + dave + "/reset-password").with(csrf()).with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String temp = body.replaceAll(".*\"tempPassword\":\"([^\"]+)\".*", "$1");
        login("dave", temp);   // 임시 비밀번호로 로그인 가능

        mvc.perform(delete("/api/admin/members/" + dave).with(csrf()).with(user("admin").roles("ADMIN"))).andExpect(status().isOk());
        assertFalse(members.existsByUsername("dave"));
    }

    @Test
    void 기본_관리자와_본인은_변경할_수_없다() throws Exception {
        mvc.perform(delete("/api/admin/members/" + id("admin")).with(csrf()).with(user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());
        members.findByUsername("bob_1").ifPresent(m -> { m.changeRole(Member.Role.ADMIN); members.save(m); });
        mvc.perform(delete("/api/admin/members/" + id("bob_1")).with(csrf()).with(user("bob_1").roles("ADMIN")))
                .andExpect(status().isBadRequest());
        members.findByUsername("bob_1").ifPresent(m -> { m.changeRole(Member.Role.USER); members.save(m); });
    }

    @Test
    void 본인_비밀번호_변경() throws Exception {
        if (!members.existsByUsername("erin")) members.save(TestMembers.user("erin", encoder));
        mvc.perform(post("/api/auth/password").with(csrf()).with(user("erin").roles("USER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"wrong\",\"newPassword\":\"newpass1234\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/password").with(csrf()).with(user("erin").roles("USER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"password123\",\"newPassword\":\"newpass1234\"}")).andExpect(status().isOk());
        login("erin", "newpass1234");
    }

    // ---------- 커뮤니티 ----------

    @Test
    void 누구나_읽고_회원만_쓴다() throws Exception {
        mvc.perform(get("/api/community/posts")).andExpect(status().isOk()).andExpect(jsonPath("$.max").value(100));
        mvc.perform(post("/api/community/posts").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"hi\"}"))
                .andExpect(status().isUnauthorized());
        write("안녕하세요", "alice").andExpect(status().isCreated()).andExpect(jsonPath("$.nickname").value("alice"));
        mvc.perform(get("/api/community/posts")).andExpect(jsonPath("$.posts[0].content").value("안녕하세요"));
    }

    @Test
    void 빈_글과_도배는_막는다() throws Exception {
        write("   ", "alice").andExpect(status().isBadRequest());
        write("first", "bob_1").andExpect(status().isCreated());
        write("second", "bob_1").andExpect(status().isBadRequest());   // 3초 안에 또 씀
    }

    @Test
    void 최신_100개만_남는다() {
        for (int i = 1; i <= 105; i++) community.write("admin", true, "글 " + i);   // 관리자는 도배 제한 없음
        assertEquals(100, posts.count());
        var recent = community.recent();
        assertEquals("글 6", recent.get(0).get("content"));
        assertEquals("글 105", recent.get(99).get("content"));
    }

    @Test
    void 본인_글이나_관리자만_지운다() throws Exception {
        Long postId = posts.save(new Post("alice", false, "지울 글")).getId();
        mvc.perform(delete("/api/community/posts/" + postId).with(csrf()).with(user("bob_1").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/community/posts/" + postId).with(csrf()).with(user("alice").roles("USER"))).andExpect(status().isOk());
        Long other = posts.save(new Post("alice", false, "관리자가 지울 글")).getId();
        mvc.perform(delete("/api/community/posts/" + other).with(csrf()).with(user("admin").roles("ADMIN"))).andExpect(status().isOk());
    }

    @Test
    void 관리자는_전체_삭제() throws Exception {
        posts.save(new Post("alice", false, "a"));
        mvc.perform(delete("/api/admin/community/posts").with(csrf()).with(user("alice").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/community/posts").with(csrf()).with(user("admin").roles("ADMIN"))).andExpect(status().isOk());
        assertEquals(0, posts.count());
    }
}
