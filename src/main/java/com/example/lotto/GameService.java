package com.example.lotto;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 공 점프 러너 점수와 순위.
 * 게임을 시작할 때 서버가 판 번호(runId)를 주고, 끝날 때 그 번호로 점수를 낸다.
 * 서버가 잰 경과 시간으로 낼 수 없는 점수(초당 최대 점수 초과)는 거절한다.
 */
@Service
public class GameService {

    public static final int TOP = 5;
    /** 게임 속도 상한에서 1초에 얻을 수 있는 최대 점수 + 여유. 프론트 BallRunner 의 점수 규칙과 맞춰야 한다 */
    static final double MAX_POINTS_PER_SEC = 25;
    static final int GRACE_POINTS = 30;
    private static final long RUN_TTL_MS = 60 * 60 * 1000L;

    private record Run(String id, long startedAt) {}

    private final GameScoreRepository scores;
    private final MemberRepository members;
    private final GameHub hub;
    private final Map<String, Run> runs = new ConcurrentHashMap<>();   // 회원별 진행 중인 판 (한 번에 한 판)

    public GameService(GameScoreRepository scores, MemberRepository members, GameHub hub) {
        this.scores = scores;
        this.members = members;
        this.hub = hub;
    }

    public List<Map<String, Object>> ranking() {
        List<Map<String, Object>> out = new ArrayList<>();
        int rank = 1;
        for (GameScore g : scores.findTop5ByBestGreaterThanOrderByBestDescBestAtAsc(0)) {
            out.add(Map.of("rank", rank++, "username", g.getUsername(), "best", g.getBest()));
        }
        return out;
    }

    public Map<String, Object> mine(String username) {
        Member m = member(username);
        Map<String, Object> out = new LinkedHashMap<>();
        Optional<GameScore> g = scores.findByMemberId(m.getId()).filter(s -> s.getBest() > 0);
        out.put("best", g.map(GameScore::getBest).orElse(0));
        out.put("plays", g.map(GameScore::getPlays).orElse(0));
        out.put("rank", g.map(s -> scores.countAhead(s.getBest(), s.getBestAt()) + 1).orElse(null));
        return out;
    }

    /** 새 판 시작. 이전에 끝내지 않은 판은 버린다 */
    public Map<String, Object> start(String username) {
        member(username);
        long now = System.currentTimeMillis();
        runs.values().removeIf(r -> now - r.startedAt() > RUN_TTL_MS);
        Run run = new Run(UUID.randomUUID().toString(), now);
        runs.put(username, run);
        return Map.of("runId", run.id());
    }

    @Transactional
    public synchronized Map<String, Object> submit(String username, String runId, Integer score) {
        Member m = member(username);
        Run run = runs.get(username);
        if (run == null || runId == null || !run.id().equals(runId)) {
            throw new IllegalArgumentException("이 판은 기록할 수 없어요. 새로 시작해 주세요.");
        }
        runs.remove(username);   // 한 판은 한 번만 기록
        if (score == null || score < 0) throw new IllegalArgumentException("점수가 올바르지 않습니다.");
        double sec = (System.currentTimeMillis() - run.startedAt()) / 1000.0;
        if (score > sec * MAX_POINTS_PER_SEC + GRACE_POINTS) {
            throw new IllegalArgumentException("점수가 플레이 시간에 비해 너무 높아 기록하지 않았어요.");
        }

        List<Map<String, Object>> before = ranking();
        GameScore g = scores.findByMemberId(m.getId()).orElseGet(() -> new GameScore(m.getId(), m.getUsername()));
        boolean newBest = g.record(score);
        scores.save(g);
        List<Map<String, Object>> after = ranking();
        if (!after.equals(before)) hub.broadcast("ranking", Map.of("ranking", after));

        Map<String, Object> out = new LinkedHashMap<>(mine(username));
        out.put("score", score);
        out.put("newBest", newBest);
        out.put("ranking", after);
        return out;
    }

    private Member member(String username) {
        return members.findByUsername(username).orElseThrow(() -> new SecurityException("회원 정보를 찾을 수 없습니다."));
    }
}
