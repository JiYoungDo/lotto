package com.example.lotto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface RewardSlotRepository extends JpaRepository<RewardSlot, Long> {
    List<RewardSlot> findByMemberIdAndRoundOrderByCreatedAtAsc(Long memberId, int round);
    List<RewardSlot> findByMemberIdAndDay(Long memberId, LocalDate day);
    boolean existsByMemberIdAndKindAndDay(Long memberId, String kind, LocalDate day);

    @Modifying
    @Query("delete from RewardSlot r where r.memberId = :memberId")
    int deleteByMemberId(@Param("memberId") Long memberId);
}
