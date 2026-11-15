package com.example.lotto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface GameScoreRepository extends JpaRepository<GameScore, Long> {
    Optional<GameScore> findByGameAndMemberId(String game, Long memberId);

    List<GameScore> findTop5ByGameAndBestGreaterThanOrderByBestDescBestAtAsc(String game, int min);

    /** 그 게임에서 나보다 앞선 사람 수 (점수가 높거나, 같은 점수를 먼저 낸 사람) */
    @Query("select count(g) from GameScore g where g.game = :game and (g.best > :best or (g.best = :best and g.bestAt < :bestAt))")
    long countAhead(@Param("game") String game, @Param("best") int best, @Param("bestAt") LocalDateTime bestAt);

    @Modifying
    @Query("delete from GameScore g where g.memberId = :memberId")
    int deleteByMemberId(@Param("memberId") Long memberId);
}
