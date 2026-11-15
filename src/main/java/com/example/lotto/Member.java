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

    protected Member() {}

    public Member(String username, String encodedPassword, Role role) {
        this.username = username;
        this.password = encodedPassword;
        this.role = role;
        this.createdAt = LocalDateTime.now(ZONE);
        this.suspended = false;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getPassword() { return password; }
    public Role getRole() { return role; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public boolean isSuspended() { return Boolean.TRUE.equals(suspended); }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public LocalDateTime getAdultConfirmedAt() { return adultConfirmedAt; }
    public void confirmAdult() { this.adultConfirmedAt = LocalDateTime.now(ZONE); }

    public void setSuspended(boolean suspended) { this.suspended = suspended; }
    public void touchLogin() { this.lastLoginAt = LocalDateTime.now(ZONE); }
    public void changePassword(String encodedPassword) { this.password = encodedPassword; }
    public void changeRole(Role role) { this.role = role; }
}
