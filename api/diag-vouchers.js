/* eslint-env node */
// 임시 진단 — 입출고/전표 대사용 (서비스롤, 비밀키). 진단 후 삭제.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.ALERT_DIGEST_SECRET;

export default async function handler(req, res) {
  if (!SUPA_URL || !SUPA_SERVICE) return res.status(500).json({ error: 'env 미설정' });
  if (!SECRET || req.query.secret !== SECRET) return res.status(401).json({ error: 'unauthorized' });

  const month = req.query.month || '2026-05';
  const [yy, mm] = month.split('-').map(Number);
  const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  const supa = createClient(SUPA_URL, SUPA_SERVICE);

  // 입출고 수정/삭제 (대사 일치용)
  if (req.query.action === 'invfix' && req.query.confirm === 'yes') {
    const log = [];
    const dels = (req.query.del || '').split(',').filter(Boolean);
    for (const id of dels) {
      const r = await supa.from('inventory_transactions').delete().eq('id', id);
      log.push({ del: id, error: r.error?.message || null });
    }
    // updPrice: id:price,id:price
    const ups = (req.query.upd || '').split(',').filter(Boolean);
    for (const pair of ups) {
      const [id, price] = pair.split(':');
      const r = await supa.from('inventory_transactions').update({ unit_price: parseFloat(price) }).eq('id', id);
      log.push({ upd: id, price, error: r.error?.message || null });
    }
    return res.status(200).json({ fixed: true, log });
  }

  // 입출고 OUT 조회 (월/거래처)
  const { data: tx = [], error } = await supa
    .from('inventory_transactions')
    .select('id, transaction_date, transaction_type, item_name, item_code, quantity, unit_price, client')
    .gte('transaction_date', `${month}-01`)
    .lt('transaction_date', nextMonth)
    .order('transaction_date', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const out = tx.filter(t => t.transaction_type === 'OUT' && /금호정공/.test(t.client || ''));
  const txSales = out.reduce((s, t) => s + (parseFloat(t.quantity) || 0) * (parseFloat(t.unit_price) || 0), 0);

  return res.status(200).json({
    month, txSalesTotal: txSales, outCount: out.length,
    out120_6020: out.filter(t => /120-6020/.test(t.item_name || '')),
    outY7T: out.filter(t => /Y7T/i.test(t.item_name || '')),
    distinctClients: [...new Set(out.map(t => t.client))],
  });
}
