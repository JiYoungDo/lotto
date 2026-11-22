package com.example.lotto;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class AnalysisService {

    private static final double TOTAL = 8_145_060.0;   // 45개 중 6개를 고르는 전체 조합 수

    /** 무작위 한 장의 등수별 당첨 조합 수 (1등~5등) */
    public static final long[] RANDOM_PRIZES = {1, 6, 228, 11_115, 182_780};
    /** 무작위 한 장이 5등 이상일 확률 */
    public static final double RANDOM_WIN_RATE = Arrays.stream(RANDOM_PRIZES).sum() / TOTAL;

    /**
     * 후보에서 빼는 조합 (6개를 45비트 마스크, 번호 n → n번째 비트로 나타냄)
     *  - 과거 당첨 조합과 완전히 같은 6개
     *  - 모양 조합: 5개 이상 연속된 번호가 든 조합 1,600개 (6연속 40개 포함)
     *              + 간격이 일정한 등차수열 180개 (간격 1인 6연속 40개는 위와 겹침) = 1,740개
     */
    private static final Set<Long> PATTERN_MASKS = buildPatternMasks();
    public static final int PATTERN_COMBOS = PATTERN_MASKS.size();

    /**
     * candidates[c] = 케이스 c+1 후보 조합 수 (제외 조합을 뺀 값)
     * prizes[c][r] = 그 후보 중 그 회차 당첨 번호 기준 (r+1)등인 조합 수.
     * bonus = 그 회차 보너스 번호 (없으면 null → 2등을 구분하지 못해 3등으로 셈)
     * excluded = 그 회차 기준 제외 조합 수 (이전 회차 당첨 조합 + 모양 조합, 겹치면 한 번)
     */
    public record DrawAnalysis(int round, List<Integer> numbers, Integer bonus, Set<Integer> center,
                               int centerSize, int centerOverlap,
                               boolean c1, boolean c2, boolean c3, boolean c4, boolean c5,
                               long[] candidates, long[][] prizes, int excluded) {

        public boolean hit(int caseNo) {
            return switch (caseNo) {
                case 1 -> c1;
                case 2 -> c2;
                case 3 -> c3;
                case 4 -> c4;
                case 5 -> c5;
                default -> false;
            };
        }
    }

    /**
     * pValue = 무작위라고 가정했을 때 적중이 hits번 이상 나올 확률 (한쪽 검정)
     * prizeCombos = 판정한 회차 전체에서 이 케이스 후보 중 1~5등이었던 조합 수의 합
     * rankRates = 매 회차 이 케이스 후보에서 무작위로 한 장 샀을 때 1~5등 각각일 확률 (회차 평균, %)
     * winRate = 위와 같이 샀을 때 5등 이상일 확률 (%), randomWinRate = 아무 조합이나 샀을 때 (%)
     * playable = 후보 조합이 1개 이상이라 살 수 있었던 회차 수 (확률은 이 회차들의 평균)
     */
    public record CaseStat(int caseNo, int hits, int total, double actualRate,
                           double expectedRate, double expectedHits, double avgCandidates,
                           double pValue,
                           long[] prizeCombos, double[] rankRates, double winRate,
                           double randomWinRate, int playable) {}

    /** 다음 회차(아직 추첨 전)를 지금까지의 전체 데이터로 판정한 기준 */
    /** counts = 번호 1~45의 출현 횟수, mean·sd = 그 평균과 표준편차, z = 가운데 구간 경계(±z) */
    /** candidates = 제외 조합을 뺀 케이스 1~5 후보 수, excluded = 제외 조합 수 (전체 당첨 조합 + 모양 조합) */
    public record NextOutlook(int round, List<Integer> center, List<Integer> prevNumbers,
                              int prevInCenter, long[] candidates,
                              List<Integer> counts, double mean, double sd, double z, int excluded) {}

    // 조합의 수 nCk
    public static double comb(int n, int k) {
        if (k < 0 || n < k) return 0;
        double r = 1;
        for (int i = 1; i <= k; i++) r = r * (n - k + i) / i;
        return r;
    }

    // k = 가운데 번호 수, m = 그중 직전 회차에도 나온 번호 수
    // 케이스 1~5의 후보 조합 수를 순서대로 돌려줌
    public static long[] candidateCounts(int k, int m) {
        return new long[]{
                Math.round(comb(k, 6)),
                Math.round(comb(k - m, 6)),
                Math.round(m * comb(k - m, 5)),
                Math.round(comb(k, 4) * comb(45 - k, 2)),
                Math.round(comb(k, 5) * (45 - k))
        };
    }

    public double zOf(double confPercent) {
        double q = 1 - (1 + confPercent / 100) / 2;
        double t = Math.sqrt(-2 * Math.log(q));
        return t - (2.515517 + 0.802853 * t + 0.010328 * t * t)
                / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
    }

    // 다음 회차의 가운데 번호와 케이스별 후보 조합 수
    public NextOutlook outlook(List<Draw> draws, double confPercent) {
        if (draws.isEmpty()) return null;
        int[] counts = new int[46];
        for (Draw d : draws) addCounts(counts, d);
        double z = zOf(confPercent);
        Set<Integer> center = centerNumbers(counts, z);
        Draw last = draws.get(draws.size() - 1);
        int m = (int) last.numbers().stream().filter(center::contains).count();
        double mean = mean(counts);
        List<Integer> countList = new ArrayList<>();
        for (int n = 1; n <= 45; n++) countList.add(counts[n]);
        Set<Long> excluded = excludedMasks(draws);
        long[] cand = candidateCounts(center.size(), m);
        long[] minus = excludedInCases(excluded, mask(center), mask(last.numbers()));
        for (int c = 0; c < 5; c++) cand[c] -= minus[c];
        return new NextOutlook(last.getRound() + 1, new TreeSet<>(center).stream().toList(),
                last.numbers(), m, cand,
                countList, mean, sd(counts, mean), z, excluded.size());
    }

    // ---------- 제외 조합 ----------

    /** 번호 묶음 → 비트 마스크 */
    public static long mask(Collection<Integer> nums) {
        long m = 0;
        for (int n : nums) m |= 1L << n;
        return m;
    }

    /** 모양 조합: 5개 이상 연속 + 등차수열 */
    private static Set<Long> buildPatternMasks() {
        Set<Long> s = new LinkedHashSet<>();
        for (int start = 1; start <= 41; start++) {          // 5연속 start~start+4 + 나머지 아무 번호 1개
            long run = 0b11111L << start;
            for (int n = 1; n <= 45; n++) if ((run & (1L << n)) == 0) s.add(run | (1L << n));
        }
        for (int d = 1; d <= 8; d++) {                       // 첫 번호 a, 간격 d: a, a+d, …, a+5d ≤ 45
            for (int a = 1; a + 5 * d <= 45; a++) {
                long m = 0;
                for (int i = 0; i < 6; i++) m |= 1L << (a + i * d);
                s.add(m);
            }
        }
        return Collections.unmodifiableSet(s);
    }

    /** 5개 이상 연속된 번호가 있는지 */
    static boolean hasRun5(long m) {
        return (m & (m >> 1) & (m >> 2) & (m >> 3) & (m >> 4)) != 0;
    }

    /** 간격이 일정한 등차수열인지 */
    static boolean isArithmetic(List<Integer> sorted) {
        int d = sorted.get(1) - sorted.get(0);
        for (int i = 2; i < sorted.size(); i++) if (sorted.get(i) - sorted.get(i - 1) != d) return false;
        return true;
    }

    /**
     * 제외 규칙별: 조합 수, 실제 당첨 횟수, 무작위일 때 기대 횟수.
     * repeat 의 기대 횟수 = 모든 회차 쌍 중 같은 조합이 나올 기대 쌍 수
     */
    public record ExclusionRule(String key, long combos, long actual, double expected) {}

    public List<ExclusionRule> exclusionSummary(List<Draw> draws) {
        int n = draws.size();
        long run = 0, ap = 0, repeat = 0;
        Set<Long> seen = new HashSet<>();
        for (Draw d : draws) {
            long m = mask(d.numbers());
            if (hasRun5(m)) run++;
            if (isArithmetic(d.numbers())) ap++;
            if (!seen.add(m)) repeat++;
        }
        long runCombos = PATTERN_MASKS.stream().filter(AnalysisService::hasRun5).count();
        long apCombos = PATTERN_COMBOS - runCombos + 40;   // 등차수열 중 6연속 40개는 연속 쪽과 겹침
        double pairs = n * (n - 1) / 2.0;
        return List.of(
                new ExclusionRule("repeat", n, repeat, pairs / TOTAL),
                new ExclusionRule("run5", runCombos, run, n * runCombos / TOTAL),
                new ExclusionRule("arithmetic", apCombos, ap, n * apCombos / TOTAL));
    }

    /**
     * 직전 회차 번호가 바로 다음 회차에 다시 나온 정도 (보너스 번호 제외, 당첨 번호 6개끼리 비교).
     * pairs = 비교한 연속 회차 쌍 수 (회차 수 − 1)
     * actual[k] = 직전 회차 번호가 정확히 k개(0~6) 다시 나온 회차 수
     * expected[k] = 무작위일 때 기대 회차 수 = pairs × C(6,k)·C(39,6−k) / C(45,6)
     * atLeastOne / expectedAtLeastOne = 1개 이상 다시 나온 회차 수와 그 기대값
     * repeatedNumbers = 다시 나온 번호 개수의 합
     */
    public record RepeatStat(int pairs, long[] actual, double[] expected,
                             long atLeastOne, double expectedAtLeastOne, long repeatedNumbers) {}

    public RepeatStat repeatSummary(List<Draw> draws) {
        int pairs = Math.max(0, draws.size() - 1);
        long[] actual = new long[7];
        long repeated = 0;
        for (int i = 1; i < draws.size(); i++) {
            int k = Long.bitCount(mask(draws.get(i).numbers()) & mask(draws.get(i - 1).numbers()));
            actual[k]++;
            repeated += k;
        }
        double[] expected = new double[7];
        for (int k = 0; k <= 6; k++) expected[k] = pairs * comb(6, k) * comb(39, 6 - k) / TOTAL;
        return new RepeatStat(pairs, actual, expected, pairs - actual[0], pairs - expected[0], repeated);
    }

    /** 5개 이상 연속이거나 등차수열인 조합인지 (예: 7 8 9 10 11 30, 3 10 17 24 31 38) */
    public static boolean isPattern(Collection<Integer> nums) {
        return nums.size() == 6 && PATTERN_MASKS.contains(mask(nums));
    }

    /** 이 회차들 기준 제외 조합: 모양 조합 + 지금까지의 당첨 조합 */
    public static Set<Long> excludedMasks(List<Draw> pastDraws) {
        Set<Long> s = new HashSet<>(PATTERN_MASKS);
        for (Draw d : pastDraws) s.add(mask(d.numbers()));
        return s;
    }

    /**
     * 사용자가 뺀 번호(removed)가 하나도 없는 조합만 셀 때의 후보 수: [무작위, 케이스1..5].
     * 제외 조합(excluded)도 뺀다. removed 가 비어 있으면 NextOutlook.candidates 와 같다.
     */
    public static long[] candidatesAvoiding(Collection<Integer> center, Collection<Integer> prev,
                                            Collection<Integer> removed, Set<Long> excluded) {
        int k = 0, m = 0, e = 0, all = 0;
        for (int n = 1; n <= 45; n++) {
            if (removed.contains(n)) continue;
            all++;
            if (center.contains(n)) { k++; if (prev.contains(n)) m++; }
            else e++;
        }
        long[] out = {
                Math.round(comb(all, 6)),
                Math.round(comb(k, 6)),
                Math.round(comb(k - m, 6)),
                Math.round(m * comb(k - m, 5)),
                Math.round(comb(k, 4) * comb(e, 2)),
                Math.round(comb(k, 5) * e)
        };
        long rm = mask(removed), cm = mask(center), pm = mask(prev);
        for (long x : excluded) {
            if ((x & rm) != 0) continue;
            out[0]--;
            boolean[] h = caseHits(x, cm, pm);
            for (int c = 0; c < 5; c++) if (h[c]) out[c + 1]--;
        }
        return out;
    }

    /** 이 조합이 제외 대상인지 (번호 생성·소진 집계에서 사용) */
    public static boolean isExcluded(Collection<Integer> nums, Set<Long> excluded) {
        return excluded.contains(mask(nums));
    }

    /** 케이스 판정을 마스크로: [1..5] */
    private static boolean[] caseHits(long combo, long center, long prev) {
        int inCenter = Long.bitCount(combo & center);
        int overlap = Long.bitCount(combo & prev);
        boolean all = inCenter == 6;
        return new boolean[]{all, all && overlap == 0, all && overlap == 1, inCenter == 4, inCenter == 5};
    }

    /** 제외 조합 중 케이스 1~5에 들어가는 수 */
    static long[] excludedInCases(Set<Long> excluded, long center, long prev) {
        long[] out = new long[5];
        for (long e : excluded) {
            boolean[] h = caseHits(e, center, prev);
            for (int c = 0; c < 5; c++) if (h[c]) out[c]++;
        }
        return out;
    }

    /** 제외 조합 중 케이스 c, 등수 r 에 해당하는 수 */
    static long[][] excludedPrizes(Set<Long> excluded, long center, long prev, long win, Integer bonus) {
        long[][] out = new long[5][5];
        for (long e : excluded) {
            int rank = rank(e, win, bonus);
            if (rank < 0) continue;
            boolean[] h = caseHits(e, center, prev);
            for (int c = 0; c < 5; c++) if (h[c]) out[c][rank]++;
        }
        return out;
    }

    /** 등수 0~4 (1~5등), 낙첨이면 -1 */
    static int rank(long combo, long win, Integer bonus) {
        int w = Long.bitCount(combo & win);
        boolean b = bonus != null && (combo & (1L << bonus)) != 0;
        return w == 6 ? 0 : w == 5 ? (b ? 1 : 2) : w == 4 ? 3 : w == 3 ? 4 : -1;
    }

    // 회차마다 적중 확률 p_i가 다를 때, 적중 횟수가 hits 이상일 확률 (포아송-이항 분포를 DP로 정확히 계산)
    static double tailProbability(double[] p, int hits) {
        if (hits <= 0) return 1;
        double[] dist = new double[p.length + 1];
        dist[0] = 1;
        for (int i = 0; i < p.length; i++) {
            for (int k = i + 1; k >= 1; k--) dist[k] = dist[k] * (1 - p[i]) + dist[k - 1] * p[i];
            dist[0] *= 1 - p[i];
        }
        double tail = 0;
        for (int k = hits; k <= p.length; k++) tail += dist[k];
        return Math.min(1, tail);
    }

    /** 출현 횟수 누적: 당첨 번호 6개 + 보너스 번호 */
    static void addCounts(int[] counts, Draw d) {
        for (int n : d.numbersWithBonus()) counts[n]++;
    }

    /** 번호 1~45 출현 횟수의 평균 (보너스가 모두 있으면 회차 수 × 7 ÷ 45) */
    static double mean(int[] counts) {
        long sum = 0;
        for (int n = 1; n <= 45; n++) sum += counts[n];
        return sum / 45.0;
    }

    static double sd(int[] counts, double mean) {
        double sum = 0;
        for (int n = 1; n <= 45; n++) sum += Math.pow(counts[n] - mean, 2);
        return Math.sqrt(sum / 45);
    }

    Set<Integer> centerNumbers(int[] counts, double z) {
        double mean = mean(counts);
        double sd = sd(counts, mean);
        Set<Integer> result = new HashSet<>();
        for (int n = 1; n <= 45; n++) {
            if (counts[n] >= mean - z * sd && counts[n] <= mean + z * sd) result.add(n);
        }
        return result;
    }

    /** 번호 6개가 케이스 1~5 조건을 만족하는지 (center = 가운데 번호, prev = 직전 회차 번호) */
    public static boolean[] caseHits(Collection<Integer> numbers, Collection<Integer> center, Collection<Integer> prev) {
        long inCenter = numbers.stream().filter(center::contains).count();
        long overlap = numbers.stream().filter(prev::contains).count();
        boolean all = inCenter == 6;
        return new boolean[]{all, all && overlap == 0, all && overlap == 1, inCenter == 4, inCenter == 5};
    }

    /**
     * 케이스 1~5 후보 조합 각각을 당첨 번호(win, bonus)와 맞춰 보고 1~5등 조합 수를 센다.
     * 결과 [케이스 0~4][등수 0~4].
     *
     * 45개 번호를 (가운데인지, 직전 회차 번호인지, 당첨/보너스/그 외) 12개 묶음으로 나누고,
     * 묶음마다 몇 개를 고를지 정하며 (고른 수, 가운데 수, 직전 회차와 겹친 수, 당첨 번호 맞힌 수, 보너스 맞힘)
     * 상태별 조합 수를 누적한다 (조합 수 = 묶음별 C(크기, 고른 개수)의 곱).
     */
    public static long[][] prizeCounts(Collection<Integer> center, Collection<Integer> prev,
                                       Collection<Integer> win, Integer bonus) {
        int[] size = new int[12];   // 묶음 = inC*6 + inPrev*3 + kind (kind 0 당첨, 1 보너스, 2 그 외)
        for (int n = 1; n <= 45; n++) {
            int kind = win.contains(n) ? 0 : (bonus != null && bonus == n) ? 1 : 2;
            size[(center.contains(n) ? 6 : 0) + (prev.contains(n) ? 3 : 0) + kind]++;
        }
        // dp[고른 수][가운데 수][겹친 수(2 이상은 2)][맞힌 수][보너스]
        long[][][][][] dp = new long[7][7][3][7][2];
        dp[0][0][0][0][0] = 1;
        for (int g = 0; g < 12; g++) {
            if (size[g] == 0) continue;
            int inC = g / 6, inP = (g / 3) % 2, kind = g % 3;
            long[][][][][] nx = new long[7][7][3][7][2];
            for (int p = 0; p <= 6; p++) for (int c = 0; c <= p; c++) for (int o = 0; o < 3; o++)
                for (int w = 0; w <= p; w++) for (int b = 0; b < 2; b++) {
                    long v = dp[p][c][o][w][b];
                    if (v == 0) continue;
                    for (int t = 0; t <= Math.min(size[g], 6 - p); t++) {
                        int nb = b + (kind == 1 ? t : 0);
                        if (nb > 1) break;
                        long ways = Math.round(comb(size[g], t));
                        nx[p + t][c + inC * t][Math.min(2, o + inP * t)][w + (kind == 0 ? t : 0)][nb] += v * ways;
                    }
                }
            dp = nx;
        }
        long[][] out = new long[5][5];
        for (int c = 0; c <= 6; c++) for (int o = 0; o < 3; o++) for (int w = 0; w <= 6; w++) for (int b = 0; b < 2; b++) {
            long v = dp[6][c][o][w][b];
            if (v == 0) continue;
            int rank = w == 6 ? 0 : w == 5 ? (b == 1 ? 1 : 2) : w == 4 ? 3 : w == 3 ? 4 : -1;
            if (rank < 0) continue;
            boolean[] in = {c == 6, c == 6 && o == 0, c == 6 && o == 1, c == 4, c == 5};
            for (int k = 0; k < 5; k++) if (in[k]) out[k][rank] += v;
        }
        return out;
    }

    public List<DrawAnalysis> analyze(List<Draw> draws, double confPercent, int minHistory) {
        double z = zOf(confPercent);
        int start = Math.max(1, minHistory);
        int[] counts = new int[46];
        List<DrawAnalysis> out = new ArrayList<>();
        Set<Long> excluded = new HashSet<>(PATTERN_MASKS);   // 그 회차 직전까지의 제외 조합

        for (int i = 0; i < draws.size(); i++) {
            Draw d = draws.get(i);
            if (i >= start) {
                Set<Integer> center = centerNumbers(counts, z);
                List<Integer> prev = draws.get(i - 1).numbers();
                int m = (int) prev.stream().filter(center::contains).count();
                long cm = mask(center), pm = mask(prev), wm = mask(d.numbers());

                // 당첨 조합이 제외 조합(과거와 똑같음·모양 조합)이면 어느 케이스 후보에도 없으므로 적중 아님
                boolean[] h = excluded.contains(wm) ? new boolean[5] : caseHits(d.numbers(), center, prev);

                long[] cand = candidateCounts(center.size(), m);
                long[] candMinus = excludedInCases(excluded, cm, pm);
                long[][] prizes = prizeCounts(center, prev, d.numbers(), d.getBonus());
                long[][] prizeMinus = excludedPrizes(excluded, cm, pm, wm, d.getBonus());
                for (int c = 0; c < 5; c++) {
                    cand[c] -= candMinus[c];
                    for (int r = 0; r < 5; r++) prizes[c][r] -= prizeMinus[c][r];
                }
                out.add(new DrawAnalysis(d.getRound(), d.numbers(), d.getBonus(), center,
                        center.size(), m, h[0], h[1], h[2], h[3], h[4],
                        cand, prizes, excluded.size()));
            }
            addCounts(counts, d);
            excluded.add(mask(d.numbers()));
        }
        return out;
    }

    // 케이스별 적중 횟수, 실제 비율, 무작위 기대 비율 등을 계산
    public List<CaseStat> summarize(List<DrawAnalysis> list) {
        int total = list.size();
        List<CaseStat> out = new ArrayList<>();
        for (int c = 1; c <= 5; c++) {
            int hits = 0, playable = 0;
            double exp = 0, cand = 0;
            double[] probs = new double[total];
            long[] prizeCombos = new long[5];
            double[] rankRates = new double[5];
            for (int i = 0; i < total; i++) {
                DrawAnalysis a = list.get(i);
                if (a.hit(c)) hits++;
                long cc = a.candidates()[c - 1];
                probs[i] = cc / TOTAL;
                exp += probs[i];
                cand += cc;
                if (cc > 0) playable++;
                for (int r = 0; r < 5; r++) {
                    long pc = a.prizes()[c - 1][r];
                    prizeCombos[r] += pc;
                    if (cc > 0) rankRates[r] += (double) pc / cc;
                }
            }
            double winRate = 0;
            for (int r = 0; r < 5; r++) {
                rankRates[r] = playable == 0 ? 0 : rankRates[r] / playable * 100;
                winRate += rankRates[r];
            }
            out.add(new CaseStat(c, hits, total,
                    total == 0 ? 0 : hits * 100.0 / total,
                    total == 0 ? 0 : exp / total * 100,
                    exp,
                    total == 0 ? 0 : cand / total,
                    tailProbability(probs, hits),
                    prizeCombos, rankRates, winRate, RANDOM_WIN_RATE * 100, playable));
        }
        return out;
    }
}