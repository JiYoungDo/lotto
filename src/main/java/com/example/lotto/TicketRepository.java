package com.example.lotto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TicketRepository extends JpaRepository<Ticket, Long> {
    List<Ticket> findByMemberIdOrderByRoundDescIdAsc(Long memberId);
    List<Ticket> findByMemberIdAndRound(Long memberId, int round);

    @Modifying
    @Query("delete from Ticket t where t.memberId = :memberId")
    int deleteByMemberId(@Param("memberId") Long memberId);
}
