/* eslint-env node */
// Vercel 서버리스 함수 — 새 채팅 메시지를 전 직원 폰에 Web Push 발송
// 필요한 환경변수(Vercel): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//                          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !SUPA_URL || !SUPA_SERVICE) {
    return res.status(500).json({ error: 'Push env vars not configured' });
  }

  try {
    webpush.setVapidDetails('mailto:admin@pms.local', VAPID_PUBLIC, VAPID_PRIVATE);
    const supabase = createClient(SUPA_URL, SUPA_SERVICE);

    const { senderId, senderName, content } = req.body || {};

    // 보낸 사람 제외한 모든 구독 조회
    let query = supabase.from('push_subscriptions').select('*');
    if (senderId) query = query.neq('user_id', senderId);
    const { data: subs, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const payload = JSON.stringify({
      title: `${senderName || '직원'}`,
      body: (content || '').slice(0, 120) || '새 메시지',
      tag: 'pms-chat',
      url: '/chat',
    });

    let sent = 0;
    const dead = [];
    await Promise.all(
      (subs || []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (e) {
          // 410/404 = 만료된 구독 → 정리 대상
          if (e.statusCode === 410 || e.statusCode === 404) dead.push(s.endpoint);
        }
      })
    );

    // 만료 구독 삭제
    if (dead.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', dead);
    }

    return res.status(200).json({ ok: true, sent, cleaned: dead.length });
  } catch (e) {
    console.error('[send-push] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
