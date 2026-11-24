package com.example.lotto;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 회원이 마이페이지에서 만든 번호 한 줄 (생성 기록).
 * 저장하지 않아도 만든 줄 수만큼 그 회차 선점 슬롯을 쓴다. 만든 번호를 저장할 때는 슬롯이 더 들지 않는다.
 */
@Entity
@Table(name = "generated_set", indexes = @Index(columnList = "memberId, round"))
public class GeneratedSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long memberId;

    @Column(nullable = false)
    private int round;                      // 만든 회차 (만들 당시의 다음 회차)

    private int n1, n2, n3, n4, n5, n6;      // 오름차순

    private Integer caseNo;                 // 0 = 무작위, 1~9 가설

    private Double conf;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    protected GeneratedSet() {}

    public GeneratedSet(Long memberId, int round, List<Integer> sorted, Integer caseNo, Double conf) {
        this.memberId = memberId;
        this.round = round;
        this.n1 = sorted.get(0); this.n2 = sorted.get(1); this.n3 = sorted.get(2);
        this.n4 = sorted.get(3); this.n5 = sorted.get(4); this.n6 = sorted.get(5);
        this.caseNo = caseNo;
        this.conf = conf;
        this.createdAt = LocalDateTime.now(Member.ZONE);
    }

    public Long getMemberId() { return memberId; }
    public int getRound() { return round; }
    public List<Integer> numbers() { return List.of(n1, n2, n3, n4, n5, n6); }
    public Integer getCaseNo() { return caseNo; }
    public Double getConf() { return conf; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
