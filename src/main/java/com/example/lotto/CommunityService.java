package com.example.lotto;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** 커뮤니티 글 저장·삭제. 항상 최신 MAX_POSTS 개만 DB에 남긴다. */
@Service
public class CommunityService {

    public static final int MAX_POSTS = 100;
    public static final int MAX_LENGTH = 500;
    private static final long MIN_INTERVAL_MS = 3_000;   // 같은 회원은 3초에 한 번만 글쓰기 (도배 방지)
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final PostRepository repo;
    private final CommunityHub hub;
    private final Map<String, Long> lastPostAt = new ConcurrentHashMap<>();

    public CommunityService(PostRepository repo, CommunityHub hub) {
        this.repo = repo;
        this.hub = hub;
    }

    /** 최신 100개를 오래된 글 → 최신 글 순서로 */
    public List<Map<String, Object>> recent() {
        List<Map<String, Object>> list = new ArrayList<>(repo.findTop100ByOrderByIdDesc().stream().map(CommunityService::dto).toList());
        Collections.reverse(list);
        return list;
    }

    @Transactional
    public synchronized Map<String, Object> write(String author, boolean admin, String content) {
        String text = content == null ? "" : content.strip();
        if (text.isEmpty()) throw new IllegalArgumentException("내용을 입력하세요.");
        if (text.length() > MAX_LENGTH) throw new IllegalArgumentException("글은 " + MAX_LENGTH + "자까지 쓸 수 있습니다.");

        long now = System.currentTimeMillis();
        Long last = lastPostAt.get(author);
        if (!admin && last != null && now - last < MIN_INTERVAL_MS) {
            throw new IllegalArgumentException("너무 빨리 쓰고 있어요. 잠시 후 다시 시도하세요.");
        }
        lastPostAt.put(author, now);

        Post saved = repo.save(new Post(author, admin, text));
        prune();
        Map<String, Object> dto = dto(saved);
        hub.broadcast("post", dto);
        return dto;
    }

    /** 최신 100개보다 오래된 글 삭제 */
    @Transactional
    public void prune() {
        List<Post> keep = repo.findTop100ByOrderByIdDesc();
        if (keep.size() < MAX_POSTS) return;
        int removed = repo.deleteOlderThan(keep.get(keep.size() - 1).getId());
        if (removed > 0) hub.broadcast("pruned", Map.of("minId", keep.get(keep.size() - 1).getId()));
    }

    /** 본인 글 또는 관리자만 삭제 */
    @Transactional
    public void delete(Long id, String actor, boolean admin) {
        Post p = repo.findById(id).orElseThrow(() -> new NoSuchElementException("이미 지워진 글입니다."));
        if (!admin && !p.getAuthor().equals(actor)) throw new SecurityException("본인 글만 지울 수 있습니다.");
        repo.delete(p);
        hub.broadcast("delete", Map.of("id", id));
    }

    /** 관리자: 전체 삭제 */
    @Transactional
    public long clear() {
        long n = repo.count();
        repo.deleteAllInBatch();
        hub.broadcast("clear", Map.of());
        return n;
    }

    public long count() { return repo.count(); }

    private static Map<String, Object> dto(Post p) {
        return Map.of("id", p.getId(), "author", p.getAuthor(), "admin", p.isAuthorAdmin(),
                "content", p.getContent(), "createdAt", p.getCreatedAt().format(DT));
    }
}
