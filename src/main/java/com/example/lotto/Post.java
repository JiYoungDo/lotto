package com.example.lotto;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/** 커뮤니티 글 한 개. 최신 100개만 남기고 오래된 글은 자동으로 지운다. */
@Entity
@Table(name = "community_post")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String author;          // 글쓴이 아이디

    private Boolean authorAdmin;    // 글 쓸 때 관리자였는지 (표시용)

    @Column(nullable = false, length = 500)
    private String content;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    // 당첨 인증: 글을 쓸 때 서버가 확인한 당첨 내역을 그대로 복사해 둔다 (번호를 나중에 지워도 인증은 남음)
    private Integer winRound;
    private Integer winMatchCount;
    @Column(length = 20)
    private String winNumbers;      // "1,2,3,4,5,6" 회원 번호
    @Column(length = 20)
    private String winDrawn;        // 그 회차 당첨 번호

    protected Post() {}

    public Post(String author, boolean authorAdmin, String content) {
        this.author = author;
        this.authorAdmin = authorAdmin;
        this.content = content;
        this.createdAt = LocalDateTime.now(Member.ZONE);
    }

    public Long getId() { return id; }
    public String getAuthor() { return author; }
    public boolean isAuthorAdmin() { return Boolean.TRUE.equals(authorAdmin); }
    public String getContent() { return content; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void attachWin(int round, int matchCount, List<Integer> numbers, List<Integer> drawn) {
        this.winRound = round;
        this.winMatchCount = matchCount;
        this.winNumbers = join(numbers);
        this.winDrawn = join(drawn);
    }

    public boolean hasWin() { return winRound != null; }
    public Integer getWinRound() { return winRound; }
    public Integer getWinMatchCount() { return winMatchCount; }
    public List<Integer> getWinNumbers() { return split(winNumbers); }
    public List<Integer> getWinDrawn() { return split(winDrawn); }

    private static String join(List<Integer> ns) {
        return String.join(",", ns.stream().map(String::valueOf).toList());
    }

    private static List<Integer> split(String s) {
        return s == null || s.isEmpty() ? List.of() : Arrays.stream(s.split(",")).map(Integer::valueOf).toList();
    }
}
