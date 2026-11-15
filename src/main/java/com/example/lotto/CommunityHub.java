package com.example.lotto;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 실시간 연결(SSE: Server-Sent Events) 관리.
 * 커뮤니티 화면을 연 브라우저마다 연결 하나를 열어 두고, 새 글·삭제가 생기면 모두에게 바로 보낸다.
 */
@Component
public class CommunityHub {

    private static final long TIMEOUT_MS = 30 * 60 * 1000L;   // 30분 뒤 끊기면 브라우저가 자동 재연결
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.add(emitter);
        Runnable remove = () -> { if (emitters.remove(emitter)) broadcastPresence(); };
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
        broadcastPresence();
        return emitter;
    }

    public int online() { return emitters.size(); }

    public void broadcast(String event, Object data) {
        for (SseEmitter e : emitters) {
            try {
                e.send(SseEmitter.event().name(event).data(data));
            } catch (IOException | IllegalStateException ex) {
                emitters.remove(e);   // 이미 닫힌 연결
            }
        }
    }

    private void broadcastPresence() {
        broadcast("presence", Map.of("online", emitters.size()));
    }

    /** 프록시·브라우저가 연결을 끊지 않도록 20초마다 빈 신호를 보낸다 */
    @Scheduled(fixedRate = 20_000)
    public void heartbeat() {
        for (SseEmitter e : emitters) {
            try {
                e.send(SseEmitter.event().comment("ping"));
            } catch (IOException | IllegalStateException ex) {
                emitters.remove(e);
            }
        }
    }
}
