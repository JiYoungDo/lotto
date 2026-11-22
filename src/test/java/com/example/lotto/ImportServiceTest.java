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

    @Test
    @SuppressWarnings("unchecked")
    void 다시_올려도_등록된_추첨일은_그대로_둔다() throws IOException {
        byte[] file;
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sh = wb.createSheet();
            sh.createRow(0).createCell(0).setCellValue("제목");
            row(sh, 1, 5, new int[]{1, 2, 3, 4, 5, 6}, 7);
            row(sh, 2, 6, new int[]{1, 2, 3, 4, 5, 6}, 7);
            wb.write(out);
            file = out.toByteArray();
        }
        DrawRepository repo = mock(DrawRepository.class);
        java.time.LocalDate fixed = java.time.LocalDate.of(2003, 1, 5);   // 관리자가 고친 날짜
        when(repo.findAllById(any())).thenReturn(List.of(new Draw(5, 9, 10, 11, 12, 13, 14, null, fixed)));
        new ImportService(repo).importExcel(new ByteArrayInputStream(file));

        ArgumentCaptor<Iterable<Draw>> saved = ArgumentCaptor.forClass(Iterable.class);
        verify(repo).saveAll(saved.capture());
        Map<Integer, Draw> byRound = new HashMap<>();
        saved.getValue().forEach(d -> byRound.put(d.getRound(), d));
        assertEquals(fixed, byRound.get(5).getDrawDate());
        assertEquals(List.of(1, 2, 3, 4, 5, 6), byRound.get(5).numbers());   // 번호는 엑셀 값으로 바뀜
        assertEquals(java.time.LocalDate.of(2003, 1, 11), byRound.get(6).getDrawDate());   // 새 회차는 계산한 날짜
    }

    @Test
    void 추첨일은_1회부터_매주_토요일() {
        assertEquals(java.time.LocalDate.of(2002, 12, 7), Draw.defaultDate(1));
        assertEquals(java.time.LocalDate.of(2026, 11, 21), Draw.defaultDate(1251));
        assertEquals(java.time.DayOfWeek.SATURDAY, Draw.defaultDate(1252).getDayOfWeek());
        assertEquals("2026-11-28T20:35+09:00", Draw.drawTime(Draw.defaultDate(1252)).toOffsetDateTime().toString());
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
