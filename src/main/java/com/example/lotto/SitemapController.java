package com.example.lotto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * /sitemap.xml 을 서버가 만든다. 등록된 회차마다 /draw/회차 주소가 자동으로 들어가서,
 * 새 회차를 등록하면 사이트맵도 저절로 늘어난다. (검색 로봇이 열 때마다 DB에서 만든다)
 *
 * 가이드 글을 추가하면 아래 PAGES 에도 주소를 추가해 주세요. (frontend/src/guides.jsx 와 같은 목록)
 */
@RestController
public class SitemapController {

    private static final List<String> PAGES = List.of(
            "/draws", "/analysis", "/guide",
            "/guide/start", "/guide/center-numbers", "/guide/lotto-odds",
            "/guide/test-hypothesis", "/guide/play-responsibly",
            "/community", "/terms", "/privacy");

    private final DrawRepository repo;
    private final String siteUrl;

    public SitemapController(DrawRepository repo,
                             @Value("${lotto.site-url:https://lottoyeonguso.kr}") String siteUrl) {
        this.repo = repo;
        this.siteUrl = siteUrl.endsWith("/") ? siteUrl.substring(0, siteUrl.length() - 1) : siteUrl;
    }

    @GetMapping(value = "/sitemap.xml", produces = "application/xml;charset=UTF-8")
    public String sitemap() {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (String page : PAGES) {
            sb.append("  <url><loc>").append(siteUrl).append(page).append("</loc></url>\n");
        }
        for (Draw d : repo.findAllByOrderByRoundAsc()) {
            sb.append("  <url><loc>").append(siteUrl).append("/draw/").append(d.getRound()).append("</loc>")
              .append("<lastmod>").append(d.getDrawDate()).append("</lastmod></url>\n");
        }
        sb.append("</urlset>\n");
        return sb.toString();
    }
}
