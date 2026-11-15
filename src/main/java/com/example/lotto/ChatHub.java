package com.example.lotto;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** 1:1 채팅 실시간 전달(SSE). 회원은 자기 대화만, 관리자는 모든 대화를 받는다. */
@Component
public class ChatHub {

    private static final long TIMEOUT_MS = 30 * 60 * 1000L;
    private final Map<String, List<SseEmitter>> members = new ConcurrentHashMap<>();
    private final List<SseEmitter> admins = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe(String username, boolean admin) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        List<SseEmitter> list = admin ? admins : members.computeIfAbsent(username, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);
        Runnable remove = () -> list.remove(emitter);
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
        return emitter;
    }

    /** 대화 상대 회원과 모든 관리자에게 보낸다 */
    public void deliver(String memberUsername, String event, Object data) {
        send(members.getOrDefault(memberUsername, List.of()), event, data);
        send(admins, event, data);
    }

    private static void send(List<SseEmitter> list, String event, Object data) {
        for (SseEmitter e : list) {
            try {
                e.send(SseEmitter.event().name(event).data(data));
            } catch (IOException | IllegalStateException ex) {
                list.remove(e);
            }
        }
    }

    @Scheduled(fixedRate = 20_000)
    public void heartbeat() {
        members.values().forEach(ChatHub::ping);
        ping(admins);
    }

    private static void ping(List<SseEmitter> list) {
        for (SseEmitter e : list) {
            try {
                e.send(SseEmitter.event().comment("ping"));
            } catch (IOException | IllegalStateException ex) {
                list.remove(e);
            }
        }
    }
}
