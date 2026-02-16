# YouTube Summary Mailer

YouTube 채널을 구독하면 최신 영상을 자동으로 AI 요약해주는 풀스택 웹 애플리케이션.

## 주요 기능

- **YouTube 채널 구독**: 채널 검색 → 구독 → 최근 영상 자동 수집
- **AI 요약 (한국어)**: 영상 자막(transcript) 기반 요약 생성, 자막 없으면 제목+설명으로 fallback
- **요약 이중 구조**: 간략 요약(3~5문장) + 상세 요약(영상 길이에 따라 5~30문장)
- **대시보드**: 채널별로 그룹핑된 요약 뷰, 마크다운 렌더링
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
| youtube-transcript | 1.2 | 영상 자막 추출 |
| Gemini 2.5 Flash | - | AI 요약 (Forge API 경유) |

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
│   │   │   └── Settings.tsx         #   이메일/알림 설정
│   │   ├── components/              # 공통 컴포넌트
│   │   │   ├── ui/                  #   shadcn/ui 컴포넌트 (50+)
│   │   │   └── DashboardLayout.tsx  #   사이드바 레이아웃
│   │   ├── _core/hooks/useAuth.ts   # 인증 상태 훅
│   │   ├── contexts/ThemeContext.tsx # 테마 (light/dark)
│   │   ├── lib/trpc.ts              # tRPC 클라이언트 설정
│   │   ├── App.tsx                  # 라우팅 정의
│   │   └── main.tsx                 # 엔트리 (tRPC + QueryClient)
│   └── index.html
│
├── server/                          # Express + tRPC 백엔드
│   ├── _core/                       # 코어 인프라
│   │   ├── index.ts                 #   서버 부트스트랩
│   │   ├── trpc.ts                  #   프로시저 정의 (public/protected/admin)
│   │   ├── context.ts               #   요청 컨텍스트 (인증)
│   │   ├── env.ts                   #   환경변수
│   │   ├── llm.ts                   #   Gemini 2.5 Flash 연동
│   │   ├── sdk.ts                   #   OAuth + 세션 관리
│   │   └── oauth.ts                 #   OAuth 콜백 핸들러
│   ├── routers.ts                   # API 엔드포인트 정의
│   ├── db.ts                        # DB CRUD 함수
│   ├── youtube.ts                   # YouTube Data API v3 연동
│   ├── summarizer.ts                # AI 요약 생성 로직
│   ├── videoUtils.ts                # 영상 길이 파싱 & 요약 길이 산정
│   ├── cronJobs.ts                  # 일일 자동 체크 (node-cron)
│   ├── mailer.ts                    # 이메일 발송 (미구현, 콘솔 로깅)
│   ├── scheduler.ts                 # 스케줄러
│   └── *.test.ts                    # 테스트 파일들
│
├── drizzle/                         # DB 스키마 & 마이그레이션
│   ├── schema.ts                    # 테이블 정의 (5개)
│   └── 0000~0004_*.sql              # 마이그레이션 파일
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
  → Gemini 2.5 Flash로 한국어 요약 생성
  → 영상 길이 기반 요약 분량 조절:
      - 짧은 영상 (<5분):  간략 2~3문장, 상세 5~7문장
      - 중간 영상 (5~20분): 간략 3~4문장, 상세 10~15문장
      - 긴 영상 (>20분):   간략 4~5문장, 상세 20~30문장
  → DB에 summary + detailedSummary 저장
```

### 인증 흐름
```
Manus OAuth 로그인 → 콜백으로 code 수신 → 토큰 교환
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
| `OWNER_OPEN_ID` | 관리자 자동 승격 대상 OpenID |
| `VITE_APP_ID` | 앱 식별자 |
| `OAUTH_SERVER_URL` | OAuth 서버 URL |
| `BUILT_IN_FORGE_API_URL` | Gemini LLM API 엔드포인트 |
| `BUILT_IN_FORGE_API_KEY` | Gemini LLM API 키 |

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
| `/settings` | Settings | 이메일/알림/빈도 설정 |

## 현재 상태 & 알려진 제한

- **이메일 발송 미구현**: 현재 콘솔 로깅만 수행. 실제 이메일 서비스(SendGrid, Resend 등) 연동 필요
- **YouTube API 일일 쿼터**: Google Cloud Console에서 사용량 모니터링 필요
- **AI 요약**: Manus Forge API 경유 Gemini 2.5 Flash 사용
- **Manus 플랫폼 의존**: OAuth, LLM, 알림 등이 Manus 인프라에 의존

## License

MIT
