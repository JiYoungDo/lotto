package com.example.lotto;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** 회원 한 명. 비밀번호는 BCrypt로 암호화한 값만 저장한다. */
@Entity
@Table(name = "member")   // USER는 DB 예약어라 member로
public class Member {

    public enum Role { USER, ADMIN }

    /** 가입일·오늘·이번 주 계산 기준 시간대 */
    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String username;

    @Column(nullable = false)
    private String password;   // 암호화된 비밀번호 ({bcrypt}...)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Role role;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private Boolean suspended;            // 정지 여부 (기존 행은 null → 정지 아님)

    private LocalDateTime lastLoginAt;    // 마지막 로그인

    private LocalDateTime adultConfirmedAt;   // 가입할 때 "만 19세 이상" 확인한 시각 (이 기능 전에 가입한 회원은 null)

    // 가입할 때 동의한 시각과 그때의 약관 버전(시행일). 이 기능 전에 가입한 회원은 null
    private LocalDateTime termsAgreedAt;      // 이용약관 동의
    private LocalDateTime privacyAgreedAt;    // 개인정보 수집·이용 동의
    @Column(length = 20)
    private String termsVersion;

    @Column(unique = true, length = 20)
    private String nickname;              // 커뮤니티·게임 순위에 보이는 이름 (다른 회원과 겹치지 않음)

    protected Member() {}

    public Member(String username, String encodedPassword, Role role) {
        this.username = username;
        this.password = encodedPassword;
        this.role = role;
        this.createdAt = LocalDateTime.now(ZONE);
        this.suspended = false;
        this.nickname = username;   // 따로 정하지 않으면 아이디와 같게 (가입할 때는 회원이 정한 닉네임으로 바꿈)
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getPassword() { return password; }
    public Role getRole() { return role; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public boolean isSuspended() { return Boolean.TRUE.equals(suspended); }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public LocalDateTime getAdultConfirmedAt() { return adultConfirmedAt; }
    public LocalDateTime getTermsAgreedAt() { return termsAgreedAt; }
    public LocalDateTime getPrivacyAgreedAt() { return privacyAgreedAt; }
    public String getTermsVersion() { return termsVersion; }
    /** 화면에 보일 이름. 닉네임 기능 전에 가입해 아직 닉네임이 없으면 아이디 */
    public String getNickname() { return nickname != null ? nickname : username; }
    public boolean hasNickname() { return nickname != null; }
    public void changeNickname(String nickname) { this.nickname = nickname; }
    public void confirmAdult() { this.adultConfirmedAt = LocalDateTime.now(ZONE); }
    /** 이용약관·개인정보 수집·이용 동의를 기록 */
    public void agreeTerms(String version) {
        LocalDateTime now = LocalDateTime.now(ZONE);
        this.termsAgreedAt = now;
        this.privacyAgreedAt = now;
        this.termsVersion = version;
    }

    public void setSuspended(boolean suspended) { this.suspended = suspended; }
    public void touchLogin() { this.lastLoginAt = LocalDateTime.now(ZONE); }
    public void changePassword(String encodedPassword) { this.password = encodedPassword; }
    public void changeRole(Role role) { this.role = role; }
}
