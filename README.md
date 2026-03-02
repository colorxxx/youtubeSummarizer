# YouTube Summary Mailer

YouTube 채널을 구독하면 최신 영상을 자동으로 AI 요약해주는 풀스택 웹 애플리케이션.

## 주요 기능

- **YouTube 채널 구독**: 채널 검색 → 구독 → 최근 영상 자동 수집
- **AI 요약 (한국어)**: 영상 자막(transcript) 기반 요약 생성, 자막 없으면 제목+설명으로 fallback
- **요약 이중 구조**: 간략 요약(3~5문장) + 상세 요약(영상 길이에 따라 5~30문장)
- **대시보드**: 채널별로 그룹핑된 요약 뷰, 마크다운 렌더링
- **직접 요약**: URL 입력으로 구독 없이 단일 영상 즉시 요약
- **AI 채팅**: 요약 기반 후속 질문 (SSE 스트리밍)
- **북마크 & 플레이리스트**: 요약 저장 및 정리
- **자동 스케줄링**: 매일 오전 9시(KST) cron job으로 새 영상 체크 및 요약 생성
- **수동 새로고침**: 대시보드에서 즉시 새 영상 체크 가능
- **채널별 설정**: 구독 채널별 요약할 영상 수(1~10) 설정
- **이메일 설정**: 수신 이메일, 빈도(daily/weekly), 알림 on/off 설정

## 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19 | UI 프레임워크 |
| Vite | 7 | 빌드 도구 |
| Tailwind CSS | 4 | 스타일링 |
| shadcn/ui | - | 컴포넌트 라이브러리 (50+ 컴포넌트) |
| Wouter | 3.3 | 라우팅 (경량) |
| tRPC Client | 11 | 타입세이프 API 호출 |
| TanStack Query | 5 | 서버 상태 관리 & 캐싱 |
| React Hook Form + Zod | - | 폼 처리 & 유효성 검증 |
| Framer Motion | 12 | 애니메이션 |
| Streamdown | 1.4 | 마크다운 렌더링 |

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| Express | 4 | HTTP 서버 |
| tRPC | 11 | 타입세이프 API 레이어 |
| Drizzle ORM | 0.44 | DB ORM (타입 추론) |
| MySQL / TiDB | - | 데이터베이스 |
| node-cron | 4 | 스케줄링 (매일 9AM KST) |
| Jose | 6 | JWT 세션 관리 |
| yt-dlp | standalone | 영상 자막 추출 (standalone 바이너리) |
| DeepSeek Chat | - | AI 요약 (OpenAI 호환 API) |

### 개발 도구
| 기술 | 용도 |
|------|------|
| TypeScript 5.9 (strict) | 타입 안전성 |
| Vitest | 테스트 |
| esbuild | 서버 프로덕션 번들링 |
| pnpm | 패키지 매니저 |
| Prettier | 코드 포맷팅 |
| SuperJSON | tRPC 복합 타입 직렬화 |

## 프로젝트 구조

