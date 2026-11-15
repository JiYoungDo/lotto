package com.example.lotto;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

/** 미니 게임 (game: runner, catch): 순위·실시간 스트림은 누구나, 점수 기록은 로그인한 회원 */
@RestController
@RequestMapping("/api/game")
public class GameController {

    private final GameService game;
    private final GameHub hub;

    public GameController(GameService game, GameHub hub) {
        this.game = game;
        this.hub = hub;
    }

    public record ScoreRequest(String runId, Integer score) {}

    /** 실시간 스트림 (이벤트: ranking { game, ranking }) */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return hub.subscribe();
    }

    @GetMapping("/{name}/ranking")
    public Map<String, Object> ranking(@PathVariable String name) {
        return Map.of("game", name, "ranking", game.ranking(name), "top", GameService.TOP);
    }

    @GetMapping("/{name}/me")
    public Map<String, Object> me(@PathVariable String name, Authentication auth) {
        return game.mine(name, auth.getName());
    }

    @PostMapping("/{name}/runs")
    public Map<String, Object> start(@PathVariable String name, Authentication auth) {
        return game.start(name, auth.getName());
    }

    @PostMapping("/{name}/scores")
    public Map<String, Object> submit(@PathVariable String name, @RequestBody ScoreRequest req, Authentication auth) {
        return game.submit(name, auth.getName(), req.runId(), req.score());
    }
}
