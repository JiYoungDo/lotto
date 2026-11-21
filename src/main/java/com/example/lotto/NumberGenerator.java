package com.example.lotto;

import java.util.*;

/**
 * 가설(케이스)의 조건을 만족하는 번호 6개를 무작위로 뽑는다.
 * 각 케이스의 후보 조합 전체에서 고르게(균등하게) 뽑히도록, 조건에 맞는 그룹에서 정해진 개수씩 뽑는다.
 *
 *  케이스 0: 무작위 (1~45에서 6개)
 *  케이스 1: 가운데 번호에서 6개
 *  케이스 2: 직전 회차에 없던 가운데 번호에서 6개
 *  케이스 3: 직전 회차에 나온 가운데 번호 1개 + 직전 회차에 없던 가운데 번호 5개
 *  케이스 4: 가운데 4개 + 양끝 2개
 *  케이스 5: 가운데 5개 + 양끝 1개
 */
public final class NumberGenerator {

    private NumberGenerator() {}

    public static List<Integer> generate(int caseNo, Collection<Integer> center, Collection<Integer> prev, Random rnd) {
        return generate(caseNo, center, prev, Set.of(), rnd);
    }

    /** removed = 사용자가 뺀 번호. 이 번호들은 어느 그룹에서도 뽑지 않는다. */
    public static List<Integer> generate(int caseNo, Collection<Integer> center, Collection<Integer> prev,
                                         Collection<Integer> removed, Random rnd) {
        Set<Integer> c = new TreeSet<>(center);
        c.removeAll(removed);
        List<Integer> edge = new ArrayList<>(), centerPrev = new ArrayList<>(), centerFresh = new ArrayList<>();
        for (int n = 1; n <= 45; n++) {
            if (removed.contains(n)) continue;
            if (!c.contains(n)) edge.add(n);
            else if (prev.contains(n)) centerPrev.add(n);
            else centerFresh.add(n);
        }
        List<Integer> all = new ArrayList<>();
        for (int n = 1; n <= 45; n++) if (!removed.contains(n)) all.add(n);

        List<Integer> out = switch (caseNo) {
            case 0 -> pick(all, 6, rnd);
            case 1 -> pick(new ArrayList<>(c), 6, rnd);
            case 2 -> pick(centerFresh, 6, rnd);
            case 3 -> join(pick(centerPrev, 1, rnd), pick(centerFresh, 5, rnd));
            case 4 -> join(pick(new ArrayList<>(c), 4, rnd), pick(edge, 2, rnd));
            case 5 -> join(pick(new ArrayList<>(c), 5, rnd), pick(edge, 1, rnd));
            default -> throw new IllegalArgumentException("가설은 0(무작위) 또는 1~5 입니다.");
        };
        return out.stream().sorted().toList();
    }

    /** 조건만으로 센 조합 수 (공식 값, 제외 조합은 빼지 않음 — 실제 후보 수는 NextOutlook.candidates) */
    public static long candidates(int caseNo, int centerSize, int prevInCenter) {
        if (caseNo == 0) return 8_145_060L;
        return AnalysisService.candidateCounts(centerSize, prevInCenter)[caseNo - 1];
    }

    private static List<Integer> pick(List<Integer> pool, int k, Random rnd) {
        if (pool.size() < k) throw new IllegalArgumentException("이 가설을 만족하는 번호가 부족해 만들 수 없습니다. 신뢰구간을 바꿔 보세요.");
        List<Integer> copy = new ArrayList<>(pool);
        Collections.shuffle(copy, rnd);
        return copy.subList(0, k);
    }

    private static List<Integer> join(List<Integer> a, List<Integer> b) {
        List<Integer> r = new ArrayList<>(a);
        r.addAll(b);
        return r;
    }
}
