/* eslint-env node */
// 임시 진단 엔드포인트 — 전표 조회 + 단가 보정 (서비스롤, 비밀키 보호). 진단 후 삭제 예정.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.ALERT_DIGEST_SECRET;

export default async function handler(req, res) {
  if (!SUPA_URL || !SUPA_SERVICE) return res.status(500).json({ error: 'env 미설정' });
  if (!SECRET || req.query.secret !== SECRET) return res.status(401).json({ error: 'unauthorized' });

  const month = req.query.month || '2026-06';
  const supa = createClient(SUPA_URL, SUPA_SERVICE);

  // 단가 일괄 보정: 특정 품목이 특정 단가면 새 단가로 (id 목록 지정 시 그 id만)
  if (req.query.action === 'fixprice' && req.query.confirm === 'yes') {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    const newPrice = parseFloat(req.query.newPrice || '35');
    const log = [];
    for (const id of ids) {
      const r = await supa.from('vouchers').update({ unit_price: newPrice }).eq('id', id);
      log.push({ id, error: r.error?.message || null });
    }
    return res.status(200).json({ fixed: true, newPrice, log });
  }

  // 조회: 해당 월 전표 전체 (금호정공 + 품목/단가 점검)
  const { data: vouchers = [], error } = await supa
    .from('vouchers')
    .select('id, voucher_date, voucher_type, item_name, quantity, unit_price, total_amount, client')
    .gte('voucher_date', `${month}-01`)
    .lte('voucher_date', `${month}-31`)
    .order('voucher_date', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  // Y7T PIVOT 전체 (월 무관) — 단가 이력 확인용
  const { data: y7t = [] } = await supa
    .from('vouchers')
    .select('id, voucher_date, item_name, quantity, unit_price, client')
    .ilike('item_name', '%Y7T%')
    .order('voucher_date', { ascending: true });

  return res.status(200).json({
    month,
    y7tAll: y7t,
    monthY7t: vouchers.filter(v => /Y7T/i.test(v.item_name || '')),
    monthPrice34: vouchers.filter(v => Math.round(parseFloat(v.unit_price)) === 34),
  });
}
