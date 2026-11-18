package com.example.lotto;

import org.springframework.security.crypto.password.PasswordEncoder;

/** 테스트용 일반 회원: 지금 약관에 동의한 상태로 만든다 (동의 전이면 쓰기 요청이 막힘) */
final class TestMembers {
    private TestMembers() {}

    static Member user(String username, PasswordEncoder encoder) {
        Member m = new Member(username, encoder.encode("password123"), Member.Role.USER);
        m.agreeTerms(MemberService.TERMS_VERSION);
        return m;
    }
}
