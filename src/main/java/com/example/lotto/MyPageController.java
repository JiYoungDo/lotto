package com.example.lotto;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 마이페이지 (로그인한 회원 본인만): 가설로 번호 생성, 구매 번호 저장·메모·삭제, 결과 확인 */
@RestController
@RequestMapping("/api/my")
public class MyPageController {

    private final TicketService tickets;

    public MyPageController(TicketService tickets) { this.tickets = tickets; }

    public record MemoRequest(String memo) {}

    /** 다음 회차 번호 생성. caseNo: 0 무작위, 1~5 가설 */
    @GetMapping("/generate")
    public Map<String, Object> generate(@RequestParam(defaultValue = "1") int caseNo,
                                        @RequestParam(defaultValue = "5") int count,
                                        @RequestParam(defaultValue = "60") double conf) {
        return tickets.generate(caseNo, count, conf);
    }

    @GetMapping("/tickets")
    public Map<String, Object> mine(Authentication auth) {
        return tickets.mine(auth.getName());
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
