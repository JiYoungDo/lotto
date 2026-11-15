package com.example.lotto;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.*;

/** 관리자 ↔ 당첨 회원 1:1 채팅. 당첨(3개 이상 일치) 기록이 있는 회원만 대화할 수 있다. */
@Service
public class ChatService {

    public static final int MAX_LENGTH = 1000;
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final ChatMessageRepository messages;
    private final MemberRepository members;
    private final WinnerService winners;
    private final ChatHub hub;

    public ChatService(ChatMessageRepository messages, MemberRepository members, WinnerService winners, ChatHub hub) {
        this.messages = messages;
        this.members = members;
        this.winners = winners;
        this.hub = hub;
    }

    private Member member(String username) {
        return members.findByUsername(username).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다."));
    }

    private Member member(Long id) {
        return members.findById(id).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다."));
    }

    private static String clean(String content) {
        String text = content == null ? "" : content.strip();
        if (text.isEmpty()) throw new IllegalArgumentException("내용을 입력하세요.");
        if (text.length() > MAX_LENGTH) throw new IllegalArgumentException("메시지는 " + MAX_LENGTH + "자까지 보낼 수 있습니다.");
        return text;
    }

    static Map<String, Object> dto(ChatMessage m) {
        return Map.of("id", m.getId(), "memberId", m.getMemberId(), "fromAdmin", m.isFromAdmin(),
                "sender", m.getSender(), "content", m.getContent(), "createdAt", m.getCreatedAt().format(DT));
    }

    // ---------- 회원 ----------

    /** 내 대화방: 채팅 가능 여부, 당첨 기록, 메시지, 안 읽은 수 */
    public Map<String, Object> myThread(String username) {
        Member m = member(username);
        List<Map<String, Object>> wins = winners.winsOf(m.getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("eligible", !wins.isEmpty());
        out.put("wins", wins);
        out.put("messages", wins.isEmpty() ? List.of() : messages.findByMemberIdOrderByIdAsc(m.getId()).stream().map(ChatService::dto).toList());
        out.put("unread", messages.countByMemberIdAndFromAdminTrueAndReadByMemberFalse(m.getId()));
        out.put("maxLength", MAX_LENGTH);
        return out;
    }

    @Transactional
    public Map<String, Object> sendAsMember(String username, String content) {
        Member m = member(username);
        if (!winners.isWinner(m.getId())) throw new SecurityException("당첨된 회원만 관리자와 채팅할 수 있습니다.");
        ChatMessage saved = messages.save(new ChatMessage(m.getId(), false, username, clean(content)));
        Map<String, Object> dto = dto(saved);
        hub.deliver(username, "message", dto);
        return dto;
    }

    @Transactional
    public void readByMember(String username) {
        messages.markReadByMember(member(username).getId());
    }

    // ---------- 관리자 ----------

    /** 대화 목록 (최근 메시지 순) */
    public List<Map<String, Object>> conversations() {
        Map<Long, Map<String, Object>> byMember = new LinkedHashMap<>();
        for (ChatMessage msg : messages.findAllByOrderByIdDesc()) {
            Map<String, Object> c = byMember.get(msg.getMemberId());
            if (c == null) {
                c = new LinkedHashMap<>();
                c.put("memberId", msg.getMemberId());
                c.put("username", members.findById(msg.getMemberId()).map(Member::getUsername).orElse("(삭제된 회원)"));
                c.put("last", dto(msg));
                c.put("unread", 0L);
                byMember.put(msg.getMemberId(), c);
            }
            if (!msg.isFromAdmin() && !msg.isReadByAdmin()) c.put("unread", (Long) c.get("unread") + 1);
        }
        return new ArrayList<>(byMember.values());
    }

    public Map<Long, Long> unreadByMember() {
        Map<Long, Long> out = new HashMap<>();
        for (Map<String, Object> c : conversations()) out.put((Long) c.get("memberId"), (Long) c.get("unread"));
        return out;
    }

    /** 한 회원과의 대화 (열면 읽음 처리) */
    @Transactional
    public Map<String, Object> thread(Long memberId) {
        Member m = member(memberId);
        messages.markReadByAdmin(memberId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("memberId", memberId);
        out.put("username", m.getUsername());
        out.put("wins", winners.winsOf(memberId));
        out.put("messages", messages.findByMemberIdOrderByIdAsc(memberId).stream().map(ChatService::dto).toList());
        return out;
    }

    @Transactional
    public Map<String, Object> sendAsAdmin(String adminName, Long memberId, String content) {
        Member m = member(memberId);
        if (!winners.isWinner(memberId)) throw new IllegalArgumentException("당첨 기록이 있는 회원에게만 메시지를 보낼 수 있습니다.");
        messages.markReadByAdmin(memberId);   // 답장하면 그 대화는 읽은 것으로
        ChatMessage saved = messages.save(new ChatMessage(memberId, true, adminName, clean(content)));
        Map<String, Object> dto = dto(saved);
        hub.deliver(m.getUsername(), "message", dto);
        return dto;
    }

    @Transactional
    public void readByAdmin(Long memberId) {
        messages.markReadByAdmin(memberId);
    }
}
