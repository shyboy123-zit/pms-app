/* eslint-env node */
// 임시 진단 엔드포인트 — 특정 거래처/월 전표 조회 (서비스롤, 비밀키 보호). 진단 후 삭제 예정.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.ALERT_DIGEST_SECRET;

export default async function handler(req, res) {
  if (!SUPA_URL || !SUPA_SERVICE) return res.status(500).json({ error: 'env 미설정' });
  if (!SECRET || req.query.secret !== SECRET) return res.status(401).json({ error: 'unauthorized' });

  const month = req.query.month || '2026-05'; // YYYY-MM
  const clientLike = req.query.client || '금호정공';
  const supa = createClient(SUPA_URL, SUPA_SERVICE);

  const { data: vouchers = [], error } = await supa
    .from('vouchers')
    .select('id, voucher_date, voucher_type, item_name, item_code, quantity, unit, unit_price, total_amount, client, notes')
    .ilike('client', `%${clientLike}%`)
    .gte('voucher_date', `${month}-01`)
    .lte('voucher_date', `${month}-31`)
    .order('voucher_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const { data: mats = [] } = await supa
    .from('materials').select('id, name, stock, unit').ilike('name', '%D100P%');

  // 합계
  const sales = vouchers.filter(v => v.voucher_type === '매출');
  const purchases = vouchers.filter(v => v.voucher_type === '매입');
  const sum = (arr) => arr.reduce((s, v) => s + parseFloat(v.total_amount || v.quantity * v.unit_price || 0), 0);

  return res.status(200).json({
    month, clientLike,
    salesTotal: sum(sales), purchaseTotal: sum(purchases),
    salesCount: sales.length, purchaseCount: purchases.length,
    distinctClients: [...new Set(vouchers.map(v => v.client))],
    materials: mats,
    sales, purchases,
  });
}
