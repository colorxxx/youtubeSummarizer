# 대학원 동문·재학생 관리 명부

졸업 동문과 재학생 정보를 한곳에서 관리하는 웹 명부입니다.
**빌드 단계가 필요 없는** 정적 프런트엔드(`index.html`) + Vercel 서버리스 함수(`api/`) + **Vercel Postgres(Neon)** 구성이라 Vercel에 바로 배포됩니다.

## 관리 항목

| 항목 | 설명 |
|------|------|
| 이름 | 필수 |
| 구분 | 졸업 동문 / 재학생 |
| 학번 | 예: `2021-30123` |
| 나이 | 정수 |
| 학과/전공 | 소속 학과 |
| 현재 직장 | 직장인의 경우 회사·기관/직책 |
| 입학 연도 / 졸업 연도 | 동문은 졸업 연도 입력 |
| 이메일 / 전화 | 연락처 |
| 비고 | 자유 메모 |

기능: 추가·수정·삭제, 이름/학번/학과/직장 검색, 구분 필터, 동문·재학생 통계, **CSV 내보내기**.

## Vercel 배포 방법

이 앱은 저장소의 `alumni-directory/` 하위 폴더에 있습니다. 두 가지 방법 중 하나로 배포하세요.

### A) 대시보드(권장)

1. <https://vercel.com/new> 에서 이 GitHub 저장소를 **Import**.
2. **Root Directory** 를 `alumni-directory` 로 지정. (Framework Preset: **Other**, Build/Output 설정은 비워둠)
3. **Storage** 탭 → **Create Database → Postgres(Neon)** 생성 후 이 프로젝트에 **Connect**.
   - 연결하면 `POSTGRES_URL` 등 환경변수가 자동으로 추가됩니다.
4. **Deploy**. 첫 API 호출 시 `members` 테이블이 자동 생성됩니다.

### B) Vercel CLI

```bash
cd alumni-directory
vercel link                 # 프로젝트 연결
vercel storage create       # Postgres 생성 후 프로젝트에 연결 (또는 대시보드에서)
vercel --prod               # 배포
```

> **환경변수**: `@vercel/postgres` 는 `POSTGRES_URL` 을 사용합니다. Vercel Postgres/Neon 스토리지를 프로젝트에 연결하면 자동 설정됩니다. 미설정 시 화면 상단에 안내 메시지가 표시됩니다.

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/members` | 전체 목록 |
| POST | `/api/members` | 신규 등록 |
| PUT | `/api/members/:id` | 수정 |
| DELETE | `/api/members/:id` | 삭제 |

## 로컬 실행

```bash
cd alumni-directory
npm install
# POSTGRES_URL 을 .env.local 에 설정한 뒤
vercel dev
```
