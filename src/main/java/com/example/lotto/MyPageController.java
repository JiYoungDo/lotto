package com.example.lotto;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 마이페이지 (로그인한 회원 본인만): 가설로 번호 생성, 구매 번호 저장·메모·삭제, 결과 확인 */
@RestController
@RequestMapping("/api/my")
public class MyPageController {

    private final TicketService tickets;
    private final WinnerService winners;
    private final MemberRepository members;

    public MyPageController(TicketService tickets, WinnerService winners, MemberRepository members) {
        this.tickets = tickets;
        this.winners = winners;
        this.members = members;
    }

    public record MemoRequest(String memo) {}

    /** 다음 회차 번호 생성. caseNo: 0 무작위, 1~9 가설, exclude: 뺄 번호 (예: exclude=7,12) */
    @GetMapping("/generate")
    public Map<String, Object> generate(@RequestParam(defaultValue = "1") int caseNo,
                                        @RequestParam(defaultValue = "5") int count,
                                        @RequestParam(defaultValue = "60") double conf,
                                        @RequestParam(required = false) List<Integer> exclude) {
        return tickets.generate(caseNo, count, conf, exclude);
    }

    /** 번호판 미리보기: 가설에 쓰는 번호, 뺀 번호를 반영한 후보·남은 조합 수 */
    @GetMapping("/generate/options")
    public Map<String, Object> generateOptions(@RequestParam(defaultValue = "1") int caseNo,
                                               @RequestParam(defaultValue = "60") double conf,
                                               @RequestParam(required = false) List<Integer> exclude) {
        return tickets.options(caseNo, conf, exclude);
    }

    @GetMapping("/tickets")
    public Map<String, Object> mine(Authentication auth) {
        return tickets.mine(auth.getName());
    }

    /** 내 당첨 기록 (커뮤니티 당첨 인증에서 고를 목록) */
    @GetMapping("/wins")
    public Map<String, Object> wins(Authentication auth) {
        Long id = members.findByUsername(auth.getName()).map(Member::getId).orElse(null);
        return Map.of("wins", id == null ? java.util.List.of() : winners.winsOf(id));
    }

    @PostMapping("/tickets")
    public ResponseEntity<Map<String, Object>> save(@RequestBody TicketService.SaveRequest req, Authentication auth) {
        int n = tickets.save(auth.getName(), req);
        return ResponseEntity.status(201).body(Map.of("message", n + "줄을 저장했습니다.", "count", n));
    }

    @PatchMapping("/tickets/{id}")
    public Map<String, Object> memo(@PathVariable Long id, @RequestBody MemoRequest req, Authentication auth) {
        tickets.updateMemo(auth.getName(), id, req.memo());
        return Map.of("message", "메모를 저장했습니다.");
    }

    @DeleteMapping("/tickets/{id}")
    public Map<String, Object> delete(@PathVariable Long id, Authentication auth) {
        tickets.delete(auth.getName(), id);
        return Map.of("message", "번호를 지웠습니다.");
    }
}
