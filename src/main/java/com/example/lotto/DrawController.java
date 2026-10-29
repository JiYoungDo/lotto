package com.example.lotto;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import java.util.*;

@Controller
public class DrawController {
    private final DrawRepository repo;
    private final ImportService importService;

    public DrawController(DrawRepository repo, ImportService importService) {
        this.repo = repo;
        this.importService = importService;
    }

    @GetMapping("/")
    public String root() { return "redirect:/draws"; }

    @GetMapping("/draws")
    public String list(Model model) {
        List<Draw> all = repo.findAllByOrderByRoundAsc();
        List<Draw> recent = new ArrayList<>(all.subList(Math.max(0, all.size() - 50), all.size()));
        Collections.reverse(recent);                         // 최신이 위로
        model.addAttribute("draws", recent);
        model.addAttribute("total", all.size());
        model.addAttribute("nextRound", all.isEmpty() ? 1 : all.get(all.size() - 1).getRound() + 1);
        return "draws";                                      // templates/draws.html을 보여 줌
    }

    @PostMapping("/draws/upload")
    public String upload(@RequestParam("file") MultipartFile file, RedirectAttributes ra) {
        try {
            int count = importService.importExcel(file.getInputStream());
            ra.addFlashAttribute("msg", count + "개 회차를 저장했습니다.");
        } catch (Exception e) {
            ra.addFlashAttribute("msg", "엑셀을 읽지 못했습니다: " + e.getMessage());
        }
        return "redirect:/draws";
    }

    @PostMapping("/draws/add")
    public String add(@RequestParam int round, @RequestParam int n1, @RequestParam int n2,
                      @RequestParam int n3, @RequestParam int n4, @RequestParam int n5,
                      @RequestParam int n6, RedirectAttributes ra) {
        List<Integer> n = Arrays.asList(n1, n2, n3, n4, n5, n6);
        boolean valid = n.stream().allMatch(v -> v >= 1 && v <= 45) && new HashSet<>(n).size() == 6;
        if (!valid) {
            ra.addFlashAttribute("msg", "1~45 사이의 서로 다른 번호 6개를 입력하세요.");
        } else {
            List<Integer> s = n.stream().sorted().toList();
            repo.save(new Draw(round, s.get(0), s.get(1), s.get(2), s.get(3), s.get(4), s.get(5)));
            ra.addFlashAttribute("msg", round + "회를 저장했습니다.");
        }
        return "redirect:/draws";
    }
}