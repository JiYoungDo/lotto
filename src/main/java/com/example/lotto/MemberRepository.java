package com.example.lotto;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {
    Optional<Member> findByUsername(String username);
    boolean existsByUsername(String username);
    boolean existsByUsernameIgnoreCase(String username);
    boolean existsByNicknameIgnoreCase(String nickname);
    List<Member> findByUsernameIn(Collection<String> usernames);
    List<Member> findByNicknameIsNull();
    List<Member> findAllByOrderByCreatedAtDesc();
}
