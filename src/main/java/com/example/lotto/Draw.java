package com.example.lotto;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.util.List;

/** 회차 한 건을 나타내는 클래스 */
@Entity
public class Draw {
    @Id
    private int round;
    private int n1, n2, n3, n4, n5, n6;

    protected Draw() {}

    public Draw(int round, int n1, int n2, int n3, int n4, int n5, int n6) {
        this.round = round;
        this.n1 = n1; this.n2 = n2; this.n3 = n3;
        this.n4 = n4; this.n5 = n5; this.n6 = n6;
    }

    public int getRound() { return round; }
    public List<Integer> numbers() { return List.of(n1, n2, n3, n4, n5, n6); }
}