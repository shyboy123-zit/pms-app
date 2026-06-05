/* eslint-env node */
// Vercel 서버리스 함수 — 관리자에 의한 직원 비밀번호 초기화
// 요청자가 진짜 관리자(employees.position === '관리자')인지 토큰으로 검증한 뒤,
// 대상 직원의 Supabase Auth 비밀번호를 새 임시값으로 변경한다.
//
// 필요 환경변수: SUPABASE_URL(또는 VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPA_URL || !SUPA_SERVICE) return res.status(500).json({ error: 'Supabase 환경변수 미설정' });

  try {
    const { token, employeeId, newPassword } = req.body || {};
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
    if (!employeeId) return res.status(400).json({ error: '대상 직원이 지정되지 않았습니다.' });
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: '임시 비밀번호는 6자 이상이어야 합니다.' });
    }

    const supa = createClient(SUPA_URL, SUPA_SERVICE);

    // 1) 요청자 검증 — 토큰의 사용자가 관리자인지 확인
    const { data: { user: authUser } } = await supa.auth.getUser(token);
    if (!authUser) return res.status(401).json({ error: '인증에 실패했습니다.' });
    const { data: requester } = await supa
      .from('employees').select('position').eq('auth_user_id', authUser.id).single();
    if (requester?.position !== '관리자') {
      return res.status(403).json({ error: '관리자만 비밀번호를 초기화할 수 있습니다.' });
    }

    // 2) 대상 직원의 auth_user_id 조회
    const { data: target, error: tErr } = await supa
      .from('employees').select('auth_user_id, name').eq('id', employeeId).single();
    if (tErr || !target) return res.status(404).json({ error: '대상 직원을 찾을 수 없습니다.' });
    if (!target.auth_user_id) {
      return res.status(400).json({ error: '이 직원은 앱 로그인 계정이 연결되어 있지 않습니다.' });
    }

    // 3) 비밀번호 변경 (Admin API)
    const { error: uErr } = await supa.auth.admin.updateUserById(target.auth_user_id, {
      password: String(newPassword),
    });
    if (uErr) return res.status(500).json({ error: uErr.message });

    return res.status(200).json({ ok: true, name: target.name });
  } catch (e) {
    console.error('[admin-reset-password] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
