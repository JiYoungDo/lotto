package com.example.lotto;

import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 당첨자 확인: 회원들이 저장한(소진된) 번호를 그 회차 당첨 번호와 비교한다.
 * 3개 이상 일치(5등 이상)를 당첨으로 본다.
 */
@Service
public class WinnerService {

    public static final int WIN_MATCH = 3;
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final List<String> RANKS = List.of("1등", "5개 일치 (2·3등)", "4등", "5등");

    private final TicketRepository tickets;
    private final DrawRepository draws;
    private final MemberRepository members;

    public WinnerService(TicketRepository tickets, DrawRepository draws, MemberRepository members) {
        this.tickets = tickets;
        this.draws = draws;
        this.members = members;
    }

    private Map<Integer, List<Integer>> drawnNumbers() {
        Map<Integer, List<Integer>> m = new HashMap<>();
        for (Draw d : draws.findAll()) m.put(d.getRound(), d.numbers());
        return m;
    }

    private static List<Integer> matched(Ticket t, List<Integer> win) {
        return t.numbers().stream().filter(win::contains).toList();
    }

    /** 추첨된 회차 중 저장된 번호가 있는 회차별 요약 (최신 회차부터) */
    public List<Map<String, Object>> rounds() {
        Map<Integer, List<Integer>> drawn = drawnNumbers();
        Map<Integer, List<Ticket>> byRound = new TreeMap<>(Comparator.reverseOrder());
        for (Ticket t : tickets.findAll()) {
            if (drawn.containsKey(t.getRound())) byRound.computeIfAbsent(t.getRound(), k -> new ArrayList<>()).add(t);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (var e : byRound.entrySet()) {
            List<Integer> win = drawn.get(e.getKey());
            Map<String, Integer> byRank = new LinkedHashMap<>();
            for (String r : RANKS) byRank.put(r, 0);
            Set<Long> winners = new HashSet<>();
            for (Ticket t : e.getValue()) {
                int n = matched(t, win).size();
                if (n >= WIN_MATCH) {
                    byRank.merge(TicketService.rank(n), 1, Integer::sum);
                    winners.add(t.getMemberId());
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("round", e.getKey());
            row.put("winning", win);
            row.put("tickets", e.getValue().size());
            row.put("members", e.getValue().stream().map(Ticket::getMemberId).distinct().count());
            row.put("winnerTickets", byRank.values().stream().mapToInt(Integer::intValue).sum());
            row.put("winnerMembers", winners.size());
            row.put("byRank", byRank);
            out.add(row);
        }
        return out;
    }

    /** 한 회차의 당첨 번호와 당첨자 목록 (많이 맞은 순) */
    public Map<String, Object> round(int round, Map<Long, Long> unreadByMember) {
        List<Integer> win = draws.findById(round).map(Draw::numbers)
                .orElseThrow(() -> new NoSuchElementException(round + "회 당첨 번호가 아직 없습니다."));
        Map<Long, String> names = new HashMap<>();
        for (Member m : members.findAll()) names.put(m.getId(), m.getUsername());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Ticket t : tickets.findByRound(round)) {
            List<Integer> hit = matched(t, win);
            if (hit.size() < WIN_MATCH) continue;
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("ticketId", t.getId());
            r.put("memberId", t.getMemberId());
            r.put("username", names.getOrDefault(t.getMemberId(), "(삭제된 회원)"));
            r.put("numbers", t.numbers());
            r.put("matched", hit);
            r.put("matchCount", hit.size());
            r.put("rank", TicketService.rank(hit.size()));
            r.put("caseNo", t.getCaseNo());
            r.put("memo", t.getMemo());
            r.put("savedAt", t.getCreatedAt().format(DT));
            r.put("unread", unreadByMember.getOrDefault(t.getMemberId(), 0L));
            rows.add(r);
        }
        rows.sort(Comparator.comparing((Map<String, Object> r) -> -(int) r.get("matchCount"))
                .thenComparing(r -> (String) r.get("username")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("round", round);
        out.put("winning", win);
        out.put("totalTickets", tickets.findByRound(round).size());
        out.put("winners", rows);
        return out;
    }

    /** 한 회원의 당첨 기록 (최신 회차부터). 비어 있으면 당첨된 적 없음 */
    public List<Map<String, Object>> winsOf(Long memberId) {
        Map<Integer, List<Integer>> drawn = drawnNumbers();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Ticket t : tickets.findByMemberIdOrderByRoundDescIdAsc(memberId)) {
            List<Integer> win = drawn.get(t.getRound());
            if (win == null) continue;
            List<Integer> hit = matched(t, win);
            if (hit.size() >= WIN_MATCH) {
                out.add(Map.of("ticketId", t.getId(), "round", t.getRound(), "rank", TicketService.rank(hit.size()),
                        "matchCount", hit.size(), "numbers", t.numbers(), "matched", hit, "winning", win));
            }
        }
        return out;
    }

    /** 이 회원의 당첨 번호 한 줄 (커뮤니티 당첨 인증용). 본인 번호가 아니거나 당첨이 아니면 거절 */
    public Map<String, Object> winOf(Long memberId, Long ticketId) {
        return winsOf(memberId).stream().filter(w -> ticketId.equals(w.get("ticketId"))).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("인증할 수 있는 당첨 번호가 아닙니다."));
    }

    public boolean isWinner(Long memberId) {
        return !winsOf(memberId).isEmpty();
    }
}
