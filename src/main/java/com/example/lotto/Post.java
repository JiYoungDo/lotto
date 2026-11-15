package com.example.lotto;

import jakarta.persistence.*;
import java.time.LocalDateTime;

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
}
