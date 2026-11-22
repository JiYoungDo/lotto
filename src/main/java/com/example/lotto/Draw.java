package com.example.lotto;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

/** 회차 한 건을 나타내는 클래스 */
@Entity   // 이 클래스는 DB 테이블과 연결된다
public class Draw {
    /** 1회 추첨일. 그 뒤로 매주 토요일마다 한 회차씩 추첨한다 */
    public static final LocalDate FIRST_DATE = LocalDate.of(2002, 12, 7);
    /** 추첨 시각 (매주 토요일 오후 8시 35분, 한국 시간) */
    public static final LocalTime DRAW_TIME = LocalTime.of(20, 35);
    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @Id   // 이 필드가 행을 구분하는 기본 키(고유 번호)
    private int round; // 회차
    private int n1, n2, n3, n4, n5, n6; // 번호 6개
    private Integer bonus; // 보너스 번호 (예전에 올린 회차는 비어 있을 수 있음)
    private LocalDate drawDate; // 추첨일 (비어 있으면 1회부터 매주 토요일로 계산한 날짜를 씀)

    protected Draw() {}
    //protected Draw() {}는 JPA가 DB에서 읽은 행을 객체로 바꿀 때 필요한 빈 생성자.
    // protected라서 일반 코드가 실수로 빈 객체를 만드는 거 막기 위함.

    public Draw(int round, int n1, int n2, int n3, int n4, int n5, int n6) {
        this(round, n1, n2, n3, n4, n5, n6, null);
    }

    public Draw(int round, int n1, int n2, int n3, int n4, int n5, int n6, Integer bonus) {
        this(round, n1, n2, n3, n4, n5, n6, bonus, null);
    }

    public Draw(int round, int n1, int n2, int n3, int n4, int n5, int n6, Integer bonus, LocalDate drawDate) {
        this.round = round; // 내가 값을 넣어 객체를 만들 때 쓰는 생성자
        this.n1 = n1; this.n2 = n2; this.n3 = n3;
        this.n4 = n4; this.n5 = n5; this.n6 = n6;
        this.bonus = bonus;
        this.drawDate = drawDate == null ? defaultDate(round) : drawDate;
    }

    public int getRound() { return round; } // 값을 꺼내는 getter
    public Integer getBonus() { return bonus; }

    /** 추첨일: 등록한 날짜, 없으면 계산한 날짜 */
    public LocalDate getDrawDate() { return drawDate != null ? drawDate : defaultDate(round); }

    /** 회차로 계산한 추첨일: 1회(2002-12-07)부터 7일마다 */
    public static LocalDate defaultDate(int round) {
        return FIRST_DATE.plusWeeks(round - 1L);
    }

    /** 그 날짜의 추첨 시각 (한국 시간 오후 8시 35분) */
    public static ZonedDateTime drawTime(LocalDate date) {
        return ZonedDateTime.of(date, DRAW_TIME, KST);
    }

    /** 당첨 번호 6개 (보너스 제외) */
    public List<Integer> numbers() { return List.of(n1, n2, n3, n4, n5, n6); }

    /** 출현 횟수 집계용: 당첨 번호 6개 + 보너스 번호(있으면) */
    public List<Integer> numbersWithBonus() {
        List<Integer> all = new ArrayList<>(numbers());
        if (bonus != null) all.add(bonus);
        return all;
    }
}
