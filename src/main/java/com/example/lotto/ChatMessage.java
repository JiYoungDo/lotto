package com.example.lotto;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** 관리자 ↔ 당첨 회원 1:1 대화 메시지. 대화방은 회원(memberId) 하나당 하나이고, 관리자 누구나 답할 수 있다. */
@Entity
@Table(name = "chat_message", indexes = @Index(columnList = "memberId"))
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long memberId;          // 대화 상대 회원

    @Column(nullable = false)
    private boolean fromAdmin;      // 관리자가 보낸 메시지인지

    @Column(nullable = false, length = 20)
    private String sender;          // 보낸 사람 아이디

    @Column(nullable = false, length = 1000)
    private String content;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private boolean readByMember;
    private boolean readByAdmin;

    protected ChatMessage() {}

    public ChatMessage(Long memberId, boolean fromAdmin, String sender, String content) {
        this.memberId = memberId;
        this.fromAdmin = fromAdmin;
        this.sender = sender;
        this.content = content;
        this.createdAt = LocalDateTime.now(Member.ZONE);
        this.readByMember = !fromAdmin;   // 내가 보낸 건 이미 읽음
        this.readByAdmin = fromAdmin;
    }

    public Long getId() { return id; }
    public Long getMemberId() { return memberId; }
    public boolean isFromAdmin() { return fromAdmin; }
    public String getSender() { return sender; }
    public String getContent() { return content; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isReadByMember() { return readByMember; }
    public boolean isReadByAdmin() { return readByAdmin; }
}
