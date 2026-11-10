package com.example.lotto;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import java.util.*;

@Controller
public class AnalysisController {
    private final DrawRepository repo;
    private final AnalysisService service;

    public AnalysisController(DrawRepository repo, AnalysisService service) {
        this.repo = repo;
        this.service = service;
    }

    @GetMapping("/analysis")
    public String analysis(@RequestParam(defaultValue = "60") double conf,
                           @RequestParam(defaultValue = "30") int min,
                           @RequestParam(defaultValue = "false") boolean all,
                           Model model) {
        if (conf < 1 || conf > 99) conf = 60;
        if (min < 1) min = 1;

        List<Draw> draws = repo.findAllByOrderByRoundAsc();
        List<AnalysisService.DrawAnalysis> result = service.analyze(draws, conf, min);

        int from = all ? 0 : Math.max(0, result.size() - 30);
        List<AnalysisService.DrawAnalysis> rows = new ArrayList<>(result.subList(from, result.size()));
        Collections.reverse(rows);                       // 최신이 위로

        model.addAttribute("conf", conf);
        model.addAttribute("min", min);
        model.addAttribute("all", all);
        model.addAttribute("total", result.size());
        model.addAttribute("stats", service.summarize(result));
        model.addAttribute("rows", rows);
        return "analysis";
    }
}