package com.example.lotto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findTop100ByOrderByIdDesc();

    List<Post> findByAuthor(String author);

    /** id가 minId보다 작은(더 오래된) 글을 모두 지운다 */
    @Modifying
    @Query("delete from Post p where p.id < :minId")
    int deleteOlderThan(@Param("minId") Long minId);
}
