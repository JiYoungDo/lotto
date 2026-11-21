package com.example.lotto;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.io.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ImportServiceTest {

    @Test
    @SuppressWarnings("unchecked")
    void 엑셀_I열의_보너스_번호까지_읽는다() throws IOException {
        byte[] file;
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sh = wb.createSheet();
            Row head = sh.createRow(0);
            String[] titles = {"No", "회차", "1", "2", "3", "4", "5", "6", "보너스"};
            for (int i = 0; i < titles.length; i++) head.createCell(i).setCellValue(titles[i]);
            row(sh, 1, 1, new int[]{10, 23, 29, 33, 37, 40}, "16");   // 글자로 적힌 보너스도 읽음
            row(sh, 2, 2, new int[]{9, 13, 21, 25, 32, 42}, 2);
            row(sh, 3, 3, new int[]{11, 16, 19, 21, 27, 31}, 31);    // 당첨 번호와 겹치면 보너스 무시
            row(sh, 4, 4, new int[]{14, 27, 30, 31, 40, 42}, null);  // 보너스 칸 비어 있음
            wb.write(out);
            file = out.toByteArray();
        }

        DrawRepository repo = mock(DrawRepository.class);
        var result = new ImportService(repo).importExcel(new ByteArrayInputStream(file));

        assertEquals(4, result.saved());
        assertEquals(2, result.withBonus());
        ArgumentCaptor<Iterable<Draw>> saved = ArgumentCaptor.forClass(Iterable.class);
        verify(repo).saveAll(saved.capture());
        Map<Integer, Draw> byRound = new HashMap<>();
        saved.getValue().forEach(d -> byRound.put(d.getRound(), d));
        assertEquals(16, byRound.get(1).getBonus());
        assertEquals(2, byRound.get(2).getBonus());
        assertNull(byRound.get(3).getBonus());
        assertNull(byRound.get(4).getBonus());
        assertEquals(List.of(10, 23, 29, 33, 37, 40, 16), byRound.get(1).numbersWithBonus());
    }

    private void row(Sheet sh, int r, int round, int[] nums, Object bonus) {
        Row row = sh.createRow(r);
        row.createCell(0).setCellValue(r);
        row.createCell(1).setCellValue(round);
        for (int i = 0; i < 6; i++) row.createCell(2 + i).setCellValue(nums[i]);
        if (bonus instanceof Integer b) row.createCell(8).setCellValue(b);
        else if (bonus instanceof String s) row.createCell(8).setCellValue(s);
    }
}
