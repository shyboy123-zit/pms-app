/* eslint-env node */
// Vercel 서버리스 함수 — PMS 일일 요약(텔레그램용) 생성
// 서비스 롤 키로 RLS 우회하여 데이터 조회 → 오늘의 요약 메시지(text) 반환.
// 보호: ?secret=... 이 ALERT_DIGEST_SECRET 와 일치해야 함.
//
// 필요 환경변수: SUPABASE_URL(또는 VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, ALERT_DIGEST_SECRET
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.ALERT_DIGEST_SECRET;

const won = (n) => '₩' + Math.round(n || 0).toLocaleString('ko-KR');

// KST 기준 날짜 문자열 (YYYY-MM-DD)
function kstDate(offsetDays = 0) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 입출고 기반 제품 재고 (IN/ADJUST +, OUT -; item_code 또는 item_name 매칭)
function productStock(txs, product) {
  const code = product.product_code;
  const name = product.name;
  let stock = 0;
  for (const t of txs) {
    const match = (code && t.item_code && t.item_code === code) || (name && t.item_name && t.item_name === name);
    if (!match) continue;
    if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUST') stock += parseFloat(t.quantity || 0);
    else if (t.transaction_type === 'OUT') stock -= parseFloat(t.quantity || 0);
  }
  return stock;
}

export default async function handler(req, res) {
  if (!SUPA_URL || !SUPA_SERVICE) return res.status(500).json({ error: 'Supabase 환경변수 미설정' });
  if (!SECRET || req.query.secret !== SECRET) return res.status(401).json({ error: 'unauthorized' });

  try {
    const supa = createClient(SUPA_URL, SUPA_SERVICE);
    const today = kstDate(0);
    const yesterday = kstDate(-1);

    const [
      { data: products = [] },
      { data: materials = [] },
      { data: txs = [] },
      { data: workOrders = [] },
      { data: molds = [] },
      { data: prodLogs = [] },
      { data: inspections = [] },
      { data: vouchers = [] },
    ] = await Promise.all([
      supa.from('products').select('*'),
      supa.from('materials').select('*'),
      supa.from('inventory_transactions').select('*'),
      supa.from('work_orders').select('*'),
      supa.from('molds').select('*'),
      supa.from('production_logs').select('*').eq('production_date', yesterday),
      supa.from('inspections').select('*').eq('date', yesterday),
      supa.from('vouchers').select('*'),
    ]);

    // 1) 어제 생산량
    const prodQty = prodLogs.reduce((s, l) => s + parseFloat(l.daily_quantity || 0), 0);

    // 2) 어제 불량
    const totalInsp = inspections.length;
    const ngInsp = inspections.filter((i) => i.result === 'NG');
    const defectRate = totalInsp > 0 ? ((ngInsp.length / totalInsp) * 100).toFixed(1) : '0.0';

    // 3) 재고 부족 (원재료 + 제품)
    const lowMaterials = materials.filter((m) => (m.min_stock || 0) > 0 && parseFloat(m.stock || 0) < parseFloat(m.min_stock));
    const lowProducts = products.filter(
      (p) => p.status !== '단종' && (p.min_stock || 0) > 0 && productStock(txs, p) < p.min_stock
    );

    // 4) 초과재고 제품
    const overProducts = products.filter(
      (p) => p.status !== '단종' && (p.max_stock || 0) > 0 && productStock(txs, p) > p.max_stock
    );

    // 5) 작업 지연 (진행중 7일+ & <100%)
    const delayed = workOrders.filter((w) => {
      if (w.status !== '진행중' || !w.start_time) return false;
      const days = (Date.now() - new Date(w.start_time).getTime()) / 86400000;
      const prog = w.target_quantity > 0 ? (w.produced_quantity / w.target_quantity) * 100 : 0;
      return days >= 7 && prog < 100;
    });

    // 6) 금형 점검 도래 (last_check + 90일 경과, 폐기/단종 제외)
    const moldDue = molds.filter((m) => {
      if (['폐기', '단종'].includes(m.status) || !m.last_check) return false;
      const days = (Date.now() - new Date(m.last_check).getTime()) / 86400000;
      return days >= 90;
    });

    // 7) 미수금 (매출 전표 미수 합계)
    const receivable = vouchers
      .filter((v) => v.voucher_type === '매출')
      .reduce((s, v) => {
        const total = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
        const paid = parseFloat(v.paid_amount || 0);
        return s + Math.max(0, total - paid);
      }, 0);

    // ── 메시지 구성 ──
    const lines = [];
    lines.push(`📊 PMS 일일 요약  (${today})`);
    lines.push('');
    lines.push(`🏭 어제 생산량: ${Math.round(prodQty).toLocaleString()}개`);
    lines.push(`🔍 어제 불량률: ${defectRate}%  (${ngInsp.length}/${totalInsp})`);
    lines.push('');

    if (lowMaterials.length || lowProducts.length) {
      lines.push(`⚠️ 재고 부족 ${lowMaterials.length + lowProducts.length}건`);
      lowMaterials.slice(0, 5).forEach((m) =>
        lines.push(`  · [원] ${m.name}: ${parseFloat(m.stock || 0).toLocaleString()}/${parseFloat(m.min_stock).toLocaleString()}${m.unit || ''}`)
      );
      lowProducts.slice(0, 5).forEach((p) =>
        lines.push(`  · [제] ${p.name}: ${productStock(txs, p).toLocaleString()}/${p.min_stock.toLocaleString()}${p.unit || ''}`)
      );
      if (lowMaterials.length + lowProducts.length > 10) lines.push(`  … 외 ${lowMaterials.length + lowProducts.length - 10}건`);
    } else {
      lines.push('✅ 재고 부족 없음');
    }
    lines.push('');

    if (overProducts.length) {
      lines.push(`📦 초과재고 ${overProducts.length}건`);
      overProducts.slice(0, 5).forEach((p) =>
        lines.push(`  · ${p.name}: ${productStock(txs, p).toLocaleString()} (상한 ${p.max_stock.toLocaleString()})${p.unit || ''}`)
      );
      lines.push('');
    }

    if (delayed.length) {
      lines.push(`⏰ 작업 지연 ${delayed.length}건 (7일+ 미완료)`);
      delayed.slice(0, 5).forEach((w) => {
        const p = products.find((x) => x.id === w.product_id);
        const prog = w.target_quantity > 0 ? Math.round((w.produced_quantity / w.target_quantity) * 100) : 0;
        lines.push(`  · ${p?.name || w.order_code}: ${prog}%`);
      });
      lines.push('');
    }

    if (moldDue.length) {
      lines.push(`🛠️ 금형 점검 도래 ${moldDue.length}건`);
      moldDue.slice(0, 5).forEach((m) => lines.push(`  · ${m.name}`));
      lines.push('');
    }

    lines.push(`💰 미수금 합계: ${won(receivable)}`);

    const hasAlert = lowMaterials.length || lowProducts.length || delayed.length || moldDue.length || overProducts.length;

    return res.status(200).json({
      ok: true,
      date: today,
      hasAlert: !!hasAlert,
      message: lines.join('\n'),
    });
  } catch (e) {
    console.error('[alert-digest] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
