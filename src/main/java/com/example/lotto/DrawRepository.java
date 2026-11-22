package com.example.lotto;

import com.example.lotto.Draw;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

//Repository는 DB를 드나드는 창구. SQL을 직접 쓰지 않고 save, findById, findAll, count, delete로.
public interface DrawRepository extends JpaRepository<Draw, Integer> {
    List<Draw> findAllByOrderByRoundAsc();
    Optional<Draw> findTopByOrderByRoundDesc();
}