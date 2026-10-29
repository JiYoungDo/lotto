package com.example.lotto;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
//@SpringBootApplication이 붙은 클래스의 같은 패키지와 그 하위 패키지만 Spring이 뒤져서 쓸 클래스를 찾음.
// 그래서 새 클래스는 com.example.lotto 안에 만들어야 함.다른 곳에 만들면 Spring이 못 찾아요.
public class LottoApplication {

    public static void main(String[] args) {

        //SpringApplication.run(...)이 Spring Boot를 킴
        // 내장 웹 서버(Tomcat)를 8080 포트로 열고, 설정을 읽고, 아래 클래스들을 찾아 연결.
        SpringApplication.run(LottoApplication.class, args);
    }

}
