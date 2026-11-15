package com.example.lotto;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/** 당첨 회원 ↔ 관리자 1:1 채팅, 관리자 당첨자 조회 */
@RestController
public class ChatController {

    private final ChatService chat;
    private final ChatHub hub;
    private final WinnerService winners;

    public ChatController(ChatService chat, ChatHub hub, WinnerService winners) {
        this.chat = chat;
        this.hub = hub;
        this.winners = winners;
    }

    public record MessageRequest(String content) {}

    // ----- 회원 (로그인) -----

    @GetMapping("/api/chat/me")
    public Map<String, Object> mine(Authentication auth) {
        return chat.myThread(auth.getName());
    }

    @PostMapping("/api/chat/me")
    public ResponseEntity<Map<String, Object>> send(@RequestBody MessageRequest req, Authentication auth) {
        return ResponseEntity.status(201).body(chat.sendAsMember(auth.getName(), req.content()));
    }

    @PostMapping("/api/chat/me/read")
    public Map<String, Object> read(Authentication auth) {
        chat.readByMember(auth.getName());
        return Map.of("message", "ok");
    }

    /** 실시간: 회원은 자기 대화, 관리자는 모든 대화의 새 메시지 (이벤트: message) */
    @GetMapping(value = "/api/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(Authentication auth) {
        return hub.subscribe(auth.getName(), AuthController.isAdmin(auth));
    }

    // ----- 관리자 -----

    /** 회차별 당첨자 요약 */
    @GetMapping("/api/admin/winners")
    public List<Map<String, Object>> winnerRounds() {
        return winners.rounds();
    }

    /** 한 회차 당첨자 목록 */
    @GetMapping("/api/admin/winners/{round}")
    public Map<String, Object> winnerRound(@PathVariable int round) {
        return winners.round(round, chat.unreadByMember());
    }

    @GetMapping("/api/admin/chats")
    public List<Map<String, Object>> conversations() {
        return chat.conversations();
    }

    @GetMapping("/api/admin/chats/{memberId}")
    public Map<String, Object> thread(@PathVariable Long memberId) {
        return chat.thread(memberId);
    }

    @PostMapping("/api/admin/chats/{memberId}")
    public ResponseEntity<Map<String, Object>> reply(@PathVariable Long memberId, @RequestBody MessageRequest req, Authentication auth) {
        return ResponseEntity.status(201).body(chat.sendAsAdmin(auth.getName(), memberId, req.content()));
    }

    @PostMapping("/api/admin/chats/{memberId}/read")
    public Map<String, Object> adminRead(@PathVariable Long memberId) {
        chat.readByAdmin(memberId);
        return Map.of("message", "ok");
    }
}
