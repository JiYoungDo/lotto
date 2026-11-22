# 🔬 로또 연구소

> 로또 번호를 **기록하고, 가설을 세우고, 숫자로 검증하는** 개인 분석 도구입니다.
> “이 방법이 정말 우연보다 잘 맞을까?”를 무작위 기대치와 비교해서 확인해 봅니다.

**🌐 운영 중인 사이트: [lottoyeonguso.kr](https://lottoyeonguso.kr)**

![Java](https://img.shields.io/badge/Java-17-007396?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

> ⚠️ **이 서비스의 분석과 번호는 당첨을 보장하거나 확률을 높이지 않습니다.**
> 복권을 판매하거나 대행하지 않으며, 만 19세 이상만 이용할 수 있습니다.
> 도박 문제 상담: 한국도박문제예방치유원 **1336** (24시간 무료)

---

## 어떤 프로젝트인가요?

로또 번호별 출현 횟수는 회차가 쌓이면 대부분 평균 근처에 모입니다. 이 점에서 출발해
**“평균 근처의 평범한 번호(가운데 번호)를 중심으로 당첨 번호가 나오지 않을까?”** 라는 가설을 세우고,
그 가설이 지난 회차에서 우연보다 얼마나 잘 맞았는지를 통계로 확인하는 서비스입니다.

핵심 원칙은 두 가지입니다.

1. **미래를 엿보지 않는다.** 각 회차는 그 회차 *직전까지의* 데이터만으로 판정합니다. (look-ahead 방지)
2. **무작위와 비교한다.** 적중 횟수가 아니라 무작위 기대 횟수와의 차이, p-값으로 판단합니다.

### 가운데 번호 정하기

```
번호별 출현 횟수 = 당첨 번호 6개 + 보너스 번호 1개를 모두 누적
평균            = 회차 수 × 7 ÷ 45
가운데 번호      = 출현 횟수가  평균 ± z × 표준편차  안에 드는 번호   (기본 신뢰구간 60% → z = 0.842)
```

번호 45개를 *직전 회차 번호 / 가운데 번호 / 많은 양끝 번호 / 적은 양끝 번호* 로 나누고,
당첨 번호 6개가 각 묶음을 몇 개씩 포함하는지에 따라 **아홉 가지 가설**로 구분합니다.

## 주요 기능

| 구분 | 기능 |
|---|---|
| 📊 **분석** | 9개 가설 판정, 무작위 기대치 비교, p-값, 정규분포 시각화, 직전 회차 반복 출현 통계, 후보 조합 수와 1~5등 조합 수 계산 |
| 🎟️ **회차 데이터** | 회차별 당첨 번호 조회, 관리자 직접 입력, **엑셀 업로드**(Apache POI), 새 회차 **실시간 알림**(SSE) |
| 👤 **회원** | 아이디·비밀번호 가입(BCrypt), 닉네임, 탈퇴, 약관 버전 관리와 재동의, 만 19세 이상 확인 |
| 🧾 **마이페이지** | 가설 기반·무작위 번호 생성, 구매 번호 기록, 당첨 결과 확인 |
| 💬 **커뮤니티** | 글쓰기, 최신 100개 보관, 관리자 모더레이션, 실시간 갱신 |
| 🏆 **소통** | 당첨 회원 ↔ 관리자 1:1 채팅, 미니게임 순위 |
| 📚 **가이드** | 사용법·확률·가설 검증 방법을 설명하는 글 |
| 🛡️ **운영** | 관리자 화면(회원·글·회차 관리), 로그인·가입 **시도 횟수 제한**, 세션 쿠키 + CSRF, AdSense 연동(선택) |

## 기술 스택

- **Backend** — Java 17, Spring Boot 4.1, Spring Web MVC, Spring Security, Spring Data JPA, Gradle
- **Database** — H2 (파일 DB, 운영에서는 Docker 볼륨에 보관)
- **Frontend** — React 19, React Router 7, Vite 8 (SPA)
- **Realtime** — Server-Sent Events (회차·채팅·커뮤니티·게임)
- **Infra** — Docker 멀티 스테이지 빌드, Docker Compose, Caddy(자동 HTTPS), AWS Lightsail

## 구조

```
브라우저 ──HTTPS──▶ Caddy ──▶ Spring Boot (API + 빌드된 React 정적 파일) ──▶ H2 (Docker 볼륨)
```

```
lotto/
├─ src/main/java/com/example/lotto/   Spring Boot (API, 분석, 보안, 실시간 허브)
├─ src/test/java/com/example/lotto/   테스트
├─ frontend/                          React + Vite
│  └─ src/pages, components, guides   화면, 공통 컴포넌트, 가이드 글
├─ deploy/backup.sh                   DB 백업 스크립트
├─ Dockerfile                         프론트 빌드 → 백엔드 빌드 → 실행 이미지
├─ docker-compose.yml                 app + caddy
└─ Caddyfile                          HTTPS 리버스 프록시
```

## 로컬에서 실행하기

필요한 것: **JDK 17**, **Node.js 22**

**1) 관리자 계정 설정 (선택)**

`config/application.properties` 파일을 만들고 관리자 비밀번호를 적습니다. 이 파일은 git에 올라가지 않습니다.

```properties
lotto.admin.username=admin
lotto.admin.password=원하는-비밀번호
```

비워 두면 실행할 때마다 임시 비밀번호가 만들어져 서버 로그에 출력됩니다.

**2) 백엔드** (포트 8080)

