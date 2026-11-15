package com.example.lotto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByMemberIdOrderByIdAsc(Long memberId);
    List<ChatMessage> findAllByOrderByIdDesc();
    long countByMemberIdAndFromAdminTrueAndReadByMemberFalse(Long memberId);

    @Modifying
    @Query("update ChatMessage m set m.readByMember = true where m.memberId = :memberId and m.fromAdmin = true")
    int markReadByMember(@Param("memberId") Long memberId);

    @Modifying
    @Query("update ChatMessage m set m.readByAdmin = true where m.memberId = :memberId and m.fromAdmin = false")
    int markReadByAdmin(@Param("memberId") Long memberId);

    @Modifying
    @Query("delete from ChatMessage m where m.memberId = :memberId")
    int deleteByMemberId(@Param("memberId") Long memberId);
}
