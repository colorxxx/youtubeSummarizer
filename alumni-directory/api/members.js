import { sql } from '@vercel/postgres';
import { ensureTable, str, int } from '../lib/db.js';

// 목록 조회(GET) · 신규 등록(POST)
export default async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT * FROM members
        ORDER BY member_type ASC, name ASC, id ASC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!str(b.name)) {
        return res.status(400).json({ error: '이름은 필수입니다.' });
      }
      const { rows } = await sql`
        INSERT INTO members
          (name, member_type, student_id, age, department, company,
           email, phone, admission_year, graduation_year, note)
        VALUES
          (${str(b.name)}, ${str(b.member_type) || '재학생'}, ${str(b.student_id)},
           ${int(b.age)}, ${str(b.department)}, ${str(b.company)},
           ${str(b.email)}, ${str(b.phone)}, ${int(b.admission_year)},
           ${int(b.graduation_year)}, ${str(b.note)})
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: dbHint(err) });
  }
}

function dbHint(err) {
  const msg = err?.message || String(err);
  if (/POSTGRES_URL|missing_connection_string|connection string/i.test(msg)) {
    return 'DB가 연결되지 않았습니다. Vercel 프로젝트에 Postgres(Neon) 스토리지를 연결해 POSTGRES_URL 환경변수를 설정하세요.';
  }
  return msg;
}
