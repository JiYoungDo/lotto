package com.example.lotto;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 로그인 상태 확인, 회원가입, 비밀번호 변경 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final MemberService members;

    public AuthController(MemberService members) { this.members = members; }

    public record SignUpRequest(String username, String nickname, String password, Boolean adult) {}   // adult: 만 19세 이상 확인 (필수)
    public record PasswordRequest(String currentPassword, String newPassword) {}
    public record NicknameRequest(String nickname) {}

    /** 내 닉네임 변경 (로그인한 회원) */
    @PatchMapping("/nickname")
    public Map<String, Object> changeNickname(Authentication auth, @RequestBody NicknameRequest req) {
        String nick = members.changeOwnNickname(auth.getName(), req.nickname());
        return Map.of("message", "닉네임을 '" + nick + "'(으)로 바꿨습니다.", "nickname", nick);
    }

    /** 회원가입: 일반 회원(USER)으로 DB에 저장 */
    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signUp(@RequestBody SignUpRequest req) {
        Member m = members.signUp(req.username(), req.nickname(), req.password(), Boolean.TRUE.equals(req.adult()));
        return ResponseEntity.status(201).body(Map.of("message", m.getUsername() + "님, 가입되었습니다."));
    }

    /** 본인 비밀번호 변경 (로그인한 회원) */
    @PostMapping("/password")
    public Map<String, Object> changePassword(Authentication auth, @RequestBody PasswordRequest req) {
        members.changeOwnPassword(auth.getName(), req.currentPassword(), req.newPassword());
        return Map.of("message", "비밀번호를 바꿨습니다.");
    }

    /** 현재 로그인 상태. 화면이 처음 열릴 때 호출하며, 이때 CSRF 토큰 쿠키도 함께 발급된다. */
    @GetMapping("/me")
    public Map<String, Object> me(Authentication auth, CsrfToken csrf) {
        csrf.getToken();   // 토큰을 읽어야 XSRF-TOKEN 쿠키가 응답에 실린다
        boolean loggedIn = isLoggedIn(auth);
        boolean admin = loggedIn && isAdmin(auth);
        String nickname = loggedIn ? members.nicknames(List.of(auth.getName())).getOrDefault(auth.getName(), auth.getName()) : "";
        return Map.of("loggedIn", loggedIn, "admin", admin, "username", loggedIn ? auth.getName() : "", "nickname", nickname);
    }

    /** 가입 화면에서 아이디·닉네임을 쓸 수 있는지 미리 확인 (둘 중 보낸 것만 확인) */
    @GetMapping("/available")
    public Map<String, Object> available(@RequestParam(required = false) String username,
                                         @RequestParam(required = false) String nickname, Authentication auth) {
        // 로그인한 회원이 닉네임을 바꿀 때는 본인 닉네임을 중복으로 보지 않음
        Member self = isLoggedIn(auth) ? members.find(auth.getName()).orElse(null) : null;
        Map<String, Object> out = new LinkedHashMap<>();
        if (username != null) out.put("username", check(members.usernameProblem(username)));
        if (nickname != null) out.put("nickname", check(members.nicknameProblem(nickname, self)));
        return out;
    }

    private static Map<String, Object> check(String problem) {
        return problem == null ? Map.of("ok", true) : Map.of("ok", false, "message", problem);
    }

    static boolean isLoggedIn(Authentication auth) {
        return auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken);
    }

    static boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}

/** 관리자 전용 회원 관리 (/api/admin/** 은 SecurityConfig에서 ADMIN만 허용) */
@RestController
@RequestMapping("/api/admin/members")
class MemberAdminController {

    private final MemberService members;

    MemberAdminController(MemberService members) { this.members = members; }

    public record RoleRequest(String role) {}
    public record SuspendRequest(boolean suspended) {}

    /** 회원 목록 (비밀번호는 내보내지 않음) */
    @GetMapping
    public List<Map<String, Object>> list() { return members.list(); }

    /** 가입 통계: 전체·오늘·이번 주·이번 달, 최근 14일 일별 가입 수 */
    @GetMapping("/stats")
    public Map<String, Object> stats() { return members.stats(); }

    @PatchMapping("/{id}/role")
    public Map<String, Object> role(@PathVariable Long id, @RequestBody RoleRequest req, Authentication auth) {
        Member m = members.changeRole(id, req.role(), auth.getName());
        return Map.of("message", m.getUsername() + "님의 권한을 " + (m.getRole() == Member.Role.ADMIN ? "관리자" : "일반 회원") + "로 바꿨습니다.");
    }

    @PatchMapping("/{id}/suspend")
    public Map<String, Object> suspend(@PathVariable Long id, @RequestBody SuspendRequest req, Authentication auth) {
        Member m = members.setSuspended(id, req.suspended(), auth.getName());
        return Map.of("message", m.getUsername() + "님을 " + (req.suspended() ? "정지했습니다." : "정지 해제했습니다."));
    }

    @PostMapping("/{id}/reset-password")
    public Map<String, Object> resetPassword(@PathVariable Long id, Authentication auth) {
        String temp = members.resetPassword(id, auth.getName());
        return Map.of("message", "임시 비밀번호를 만들었습니다. 회원에게 전달해 주세요.", "tempPassword", temp);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable Long id, Authentication auth) {
        String name = members.delete(id, auth.getName());
        return Map.of("message", name + "님을 삭제했습니다.");
    }
}
