package com.example.lotto;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.regex.Pattern;

/**
 * 회원 가입·조회·관리 + 로그인할 때 DB에서 회원을 찾아주는 역할(UserDetailsService).
 * 서버가 켜질 때 config/application.properties 의 관리자 계정을 DB에 맞춰 둔다.
 */
@Service
public class MemberService implements UserDetailsService, ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MemberService.class);
    private static final Pattern USERNAME = Pattern.compile("^[a-zA-Z0-9_]{4,20}$");
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final MemberRepository repo;
    private final TicketRepository tickets;
    private final ChatMessageRepository chats;
    private final GameScoreRepository gameScores;
    private final PasswordEncoder encoder;
    private final String adminUsername;
    private final String adminPassword;

    public MemberService(MemberRepository repo, TicketRepository tickets, ChatMessageRepository chats, GameScoreRepository gameScores, PasswordEncoder encoder,
                         @Value("${lotto.admin.username:admin}") String adminUsername,
                         @Value("${lotto.admin.password:}") String adminPassword) {
        this.repo = repo;
        this.tickets = tickets;
        this.chats = chats;
        this.gameScores = gameScores;
        this.encoder = encoder;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    // ---------- 가입·로그인 ----------

    /** 가입 규칙을 어기면 IllegalArgumentException (메시지는 화면에 그대로 보여줌) */
    @Transactional
    public Member signUp(String username, String password) {
        String name = username == null ? "" : username.trim();
        if (!USERNAME.matcher(name).matches()) {
            throw new IllegalArgumentException("아이디는 영문·숫자·밑줄(_)로 4~20자여야 합니다.");
        }
        checkPassword(password);
        if (repo.existsByUsername(name)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }
        return repo.save(new Member(name, encoder.encode(password), Member.Role.USER));
    }

    private static void checkPassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 64) {
            throw new IllegalArgumentException("비밀번호는 8~64자여야 합니다.");
        }
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Member m = repo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(username));
        return User.withUsername(m.getUsername()).password(m.getPassword())
                .roles(m.getRole().name())
                .disabled(m.isSuspended())          // 정지된 회원은 로그인 불가
                .build();
    }

    @Transactional
    public void recordLogin(String username) {
        repo.findByUsername(username).ifPresent(Member::touchLogin);
    }

    /** 본인 비밀번호 변경 */
    @Transactional
    public void changeOwnPassword(String username, String current, String next) {
        Member m = repo.findByUsername(username).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다."));
        if (current == null || !encoder.matches(current, m.getPassword())) {
            throw new IllegalArgumentException("현재 비밀번호가 맞지 않습니다.");
        }
        checkPassword(next);
        if (m.getUsername().equals(adminUsername)) {
            throw new IllegalArgumentException("기본 관리자 비밀번호는 config/application.properties 에서 바꿔 주세요.");
        }
        m.changePassword(encoder.encode(next));
    }

    // ---------- 관리자: 조회 ----------

    public Map<String, Object> stats() {
        List<Member> all = repo.findAll();
        LocalDate today = LocalDate.now(Member.ZONE);
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate monthStart = today.withDayOfMonth(1);

        long todayCount = 0, weekCount = 0, monthCount = 0, admins = 0, suspended = 0;
        Map<LocalDate, Long> perDay = new TreeMap<>();
        for (int i = 13; i >= 0; i--) perDay.put(today.minusDays(i), 0L);   // 최근 14일

        for (Member m : all) {
            LocalDate d = m.getCreatedAt().toLocalDate();
            if (d.equals(today)) todayCount++;
            if (!d.isBefore(weekStart)) weekCount++;
            if (!d.isBefore(monthStart)) monthCount++;
            if (m.getRole() == Member.Role.ADMIN) admins++;
            if (m.isSuspended()) suspended++;
            perDay.computeIfPresent(d, (k, v) -> v + 1);
        }
        List<Map<String, Object>> daily = perDay.entrySet().stream()
                .map(e -> Map.<String, Object>of("date", e.getKey().toString(), "count", e.getValue())).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", all.size());
        out.put("admins", admins);
        out.put("users", all.size() - admins);
        out.put("suspended", suspended);
        out.put("today", todayCount);
        out.put("thisWeek", weekCount);
        out.put("thisMonth", monthCount);
        out.put("weekStart", weekStart.toString());
        out.put("daily", daily);
        return out;
    }

    public List<Map<String, Object>> list() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(m -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", m.getId());
            row.put("username", m.getUsername());
            row.put("role", m.getRole().name());
            row.put("suspended", m.isSuspended());
            row.put("createdAt", m.getCreatedAt().format(DT));
            row.put("createdDate", m.getCreatedAt().toLocalDate().toString());
            row.put("lastLoginAt", m.getLastLoginAt() == null ? null : m.getLastLoginAt().format(DT));
            row.put("protected", m.getUsername().equals(adminUsername));   // 기본 관리자 (변경 불가)
            return row;
        }).toList();
    }

    // ---------- 관리자: 변경 ----------

    /** 기본 관리자와 본인 계정은 관리 화면에서 바꿀 수 없다 */
    private Member target(Long id, String actor) {
        Member m = repo.findById(id).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다."));
        if (m.getUsername().equals(adminUsername)) throw new IllegalArgumentException("기본 관리자 계정은 변경할 수 없습니다.");
        if (m.getUsername().equals(actor)) throw new IllegalArgumentException("본인 계정은 여기서 변경할 수 없습니다.");
        return m;
    }

    @Transactional
    public Member changeRole(Long id, String role, String actor) {
        Member.Role r;
        try { r = Member.Role.valueOf(role); } catch (Exception e) { throw new IllegalArgumentException("권한은 USER 또는 ADMIN 입니다."); }
        Member m = target(id, actor);
        m.changeRole(r);
        return m;
    }

    @Transactional
    public Member setSuspended(Long id, boolean suspended, String actor) {
        Member m = target(id, actor);
        m.setSuspended(suspended);
        return m;
    }

    /** 임시 비밀번호를 만들어 돌려준다 (관리자가 회원에게 전달) */
    @Transactional
    public String resetPassword(Long id, String actor) {
        Member m = target(id, actor);
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
        m.changePassword(encoder.encode(sb.toString()));
        return sb.toString();
    }

    @Transactional
    public String delete(Long id, String actor) {
        Member m = target(id, actor);
        tickets.deleteByMemberId(m.getId());   // 그 회원의 구매 번호도 함께 삭제
        chats.deleteByMemberId(m.getId());     // 관리자와의 대화도 삭제
        gameScores.deleteByMemberId(m.getId()); // 게임 점수도 삭제
        repo.delete(m);
        return m.getUsername();
    }

    /** 로그인 세션이 아직 유효한지: 회원이 있고, 정지되지 않았고, 권한이 그대로인지 */
    public boolean sessionValid(String username, boolean sessionIsAdmin) {
        return repo.findByUsername(username)
                .map(m -> !m.isSuspended() && (m.getRole() == Member.Role.ADMIN) == sessionIsAdmin)
                .orElse(false);
    }

    // ---------- 서버 시작 시 관리자 계정 맞추기 ----------

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        boolean noPassword = adminPassword == null || adminPassword.isBlank();
        Member admin = repo.findByUsername(adminUsername).orElse(null);

        if (admin == null) {
            String pw = noPassword ? UUID.randomUUID().toString().substring(0, 12) : adminPassword;
            repo.save(new Member(adminUsername, encoder.encode(pw), Member.Role.ADMIN));
            if (noPassword) {
                log.warn("lotto.admin.password가 없어 임시 관리자 비밀번호를 만들었습니다. 아이디: {} / 비밀번호: {}", adminUsername, pw);
            }
            return;
        }
        admin.changeRole(Member.Role.ADMIN);
        admin.setSuspended(false);
        if (!noPassword && !encoder.matches(adminPassword, admin.getPassword())) {
            admin.changePassword(encoder.encode(adminPassword));
            log.info("관리자 비밀번호를 설정 파일 값으로 바꿨습니다.");
        }
    }
}
