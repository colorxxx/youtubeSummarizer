import { sql } from '@vercel/postgres';
import { ensureTable, str, int } from '../../lib/db.js';

// 수정(PUT) · 삭제(DELETE)
export default async function handler(req, res) {
  try {
    await ensureTable();
    const id = int(req.query.id);
    if (!id) return res.status(400).json({ error: '잘못된 id 입니다.' });

    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!str(b.name)) {
        return res.status(400).json({ error: '이름은 필수입니다.' });
      }
      const { rows } = await sql`
        UPDATE members SET
          name            = ${str(b.name)},
          member_type     = ${str(b.member_type) || '재학생'},
          student_id      = ${str(b.student_id)},
          age             = ${int(b.age)},
          department      = ${str(b.department)},
          company         = ${str(b.company)},
          email           = ${str(b.email)},
          phone           = ${str(b.phone)},
          admission_year  = ${int(b.admission_year)},
          graduation_year = ${int(b.graduation_year)},
          note            = ${str(b.note)},
          updated_at      = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) return res.status(404).json({ error: '대상을 찾을 수 없습니다.' });
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const { rowCount } = await sql`DELETE FROM members WHERE id = ${id}`;
      if (!rowCount) return res.status(404).json({ error: '대상을 찾을 수 없습니다.' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'PUT, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
