package com.example.lotto;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:context-test")   // 실행 중인 서버가 쓰는 DB 파일과 겹치지 않게
class LottoApplicationTests {

    @Test
    void contextLoads() {
    }

}
