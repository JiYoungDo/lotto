package com.example.lotto;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.util.List;

/** 회차 한 건을 나타내는 클래스 */
@Entity   // 이 클래스는 DB 테이블과 연결된다
public class Draw {
    @Id   // 이 필드가 행을 구분하는 기본 키(고유 번호)
    private int round; // 회차
    private int n1, n2, n3, n4, n5, n6; // 번호 6개

    protected Draw() {}
    //protected Draw() {}는 JPA가 DB에서 읽은 행을 객체로 바꿀 때 필요한 빈 생성자.
    // protected라서 일반 코드가 실수로 빈 객체를 만드는 거 막기 위함.

    public Draw(int round, int n1, int n2, int n3, int n4, int n5, int n6) {
        this.round = round; // 내가 값을 넣어 객체를 만들 때 쓰는 생성자
        this.n1 = n1; this.n2 = n2; this.n3 = n3;
        this.n4 = n4; this.n5 = n5; this.n6 = n6;
    }

    public int getRound() { return round; } // 값을 꺼내는 getter
    public List<Integer> numbers() { return List.of(n1, n2, n3, n4, n5, n6); }
}