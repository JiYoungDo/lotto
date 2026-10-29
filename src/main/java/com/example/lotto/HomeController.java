package com.example.lotto;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController                                  // 요청을 받고 값을 그대로 응답하는 클래스
public class HomeController {
    private final DrawRepository repo;           // final: 한 번 정하면 못 바꿈

    public HomeController(DrawRepository repo) { // Spring이 repo를 만들어 넣어 줌
        this.repo = repo;
    }

    @GetMapping("/")                             // 브라우저가 "/"로 들어오면 아래 실행
    public String home() { return "저장된 회차: " + repo.count(); }

    @GetMapping("/seed")                         // "/seed"로 들어오면 아래 실행
    public String seed() {
        repo.save(new Draw(1, 10, 23, 29, 33, 37, 40));   // DB에 한 건 저장
        return "저장 완료";
    }
}