package com.example.lotto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GeneratedSetRepository extends JpaRepository<GeneratedSet, Long> {
    List<GeneratedSet> findByMemberIdAndRound(Long memberId, int round);

    @Modifying
    @Query("delete from GeneratedSet g where g.memberId = :memberId")
    int deleteByMemberId(@Param("memberId") Long memberId);
}
