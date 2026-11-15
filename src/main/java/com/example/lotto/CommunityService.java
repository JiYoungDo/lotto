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
    private final MemberRepository members;
    private final MemberService memberService;
    private final WinnerService winners;
    private final Map<String, Long> lastPostAt = new ConcurrentHashMap<>();

    public CommunityService(PostRepository repo, CommunityHub hub, MemberRepository members, MemberService memberService,
                            WinnerService winners) {
        this.repo = repo;
        this.hub = hub;
        this.members = members;
        this.memberService = memberService;
        this.winners = winners;
    }

    /** 최신 100개를 오래된 글 → 최신 글 순서로 */
    public List<Map<String, Object>> recent() {
        List<Post> posts = repo.findTop100ByOrderByIdDesc();
        Map<String, String> names = memberService.nicknames(posts.stream().map(Post::getAuthor).distinct().toList());
        List<Map<String, Object>> list = new ArrayList<>(posts.stream().map(p -> dto(p, names)).toList());
        Collections.reverse(list);
        return list;
    }

    @Transactional
    public synchronized Map<String, Object> write(String author, boolean admin, String content) {
        return write(author, admin, content, null);
    }

    /** ticketId가 있으면 그 번호가 글쓴이 본인의 당첨 번호인지 서버에서 확인하고 당첨 인증을 붙인다 */
    @Transactional
    public synchronized Map<String, Object> write(String author, boolean admin, String content, Long ticketId) {
        String text = content == null ? "" : content.strip();
        if (text.isEmpty() && ticketId == null) throw new IllegalArgumentException("내용을 입력하세요.");
        if (text.length() > MAX_LENGTH) throw new IllegalArgumentException("글은 " + MAX_LENGTH + "자까지 쓸 수 있습니다.");

        Map<String, Object> win = null;
        if (ticketId != null) {
            Member m = members.findByUsername(author).orElseThrow(() -> new SecurityException("회원 정보를 찾을 수 없습니다."));
            win = winners.winOf(m.getId(), ticketId);
        }

        long now = System.currentTimeMillis();
        Long last = lastPostAt.get(author);
        if (!admin && last != null && now - last < MIN_INTERVAL_MS) {
            throw new IllegalArgumentException("너무 빨리 쓰고 있어요. 잠시 후 다시 시도하세요.");
        }
        lastPostAt.put(author, now);

        Post post = new Post(author, admin, text);
        if (win != null) {
            @SuppressWarnings("unchecked") List<Integer> numbers = (List<Integer>) win.get("numbers");
            @SuppressWarnings("unchecked") List<Integer> drawn = (List<Integer>) win.get("winning");
            post.attachWin((int) win.get("round"), (int) win.get("matchCount"), numbers, drawn);
        }
        Post saved = repo.save(post);
        prune();
        Map<String, Object> dto = dto(saved, memberService.nicknames(List.of(author)));
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

    /** 공개 응답: 로그인 아이디는 내보내지 않고 닉네임만 (names = 아이디 → 닉네임) */
    private static Map<String, Object> dto(Post p, Map<String, String> names) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("nickname", names.getOrDefault(p.getAuthor(), MemberService.GONE));
        m.put("admin", p.isAuthorAdmin());
        m.put("content", p.getContent());
        m.put("createdAt", p.getCreatedAt().format(DT));
        if (p.hasWin()) {
            List<Integer> drawn = p.getWinDrawn();
            m.put("win", Map.of("round", p.getWinRound(), "rank", TicketService.rank(p.getWinMatchCount()),
                    "matchCount", p.getWinMatchCount(), "numbers", p.getWinNumbers(), "winning", drawn,
                    "matched", p.getWinNumbers().stream().filter(drawn::contains).toList()));
        }
        return m;
    }
}
