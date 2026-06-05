/* eslint-env node */
// Vercel 서버리스 함수 — 아이디(가입 이메일) 찾기
// 로그인 전 상태에서 호출되므로 service role 로 employees 를 조회한다.
// 보안: 이름 + 사원번호가 모두 일치할 때만, 그것도 "마스킹된" 이메일만 반환한다.
//
// 필요 환경변수: SUPABASE_URL(또는 VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// kimhj@gmail.com → ki***@gmail.com  (로컬파트 앞 2글자만 노출)
function maskEmail(email) {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}${'*'.repeat(Math.max(3, local.length - keep.length))}@${domain}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPA_URL || !SUPA_SERVICE) return res.status(500).json({ error: 'Supabase 환경변수 미설정' });

  try {
    const { name, emp_id } = req.body || {};
    if (!name || !emp_id || !String(name).trim() || !String(emp_id).trim()) {
      return res.status(400).json({ error: '이름과 사원번호를 모두 입력하세요.' });
    }

    const supa = createClient(SUPA_URL, SUPA_SERVICE);
    const { data, error } = await supa
      .from('employees')
      .select('email, name, emp_id')
      .eq('name', String(name).trim())
      .eq('emp_id', String(emp_id).trim())
      .limit(1);

    if (error) return res.status(500).json({ error: error.message });

    const emp = data && data[0];
    if (!emp || !emp.email) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json({ found: true, email: maskEmail(emp.email) });
  } catch (e) {
    console.error('[find-account] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
