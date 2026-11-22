package com.example.lotto;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * React 화면(한 장짜리 웹앱)을 보여 주는 길잡이.
 * 브라우저가 /draws, /admin 같은 주소를 직접 열거나 새로고침하면 서버는 그런 파일이 없어 404를 낼 텐데,
 * 그럴 때 index.html을 대신 보여 주고 이후 화면 전환은 React가 맡는다.
 *
 * - 점(.)이 없는 한 단계짜리 주소만 처리한다. (logo.svg, ads.txt 같은 파일과 /api/... 는 해당 없음)
 * - 두 단계 주소는 /guide/글이름 만 처리한다. 다른 화면 주소가 두 단계로 늘어나면 여기에 추가해야 한다.
 */
@Controller
public class SpaController {

    @GetMapping({"/", "/{path:[^\\.]*}", "/guide/{slug:[^\\.]*}"})
    public String spa() {
        return "forward:/index.html";
    }
}
