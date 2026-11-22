package com.example.lotto;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 가입 없이 번호 만들어 보기 (누구나). 저장은 못 하고, 뽑아 보기만 한다.
 * 계산은 회원용(/api/my/generate)과 같은 TicketService 를 쓰므로, 이미 다른 회원이 저장한 조합은 나오지 않는다.
 * 계산이 무거운 편이라 RateLimitFilter 가 IP당 횟수를 제한한다.
 */
@RestController
@RequestMapping("/api/try")
public class TryController {

    /** 가입 없이 한 번에 뽑을 수 있는 최대 줄 수 (회원은 10줄) */
    static final int MAX_COUNT = 5;

    private final TicketService tickets;

    public TryController(TicketService tickets) {
        this.tickets = tickets;
    }

    @GetMapping("/generate")
    public Map<String, Object> generate(@RequestParam(defaultValue = "1") int caseNo,
                                        @RequestParam(defaultValue = "5") int count,
                                        @RequestParam(defaultValue = "60") double conf,
                                        @RequestParam(required = false) List<Integer> exclude) {
        if (count > MAX_COUNT) {
            throw new IllegalArgumentException("가입 없이는 한 번에 " + MAX_COUNT + "줄까지 만들 수 있습니다.");
        }
        return tickets.generate(caseNo, count, conf, exclude);
    }

    @GetMapping("/generate/options")
    public Map<String, Object> options(@RequestParam(defaultValue = "1") int caseNo,
                                       @RequestParam(defaultValue = "60") double conf,
                                       @RequestParam(required = false) List<Integer> exclude) {
        return tickets.options(caseNo, conf, exclude);
    }
}
