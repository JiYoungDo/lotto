package com.example.lotto;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class AnalysisServiceTest {

    AnalysisService service = new AnalysisService();

    @Test
    void z값_60퍼센트는_약_0점8416() {
        assertEquals(0.8416, service.zOf(60), 0.001);
    }

    @Test
    void 최소회차_이전은_분석에서_빠진다() {
        List<Draw> draws = randomDraws(100);
        List<AnalysisService.DrawAnalysis> result = service.analyze(draws, 60, 30);
        assertEquals(70, result.size());
        assertEquals(31, result.get(0).round());
    }

    @Test
    void 케이스_관계가_맞다() {
        for (AnalysisService.DrawAnalysis a : service.analyze(randomDraws(300), 60, 30)) {
            if (a.c2() || a.c3()) assertTrue(a.c1());   // 케이스 2·3은 케이스 1의 부분집합
            assertFalse(a.c2() && a.c3());              // 2와 3은 동시에 안 됨
            if (a.c4() || a.c5()) assertFalse(a.c1());  // 4·5는 1과 겹치지 않음
        }
    }

    private List<Draw> randomDraws(int count) {
        Random rnd = new Random(42);
        List<Draw> list = new ArrayList<>();
        for (int r = 1; r <= count; r++) {
            List<Integer> pool = new ArrayList<>();
            for (int i = 1; i <= 45; i++) pool.add(i);
            Collections.shuffle(pool, rnd);
            List<Integer> s = pool.subList(0, 6).stream().sorted().toList();
            list.add(new Draw(r, s.get(0), s.get(1), s.get(2), s.get(3), s.get(4), s.get(5)));
        }
        return list;
    }
}