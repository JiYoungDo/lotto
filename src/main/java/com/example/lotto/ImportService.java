package com.example.lotto;

import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;

@Service
public class ImportService {
    private static final int COL_ROUND = 1;       // B열: 회차
    private static final int COL_FIRST_NUM = 2;   // C열: 당첨번호 첫 번째 (C~H = 6개)
    private static final int COL_BONUS = 8;       // I열: 보너스 번호

    private final DrawRepository repo;

    public ImportService(DrawRepository repo) { this.repo = repo; }

    /** saved = 저장한 회차 수, withBonus = 그중 보너스 번호까지 읽은 회차 수 */
    public record ImportResult(int saved, int withBonus) {}

    public ImportResult importExcel(InputStream in) throws IOException {
        Map<Integer, Draw> map = new TreeMap<>();            // 회차 → Draw (중복 회차는 한 번만)
        try (Workbook wb = WorkbookFactory.create(in)) {
            Sheet sheet = wb.getSheetAt(0);
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {   // 0행은 제목줄이라 1행부터
                Row row = sheet.getRow(r);
                if (row == null) continue;

                Integer round = intAt(row, COL_ROUND);
                if (round == null) continue;

                List<Integer> n = new ArrayList<>();
                for (int c = COL_FIRST_NUM; c < COL_FIRST_NUM + 6; c++) {
                    Integer v = intAt(row, c);
                    if (v != null && v >= 1 && v <= 45) n.add(v);
                }
                if (n.size() != 6 || new HashSet<>(n).size() != 6) continue;

                Integer bonus = intAt(row, COL_BONUS);
                if (bonus != null && (bonus < 1 || bonus > 45 || n.contains(bonus))) bonus = null;

                Collections.sort(n);
                map.putIfAbsent(round,
                        new Draw(round, n.get(0), n.get(1), n.get(2), n.get(3), n.get(4), n.get(5), bonus));
            }
        }
        repo.saveAll(map.values());
        int withBonus = (int) map.values().stream().filter(d -> d.getBonus() != null).count();
        return new ImportResult(map.size(), withBonus);
    }

    // 칸의 값을 정수로 읽는 도우미 (숫자 칸, 글자로 저장된 숫자 칸 모두 처리)
    private Integer intAt(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) return (int) cell.getNumericCellValue();
        if (cell.getCellType() == CellType.STRING) {
            String s = cell.getStringCellValue().replaceAll("[^0-9]", "");
            return s.isEmpty() ? null : Integer.parseInt(s);
        }
        return null;
    }
}