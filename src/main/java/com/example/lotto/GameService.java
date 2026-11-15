package com.example.lotto;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 미니 게임 점수와 순위 (게임별로 따로).
 * 게임을 시작할 때 서버가 판 번호(runId)를 주고, 끝날 때 그 번호로 점수를 낸다.
 * 서버가 잰 경과 시간으로 낼 수 없는 점수(게임별 초당 최대 점수 초과)는 거절한다.
 */
@Service
public class GameService {

    public static final int TOP = 5;

    /** 게임별 점수 상한: 1초에 얻을 수 있는 최대 점수 + 여유 점수. 프론트 게임의 점수 규칙과 맞춰야 한다 */
    record Rule(double maxPointsPerSec, int grace) {}
    static final Map<String, Rule> GAMES = Map.of(
            "runner", new Rule(30, 30),    // BallRunner: 최고 속도 1000px/s ÷ 40px = 초당 25점
            "catch", new Rule(60, 60));    // CatchGame: 한 개 최대 20점, 공은 많아야 0.34초마다 하나
    private static final long RUN_TTL_MS = 60 * 60 * 1000L;

    private record Run(String id, long startedAt) {}

    private final GameScoreRepository scores;
    private final MemberRepository members;
    private final GameHub hub;
    private final Map<String, Run> runs = new ConcurrentHashMap<>();   // "회원:게임" 별 진행 중인 판 (게임마다 한 번에 한 판)

    public GameService(GameScoreRepository scores, MemberRepository members, GameHub hub) {
        this.scores = scores;
        this.members = members;
        this.hub = hub;
    }

    public List<Map<String, Object>> ranking(String game) {
        rule(game);
        List<Map<String, Object>> out = new ArrayList<>();
        int rank = 1;
        for (GameScore g : scores.findTop5ByGameAndBestGreaterThanOrderByBestDescBestAtAsc(game, 0)) {
            out.add(Map.of("rank", rank++, "username", g.getUsername(), "best", g.getBest()));
        }
        return out;
    }

    public Map<String, Object> mine(String game, String username) {
        rule(game);
        Member m = member(username);
        Map<String, Object> out = new LinkedHashMap<>();
        Optional<GameScore> g = scores.findByGameAndMemberId(game, m.getId()).filter(s -> s.getBest() > 0);
        out.put("best", g.map(GameScore::getBest).orElse(0));
        out.put("plays", g.map(GameScore::getPlays).orElse(0));
        out.put("rank", g.map(s -> scores.countAhead(game, s.getBest(), s.getBestAt()) + 1).orElse(null));
        return out;
    }

    /** 새 판 시작. 같은 게임에서 이전에 끝내지 않은 판은 버린다 */
    public Map<String, Object> start(String game, String username) {
        rule(game);
        member(username);
        long now = System.currentTimeMillis();
        runs.values().removeIf(r -> now - r.startedAt() > RUN_TTL_MS);
        Run run = new Run(UUID.randomUUID().toString(), now);
        runs.put(username + ":" + game, run);
        return Map.of("runId", run.id());
    }

    @Transactional
    public synchronized Map<String, Object> submit(String game, String username, String runId, Integer score) {
        Rule rule = rule(game);
        Member m = member(username);
        String key = username + ":" + game;
        Run run = runs.get(key);
        if (run == null || runId == null || !run.id().equals(runId)) {
            throw new IllegalArgumentException("이 판은 기록할 수 없어요. 새로 시작해 주세요.");
        }
        runs.remove(key);   // 한 판은 한 번만 기록
        if (score == null || score < 0) throw new IllegalArgumentException("점수가 올바르지 않습니다.");
        double sec = (System.currentTimeMillis() - run.startedAt()) / 1000.0;
        if (score > sec * rule.maxPointsPerSec() + rule.grace()) {
            throw new IllegalArgumentException("점수가 플레이 시간에 비해 너무 높아 기록하지 않았어요.");
        }

        List<Map<String, Object>> before = ranking(game);
        GameScore g = scores.findByGameAndMemberId(game, m.getId()).orElseGet(() -> new GameScore(game, m.getId(), m.getUsername()));
        boolean newBest = g.record(score);
        scores.save(g);
        List<Map<String, Object>> after = ranking(game);
        if (!after.equals(before)) hub.broadcast("ranking", Map.of("game", game, "ranking", after));

        Map<String, Object> out = new LinkedHashMap<>(mine(game, username));
        out.put("score", score);
        out.put("newBest", newBest);
        out.put("ranking", after);
        return out;
    }

    private static Rule rule(String game) {
        Rule r = GAMES.get(game);
        if (r == null) throw new NoSuchElementException("없는 게임입니다.");
        return r;
    }

    private Member member(String username) {
        return members.findByUsername(username).orElseThrow(() -> new SecurityException("회원 정보를 찾을 수 없습니다."));
    }
}
