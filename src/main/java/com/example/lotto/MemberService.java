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
    private static final Pattern NICKNAME = Pattern.compile("^[가-힣a-zA-Z0-9_]{2,12}$");
    /** 일반 회원이 닉네임에 쓸 수 없는 말 (관리자 사칭 방지) */
    private static final List<String> RESERVED = List.of("관리자", "운영자", "admin", "운영진", "로또연구소");
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final SecureRandom RANDOM = new SecureRandom();
    /** 지금 적용 중인 이용약관·개인정보 처리방침의 시행일 (frontend/src/pages/Legal.jsx 의 EFFECTIVE 와 같이 바꿈) */
    public static final String TERMS_VERSION = "2026-11-22";

    private final MemberRepository repo;
    private final TicketRepository tickets;
    private final ChatMessageRepository chats;
    private final GameScoreRepository gameScores;
    private final RewardSlotRepository rewardSlots;
    private final PasswordEncoder encoder;
    private final String adminUsername;
    private final String adminPassword;

    public MemberService(MemberRepository repo, TicketRepository tickets, ChatMessageRepository chats, GameScoreRepository gameScores,
                         RewardSlotRepository rewardSlots, PasswordEncoder encoder,
                         @Value("${lotto.admin.username:admin}") String adminUsername,
                         @Value("${lotto.admin.password:}") String adminPassword) {
        this.repo = repo;
        this.tickets = tickets;
        this.chats = chats;
        this.gameScores = gameScores;
        this.rewardSlots = rewardSlots;
        this.encoder = encoder;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    // ---------- 가입·로그인 ----------

    /** 가입 규칙을 어기면 IllegalArgumentException (메시지는 화면에 그대로 보여줌) */
    @Transactional
    public Member signUp(String username, String nickname, String password, boolean adultConfirmed,
                         boolean termsAgreed, boolean privacyAgreed) {
        if (!adultConfirmed) throw new IllegalArgumentException("만 19세 이상만 가입할 수 있습니다. 나이 확인에 체크해 주세요.");
        if (!termsAgreed || !privacyAgreed) throw new IllegalArgumentException("이용약관과 개인정보 수집·이용에 동의해야 가입할 수 있습니다.");
        String name = username == null ? "" : username.trim();
        String nick = nickname == null ? "" : nickname.trim();
        String problem = usernameProblem(name);
        if (problem == null) problem = nicknameProblem(nick, null);
        if (problem != null) throw new IllegalArgumentException(problem);
        checkPassword(password);
        Member m = new Member(name, encoder.encode(password), Member.Role.USER);
        m.changeNickname(nick);
        m.confirmAdult();
        m.agreeTerms(TERMS_VERSION);
        try {
            return repo.saveAndFlush(m);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 동시에 같은 아이디·닉네임으로 가입한 경우 (DB 고유 제약)
            throw new IllegalArgumentException("방금 다른 회원이 같은 아이디나 닉네임으로 가입했습니다. 다른 값으로 다시 시도하세요.");
        }
    }

    /** 아이디를 쓸 수 없으면 이유, 쓸 수 있으면 null. 대소문자만 다른 아이디도 중복으로 봄 */
    public String usernameProblem(String username) {
        String name = username == null ? "" : username.trim();
        if (!USERNAME.matcher(name).matches()) return "아이디는 영문·숫자·밑줄(_)로 4~20자여야 합니다.";
        if (repo.existsByUsernameIgnoreCase(name)) return "이미 사용 중인 아이디입니다.";
        return null;
    }

    /**
     * 닉네임을 쓸 수 없으면 이유, 쓸 수 있으면 null. 대소문자만 다른 닉네임도 중복으로 봄.
     * self: 닉네임을 바꾸려는 본인 (가입할 때는 null). 본인의 지금 닉네임은 중복으로 보지 않고, 관리자는 '관리자' 같은 말도 쓸 수 있음
     */
    public String nicknameProblem(String nickname, Member self) {
        String nick = nickname == null ? "" : nickname.trim();
        if (!NICKNAME.matcher(nick).matches()) return "닉네임은 한글·영문·숫자·밑줄(_)로 2~12자여야 합니다 (띄어쓰기 불가).";
        String lower = nick.toLowerCase(Locale.ROOT);
        boolean admin = self != null && self.getRole() == Member.Role.ADMIN;
        if (!admin && RESERVED.stream().anyMatch(lower::contains)) return "관리자로 오해할 수 있는 닉네임은 쓸 수 없습니다.";
        boolean mine = self != null && self.getNickname().equalsIgnoreCase(nick);
        if (!mine && repo.existsByNicknameIgnoreCase(nick)) return "이미 사용 중인 닉네임입니다.";
        return null;
    }

    /** 내 닉네임 변경. 커뮤니티 글·게임 순위에는 바뀐 닉네임이 바로 보인다 (이름을 따로 저장하지 않고 그때그때 찾음) */
    @Transactional
    public String changeOwnNickname(String username, String nickname) {
        Member m = repo.findByUsername(username).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다."));
        String nick = nickname == null ? "" : nickname.trim();
        if (m.getNickname().equals(nick)) throw new IllegalArgumentException("지금 쓰는 닉네임과 같습니다.");
        String problem = nicknameProblem(nick, m);
        if (problem != null) throw new IllegalArgumentException(problem);
        m.changeNickname(nick);
        try {
            repo.saveAndFlush(m);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new IllegalArgumentException("방금 다른 회원이 같은 닉네임을 가져갔습니다. 다른 닉네임으로 다시 시도하세요.");
        }
        return nick;
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
            row.put("nickname", m.getNickname());
            row.put("role", m.getRole().name());
            row.put("suspended", m.isSuspended());
            row.put("createdAt", m.getCreatedAt().format(DT));
            row.put("createdDate", m.getCreatedAt().toLocalDate().toString());
            row.put("lastLoginAt", m.getLastLoginAt() == null ? null : m.getLastLoginAt().format(DT));
            // 약관 동의 기록 (동의 기능 전에 가입한 회원은 null)
            row.put("termsAgreedAt", m.getTermsAgreedAt() == null ? null : m.getTermsAgreedAt().format(DT));
            row.put("privacyAgreedAt", m.getPrivacyAgreedAt() == null ? null : m.getPrivacyAgreedAt().format(DT));
            row.put("termsVersion", m.getTermsVersion());
            row.put("termsCurrent", TERMS_VERSION.equals(m.getTermsVersion()));   // 지금 약관에 동의했는지
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
        remove(m);
        return m.getUsername();
    }

    /** 본인 탈퇴: 비밀번호를 다시 확인한다. 관리자 계정은 탈퇴할 수 없다. */
    @Transactional
    public void withdraw(String username, String password) {
        Member m = repo.findByUsername(username).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다."));
        if (password == null || !encoder.matches(password, m.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 맞지 않습니다.");
        }
        if (m.getRole() == Member.Role.ADMIN) {
            throw new IllegalArgumentException("관리자 계정은 탈퇴할 수 없습니다. 다른 관리자에게 일반 회원으로 바꿔 달라고 하세요.");
        }
        remove(m);
    }

    /** 회원과 그 회원의 저장 번호·1:1 채팅·게임 점수·보상 슬롯을 함께 삭제 (커뮤니티 글은 따로) */
    private void remove(Member m) {
        tickets.deleteByMemberId(m.getId());
        chats.deleteByMemberId(m.getId());
        gameScores.deleteByMemberId(m.getId());
        rewardSlots.deleteByMemberId(m.getId());
        repo.delete(m);
    }

    /** 로그인 세션이 아직 유효한지: 회원이 있고, 정지되지 않았고, 권한이 그대로인지 */
    public boolean sessionValid(String username, boolean sessionIsAdmin) {
        return sessionState(username, sessionIsAdmin) != SessionState.INVALID;
    }

    public enum SessionState { OK, INVALID, TERMS_REQUIRED }

    /** 세션 상태: 끊어야 하는지(INVALID), 새 약관 동의가 필요한지(TERMS_REQUIRED) */
    public SessionState sessionState(String username, boolean sessionIsAdmin) {
        return repo.findByUsername(username).map(m -> {
            if (m.isSuspended() || (m.getRole() == Member.Role.ADMIN) != sessionIsAdmin) return SessionState.INVALID;
            return needsTerms(m) ? SessionState.TERMS_REQUIRED : SessionState.OK;
        }).orElse(SessionState.INVALID);
    }

    /** 지금 약관에 아직 동의하지 않은 일반 회원인지 (관리자는 운영자 쪽이라 제외) */
    static boolean needsTerms(Member m) {
        return m.getRole() == Member.Role.USER && !TERMS_VERSION.equals(m.getTermsVersion());
    }

    public boolean termsRequired(String username) {
        return repo.findByUsername(username).map(MemberService::needsTerms).orElse(false);
    }

    /** 기존 회원이 로그인 후 지금 약관에 다시 동의 */
    @Transactional
    public void agreeTerms(String username, boolean termsAgreed, boolean privacyAgreed) {
        if (!termsAgreed || !privacyAgreed) throw new IllegalArgumentException("이용약관과 개인정보 수집·이용에 모두 동의해 주세요.");
        Member m = repo.findByUsername(username).orElseThrow(() -> new NoSuchElementException("회원을 찾을 수 없습니다."));
        m.agreeTerms(TERMS_VERSION);
    }

    // ---------- 서버 시작 시 관리자 계정 맞추기 ----------

    public Optional<Member> find(String username) { return repo.findByUsername(username); }

    /** 화면에 보일 이름(닉네임). 없는 회원이면 "(탈퇴한 회원)" */
    public Map<String, String> nicknames(Collection<String> usernames) {
        Map<String, String> out = new HashMap<>();
        for (Member m : repo.findByUsernameIn(usernames)) out.put(m.getUsername(), m.getNickname());
        return out;
    }

    public static final String GONE = "(탈퇴한 회원)";

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 닉네임 기능 전에 가입한 회원은 아이디를 닉네임으로 (아이디가 서로 다르니 겹치지 않음)
        List<Member> noNick = repo.findByNicknameIsNull();
        for (Member m : noNick) m.changeNickname(m.getUsername());
        if (!noNick.isEmpty()) log.info("닉네임이 없던 회원 {}명의 닉네임을 아이디로 정했습니다.", noNick.size());

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
