package com.example.lotto;

import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class NumberGeneratorTest {

    // 가운데 번호 1~30, 직전 회차 번호 3,7,12(가운데) + 40,41,42(양끝)
    final List<Integer> center = IntStream.rangeClosed(1, 30).boxed().toList();
    final List<Integer> prev = List.of(3, 7, 12, 40, 41, 42);
    final Random rnd = new Random(7);

    private long inCenter(List<Integer> n) { return n.stream().filter(center::contains).count(); }
    private long overlap(List<Integer> n) { return n.stream().filter(prev::contains).count(); }

    @Test
    void 뺀_번호는_나오지_않는다() {
        Set<Integer> removed = Set.of(1, 3, 5, 7, 40, 44);
        for (int i = 0; i < 300; i++) {
            for (int c = 0; c <= 5; c++) {
                List<Integer> n = NumberGenerator.generate(c, center, prev, removed, rnd);
                assertTrue(n.stream().noneMatch(removed::contains), "가설 " + c + ": " + n);
                if (c == 3) assertEquals(1, overlap(n));   // 직전 회차 가운데 번호 중 남은 12만 쓸 수 있음
            }
        }
    }

    @Test
    void 만든_번호는_각_가설의_조건을_만족한다() {
        for (int i = 0; i < 500; i++) {
            List<Integer> c1 = NumberGenerator.generate(1, center, prev, rnd);
            assertEquals(6, inCenter(c1));

            List<Integer> c2 = NumberGenerator.generate(2, center, prev, rnd);
            assertEquals(6, inCenter(c2));
            assertEquals(0, overlap(c2));

            List<Integer> c3 = NumberGenerator.generate(3, center, prev, rnd);
            assertEquals(6, inCenter(c3));
            assertEquals(1, overlap(c3));

            assertEquals(4, inCenter(NumberGenerator.generate(4, center, prev, rnd)));
            assertEquals(5, inCenter(NumberGenerator.generate(5, center, prev, rnd)));

            List<Integer> r = NumberGenerator.generate(0, center, prev, rnd);
            assertEquals(6, new HashSet<>(r).size());
            assertTrue(r.stream().allMatch(n -> n >= 1 && n <= 45));
        }
    }

    @Test
    void 번호는_오름차순이고_중복이_없다() {
        for (int c = 0; c <= 5; c++) {
            List<Integer> n = NumberGenerator.generate(c, center, prev, rnd);
            assertEquals(n.stream().sorted().toList(), n);
            assertEquals(6, new HashSet<>(n).size());
        }
    }

    @Test
    void 조건을_만족할_수_없으면_오류() {
        // 가운데 번호가 5개뿐이면 케이스 1(가운데 6개)은 불가능
        assertThrows(IllegalArgumentException.class,
                () -> NumberGenerator.generate(1, List.of(1, 2, 3, 4, 5), prev, rnd));
        assertEquals(0, NumberGenerator.candidates(1, 5, 0));
    }

    @Test
    void 결과_등수() {
        assertEquals("1등", TicketService.rank(6));
        assertEquals("4등", TicketService.rank(4));
        assertEquals("5등", TicketService.rank(3));
        assertEquals("낙첨", TicketService.rank(2));
    }
}
