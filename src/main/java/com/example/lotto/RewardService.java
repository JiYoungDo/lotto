package com.example.lotto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 출석·미니 게임 보상: 다음 회차에 선점할 수 있는 줄 수를 늘려 준다.
 * 기본 BASE 줄 + 그 회차에 받은 보상 슬롯, 합쳐서 MAX 줄(1인 구매 한도)까지.
 * 출석과 게임(목표 점수 이상)은 종류마다 하루 한 번만 받는다.
 */
@Service
public class RewardService {

    public static final int BASE = 5;
    public static final int MAX = TicketService.MAX_PER_ROUND;
    public static final int ATTEND_SLOTS = 1;
    public static final int GAME_SLOTS = 2;
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("MM-dd HH:mm");

    private final RewardSlotRepository rewards;
    private final MemberRepository members;
    private final DrawRepository draws;
    private final Map<String, Integer> goals;   // 게임별 목표 점수

    public RewardService(RewardSlotRepository rewards, MemberRepository members, DrawRepository draws,
                         @Value("${lotto.reward.catch-score:300}") int catchGoal,
                         @Value("${lotto.reward.runner-score:300}") int runnerGoal) {
        this.rewards = rewards;
        this.members = members;
        this.draws = draws;
        this.goals = Map.of("catch", catchGoal, "runner", runnerGoal);
    }

    static LocalDate today() { return LocalDate.now(Member.ZONE); }

    int nextRound() {
        return draws.findTopByOrderByRoundDesc().map(d -> d.getRound() + 1).orElse(1);
    }

    private Long memberId(String username) {
        return members.findByUsername(username).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다.")).getId();
    }

    /** 이 회원이 그 회차에 저장할 수 있는 줄 수. 다음 회차만 보상으로 늘고, 지난 회차 기록은 MAX 줄까지 */
    public int limit(Long memberId, int round) {
        if (round != nextRound()) return MAX;
        int bonus = rewards.findByMemberIdAndRoundOrderByCreatedAtAsc(memberId, round).stream().mapToInt(RewardSlot::getSlots).sum();
        return Math.min(MAX, BASE + bonus);
    }

    /** 오늘 출석 체크 */
    @Transactional
    public synchronized Map<String, Object> attend(String username) {
        Long mid = memberId(username);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("granted", grant(mid, "attend", ATTEND_SLOTS, null));
        out.putAll(status(username));
        return out;
    }

    /**
     * 게임 한 판 기록 뒤 호출: 목표 점수를 넘었고 오늘 그 게임 보상을 아직 안 받았으면 슬롯을 준다.
     * 받은 보상(없으면 null)을 돌려준다. 점수 기록과 같은 트랜잭션에서 돈다.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Map<String, Object> onGameScore(String game, Long memberId, int score) {
        Integer goal = goals.get(game);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("goal", goal);
        if (goal == null || score < goal) {
            out.put("granted", false);
            out.put("claimedToday", rewards.existsByMemberIdAndKindAndDay(memberId, game, today()));
            return out;
        }
        boolean granted = grant(memberId, game, GAME_SLOTS, score);
        out.put("granted", granted);
        out.put("claimedToday", true);
        if (granted) {
            int round = nextRound();
            out.put("slots", GAME_SLOTS);
            out.put("round", round);
            out.put("limit", limit(memberId, round));
        }
        return out;
    }

    /** 게임 화면용: 목표 점수와 오늘 이미 받았는지 */
    public Map<String, Object> gameStatus(String game, Long memberId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("goal", goals.get(game));
        out.put("slots", GAME_SLOTS);
        out.put("claimedToday", rewards.existsByMemberIdAndKindAndDay(memberId, game, today()));
        return out;
    }

    private boolean grant(Long memberId, String kind, int slots, Integer score) {
        LocalDate day = today();
        if (rewards.existsByMemberIdAndKindAndDay(memberId, kind, day)) return false;
        rewards.saveAndFlush(new RewardSlot(memberId, nextRound(), kind, day, slots, score));   // 같은 날 두 번은 DB 제약도 막는다
        return true;
    }

    /** 마이페이지 보상 현황: 다음 회차 한도, 오늘 받을 수 있는 보상, 이번 회차에 받은 기록 */
    public Map<String, Object> status(String username) {
        Long mid = memberId(username);
        int round = nextRound();
        List<RewardSlot> got = rewards.findByMemberIdAndRoundOrderByCreatedAtAsc(mid, round);
        Set<String> doneToday = new HashSet<>();
        for (RewardSlot r : rewards.findByMemberIdAndDay(mid, today())) doneToday.add(r.getKind());
        int bonus = got.stream().mapToInt(RewardSlot::getSlots).sum();

        List<Map<String, Object>> today = new ArrayList<>();
        today.add(rule("attend", "출석 체크", ATTEND_SLOTS, null, doneToday));
        today.add(rule("catch", "번호 캐치", GAME_SLOTS, goals.get("catch"), doneToday));
        today.add(rule("runner", "공 점프 러너", GAME_SLOTS, goals.get("runner"), doneToday));

        List<Map<String, Object>> history = got.stream().map(r -> {
            Map<String, Object> h = new LinkedHashMap<>();
            h.put("kind", r.getKind());
            h.put("slots", r.getSlots());
            h.put("score", r.getScore());
            h.put("at", r.getCreatedAt().format(DT));
            return h;
        }).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("round", round);
        out.put("base", BASE);
        out.put("bonus", bonus);
        out.put("limit", Math.min(MAX, BASE + bonus));
        out.put("max", MAX);
        out.put("today", today);
        out.put("history", history);
        return out;
    }

    private static Map<String, Object> rule(String kind, String label, int slots, Integer goal, Set<String> done) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kind", kind);
        m.put("label", label);
        m.put("slots", slots);
        m.put("goal", goal);
        m.put("done", done.contains(kind));
        return m;
    }
}
