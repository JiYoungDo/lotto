package com.example.lotto;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:draw-page-test",
        "lotto.admin.username=admin",
        "lotto.admin.password=test-pass"
})
@AutoConfigureMockMvc
class DrawPageTest {

    @Autowired MockMvc mvc;
    @Autowired DrawRepository draws;

    private String text(String url) throws Exception {
        return mvc.perform(get(url)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private void seed() {
        draws.save(new Draw(901, 1, 2, 3, 4, 5, 6, 7));
        draws.save(new Draw(902, 4, 5, 20, 30, 40, 45, 10));
    }

    @Test
    void 회차_페이지에_제목과_번호와_통계가_글자로_들어_있다() throws Exception {
        seed();
        mvc.perform(get("/draw/902")).andExpect(status().isOk());
        String html = text("/draw/902");
        assertTrue(html.contains("902회 로또 당첨번호"), "제목");
        assertTrue(html.contains("4, 5, 20, 30, 40, 45"), "번호");
        assertTrue(html.contains("보너스 번호 10"), "보너스");
        assertTrue(html.contains("번호 합계 144"), "합계 4+5+20+30+40+45");
        assertTrue(html.contains("직전 회차와 겹친 번호 4, 5 (2개)"), "겹친 번호");
        assertTrue(html.contains("rel=\"canonical\""), "대표 주소");
        assertTrue(html.contains("href=\"/draw/901\""), "이전 회차 링크");
    }

    @Test
    void 없는_회차는_404이다() throws Exception {
        mvc.perform(get("/draw/999999")).andExpect(status().isNotFound());
    }

    @Test
    void 회차_상세_JSON을_누구나_볼_수_있다() throws Exception {
        seed();
        mvc.perform(get("/api/draws/902")).andExpect(status().isOk())
                .andExpect(jsonPath("$.round").value(902))
                .andExpect(jsonPath("$.sum").value(144))
                .andExpect(jsonPath("$.odd").value(2))
                .andExpect(jsonPath("$.low").value(3))
                .andExpect(jsonPath("$.repeated.length()").value(2))
                .andExpect(jsonPath("$.hasPrev").value(true))
                .andExpect(jsonPath("$.hasNext").value(false));
        mvc.perform(get("/api/draws/998877")).andExpect(status().isNotFound());
    }

    @Test
    void 사이트맵에_회차_주소가_들어_있다() throws Exception {
        seed();
        String xml = text("/sitemap.xml");
        assertTrue(xml.contains("/draw/901"));
        assertTrue(xml.contains("/draw/902"));
        assertTrue(xml.contains("/guide/start"));
    }
}
