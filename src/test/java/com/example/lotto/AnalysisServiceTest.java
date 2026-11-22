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


    @Test
    void 후보_조합_수_계산() {
        long[] c = AnalysisService.candidateCounts(27, 3);
        assertArrayEquals(new long[]{296010, 134596, 127512, 2685150, 1453140}, c);
        assertEquals(8145060L, (long) AnalysisService.comb(45, 6));
    }

    @Test
    void 통계_합계가_맞다() {
        var result = service.analyze(randomDraws(300), 60, 30);
        var stats = service.summarize(result);
        assertEquals(5, stats.size());
        assertEquals(result.size(), stats.get(0).total());
        assertEquals(result.stream().filter(AnalysisService.DrawAnalysis::c1).count(),
                stats.get(0).hits());
    }

    @Test
    void 등수별_조합_수는_전체_조합을_직접_세어본_값과_같다() {
        Set<Integer> center = new HashSet<>(List.of(2, 3, 5, 7, 8, 11, 13, 14, 17, 19, 20, 22, 23, 26, 28, 29,
                31, 33, 34, 36, 38, 40, 41, 43));
        List<Integer> prev = List.of(3, 9, 14, 22, 30, 41);
        List<Integer> win = List.of(2, 7, 14, 30, 33, 44);
        int bonus = 22;

        long[][] brute = new long[5][5];
        long[] total = new long[5];
        int[] x = new int[6];
        for (x[0] = 1; x[0] <= 40; x[0]++) for (x[1] = x[0] + 1; x[1] <= 41; x[1]++)
        for (x[2] = x[1] + 1; x[2] <= 42; x[2]++) for (x[3] = x[2] + 1; x[3] <= 43; x[3]++)
        for (x[4] = x[3] + 1; x[4] <= 44; x[4]++) for (x[5] = x[4] + 1; x[5] <= 45; x[5]++) {
            List<Integer> nums = List.of(x[0], x[1], x[2], x[3], x[4], x[5]);
            boolean[] h = AnalysisService.caseHits(nums, center, prev);
            int w = 0; boolean b = false;
            for (int n : x) { if (win.contains(n)) w++; if (n == bonus) b = true; }
            int rank = w == 6 ? 0 : w == 5 ? (b ? 1 : 2) : w == 4 ? 3 : w == 3 ? 4 : -1;
            for (int c = 0; c < 5; c++) if (h[c]) {
                total[c]++;
                if (rank >= 0) brute[c][rank]++;
            }
        }
        long[][] dp = AnalysisService.prizeCounts(center, prev, win, bonus);
        for (int c = 0; c < 5; c++) assertArrayEquals(brute[c], dp[c], "케이스 " + (c + 1));
        int m = (int) prev.stream().filter(center::contains).count();
        assertArrayEquals(AnalysisService.candidateCounts(center.size(), m), total);
    }

    @Test
    void 무작위_전체의_등수별_조합_수() {
        Set<Integer> all = new HashSet<>();
        for (int n = 1; n <= 45; n++) all.add(n);
        // 가운데 번호 = 전체이면 케이스 1 후보 = 전체 8,145,060개
        long[][] p = AnalysisService.prizeCounts(all, List.of(), List.of(1, 2, 3, 4, 5, 6), 7);
        assertArrayEquals(AnalysisService.RANDOM_PRIZES, p[0]);
    }

    @Test
    void 일등_조합은_적중한_케이스에만_1개_있다() {
        for (var a : service.analyze(randomDraws(200, true), 60, 30)) {
            for (int c = 1; c <= 5; c++) {
                assertEquals(a.hit(c) ? 1 : 0, a.prizes()[c - 1][0]);
                long sum = Arrays.stream(a.prizes()[c - 1]).sum();
                assertTrue(sum <= a.candidates()[c - 1]);
            }
        }
        var stats = service.summarize(service.analyze(randomDraws(200, true), 60, 30));
        for (var s : stats) {
            assertEquals(s.hits(), s.prizeCombos()[0]);
            assertEquals(Arrays.stream(s.rankRates()).sum(), s.winRate(), 1e-9);
        }
    }

    @Test
    void 보너스_번호도_출현_횟수에_누적된다() {
        List<Draw> draws = randomDraws(100, true);
        var next = service.outlook(draws, 60);
        assertEquals(700, next.counts().stream().mapToInt(Integer::intValue).sum());
        assertEquals(700 / 45.0, next.mean(), 1e-9);
        int[] expect = new int[46];
        for (Draw d : draws) {
            for (int n : d.numbers()) expect[n]++;
            expect[d.getBonus()]++;
        }
        for (int n = 1; n <= 45; n++) assertEquals(expect[n], next.counts().get(n - 1));
    }

    @Test
    void 제외_조합을_뺀_후보와_등수는_전체_조합을_직접_세어본_값과_같다() {
        // 앞 40회는 무작위, 41회 = 6연속, 42회 = 5회와 똑같은 조합, 43회 = 5연속, 44회 = 등차수열
        List<Draw> draws = new ArrayList<>(randomDraws(60, true));
        draws.set(40, new Draw(41, 9, 10, 11, 12, 13, 14, 20));
        List<Integer> d5 = draws.get(4).numbers();
        int b42 = d5.contains(1) ? 2 : 1;
        if (d5.contains(b42)) b42 = 3;
        draws.set(41, new Draw(42, d5.get(0), d5.get(1), d5.get(2), d5.get(3), d5.get(4), d5.get(5), b42));
        draws.set(42, new Draw(43, 3, 20, 21, 22, 23, 24, 30));
        draws.set(43, new Draw(44, 3, 10, 17, 24, 31, 38, 1));

        List<AnalysisService.DrawAnalysis> rows = service.analyze(draws, 60, 30);
        for (var a : rows) {
            if (a.round() >= 41 && a.round() <= 44) {
                for (int c = 1; c <= 5; c++) assertFalse(a.hit(c), a.round() + "회는 제외 조합이라 적중 아님");
            }
        }

        // 45회 판정을 직접 세어 보기: 제외 = 5개 이상 연속 + 등차수열 + 1~44회 당첨 조합
        var a45 = rows.stream().filter(a -> a.round() == 45).findFirst().orElseThrow();
        Set<List<Integer>> excluded = new HashSet<>();
        for (int i = 0; i < 44; i++) excluded.add(draws.get(i).numbers());

        List<Integer> prev = draws.get(43).numbers(), win = draws.get(44).numbers();
        int bonus = draws.get(44).getBonus();
        long[] cand = new long[5];
        long[][] prizes = new long[5][5];
        long patterns = 0;
        Set<List<Integer>> excludedTotal = new HashSet<>(excluded);
        int[] x = new int[6];
        for (x[0] = 1; x[0] <= 40; x[0]++) for (x[1] = x[0] + 1; x[1] <= 41; x[1]++)
        for (x[2] = x[1] + 1; x[2] <= 42; x[2]++) for (x[3] = x[2] + 1; x[3] <= 43; x[3]++)
        for (x[4] = x[3] + 1; x[4] <= 44; x[4]++) for (x[5] = x[4] + 1; x[5] <= 45; x[5]++) {
            List<Integer> nums = List.of(x[0], x[1], x[2], x[3], x[4], x[5]);
            int run = 1, best = 1;
            for (int i = 1; i < 6; i++) { run = x[i] == x[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); }
            boolean ap = true;
            for (int i = 2; i < 6; i++) ap &= x[i] - x[i - 1] == x[1] - x[0];
            if (best >= 5 || ap) { patterns++; excludedTotal.add(nums); continue; }
            if (excluded.contains(nums)) continue;
            boolean[] h = AnalysisService.caseHits(nums, a45.center(), prev);
            int rank = AnalysisService.rank(AnalysisService.mask(nums), AnalysisService.mask(win), bonus);
            for (int c = 0; c < 5; c++) if (h[c]) {
                cand[c]++;
                if (rank >= 0) prizes[c][rank]++;
            }
        }
        assertEquals(1740, patterns);
        assertEquals(1740, AnalysisService.PATTERN_COMBOS);
        assertEquals(excludedTotal.size(), a45.excluded());
        assertArrayEquals(cand, a45.candidates());
        for (int c = 0; c < 5; c++) assertArrayEquals(prizes[c], a45.prizes()[c], "케이스 " + (c + 1));
    }

    @Test
    void 뺀_번호를_반영한_후보_수는_직접_세어본_값과_같다() {
        List<Draw> draws = randomDraws(80);
        var next = service.outlook(draws, 60);
        Set<Long> excluded = AnalysisService.excludedMasks(draws);

        // 뺀 번호가 없으면 다음 회차 후보 수와 같다
        long[] none = AnalysisService.candidatesAvoiding(next.center(), next.prevNumbers(), Set.of(), excluded);
        assertEquals(8145060L - next.excluded(), none[0]);
        for (int c = 0; c < 5; c++) assertEquals(next.candidates()[c], none[c + 1]);

        // 가운데 번호 2개, 양끝 번호 1개, 직전 회차 번호 1개를 빼고 전부 세어 보기
        List<Integer> center = next.center(), prev = next.prevNumbers();
        Set<Integer> removed = new HashSet<>(List.of(center.get(0), center.get(3)));
        for (int n = 1; n <= 45; n++) if (!center.contains(n)) { removed.add(n); break; }
        removed.add(prev.get(0));

        long[] brute = new long[6];
        int[] x = new int[6];
        for (x[0] = 1; x[0] <= 40; x[0]++) for (x[1] = x[0] + 1; x[1] <= 41; x[1]++)
        for (x[2] = x[1] + 1; x[2] <= 42; x[2]++) for (x[3] = x[2] + 1; x[3] <= 43; x[3]++)
        for (x[4] = x[3] + 1; x[4] <= 44; x[4]++) for (x[5] = x[4] + 1; x[5] <= 45; x[5]++) {
            List<Integer> nums = List.of(x[0], x[1], x[2], x[3], x[4], x[5]);
            if (nums.stream().anyMatch(removed::contains)) continue;
            if (AnalysisService.isExcluded(nums, excluded)) continue;
            brute[0]++;
            boolean[] h = AnalysisService.caseHits(nums, center, prev);
            for (int c = 0; c < 5; c++) if (h[c]) brute[c + 1]++;
        }
        assertArrayEquals(brute, AnalysisService.candidatesAvoiding(center, prev, removed, excluded));
    }

    @Test
    void 모양_조합_판별() {
        assertTrue(AnalysisService.isPattern(List.of(40, 41, 42, 43, 44, 45)));   // 6연속
        assertTrue(AnalysisService.isPattern(List.of(3, 1, 2, 6, 5, 4)));
        assertTrue(AnalysisService.isPattern(List.of(1, 2, 3, 4, 5, 7)));         // 5연속 + 1
        assertTrue(AnalysisService.isPattern(List.of(9, 20, 21, 22, 23, 24)));
        assertTrue(AnalysisService.isPattern(List.of(3, 10, 17, 24, 31, 38)));    // 간격 7
        assertTrue(AnalysisService.isPattern(List.of(1, 9, 17, 25, 33, 41)));     // 간격 8
        assertFalse(AnalysisService.isPattern(List.of(1, 2, 3, 4, 6, 7)));        // 4연속까지는 허용
    }

    @Test
    void 제외_규칙별_집계() {
        List<Draw> draws = new ArrayList<>(randomDraws(10));
        draws.add(new Draw(11, 1, 2, 3, 4, 5, 9));
        draws.add(new Draw(12, 3, 10, 17, 24, 31, 38));
        Draw d3 = draws.get(2);
        List<Integer> n3 = d3.numbers();
        draws.add(new Draw(13, n3.get(0), n3.get(1), n3.get(2), n3.get(3), n3.get(4), n3.get(5)));
        var rules = service.exclusionSummary(draws);
        assertEquals(List.of("repeat", "run5", "arithmetic"), rules.stream().map(AnalysisService.ExclusionRule::key).toList());
        assertEquals(1, rules.get(0).actual());
        assertEquals(1600, rules.get(1).combos());
        assertEquals(1, rules.get(1).actual());
        assertEquals(180, rules.get(2).combos());
        assertEquals(1, rules.get(2).actual());
    }

    @Test
    void 직전_회차_번호_반복_집계() {
        var draws = List.of(
                new Draw(1, 1, 2, 3, 4, 5, 6),
                new Draw(2, 1, 2, 10, 11, 12, 13),     // 직전과 2개 겹침
                new Draw(3, 20, 21, 22, 23, 24, 25),   // 0개
                new Draw(4, 25, 30, 31, 32, 33, 34));  // 1개
        var r = service.repeatSummary(draws);
        assertEquals(3, r.pairs());
        assertEquals(1, r.actual()[0]);
        assertEquals(1, r.actual()[1]);
        assertEquals(1, r.actual()[2]);
        assertEquals(2, r.atLeastOne());
        assertEquals(3, r.repeatedNumbers());
        double sum = 0;
        for (double e : r.expected()) sum += e;
        assertEquals(3.0, sum, 1e-9);
        assertEquals(3 * (1 - 3_262_623 / 8_145_060.0), r.expectedAtLeastOne(), 1e-9);
    }

    private List<Draw> randomDraws(int count) {
        return randomDraws(count, false);
    }

    private List<Draw> randomDraws(int count, boolean withBonus) {
        Random rnd = new Random(42);
        List<Draw> list = new ArrayList<>();
        for (int r = 1; r <= count; r++) {
            List<Integer> pool = new ArrayList<>();
            for (int i = 1; i <= 45; i++) pool.add(i);
            Collections.shuffle(pool, rnd);
            List<Integer> s = pool.subList(0, 6).stream().sorted().toList();
            list.add(new Draw(r, s.get(0), s.get(1), s.get(2), s.get(3), s.get(4), s.get(5),
                    withBonus ? pool.get(6) : null));
        }
        return list;
    }

    @Test
    void 꼬리확률_계산() {
        double[] half = {0.5, 0.5, 0.5};
        assertEquals(1.0, AnalysisService.tailProbability(half, 0), 1e-12);
        assertEquals(0.5, AnalysisService.tailProbability(half, 2), 1e-12);   // 3/8 + 1/8
        assertEquals(0.125, AnalysisService.tailProbability(half, 3), 1e-12);
        assertEquals(0.0, AnalysisService.tailProbability(half, 4), 1e-12);
    }

    @Test
    void 다음회차_기준은_전체_데이터로_계산한다() {
        List<Draw> draws = randomDraws(100);
        var next = service.outlook(draws, 60);
        assertEquals(101, next.round());
        assertEquals(draws.get(99).numbers(), next.prevNumbers());
        long patternDraws = draws.stream().filter(d -> AnalysisService.isPattern(d.numbers())).count();
        assertEquals(1740 + 100 - patternDraws, next.excluded());   // 모양 조합 1,740개 + 당첨 조합 100개
        long[] raw = AnalysisService.candidateCounts(next.center().size(), next.prevInCenter());
        for (int c = 0; c < 5; c++) assertTrue(next.candidates()[c] <= raw[c]);
        assertEquals(45, next.counts().size());
        assertEquals(600, next.counts().stream().mapToInt(Integer::intValue).sum());
        // 가운데 번호 = |출현 횟수 - 평균| <= z·sd 인 번호
        for (int n = 1; n <= 45; n++) {
            boolean inside = Math.abs(next.counts().get(n - 1) - next.mean()) <= next.z() * next.sd();
            assertEquals(inside, next.center().contains(n));
        }
        assertNull(service.outlook(List.of(), 60));
    }
}