```
├── client/                          # React 프론트엔드
│   ├── src/
│   │   ├── pages/                   # 페이지 컴포넌트
│   │   │   ├── Home.tsx             #   랜딩 페이지
│   │   │   ├── Dashboard.tsx        #   채널별 요약 대시보드
│   │   │   ├── Subscriptions.tsx    #   구독 관리 (검색/추가/삭제/설정)
│   │   │   ├── Summaries.tsx        #   전체 요약 목록
│   │   │   ├── DirectSummary.tsx    #   URL 직접 요약
│   │   │   ├── Bookmarks.tsx        #   북마크 목록
│   │   │   ├── Playlists.tsx        #   플레이리스트 관리
│   │   │   └── Settings.tsx         #   이메일/알림 설정
│   │   ├── components/              # 공통 컴포넌트
│   │   │   ├── ui/                  #   shadcn/ui 컴포넌트 (50+)
│   │   │   ├── DashboardLayout.tsx  #   사이드바 레이아웃
│   │   │   ├── VideoSummaryCard.tsx #   영상 요약 카드 (SummaryTabs 내장)
│   │   │   ├── SummaryTabs.tsx      #   간단/상세 요약 탭
│   │   │   ├── AIChatBox.tsx        #   AI 채팅 컴포넌트
│   │   │   ├── PaginationBar.tsx    #   페이지네이션
│   │   │   └── SearchInput.tsx      #   디바운스 검색 입력
│   │   ├── _core/hooks/useAuth.ts   # 인증 상태 훅
│   │   ├── contexts/ThemeContext.tsx # 테마 (light/dark)
│   │   ├── lib/trpc.ts              # tRPC 클라이언트 설정
│   │   ├── App.tsx                  # 라우팅 정의
│   │   └── main.tsx                 # 엔트리 (tRPC + QueryClient)
│   └── index.html
│
├── server/                          # Express + tRPC 백엔드
│   ├── _core/                       # 코어 인프라
│   │   ├── index.ts                 #   서버 부트스트랩 + 진단 엔드포인트
│   │   ├── trpc.ts                  #   프로시저 정의 (public/protected/admin)
│   │   ├── context.ts               #   요청 컨텍스트 (인증)
│   │   ├── env.ts                   #   환경변수
│   │   ├── llm.ts                   #   DeepSeek Chat 연동 (OpenAI 호환)
│   │   ├── logger.ts                #   로거
│   │   ├── sdk.ts                   #   OAuth + 세션 관리
│   │   └── oauth.ts                 #   OAuth 콜백 핸들러
│   ├── routers/                     # tRPC 라우터 (도메인별 분리)
│   │   ├── index.ts                 #   appRouter 조합 + AppRouter 타입
│   │   ├── auth.ts                  #   인증 (me, logout)
│   │   ├── subscriptions.ts         #   구독 CRUD
│   │   ├── dashboard.ts             #   대시보드 (채널별 요약)
│   │   ├── youtube.ts               #   채널 검색
│   │   ├── videos.ts                #   영상 목록
│   │   ├── summaries.ts             #   요약 CRUD + 직접 요약
│   │   ├── chat.ts                  #   AI 채팅
│   │   ├── bookmarks.ts             #   북마크
│   │   ├── playlists.ts             #   플레이리스트
│   │   ├── settings.ts              #   사용자 설정
│   │   └── backgroundTasks.ts       #   백그라운드 작업 상태
│   ├── db/                          # DB CRUD (도메인별 분리)
│   │   ├── index.ts                 #   barrel re-export
│   │   ├── connection.ts            #   DB 연결
│   │   ├── users.ts                 #   사용자
│   │   ├── subscriptions.ts         #   구독
│   │   ├── videos.ts                #   영상
│   │   ├── summaries.ts             #   요약
│   │   ├── bookmarks.ts             #   북마크
│   │   ├── playlists.ts             #   플레이리스트
│   │   ├── chat.ts                  #   채팅 히스토리
│   │   └── settings.ts              #   사용자 설정
│   ├── youtube.ts                   # YouTube Data API v3 + yt-dlp 자막
│   ├── summarizer.ts                # AI 요약 생성 (DeepSeek)
│   ├── videoUtils.ts                # 영상 길이 파싱 & 요약 길이 산정
│   ├── backgroundTasks.ts           # 백그라운드 영상 처리 (공통)
│   ├── chatStream.ts                # AI 채팅 SSE 스트리밍
│   ├── cronJobs.ts                  # 일일 자동 체크 (node-cron, 09:00 KST)
│   ├── routers.ts                   # (하위호환) routers/index.ts re-export
│   └── db.ts                        # (하위호환) db/index.ts re-export
│
├── drizzle/                         # DB 스키마 & 마이그레이션
│   ├── schema.ts                    # 테이블 정의
│   └── *.sql                        # 마이그레이션 파일
│
├── shared/                          # 클라이언트/서버 공유
│   ├── types.ts                     # DB 타입 re-export
│   ├── const.ts                     # 상수 (쿠키명, 타임아웃 등)
│   └── _core/errors.ts              # HTTP 에러 클래스
│
└── patches/                         # pnpm 패치
    └── wouter@3.7.1.patch
```

## 데이터베이스 스키마

```
users            subscriptions         videos              summaries          userSettings
─────────        ─────────────         ──────              ─────────          ────────────
id (PK)          id (PK)               id (PK)             id (PK)            id (PK)
openId (unique)  userId                videoId (unique)    videoId            userId (unique)
name             channelId             channelId           userId             email
email            channelName           title               summary            emailEnabled
loginMethod      channelThumbnail      description         detailedSummary    summaryFrequency
role (user/admin) videoCount (1~10)    publishedAt         createdAt          videoCount
createdAt        addedAt               thumbnailUrl                           lastEmailSent
updatedAt                              duration                               createdAt
lastSignedIn                           createdAt                              updatedAt
```

## API 엔드포인트 (tRPC)

### 인증
| 프로시저 | 타입 | 보호 | 설명 |
|----------|------|------|------|
| `auth.me` | query | protected | 현재 로그인 사용자 정보 |
| `auth.logout` | mutation | protected | 로그아웃 (쿠키 제거) |

### 구독 관리
| 프로시저 | 타입 | 보호 | 설명 |
|----------|------|------|------|
| `subscriptions.list` | query | protected | 구독 채널 목록 |
| `subscriptions.add` | mutation | protected | 채널 구독 (+ 최근 영상 자동 요약) |
| `subscriptions.remove` | mutation | protected | 구독 해제 |
| `subscriptions.updateSettings` | mutation | protected | 채널별 영상 수 설정 |

### 대시보드
| 프로시저 | 타입 | 보호 | 설명 |
|----------|------|------|------|
| `dashboard.channelSummaries` | query | protected | 채널별 그룹핑된 요약 |
| `dashboard.refreshVideos` | mutation | protected | 수동 새 영상 체크 |

### YouTube
| 프로시저 | 타입 | 보호 | 설명 |
|----------|------|------|------|
| `youtube.searchChannels` | query | protected | 채널 검색 |

