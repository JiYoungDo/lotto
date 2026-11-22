package com.example.lotto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * /draw/회차 주소(예: /draw/1150)의 검색용 HTML.
 *
 * React 화면은 자바스크립트가 돌아야 내용이 그려져서, 네이버 같은 검색 로봇은 빈 화면으로 볼 수 있다.
 * 그래서 서버가 빌드된 index.html 에 이 회차의 제목·설명·본문 글자를 미리 채워서 내려준다.
 * 사람이 열면 React 가 뜨면서 #root 안을 자기 화면으로 바꾸므로 보이는 모습은 React 화면이다.
 *
 * 채워 넣는 값은 모두 숫자와 날짜(서버가 만든 값)라서 따로 이스케이프하지 않는다.
 */
@Controller
public class DrawPageController {

    private static final Pattern TITLE = Pattern.compile("<title>.*?</title>", Pattern.DOTALL);
    private static final Pattern DESCRIPTION = Pattern.compile("<meta\\s+name=\"description\"[^>]*>");
    private static final String ROOT = "<div id=\"root\"></div>";
    /** 빌드된 index.html 이 없을 때(개발·테스트) 쓰는 최소 틀 */
    private static final String EMPTY_SHELL = "<!doctype html><html lang=\"ko\"><head><meta charset=\"UTF-8\" />"
            + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />"
            + "<title>로또 연구소</title></head><body>" + ROOT + "</body></html>";
    private static final DateTimeFormatter LONG_DATE = DateTimeFormatter.ofPattern("yyyy년 M월 d일 (E)", Locale.KOREAN);

    private final DrawRepository repo;
    private final String siteUrl;
    private volatile String shellCache;

    public DrawPageController(DrawRepository repo,
                              @Value("${lotto.site-url:https://lottoyeonguso.kr}") String siteUrl) {
        this.repo = repo;
        this.siteUrl = siteUrl.endsWith("/") ? siteUrl.substring(0, siteUrl.length() - 1) : siteUrl;
    }

    @GetMapping(value = "/draw/{roundText:\\d+}", produces = "text/html;charset=UTF-8")
    public ResponseEntity<String> page(@PathVariable String roundText) {
        int round = roundText.length() <= 6 ? Integer.parseInt(roundText) : -1;   // 너무 긴 숫자는 없는 회차로 본다
        Draw draw = round < 1 ? null : repo.findById(round).orElse(null);
        if (draw == null) {
            // 없는 회차: 404 로 알리되, 화면은 React 가 "아직 없는 회차"로 보여 준다
            return ResponseEntity.status(404).body(shell());
        }
        Draw prev = repo.findById(round - 1).orElse(null);
        boolean hasNext = repo.existsById(round + 1);
        DrawStats stats = DrawStats.of(draw, prev);

        List<Integer> nums = draw.numbers().stream().sorted().toList();
        String numText = nums.stream().map(String::valueOf).collect(Collectors.joining(", "));
        String bonusText = draw.getBonus() == null ? "" : ", 보너스 번호 " + draw.getBonus();
        String shortDate = draw.getDrawDate().toString().replace('-', '.');
        String longDate = draw.getDrawDate().format(LONG_DATE);
        String repeatedText = stats.repeated().isEmpty()
                ? "없음"
                : stats.repeated().stream().map(String::valueOf).collect(Collectors.joining(", "))
                        + " (" + stats.repeated().size() + "개)";

        String title = round + "회 로또 당첨번호 (추첨일 " + shortDate + ") · 로또 연구소";
        String description = round + "회 로또 당첨번호 " + numText + bonusText + " (추첨일 " + shortDate + "). "
                + "번호 합계, 홀짝·고저 비율, 직전 회차와 겹친 번호를 확인하세요.";

        StringBuilder body = new StringBuilder();
        body.append("<main style=\"max-width:760px;margin:0 auto;padding:32px 24px;line-height:1.7\">");
        body.append("<h1>").append(round).append("회 로또 당첨번호</h1>");
        body.append("<p>추첨일 ").append(longDate).append("</p>");
        body.append("<p>당첨번호 ").append(numText).append(bonusText).append("</p>");
        body.append("<ul>");
        body.append("<li>번호 합계 ").append(stats.sum()).append("</li>");
        body.append("<li>홀수 ").append(stats.odd()).append("개 · 짝수 ").append(6 - stats.odd()).append("개</li>");
        body.append("<li>낮은 번호(1~22) ").append(stats.low()).append("개 · 높은 번호(23~45) ").append(6 - stats.low()).append("개</li>");
        body.append("<li>직전 회차와 겹친 번호 ").append(repeatedText).append("</li>");
        body.append("</ul>");
        body.append("<p>");
        if (prev != null) body.append("<a href=\"/draw/").append(round - 1).append("\">").append(round - 1).append("회</a> ");
        if (hasNext) body.append("<a href=\"/draw/").append(round + 1).append("\">").append(round + 1).append("회</a> ");
        body.append("<a href=\"/analysis\">가설 분석</a> <a href=\"/guide\">가이드</a> <a href=\"/draws\">로또 연구소 첫 화면</a>");
        body.append("</p>");
        body.append("<p>이 정보는 오락·학습용이며 당첨을 보장하거나 확률을 높이지 않습니다. 만 19세 미만은 이용할 수 없습니다.</p>");
        body.append("</main>");

        return ResponseEntity.ok(render(title, description, siteUrl + "/draw/" + round, body.toString()));
    }

    private String render(String title, String description, String canonical, String body) {
        String html = shell();
        html = TITLE.matcher(html).replaceFirst(Matcher.quoteReplacement("<title>" + title + "</title>"));
        html = DESCRIPTION.matcher(html).replaceAll("");
        String head = "<meta name=\"description\" content=\"" + description + "\" />\n"
                + "<link rel=\"canonical\" href=\"" + canonical + "\" />\n"
                + "<meta property=\"og:type\" content=\"website\" />\n"
                + "<meta property=\"og:title\" content=\"" + title + "\" />\n"
                + "<meta property=\"og:description\" content=\"" + description + "\" />\n"
                + "<meta property=\"og:url\" content=\"" + canonical + "\" />\n";
        html = html.replace("</head>", head + "</head>");
        return html.replace(ROOT, "<div id=\"root\">" + body + "</div>");
    }

    /** 빌드된 index.html (없으면 최소 틀) */
    private String shell() {
        String cached = shellCache;
        if (cached != null) return cached;
        ClassPathResource res = new ClassPathResource("static/index.html");
        if (!res.exists()) return EMPTY_SHELL;
        try (InputStream in = res.getInputStream()) {
            cached = StreamUtils.copyToString(in, StandardCharsets.UTF_8);
            shellCache = cached;
            return cached;
        } catch (IOException e) {
            return EMPTY_SHELL;
        }
    }
}
