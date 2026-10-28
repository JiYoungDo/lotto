package com.example.lotto;

import com.example.lotto.Draw;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DrawRepository extends JpaRepository<Draw, Integer> {
}