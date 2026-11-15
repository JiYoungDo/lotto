package com.example.lotto;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

/** 공 점프 러너: 순위·실시간 스트림은 누구나, 점수 기록은 로그인한 회원 */
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

    @GetMapping("/ranking")
    public Map<String, Object> ranking() {
        return Map.of("ranking", game.ranking(), "top", GameService.TOP);
    }

    /** 실시간 스트림 (이벤트: ranking) */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return hub.subscribe();
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication auth) {
        return game.mine(auth.getName());
    }

    @PostMapping("/runs")
    public Map<String, Object> start(Authentication auth) {
        return game.start(auth.getName());
    }

    @PostMapping("/scores")
    public Map<String, Object> submit(@RequestBody ScoreRequest req, Authentication auth) {
        return game.submit(auth.getName(), req.runId(), req.score());
    }
}
