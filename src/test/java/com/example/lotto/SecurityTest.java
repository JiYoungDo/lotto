package com.example.lotto;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:security-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class SecurityTest {

    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder encoder;

    /** with(user("u")) 로 쓰는 일반 회원도 DB에 있어야 세션 확인 필터를 통과한다 */
    @org.junit.jupiter.api.BeforeEach
    void ensureUser() {
        if (!members.existsByUsername("u")) members.save(new Member("u", encoder.encode("password123"), Member.Role.USER));
    }

    private static final String BODY = "{\"round\":1,\"numbers\":[1,2,3,4,5,6]}";

    @Test
    void 누구나_회차와_분석을_볼_수_있다() throws Exception {
        mvc.perform(get("/api/draws")).andExpect(status().isOk());
        mvc.perform(get("/api/analysis")).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me"))
                .andExpect(jsonPath("$.admin").value(false))
                .andExpect(jsonPath("$.loggedIn").value(false));
    }

    @Test
    void 로그인하지_않으면_회차를_등록할_수_없다() throws Exception {
        mvc.perform(post("/api/draws").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 관리자가_아니면_등록할_수_없다() throws Exception {
        mvc.perform(post("/api/draws").with(csrf()).with(user("u").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void 관리자는_등록할_수_있다() throws Exception {
        mvc.perform(post("/api/draws").with(csrf()).with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk());
    }

    @Test
    void CSRF_토큰이_없으면_거부된다() throws Exception {
        mvc.perform(post("/api/draws").with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void 로그인_성공과_실패() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "admin").param("password", "test-pass"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "admin").param("password", "wrong"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 관리자만_회차를_삭제할_수_있다() throws Exception {
        mvc.perform(post("/api/draws").with(csrf()).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"round\":7,\"numbers\":[1,2,3,4,5,6]}"));
        mvc.perform(delete("/api/draws/7").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/draws/7").with(csrf()).with(user("u").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/draws/7").with(csrf()).with(user("admin").roles("ADMIN"))).andExpect(status().isOk());
        mvc.perform(delete("/api/draws/7").with(csrf()).with(user("admin").roles("ADMIN"))).andExpect(status().isNotFound());
    }

    @Test
    void 로그인한_관리자_정보() throws Exception {
        mvc.perform(get("/api/auth/me").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$.admin").value(true))
                .andExpect(jsonPath("$.loggedIn").value(true));
        mvc.perform(get("/api/auth/me").with(user("u").roles("USER")))
                .andExpect(jsonPath("$.admin").value(false))
                .andExpect(jsonPath("$.loggedIn").value(true));
    }

    private org.springframework.test.web.servlet.ResultActions signUp(String username, String password) throws Exception {
        return mvc.perform(post("/api/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"nickname\":\"" + nick(username) + "\",\"password\":\"" + password + "\",\"adult\":true,\"agreeTerms\":true,\"agreePrivacy\":true}"));
    }

    /** 테스트용 닉네임: 아이디 앞부분 + "닉" (2~12자) */
    static String nick(String username) {
        return (username.length() > 10 ? username.substring(0, 10) : username) + "닉";
    }

    @Test
    void 만_19세_이상_확인_없이는_가입할_수_없다() throws Exception {
        for (String extra : new String[]{"", ",\"adult\":false"}) {
            mvc.perform(post("/api/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"kid_user\",\"nickname\":\"꼬마\",\"password\":\"password123\",\"agreeTerms\":true,\"agreePrivacy\":true" + extra + "}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("만 19세 이상만 가입할 수 있습니다. 나이 확인에 체크해 주세요."));
        }
        assertFalse(members.existsByUsername("kid_user"));

        signUp("adult_user", "password123").andExpect(status().isCreated());
        assertNotNull(members.findByUsername("adult_user").orElseThrow().getAdultConfirmedAt());
    }

    @Test
    void 약관_동의_없이는_가입할_수_없고_동의_시각과_버전을_저장한다() throws Exception {
        for (String agree : new String[]{"", ",\"agreeTerms\":true", ",\"agreePrivacy\":true", ",\"agreeTerms\":true,\"agreePrivacy\":false"}) {
            mvc.perform(post("/api/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"no_agree\",\"nickname\":\"동의안함\",\"password\":\"password123\",\"adult\":true" + agree + "}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("이용약관과 개인정보 수집·이용에 동의해야 가입할 수 있습니다."));
        }
        assertFalse(members.existsByUsername("no_agree"));

        signUp("agree_user", "password123").andExpect(status().isCreated());
        Member m = members.findByUsername("agree_user").orElseThrow();
        assertNotNull(m.getTermsAgreedAt());
        assertNotNull(m.getPrivacyAgreedAt());
        assertEquals(MemberService.TERMS_VERSION, m.getTermsVersion());
    }

    @Test
    void 회원가입하면_DB에_암호화된_비밀번호로_저장된다() throws Exception {
        signUp("newbie1", "password123").andExpect(status().isCreated());
        Member m = members.findByUsername("newbie1").orElseThrow();
        assertEquals(Member.Role.USER, m.getRole());
        assertNotEquals("password123", m.getPassword());
        assertTrue(m.getPassword().startsWith("{bcrypt}"));
    }

    @Test
    void 가입한_회원은_로그인되지만_관리자는_아니다() throws Exception {
        signUp("member2", "password123").andExpect(status().isCreated());
        var session = (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf())
                        .param("username", "member2").param("password", "password123"))
                .andExpect(status().isOk()).andReturn().getRequest().getSession();
        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(jsonPath("$.loggedIn").value(true))
                .andExpect(jsonPath("$.admin").value(false));
        mvc.perform(post("/api/draws").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/members").session(session)).andExpect(status().isForbidden());
    }

    @Test
    void 가입_규칙() throws Exception {
        signUp("dup_user", "password123").andExpect(status().isCreated());
        signUp("dup_user", "password123").andExpect(status().isBadRequest());   // 중복
        signUp("admin", "password123").andExpect(status().isBadRequest());      // 관리자 아이디
        signUp("ab", "password123").andExpect(status().isBadRequest());         // 너무 짧은 아이디
        signUp("한글아이디", "password123").andExpect(status().isBadRequest());   // 허용 안 되는 문자
        signUp("shortpw", "1234").andExpect(status().isBadRequest());           // 짧은 비밀번호
    }

    @Test
    void 관리자는_설정_파일_계정으로_DB에_생성되고_회원목록을_본다() throws Exception {
        assertEquals(Member.Role.ADMIN, members.findByUsername("admin").orElseThrow().getRole());
        mvc.perform(get("/api/admin/members").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].password").doesNotExist());
    }

    @Test
    void DB_콘솔은_관리자만_열린다() throws Exception {
        mvc.perform(get("/h2-console/")).andExpect(status().is3xxRedirection());              // 로그인 화면으로
        mvc.perform(get("/h2-console/").with(user("u").roles("USER"))).andExpect(status().isForbidden());
        // MockMvc에는 H2 콘솔 서블릿이 없어 404가 나오지만, 보안 검사는 통과했다는 뜻 (실제 서버에서는 콘솔 화면)
        mvc.perform(get("/h2-console/").with(user("admin").roles("ADMIN"))).andExpect(status().isNotFound());
    }
}
