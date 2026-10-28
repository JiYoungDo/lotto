package com.example.lotto;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {
    private final DrawRepository repo;

    public HomeController(DrawRepository repo) { this.repo = repo; }

    @GetMapping("/")
    public String home() { return "저장된 회차: " + repo.count(); }

    @GetMapping("/seed")
    public String seed() {
        repo.save(new Draw(1, 10, 23, 29, 33, 37, 40));
        return "저장 완료";
    }
}