package com.example.lotto;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

/** 회원이 산(또는 사려고 고른) 번호 한 줄. 추첨이 끝나면 그 회차 당첨 번호와 비교해 결과를 보여준다. */
@Entity
@Table(name = "ticket",
        indexes = @Index(columnList = "memberId, round"),
        // 한 회차에서 같은 조합은 한 명만 저장할 수 있다
        uniqueConstraints = @UniqueConstraint(name = "uk_ticket_round_numbers",
                columnNames = {"round", "n1", "n2", "n3", "n4", "n5", "n6"}))
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false)
    private int round;                      // 구매한 회차

    private int n1, n2, n3, n4, n5, n6;      // 오름차순

    private Integer caseNo;                 // 생성에 쓴 가설 (1~9), 0 = 무작위, null = 직접 입력

    private Double conf;                    // 생성 당시 신뢰구간

    @Column(length = 50)
    private String memo;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    protected Ticket() {}

    public Ticket(Long memberId, int round, List<Integer> sorted, Integer caseNo, Double conf, String memo) {
        this.memberId = memberId;
        this.round = round;
        this.n1 = sorted.get(0); this.n2 = sorted.get(1); this.n3 = sorted.get(2);
        this.n4 = sorted.get(3); this.n5 = sorted.get(4); this.n6 = sorted.get(5);
        this.caseNo = caseNo;
        this.conf = conf;
        this.memo = memo;
        this.createdAt = LocalDateTime.now(Member.ZONE);
    }

    public Long getId() { return id; }
    public Long getMemberId() { return memberId; }
    public int getRound() { return round; }
    public List<Integer> numbers() { return List.of(n1, n2, n3, n4, n5, n6); }
    public Integer getCaseNo() { return caseNo; }
    public Double getConf() { return conf; }
    public String getMemo() { return memo; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setMemo(String memo) { this.memo = memo; }
}