```bash
./gradlew bootRun
```

**3) 프론트엔드** (포트 5173, `/api` 요청은 8080으로 전달됩니다)

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 <http://localhost:5173> 을 엽니다.

## 테스트

```bash
./gradlew test
```

인증·권한, 분석 계산, 엑셀 가져오기, 회원 탈퇴, 채팅, 게임 등 80여 개 테스트가 있습니다.

## 배포 (Docker Compose + Caddy)

서버 한 대에서 `docker compose` 한 줄로 올립니다. HTTPS 인증서는 Caddy가 자동으로 발급합니다.

```bash
git clone https://github.com/JiYoungDo/lotto.git && cd lotto
cp .env.example .env     # DOMAIN, 관리자 비밀번호를 채웁니다 (.env 는 git 제외)
docker compose up -d --build
```

| 환경 변수 | 설명 |
|---|---|
| `DOMAIN` | 서버 IP를 가리키는 내 도메인 (HTTPS 자동 적용) |
| `LOTTO_ADMIN_USERNAME` / `LOTTO_ADMIN_PASSWORD` | 관리자 계정 |
| `VITE_ADSENSE_CLIENT` 등 | Google AdSense 게시자·광고 단위 ID (비워 두면 광고 꺼짐) |

- DB는 `lotto-data` 볼륨에 저장되어 컨테이너를 다시 만들어도 유지됩니다.
- **백업**: `bash deploy/backup.sh` — 앱을 잠깐 멈추고 DB를 압축한 뒤 다시 켭니다. cron으로 매일 실행합니다.
- 서버 메모리가 작을 때(1GB)는 빌드 중 부족할 수 있어 스왑을 추가하는 것을 권장합니다.

## 보안과 개인정보

- 비밀번호는 BCrypt로 암호화해 저장하고, 이름·이메일·전화번호는 받지 않습니다.
- 변경 요청에는 CSRF 토큰이 필요하고, 관리자 기능과 DB 화면은 관리자만 접근할 수 있습니다.
- 로그인(IP당 5분 15회, 아이디당 10분 10회)과 회원가입(IP당 1시간 5회)에 시도 횟수 제한이 있습니다.
- 운영 환경에서는 H2 콘솔을 끄고, 세션 쿠키에 `Secure`·`HttpOnly`·`SameSite`를 적용합니다.

## 로드맵

- [ ] H2 → PostgreSQL 전환
- [ ] 당첨 번호 자동 수집
- [ ] 백업 자동 외부 전송
- [ ] 미니게임 추가

## 라이선스와 면책

개인 학습·운영 프로젝트입니다. 이 저장소의 분석 결과와 번호는 오락·학습용이며,
당첨 가능성을 높이지 않습니다.
