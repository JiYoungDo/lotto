package com.example.lotto;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class AnalysisService {

    // 한 회차의 분석 결과를 담는 상자 (record: 값만 담는 간단한 클래스)
    public record DrawAnalysis(int round, List<Integer> numbers, Set<Integer> center,
                               boolean c1, boolean c2, boolean c3, boolean c4, boolean c5) {}

    // 신뢰구간(%)을 z값으로 바꾸는 근사 공식 (60 → 약 0.8416)
    public double zOf(double confPercent) {
        double q = 1 - (1 + confPercent / 100) / 2;
        double t = Math.sqrt(-2 * Math.log(q));
        return t - (2.515517 + 0.802853 * t + 0.010328 * t * t)
                / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
    }

    // 출현 횟수가 "평균 ± z·표준편차" 안에 드는 번호(가운데 번호)를 구함
    Set<Integer> centerNumbers(int[] counts, int upto, double z) {
        double mean = upto * 6.0 / 45;
        double sum = 0;
        for (int n = 1; n <= 45; n++) sum += Math.pow(counts[n] - mean, 2);
        double sd = Math.sqrt(sum / 45);
        Set<Integer> result = new HashSet<>();
        for (int n = 1; n <= 45; n++) {
            if (counts[n] >= mean - z * sd && counts[n] <= mean + z * sd) result.add(n);
        }
        return result;
    }

    // 전체 회차를 순서대로 훑으며 케이스 1~5를 판정
    public List<DrawAnalysis> analyze(List<Draw> draws, double confPercent, int minHistory) {
        double z = zOf(confPercent);
        int start = Math.max(1, minHistory);
        int[] counts = new int[46];              // counts[번호] = 지금까지 나온 횟수
        List<DrawAnalysis> out = new ArrayList<>();

        for (int i = 0; i < draws.size(); i++) {
            Draw d = draws.get(i);
            if (i >= start) {
                Set<Integer> center = centerNumbers(counts, i, z);
                List<Integer> prev = draws.get(i - 1).numbers();
                long inCenter = d.numbers().stream().filter(center::contains).count();
                long overlap = d.numbers().stream().filter(prev::contains).count();
                boolean all = inCenter == 6;
                out.add(new DrawAnalysis(d.getRound(), d.numbers(), center,
                        all, all && overlap == 0, all && overlap == 1,
                        inCenter == 4, inCenter == 5));
            }
            for (int n : d.numbers()) counts[n]++;   // 판정 후에 이번 회차를 집계에 반영
        }
        return out;
    }
}