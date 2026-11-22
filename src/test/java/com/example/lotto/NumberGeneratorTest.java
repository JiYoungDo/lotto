package com.example.lotto;

import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class NumberGeneratorTest {

    // 가운데 번호 1~30, 많은 양끝 번호 31~38, 적은 양끝 39~45
    // 직전 회차 번호 3,7,12(가운데) + 33(많은 양끝) + 40,41(적은 양끝)
    final List<Integer> center = IntStream.rangeClosed(1, 30).boxed().toList();
    final List<Integer> high = IntStream.rangeClosed(31, 38).boxed().toList();
    final List<Integer> prev = List.of(3, 7, 12, 33, 40, 41);
    final Random rnd = new Random(7);

    @Test
    void 뺀_번호는_나오지_않는다() {
        Set<Integer> removed = Set.of(1, 3, 5, 7, 32, 40, 44);
        for (int i = 0; i < 300; i++) {
            for (int c = 0; c <= 9; c++) {
                List<Integer> n = NumberGenerator.generate(c, center, high, prev, removed, rnd);
                assertTrue(n.stream().noneMatch(removed::contains), "가설 " + c + ": " + n);
            }
        }
    }

    @Test
    void 만든_번호는_각_가설의_조건을_만족한다() {
        for (int i = 0; i < 300; i++) {
            for (int c = 1; c <= 9; c++) {
                List<Integer> n = NumberGenerator.generate(c, center, high, prev, rnd);
                assertEquals(c, AnalysisServiceTest.bruteCase(n, center, high, prev), "가설 " + c + ": " + n);
            }
            List<Integer> r = NumberGenerator.generate(0, center, high, prev, rnd);
            assertEquals(6, new HashSet<>(r).size());
            assertTrue(r.stream().allMatch(n -> n >= 1 && n <= 45));
        }
    }

    @Test
    void 직전_회차_번호는_가운데든_양끝이든_쓸_수_있다() {
        Set<Integer> seen = new HashSet<>();
        for (int i = 0; i < 500; i++) {
            for (int n : NumberGenerator.generate(3, center, high, prev, rnd)) if (prev.contains(n)) seen.add(n);
        }
        assertEquals(new HashSet<>(prev), seen);   // 적은 양끝인 40, 41도 직전 회차 번호로 뽑힌다
    }

    @Test
    void 번호는_오름차순이고_중복이_없다() {
        for (int c = 0; c <= 9; c++) {
            List<Integer> n = NumberGenerator.generate(c, center, high, prev, rnd);
            assertEquals(n.stream().sorted().toList(), n);
            assertEquals(6, new HashSet<>(n).size());
        }
    }

    @Test
    void 조건을_만족할_수_없으면_오류() {
        // 직전 회차를 뺀 가운데 번호가 5개뿐이면 케이스 1(가운데 6개)은 불가능
        assertThrows(IllegalArgumentException.class,
                () -> NumberGenerator.generate(1, List.of(1, 2, 3, 4, 5, 6), high, List.of(6, 40, 41, 42, 43, 44), rnd));
        // 많은 양끝 번호가 1개뿐이면 케이스 4(많은 양끝 2개)는 불가능
        assertThrows(IllegalArgumentException.class,
                () -> NumberGenerator.generate(4, center, List.of(31), prev, rnd));
        assertThrows(IllegalArgumentException.class, () -> NumberGenerator.generate(10, center, high, prev, rnd));
        assertEquals(0, AnalysisService.candidateCounts(6, 5, 8)[0]);
    }

    @Test
    void 결과_등수() {
        assertEquals("1등", TicketService.rank(6));
        assertEquals("4등", TicketService.rank(4));
        assertEquals("5등", TicketService.rank(3));
        assertEquals("낙첨", TicketService.rank(2));
    }
}
