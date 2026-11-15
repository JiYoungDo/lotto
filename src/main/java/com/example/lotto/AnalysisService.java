package com.example.lotto;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class AnalysisService {

    private static final double TOTAL = 8_145_060.0;   // 45개 중 6개를 고르는 전체 조합 수

    public record DrawAnalysis(int round, List<Integer> numbers, Set<Integer> center,
                               int centerSize, int centerOverlap,
                               boolean c1, boolean c2, boolean c3, boolean c4, boolean c5) {

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

        public long[] candidates() {
            return AnalysisService.candidateCounts(centerSize, centerOverlap);
        }
    }

    /** pValue = 무작위라고 가정했을 때 적중이 hits번 이상 나올 확률 (한쪽 검정) */
    public record CaseStat(int caseNo, int hits, int total, double actualRate,
                           double expectedRate, double expectedHits, double avgCandidates,
                           double pValue) {}

    /** 다음 회차(아직 추첨 전)를 지금까지의 전체 데이터로 판정한 기준 */
    /** counts = 번호 1~45의 출현 횟수, mean·sd = 그 평균과 표준편차, z = 가운데 구간 경계(±z) */
    public record NextOutlook(int round, List<Integer> center, List<Integer> prevNumbers,
                              int prevInCenter, long[] candidates,
                              List<Integer> counts, double mean, double sd, double z) {}

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
        for (Draw d : draws) for (int n : d.numbers()) counts[n]++;
        double z = zOf(confPercent);
        Set<Integer> center = centerNumbers(counts, draws.size(), z);
        Draw last = draws.get(draws.size() - 1);
        int m = (int) last.numbers().stream().filter(center::contains).count();
        double mean = draws.size() * 6.0 / 45;
        List<Integer> countList = new ArrayList<>();
        for (int n = 1; n <= 45; n++) countList.add(counts[n]);
        return new NextOutlook(last.getRound() + 1, new TreeSet<>(center).stream().toList(),
                last.numbers(), m, candidateCounts(center.size(), m),
                countList, mean, sd(counts, mean), z);
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

    static double sd(int[] counts, double mean) {
        double sum = 0;
        for (int n = 1; n <= 45; n++) sum += Math.pow(counts[n] - mean, 2);
        return Math.sqrt(sum / 45);
    }

    Set<Integer> centerNumbers(int[] counts, int upto, double z) {
        double mean = upto * 6.0 / 45;
        double sd = sd(counts, mean);
        Set<Integer> result = new HashSet<>();
        for (int n = 1; n <= 45; n++) {
            if (counts[n] >= mean - z * sd && counts[n] <= mean + z * sd) result.add(n);
        }
        return result;
    }

    public List<DrawAnalysis> analyze(List<Draw> draws, double confPercent, int minHistory) {
        double z = zOf(confPercent);
        int start = Math.max(1, minHistory);
        int[] counts = new int[46];
        List<DrawAnalysis> out = new ArrayList<>();

        for (int i = 0; i < draws.size(); i++) {
            Draw d = draws.get(i);
            if (i >= start) {
                Set<Integer> center = centerNumbers(counts, i, z);
                List<Integer> prev = draws.get(i - 1).numbers();
                int m = (int) prev.stream().filter(center::contains).count();
                long inCenter = d.numbers().stream().filter(center::contains).count();
                long overlap = d.numbers().stream().filter(prev::contains).count();
                boolean all = inCenter == 6;
                out.add(new DrawAnalysis(d.getRound(), d.numbers(), center,
                        center.size(), m,
                        all, all && overlap == 0, all && overlap == 1,
                        inCenter == 4, inCenter == 5));
            }
            for (int n : d.numbers()) counts[n]++;
        }
        return out;
    }

    // 케이스별 적중 횟수, 실제 비율, 무작위 기대 비율 등을 계산
    public List<CaseStat> summarize(List<DrawAnalysis> list) {
        int total = list.size();
        List<CaseStat> out = new ArrayList<>();
        for (int c = 1; c <= 5; c++) {
            int hits = 0;
            double exp = 0, cand = 0;
            double[] probs = new double[total];
            for (int i = 0; i < total; i++) {
                DrawAnalysis a = list.get(i);
                if (a.hit(c)) hits++;
                long cc = a.candidates()[c - 1];
                probs[i] = cc / TOTAL;
                exp += probs[i];
                cand += cc;
            }
            out.add(new CaseStat(c, hits, total,
                    total == 0 ? 0 : hits * 100.0 / total,
                    total == 0 ? 0 : exp / total * 100,
                    exp,
                    total == 0 ? 0 : cand / total,
                    tailProbability(probs, hits)));
        }
        return out;
    }
}