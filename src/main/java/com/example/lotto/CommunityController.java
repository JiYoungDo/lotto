package com.example.lotto;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

/** 커뮤니티: 읽기·실시간 스트림은 누구나, 쓰기·삭제는 로그인한 회원 */
@RestController
public class CommunityController {

    private final CommunityService community;
    private final CommunityHub hub;

    public CommunityController(CommunityService community, CommunityHub hub) {
        this.community = community;
        this.hub = hub;
    }

    public record PostRequest(String content, Long ticketId) {}

    @GetMapping("/api/community/posts")
    public Map<String, Object> posts() {
        return Map.of("posts", community.recent(), "max", CommunityService.MAX_POSTS,
                "maxLength", CommunityService.MAX_LENGTH, "online", hub.online());
    }

    /** 실시간 스트림 (이벤트: post, delete, pruned, clear, presence) */
    @GetMapping(value = "/api/community/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return hub.subscribe();
    }

    @PostMapping("/api/community/posts")
    public ResponseEntity<Map<String, Object>> write(@RequestBody PostRequest req, Authentication auth) {
        return ResponseEntity.status(201).body(community.write(auth.getName(), AuthController.isAdmin(auth), req.content(), req.ticketId()));
    }

    @DeleteMapping("/api/community/posts/{id}")
    public Map<String, Object> delete(@PathVariable Long id, Authentication auth) {
        community.delete(id, auth.getName(), AuthController.isAdmin(auth));
        return Map.of("message", "글을 지웠습니다.");
    }

    // ----- 관리자 -----

    @GetMapping("/api/admin/community")
    public Map<String, Object> adminStats() {
        return Map.of("count", community.count(), "max", CommunityService.MAX_POSTS, "online", hub.online());
    }

    @DeleteMapping("/api/admin/community/posts")
    public Map<String, Object> clear() {
        long n = community.clear();
        return Map.of("message", "글 " + n + "개를 모두 지웠습니다.");
    }
}
