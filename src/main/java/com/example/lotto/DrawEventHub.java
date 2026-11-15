package com.example.lotto;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 회차 데이터 변경 알림(SSE).
 * 관리자가 당첨 번호를 등록·수정·삭제·업로드하면 열려 있는 화면(마이페이지, 회차 번호)에 바로 알려
 * 새로고침 없이 결과를 다시 불러오게 한다.
 */
@Component
public class DrawEventHub {

    private static final long TIMEOUT_MS = 30 * 60 * 1000L;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        return emitter;
    }

    /** action: saved(한 회차 저장/수정), deleted, uploaded */
    public void drawChanged(String action, Integer round) {
        Map<String, Object> data = round == null ? Map.of("action", action) : Map.of("action", action, "round", round);
        for (SseEmitter e : emitters) {
            try {
                e.send(SseEmitter.event().name("draw").data(data));
            } catch (IOException | IllegalStateException ex) {
                emitters.remove(e);
            }
        }
    }

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