### 영상 & 요약
| 프로시저 | 타입 | 보호 | 설명 |
|----------|------|------|------|
| `videos.recent` | query | protected | 최근 영상 목록 (최대 50) |
| `summaries.list` | query | protected | 요약 목록 (최대 50) |

### 설정
| 프로시저 | 타입 | 보호 | 설명 |
|----------|------|------|------|
| `settings.get` | query | protected | 사용자 설정 조회 |
| `settings.update` | mutation | protected | 설정 업데이트 |

## 핵심 로직

### AI 요약 파이프라인
```
채널 구독/cron 트리거
  → YouTube Data API로 최근 영상 수집
  → 영상별 자막(transcript) 추출 시도
  → 자막 없으면 제목+설명으로 fallback
  → DeepSeek Chat으로 한국어 요약 생성
  → 영상 길이 기반 요약 분량 조절:
      - 짧은 영상 (<5분):  간략 2~3문장, 상세 5~7문장
      - 중간 영상 (5~20분): 간략 3~4문장, 상세 10~15문장
      - 긴 영상 (>20분):   간략 4~5문장, 상세 20~30문장
  → DB에 summary + detailedSummary 저장
```

### 인증 흐름
```
Google OAuth 로그인 → 콜백으로 code 수신 → 토큰 교환
→ 사용자 정보 조회 → DB upsert → JWT 생성 → httpOnly 쿠키 설정
```

### 자동 스케줄링
```
매일 09:00 KST (node-cron)
  → 전체 구독 조회 → 채널별 그룹핑
  → 최근 24시간 내 새 영상 확인
  → 새 영상 발견 시 요약 생성 & 저장
```

## 환경 변수

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | MySQL/TiDB 연결 문자열 |
| `YOUTUBE_API_KEY` | YouTube Data API v3 키 |
| `JWT_SECRET` | JWT 서명 시크릿 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 시크릿 |
| `DEEPSEEK_API_KEY` | DeepSeek API 키 |
| `DEEPSEEK_API_URL` | DeepSeek API URL |
| `VITE_GOOGLE_CLIENT_ID` | 클라이언트용 Google OAuth ID |

## 시작하기

### 사전 준비
- Node.js 22.x
- pnpm
- YouTube Data API 키 ([Google Cloud Console](https://console.cloud.google.com/apis/credentials))

### 설치 & 실행
```bash
pnpm install
pnpm db:push      # DB 마이그레이션
pnpm dev           # 개발 서버 (http://localhost:3000)
```

### 빌드 & 배포
```bash
pnpm build         # 클라이언트(Vite) + 서버(esbuild) 번들
pnpm start         # 프로덕션 실행
```

### 테스트
```bash
pnpm test          # Vitest 실행
```

테스트 커버리지:
- YouTube API 연동 (`youtube.test.ts`)
- 구독 관리 CRUD (`subscriptions.test.ts`)
- 구독 + 요약 통합 테스트 (`subscription-with-summary.test.ts`)
- 사용자 설정 (`settings.test.ts`)
- 인증/로그아웃 (`auth.logout.test.ts`)

## 클라이언트 라우팅

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | Home | 랜딩 페이지 (기능 소개, 로그인 CTA) |
| `/dashboard` | Dashboard | 채널별 요약 대시보드 (접기/펼치기) |
| `/subscriptions` | Subscriptions | 구독 관리 (검색/추가/삭제/설정) |
| `/summaries` | Summaries | 전체 요약 목록 |
| `/direct-summary` | DirectSummary | URL 직접 요약 |
| `/bookmarks` | Bookmarks | 북마크 목록 |
| `/playlists` | Playlists | 플레이리스트 관리 |
| `/settings` | Settings | 이메일/알림/빈도 설정 |

## 진단 엔드포인트 (배포 디버깅)

로컬에서는 정상인데 배포 환경에서 안 되는 문제를 빠르게 파악하기 위한 엔드포인트.

| 엔드포인트 | 설명 |
|------------|------|
| `GET /api/debug/yt-dlp` | yt-dlp 바이너리 존재/버전, 자막 fetch 테스트, python3/pip3 상태, 환경 정보(PATH, Node버전, OS) 일괄 확인 |

**응답 항목:**
- `whichYtDlp` — yt-dlp 바이너리 경로
- `ytDlpVersion` — yt-dlp 버전 (standalone binary)
- `ytDlpModuleVersion` — python3 -m yt_dlp 버전 (모듈)
- `pipShowYtDlp` — pip3 show yt-dlp 정보
- `transcriptFetch` — 실제 자막 fetch 테스트 결과 (텍스트 길이, 미리보기)
- `whichCurl` — curl 존재 여부
- `findYtDlp` / `findPython3` — 시스템 전체 바이너리 탐색
- `environment` — PATH, Node.js 버전, platform, arch, tmpdir

## 현재 상태 & 알려진 제한

- **YouTube API 일일 쿼터**: Google Cloud Console에서 사용량 모니터링 필요
- **AI 요약**: DeepSeek Chat (OpenAI 호환 API) 사용

## License

MIT
