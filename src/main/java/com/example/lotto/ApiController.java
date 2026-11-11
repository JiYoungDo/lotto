package com.example.lotto;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

/**
 * React 화면이 호출하는 JSON API.
 * @RestController = 반환값을 HTML 화면이 아니라 JSON 데이터로 응답한다.
 */
@RestController
@RequestMapping("/api")
public class ApiController {

    private final DrawRepository repo;
    private final AnalysisService analysis;
    private final ImportService importService;

    public ApiController(DrawRepository repo, AnalysisService analysis, ImportService importService) {
        this.repo = repo;
        this.analysis = analysis;
        this.importService = importService;
    }

    /** 새 회차 입력 요청 본문 {"round": 1247, "numbers": [1,2,3,4,5,6]} */
    public record DrawRequest(int round, List<Integer> numbers) {}

    /** 회차 목록: 최근 limit개(최신순) + 전체 개수 + 다음 회차 */
    @GetMapping("/draws")
    public Map<String, Object> draws(@RequestParam(defaultValue = "50") int limit) {
        List<Draw> all = repo.findAllByOrderByRoundAsc();
        int total = all.size();
        int nextRound = total == 0 ? 1 : all.get(total - 1).getRound() + 1;

        List<Map<String, Object>> recent = new ArrayList<>(all.stream()
                .skip(Math.max(0, total - Math.max(1, limit)))
                .map(d -> Map.<String, Object>of("round", d.getRound(), "numbers", d.numbers()))
                .toList());
        Collections.reverse(recent);   // 최신 회차가 위로 (Java 17에는 List.reversed()가 없음)

        return Map.of("total", total, "nextRound", nextRound, "draws", recent);
    }

    /** 새 회차 한 건 추가 (번호 6개: 1~45, 서로 다름) */
    @PostMapping("/draws")
    public ResponseEntity<Map<String, Object>> addDraw(@RequestBody DrawRequest req) {
        List<Integer> n = req.numbers();
        boolean valid = req.round() >= 1 && n != null && n.size() == 6
                && n.stream().allMatch(v -> v != null && v >= 1 && v <= 45)
                && new HashSet<>(n).size() == 6;
        if (!valid) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "회차와, 1~45 사이의 서로 다른 번호 6개를 입력하세요."));
        }
        List<Integer> s = n.stream().sorted().toList();
        repo.save(new Draw(req.round(), s.get(0), s.get(1), s.get(2), s.get(3), s.get(4), s.get(5)));
        return ResponseEntity.ok(Map.of("message", req.round() + "회를 저장했습니다."));
    }

    /** 엑셀 업로드 (B열 회차, C~H열 번호 6개) */
    @PostMapping("/draws/upload")
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        try {
            int count = importService.importExcel(file.getInputStream());
            return ResponseEntity.ok(Map.of("message", count + "개 회차를 저장했습니다.", "count", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "엑셀을 읽지 못했습니다: " + e.getMessage()));
        }
    }

    /** 가설 분석: 케이스별 통계 + 회차별 판정 (오래된 회차 → 최신 순) */
    @GetMapping("/analysis")
    public Map<String, Object> analysis(@RequestParam(defaultValue = "60") double conf,
                                        @RequestParam(defaultValue = "30") int min) {
        if (conf < 1 || conf > 99) conf = 60;
        if (min < 1) min = 1;

        var rows = analysis.analyze(repo.findAllByOrderByRoundAsc(), conf, min);

        List<Map<String, Object>> rowDtos = rows.stream().map(a -> Map.<String, Object>of(
                "round", a.round(),
                "numbers", a.numbers(),
                "center", a.center(),
                "hits", IntStream.rangeClosed(1, 5).mapToObj(a::hit).toList()
        )).toList();

        return Map.of("conf", conf, "min", min, "stats", analysis.summarize(rows), "rows", rowDtos);
    }
}
