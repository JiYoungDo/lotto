package com.example.lotto;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** 마이페이지: 가설별 번호 생성, 구매 번호 저장·관리, 추첨 결과 비교 */
@Service
public class TicketService {

    public static final int MAX_PER_ROUND = 100;   // 한 회차에 저장할 수 있는 줄 수 (1인 구매 한도 10만 원 = 100게임)
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final TicketRepository tickets;
    private final DrawRepository draws;
    private final MemberRepository members;
    private final AnalysisService analysis;

    public TicketService(TicketRepository tickets, DrawRepository draws, MemberRepository members, AnalysisService analysis) {
        this.tickets = tickets;
        this.draws = draws;
        this.members = members;
        this.analysis = analysis;
    }

    public record SaveRequest(Integer round, List<List<Integer>> sets, Integer caseNo, Double conf, String memo) {}

    private Long memberId(String username) {
        return members.findByUsername(username).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다.")).getId();
    }

    /** 그 회차에 누군가 이미 저장한 조합들 */
    private Set<List<Integer>> takenSets(int round) {
        Set<List<Integer>> out = new HashSet<>();
        for (Ticket t : tickets.findByRound(round)) out.add(t.numbers());
        return out;
    }

    /** 소진된 조합 수: [전체, 케이스1..5] (지금 가운데 번호 기준으로 각 조건을 만족하는 저장 조합 수) */
    private long[] usedCounts(Collection<List<Integer>> taken, List<Integer> center, List<Integer> prev) {
        long[] used = new long[6];
        for (List<Integer> nums : taken) {
            used[0]++;
            boolean[] h = AnalysisService.caseHits(nums, center, prev);
            for (int c = 0; c < 5; c++) if (h[c]) used[c + 1]++;
        }
        return used;
    }

