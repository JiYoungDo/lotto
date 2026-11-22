package com.example.lotto;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 출석·미니 게임으로 받은 추가 선점 슬롯 한 건.
 * 받은 날의 '다음 회차'에만 쓸 수 있고, 종류(출석/게임)마다 하루에 한 번만 받는다.
 */
@Entity
@Table(name = "reward_slot",
        indexes = @Index(columnList = "memberId, round"),
        uniqueConstraints = @UniqueConstraint(name = "uk_reward_slot_day", columnNames = {"memberId", "kind", "rewardDay"}))
public class RewardSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false)
    private int round;              // 슬롯을 쓸 수 있는 회차

    @Column(nullable = false, length = 20)
    private String kind;            // attend: 출석, catch: 번호 캐치, runner: 공 점프 러너

    @Column(name = "rewardDay", nullable = false)   // day 는 H2 예약어
    private LocalDate day;          // 받은 날 (한국 시간)

    private int slots;              // 늘어난 줄 수

    private Integer score;          // 게임 보상일 때 그 판의 점수

    @Column(nullable = false)
    private LocalDateTime createdAt;

    protected RewardSlot() {}

    public RewardSlot(Long memberId, int round, String kind, LocalDate day, int slots, Integer score) {
        this.memberId = memberId;
        this.round = round;
        this.kind = kind;
        this.day = day;
        this.slots = slots;
        this.score = score;
        this.createdAt = LocalDateTime.now(Member.ZONE);
    }

    public Long getMemberId() { return memberId; }
    public int getRound() { return round; }
    public String getKind() { return kind; }
    public LocalDate getDay() { return day; }
    public int getSlots() { return slots; }
    public Integer getScore() { return score; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
