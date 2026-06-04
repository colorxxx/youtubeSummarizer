import { sql } from '@vercel/postgres';

let tableReady = false;

/**
 * 명부 테이블을 보장한다. 최초 호출 시 한 번만 생성하고 이후엔 캐시한다.
 * member_type: '동문'(졸업) | '재학생'
 */
export async function ensureTable() {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS members (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      member_type     TEXT NOT NULL DEFAULT '재학생',
      student_id      TEXT,
      age             INTEGER,
      department      TEXT,
      company         TEXT,
      email           TEXT,
      phone           TEXT,
      admission_year  INTEGER,
      graduation_year INTEGER,
      note            TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  tableReady = true;
}

/** 빈 문자열/undefined → null 로 정규화 */
export function str(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** 정수 변환, 비어있거나 숫자가 아니면 null */
export function int(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