    /** 다음 회차 조합 현황: 가설별 전체·소진·남은 조합 수 (누구나 볼 수 있음) */
    public Map<String, Object> pool(double conf) {
        if (conf < 1 || conf > 99) conf = 60;
        List<Draw> all = draws.findAllByOrderByRoundAsc();
        int round = nextRound(all);
        AnalysisService.NextOutlook next = analysis.outlook(all, conf);
        List<Ticket> saved = tickets.findByRound(round);
        Set<List<Integer>> taken = new HashSet<>();
        for (Ticket t : saved) taken.add(t.numbers());

        List<Integer> center = next == null ? List.of() : next.center();
        List<Integer> prev = next == null ? List.of() : next.prevNumbers();
        long[] used = usedCounts(taken, center, prev);

        List<Map<String, Object>> cases = new ArrayList<>();
        cases.add(poolRow(0, 8_145_060L, used[0]));
        for (int c = 1; c <= 5; c++) {
            long total = next == null ? 0 : NumberGenerator.candidates(c, center.size(), next.prevInCenter());
            cases.add(poolRow(c, total, used[c]));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("round", round);
        out.put("conf", conf);
        out.put("centerSize", center.size());
        out.put("savedTickets", saved.size());
        out.put("savers", saved.stream().map(Ticket::getMemberId).distinct().count());
        out.put("cases", cases);
        return out;
    }

    private static Map<String, Object> poolRow(int caseNo, long total, long used) {
        return Map.of("caseNo", caseNo, "total", total, "used", used, "remaining", Math.max(0, total - used));
    }

    private int nextRound(List<Draw> all) {
        return all.isEmpty() ? 1 : all.get(all.size() - 1).getRound() + 1;
    }

    // ---------- 번호 생성 ----------

    public Map<String, Object> generate(int caseNo, int count, double conf) {
        if (count < 1 || count > 10) throw new IllegalArgumentException("한 번에 1~10줄까지 만들 수 있습니다.");
        if (conf < 1 || conf > 99) throw new IllegalArgumentException("신뢰구간은 1~99 사이입니다.");
        if (caseNo < 0 || caseNo > 5) throw new IllegalArgumentException("가설은 0(무작위) 또는 1~5 입니다.");

        List<Draw> all = draws.findAllByOrderByRoundAsc();
        AnalysisService.NextOutlook next = analysis.outlook(all, conf);
        if (next == null && caseNo != 0) throw new IllegalArgumentException("회차 데이터가 없어 가설로 만들 수 없습니다.");

        List<Integer> center = next == null ? List.of() : next.center();
        List<Integer> prev = next == null ? List.of() : next.prevNumbers();
        long candidates = next == null ? 8_145_060L : NumberGenerator.candidates(caseNo, center.size(), next.prevInCenter());
        if (candidates == 0) throw new IllegalArgumentException("지금 기준으로는 이 가설을 만족하는 조합이 없습니다. 신뢰구간을 바꿔 보세요.");

        // 이미 다른 회원(또는 내)가 저장한 조합은 빼고, 서로 다른 조합으로 count개
        int round = nextRound(all);
        Set<List<Integer>> taken = takenSets(round);
        long used = usedCounts(taken, center, prev)[caseNo];
        long remaining = Math.max(0, candidates - used);
        if (remaining == 0) throw new IllegalArgumentException("이 가설의 조합이 모두 소진되었습니다. 다른 가설을 골라 보세요.");

        Set<List<Integer>> sets = new LinkedHashSet<>();
        int target = (int) Math.min(count, remaining);
        for (int tries = 0; sets.size() < target && tries < 5000; tries++) {
            List<Integer> s = NumberGenerator.generate(caseNo, center, prev, RANDOM);
            if (!taken.contains(s)) sets.add(s);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("round", round);
        out.put("caseNo", caseNo);
        out.put("conf", conf);
        out.put("candidates", candidates);
        out.put("used", used);
        out.put("remaining", remaining);
        out.put("probability", candidates / 8_145_060.0);   // 무작위로 나온 당첨 번호가 이 가설에 들어갈 확률
        out.put("prevNumbers", prev);
        out.put("sets", new ArrayList<>(sets));
        return out;
    }

    // ---------- 저장·수정·삭제 ----------

    @Transactional
    public int save(String username, SaveRequest req) {
        Long mid = memberId(username);
        int next = nextRound(draws.findAllByOrderByRoundAsc());
        int round = req.round() == null ? next : req.round();
        if (round < 1 || round > next) throw new IllegalArgumentException("회차는 1~" + next + "회 사이로 입력하세요.");
        if (req.sets() == null || req.sets().isEmpty()) throw new IllegalArgumentException("저장할 번호를 고르세요.");
        if (req.sets().size() > 10) throw new IllegalArgumentException("한 번에 10줄까지 저장할 수 있습니다.");
        Integer caseNo = req.caseNo();
        if (caseNo != null && (caseNo < 0 || caseNo > 5)) throw new IllegalArgumentException("가설 번호가 올바르지 않습니다.");
        String memo = req.memo() == null ? null : req.memo().strip();
        if (memo != null && memo.length() > 50) throw new IllegalArgumentException("메모는 50자까지 쓸 수 있습니다.");
        if (memo != null && memo.isEmpty()) memo = null;

        List<Ticket> existing = tickets.findByMemberIdAndRound(mid, round);
        if (existing.size() + req.sets().size() > MAX_PER_ROUND) {
            throw new IllegalArgumentException("한 회차에는 " + MAX_PER_ROUND + "줄까지 저장할 수 있습니다.");
        }
        Set<List<Integer>> mine = new HashSet<>();
        for (Ticket t : existing) mine.add(t.numbers());
        Set<List<Integer>> taken = takenSets(round);   // 모든 회원이 이 회차에 저장한 조합

        int saved = 0;
        for (List<Integer> nums : req.sets()) {
            List<Integer> sorted = validate(nums);
            if (mine.contains(sorted)) throw new IllegalArgumentException(round + "회에 이미 저장한 번호입니다: " + sorted);
            if (!taken.add(sorted)) {
                throw new IllegalArgumentException(round + "회에 다른 회원이 이미 저장한 조합입니다: " + sorted + " (한 조합은 한 명만 가질 수 있어요)");
            }
            mine.add(sorted);
            tickets.save(new Ticket(mid, round, sorted, caseNo, req.conf(), memo));
            saved++;
        }
        return saved;
    }

    private static List<Integer> validate(List<Integer> n) {
        boolean ok = n != null && n.size() == 6 && n.stream().allMatch(v -> v != null && v >= 1 && v <= 45)
                && new HashSet<>(n).size() == 6;
        if (!ok) throw new IllegalArgumentException("1~45 사이의 서로 다른 번호 6개를 입력하세요.");
        return n.stream().sorted().toList();
    }

    private Ticket own(String username, Long id) {
        Ticket t = tickets.findById(id).orElseThrow(() -> new NoSuchElementException("이미 지워진 번호입니다."));
        if (!t.getMemberId().equals(memberId(username))) throw new SecurityException("본인 번호만 바꿀 수 있습니다.");
        return t;
    }

    @Transactional
    public void updateMemo(String username, Long id, String memo) {
        String m = memo == null ? null : memo.strip();
        if (m != null && m.length() > 50) throw new IllegalArgumentException("메모는 50자까지 쓸 수 있습니다.");
        own(username, id).setMemo(m == null || m.isEmpty() ? null : m);
    }

    @Transactional
    public void delete(String username, Long id) {
        tickets.delete(own(username, id));
    }

    // ---------- 조회 + 결과 ----------

    public Map<String, Object> mine(String username) {
        Long mid = memberId(username);
        List<Draw> all = draws.findAllByOrderByRoundAsc();
        Map<Integer, List<Integer>> drawn = new HashMap<>();
        for (Draw d : all) drawn.put(d.getRound(), d.numbers());
        int next = nextRound(all);

        List<Map<String, Object>> rows = new ArrayList<>();
        // 가설별 성적: [줄 수, 맞힌 개수 합, 3개 이상 맞힌 줄 수, 최고 맞힌 개수]
        Map<String, int[]> perCase = new LinkedHashMap<>();

        for (Ticket t : tickets.findByMemberIdOrderByRoundDescIdAsc(mid)) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("id", t.getId());
            r.put("round", t.getRound());
            r.put("numbers", t.numbers());
            r.put("caseNo", t.getCaseNo());
            r.put("conf", t.getConf());
            r.put("memo", t.getMemo());
            r.put("createdAt", t.getCreatedAt().format(DT));
            List<Integer> win = drawn.get(t.getRound());
            if (win != null) {
                List<Integer> hit = t.numbers().stream().filter(win::contains).toList();
                r.put("drawn", true);
                r.put("winning", win);
                r.put("matched", hit);
                r.put("matchCount", hit.size());
                r.put("rank", rank(hit.size()));
                int[] s = perCase.computeIfAbsent(caseKey(t.getCaseNo()), k -> new int[4]);
                s[0]++; s[1] += hit.size(); if (hit.size() >= 3) s[2]++; s[3] = Math.max(s[3], hit.size());
            } else {
                r.put("drawn", false);
            }
            rows.add(r);
        }

        List<Map<String, Object>> summary = perCase.entrySet().stream().map(e -> Map.<String, Object>of(
                "key", e.getKey(),
                "tickets", e.getValue()[0],
                "avgMatch", e.getValue()[0] == 0 ? 0 : (double) e.getValue()[1] / e.getValue()[0],
                "wins", e.getValue()[2],
                "best", e.getValue()[3])).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("nextRound", next);
        out.put("maxPerRound", MAX_PER_ROUND);
        out.put("tickets", rows);
        out.put("summary", summary);
        return out;
    }

    static String caseKey(Integer caseNo) {
        return caseNo == null ? "manual" : caseNo == 0 ? "random" : "case" + caseNo;
    }

    /** 맞힌 개수 → 등수 (보너스 번호는 저장하지 않으므로 5개 일치는 2·3등을 구분하지 않음) */
    static String rank(int matched) {
        return switch (matched) {
            case 6 -> "1등";
            case 5 -> "5개 일치 (2·3등)";
            case 4 -> "4등";
            case 3 -> "5등";
            default -> "낙첨";
        };
    }
}
