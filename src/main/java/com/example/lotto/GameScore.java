package com.example.lotto;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** 공 점프 러너 게임: 회원별 최고 점수 한 줄 */
@Entity
@Table(name = "game_score")
public class GameScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long memberId;

    @Column(nullable = false, length = 20)
    private String username;

    private int best;               // 최고 점수

    private int plays;              // 점수를 낸 판 수

    @Column(nullable = false)
    private LocalDateTime bestAt;   // 최고 점수를 낸 시각 (같은 점수면 먼저 낸 사람이 위)

    protected GameScore() {}

    public GameScore(Long memberId, String username) {
        this.memberId = memberId;
        this.username = username;
        this.bestAt = LocalDateTime.now(Member.ZONE);
    }

    public Long getMemberId() { return memberId; }
    public String getUsername() { return username; }
    public int getBest() { return best; }
    public int getPlays() { return plays; }
    public LocalDateTime getBestAt() { return bestAt; }

    /** 한 판 기록. 최고 점수를 넘었으면 true */
    public boolean record(int score) {
        plays++;
        if (score <= best) return false;
        best = score;
        bestAt = LocalDateTime.now(Member.ZONE);
        return true;
    }
}
