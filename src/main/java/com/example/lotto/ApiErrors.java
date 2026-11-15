package com.example.lotto;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.NoSuchElementException;

/** 서비스에서 던진 예외를 {"message": ...} JSON 응답으로 바꾼다. */
@RestControllerAdvice
public class ApiErrors {

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, Object>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<Map<String, Object>> notFound(NoSuchElementException e) {
        return ResponseEntity.status(404).body(Map.of("message", e.getMessage()));
    }

    /** 동시에 같은 조합을 저장한 경우 (DB 고유 제약) */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ResponseEntity<Map<String, Object>> conflict(org.springframework.dao.DataIntegrityViolationException e) {
        return ResponseEntity.status(409).body(Map.of("message", "방금 다른 회원이 같은 조합을 저장했습니다. 다시 시도해 주세요."));
    }

    /** 권한은 있지만 대상이 허용되지 않는 경우 (예: 남의 글 삭제) */
    @ExceptionHandler(SecurityException.class)
    ResponseEntity<Map<String, Object>> forbidden(SecurityException e) {
        return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
    }
}
