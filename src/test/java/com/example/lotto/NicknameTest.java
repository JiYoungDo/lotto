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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:nickname-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class NicknameTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired MemberService memberService;
    @Autowired PostRepository posts;
    @Autowired GameScoreRepository scores;
    @Autowired PasswordEncoder encoder;

    @BeforeEach
    void setUp() {
        posts.deleteAllInBatch();
        scores.deleteAllInBatch();
    }

    private ResultActions signUp(String username, String nickname) throws Exception {
        return mvc.perform(post("/api/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"nickname\":\"" + nickname + "\",\"password\":\"password123\",\"adult\":true}"));
    }

    @Test
    void 가입할_때_닉네임을_받고_아이디_닉네임은_대소문자_무시하고_중복_불가() throws Exception {
        signUp("Lucky_7", "행운의칠").andExpect(status().isCreated());
        assertEquals("행운의칠", members.findByUsername("Lucky_7").orElseThrow().getNickname());

        signUp("lucky_7", "다른닉").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("이미 사용 중인 아이디입니다."));
        signUp("lucky_8", "행운의칠").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("이미 사용 중인 닉네임입니다."));
        signUp("eng_nick1", "Lucky").andExpect(status().isCreated());
        signUp("eng_nick2", "LUCKY").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("이미 사용 중인 닉네임입니다."));
    }

    @Test
    void 닉네임_형식과_관리자_사칭_금지() throws Exception {
        signUp("nick_rule1", "a").andExpect(status().isBadRequest());               // 너무 짧음
        signUp("nick_rule2", "띄어 쓰기").andExpect(status().isBadRequest());       // 공백
        signUp("nick_rule3", "열세글자를넘는아주긴닉네임").andExpect(status().isBadRequest());
        signUp("nick_rule4", "진짜관리자").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("관리자로 오해할 수 있는 닉네임은 쓸 수 없습니다."));
        signUp("nick_rule5", "Admin_kim").andExpect(status().isBadRequest());
        // 기존 회원의 아이디(=기존 닉네임)도 닉네임으로 쓸 수 없음
        if (!members.existsByUsername("old_member")) members.save(new Member("old_member", encoder.encode("password123"), Member.Role.USER));
        signUp("nick_rule6", "old_member").andExpect(status().isBadRequest());
        assertFalse(members.existsByUsername("nick_rule1"));
    }

    @Test
    void 가입_전에_아이디와_닉네임_사용_가능_여부를_확인한다() throws Exception {
        signUp("taken_id", "가져간닉").andExpect(status().isCreated());
        mvc.perform(get("/api/auth/available").param("username", "TAKEN_ID").param("nickname", "새닉네임"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username.ok").value(false))
                .andExpect(jsonPath("$.username.message").value("이미 사용 중인 아이디입니다."))
                .andExpect(jsonPath("$.nickname.ok").value(true));
        mvc.perform(get("/api/auth/available").param("nickname", "가져간닉"))
                .andExpect(jsonPath("$.nickname.ok").value(false))
                .andExpect(jsonPath("$.username").doesNotExist());
    }

    @Test
    void 닉네임이_없던_기존_회원은_서버가_켜질_때_아이디가_닉네임이_된다() throws Exception {
        Member legacy = new Member("legacy_one", encoder.encode("password123"), Member.Role.USER);
        legacy.changeNickname(null);
        members.save(legacy);
        assertFalse(members.findByUsername("legacy_one").orElseThrow().hasNickname());

        memberService.run(null);
        Member after = members.findByUsername("legacy_one").orElseThrow();
        assertTrue(after.hasNickname());
        assertEquals("legacy_one", after.getNickname());
    }

    @Test
    void 커뮤니티와_게임_순위에는_아이디_대신_닉네임이_보인다() throws Exception {
        signUp("secret_id9", "공개이름").andExpect(status().isCreated());

        mvc.perform(post("/api/community/posts").with(csrf()).with(user("secret_id9").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"안녕\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nickname").value("공개이름"))
                .andExpect(jsonPath("$.author").doesNotExist());
        String list = mvc.perform(get("/api/community/posts")).andReturn().getResponse().getContentAsString();
        assertTrue(list.contains("공개이름"));
        assertFalse(list.contains("secret_id9"), "로그인 아이디가 공개 응답에 나오면 안 됨");

        String body = mvc.perform(post("/api/game/runner/runs").with(csrf()).with(user("secret_id9").roles("USER")))
                .andReturn().getResponse().getContentAsString();
        String runId = body.replaceAll(".*\"runId\":\"([^\"]+)\".*", "$1");
        mvc.perform(post("/api/game/runner/scores").with(csrf()).with(user("secret_id9").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"runId\":\"" + runId + "\",\"score\":9}"))
                .andExpect(status().isOk());
        String ranking = mvc.perform(get("/api/game/runner/ranking")).andReturn().getResponse().getContentAsString();
        assertTrue(ranking.contains("공개이름"));
        assertFalse(ranking.contains("secret_id9"));

        mvc.perform(get("/api/auth/me").with(user("secret_id9").roles("USER")))
                .andExpect(jsonPath("$.nickname").value("공개이름"));
    }

    private ResultActions changeNick(String who, String nickname) throws Exception {
        return mvc.perform(patch("/api/auth/nickname").with(csrf()).with(user(who).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"" + nickname + "\"}"));
    }

    @Test
    void 내_정보에서_닉네임을_바꾸면_커뮤니티와_순위에_바로_보인다() throws Exception {
        signUp("changer_1", "옛날이름").andExpect(status().isCreated());
        mvc.perform(post("/api/community/posts").with(csrf()).with(user("changer_1").roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"전에 쓴 글\"}")).andExpect(status().isCreated());

        changeNick("changer_1", "새이름").andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("새이름"));
        assertEquals("새이름", members.findByUsername("changer_1").orElseThrow().getNickname());
        mvc.perform(get("/api/community/posts")).andExpect(jsonPath("$.posts[0].nickname").value("새이름"));   // 지난 글도 새 이름
        mvc.perform(get("/api/auth/me").with(user("changer_1").roles("USER"))).andExpect(jsonPath("$.nickname").value("새이름"));

        // 예전 닉네임은 다른 사람이 쓸 수 있게 풀림
        mvc.perform(get("/api/auth/available").param("nickname", "옛날이름")).andExpect(jsonPath("$.nickname.ok").value(true));
    }

    @Test
    void 닉네임_변경도_중복_형식_사칭_규칙을_지킨다() throws Exception {
        signUp("changer_2", "이름하나").andExpect(status().isCreated());
        signUp("changer_3", "이름둘").andExpect(status().isCreated());

        changeNick("changer_2", "이름둘").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("이미 사용 중인 닉네임입니다."));
        changeNick("changer_2", "이름하나").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("지금 쓰는 닉네임과 같습니다."));
        changeNick("changer_2", "a").andExpect(status().isBadRequest());
        changeNick("changer_2", "관리자다").andExpect(status().isBadRequest());

        // 본인 닉네임은 중복으로 보지 않음 → 대소문자만 바꾸기 가능
        signUp("changer_4", "sunny").andExpect(status().isCreated());
        mvc.perform(get("/api/auth/available").param("nickname", "SUNNY").with(user("changer_4").roles("USER")))
                .andExpect(jsonPath("$.nickname.ok").value(true));
        mvc.perform(get("/api/auth/available").param("nickname", "SUNNY"))   // 다른 사람(비회원)에게는 사용 중
                .andExpect(jsonPath("$.nickname.ok").value(false));
        changeNick("changer_4", "Sunny").andExpect(status().isOk());

        mvc.perform(patch("/api/auth/nickname").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"몰래\"}")).andExpect(status().isUnauthorized());
    }
}
