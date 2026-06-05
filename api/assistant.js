/* eslint-env node */
// Vercel 서버리스 함수 — PMS AI 질문방 어시스턴트 (조회 전용)
// Claude Tool-Calling 으로 전사 데이터(제품/원재료/생산/매출/품질/설비)에
// 대한 자연어 질문에 답한다. 정확한 숫자 계산은 서버(JS)에서 수행하고,
// Claude 는 도구 선택과 한국어 답변 작성만 담당한다.
//
// 필요한 환경변수(Vercel):
//   ANTHROPIC_API_KEY          — Claude API 키 (서버에만 보관)
//   SUPABASE_URL               — (또는 VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase 서비스 롤 키 (send-push 와 공유)
//   ASSISTANT_MODEL (선택)     — 기본 claude-haiku-4-5-20251001
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODEL = process.env.ASSISTANT_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `당신은 한 사출 제조회사의 생산관리시스템(PMS) 사내 AI 어시스턴트입니다.
직원이 한국어로 묻는 재고·원재료·생산·매출·품질·설비 관련 질문에 답합니다.

규칙:
- 숫자/사실은 반드시 제공된 도구를 호출해서 얻으세요. 절대 추측하거나 지어내지 마세요.
- 도구 결과에 데이터가 없으면 "해당 데이터가 없습니다"라고 솔직히 답하세요.
- 답변은 간결한 한국어로, 핵심 숫자를 굵게(**) 강조하세요.
- 여러 도구가 필요한 복합 질문은 순서대로 도구를 호출해 종합하세요.
- 당신은 조회 전용입니다. 데이터를 변경/등록/삭제할 수 없습니다. 그런 요청은 정중히 거절하고 담당 페이지에서 직접 처리하도록 안내하세요.
- 원재료 소요량 계산이 안 되는 경우(제품 중량/캐비티 정보 누락)는 그 사실을 알려주세요.
- 매출/매입 금액 정보는 관리자 전용입니다. 관리자가 아닌 사용자가 매출·매입을 물으면 "매출/매입 정보는 관리자만 조회할 수 있습니다"라고 정중히 안내하세요(다른 현장 정보는 정상 안내).`;

// ── 도구 정의 (Claude 에게 노출) ──────────────────────────────
const TOOLS = [
  {
    name: 'find_products',
    description: '제품을 이름/코드로 검색해 정보(현재고, 단가, 모델, 연결된 원재료, 중량/캐비티)를 조회한다. query 생략 시 전체 목록.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: '제품명 또는 제품코드 일부 (생략 가능)' } },
    },
  },
  {
    name: 'find_materials',
    description: '원재료를 이름으로 검색해 현재 재고(kg 등), 단위, 안전재고, 단가를 조회한다. query 생략 시 전체 목록.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: '원재료명 일부 (생략 가능)' } },
    },
  },
  {
    name: 'calc_material_requirement',
    description: '특정 제품을 N개 생산하는 데 필요한 원재료량(kg)을 계산하고, 현재 원재료 재고로 생산 가능한지 판정한다.',
    input_schema: {
      type: 'object',
      properties: {
        product_query: { type: 'string', description: '제품명 또는 코드' },
        quantity: { type: 'number', description: '생산 목표 수량(개)' },
        scrap_rate: { type: 'number', description: '로스율(%) 선택, 기본 0' },
      },
      required: ['product_query', 'quantity'],
    },
  },
  {
    name: 'calc_producible_quantity',
    description: '현재 원재료 재고로 특정 제품을 최대 몇 개까지 생산할 수 있는지 계산한다.',
    input_schema: {
      type: 'object',
      properties: { product_query: { type: 'string', description: '제품명 또는 코드' } },
      required: ['product_query'],
    },
  },
  {
    name: 'sales_summary',
    description: '기간별 매출/매입 전표(vouchers)를 합계 집계한다. 거래처별/품목별 상위도 제공.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['매출', '매입'], description: '전표 유형, 기본 매출' },
        start_date: { type: 'string', description: 'YYYY-MM-DD (선택)' },
        end_date: { type: 'string', description: 'YYYY-MM-DD (선택)' },
      },
    },
  },
  {
    name: 'quality_summary',
    description: '기간별 품질검사(inspections) 합격/불량(OK/NG) 건수와 불량률, 불량유형을 집계한다.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD (선택)' },
        end_date: { type: 'string', description: 'YYYY-MM-DD (선택)' },
      },
    },
  },
  {
    name: 'list_work_orders',
    description: '작업지시(work_orders) 현황을 상태별로 조회한다(대기/진행중/완료/취소). 진척률 포함.',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', description: '상태 필터 (선택)' } },
    },
  },
  {
    name: 'list_low_stock',
    description: '안전재고 미달인 원재료/제품 목록을 조회한다.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'equipment_mold_status',
    description: '설비(equipments) 가동상태와 금형(molds) 점검 도래(최종점검 90일 경과) 현황을 조회한다.',
    input_schema: { type: 'object', properties: {} },
  },
];

// ── 유틸 ──────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
const fuzzy = (rows, query, fields) => {
  if (!query) return rows;
  const q = norm(query);
  return rows.filter((r) => fields.some((f) => norm(r[f]).includes(q)));
};

// 제품 현재고 = inventory_transactions 합산 (item_name = 제품명 또는 코드)
function productStock(product, txns) {
  let stock = 0;
  for (const t of txns) {
    if (t.item_name === product.name || t.item_name === product.product_code) {
      const q = parseFloat(t.quantity) || 0;
      if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUST') stock += q;
      else if (t.transaction_type === 'OUT') stock -= q;
    }
  }
  return stock;
}

// 제품 1개당 원재료(g): 캐비티 고려 — 1샷 = cavity*제품중량 + 런너중량, 1샷당 cavity개 생산
function perUnitGram(p) {
  const pw = parseFloat(p.product_weight) || 0;
  const rw = parseFloat(p.runner_weight) || 0;
  const cav = parseFloat(p.cavity_count) || 1;
  if (pw <= 0) return null; // 계산 불가
  return pw + rw / (cav > 0 ? cav : 1);
}

// ── 도구 실행기 ───────────────────────────────────────────────
async function runTool(name, input, supa, cache, isAdmin) {
  const getProducts = async () => {
    if (!cache.products) cache.products = (await supa.from('products').select('*')).data || [];
    return cache.products;
  };
  const getMaterials = async () => {
    if (!cache.materials) cache.materials = (await supa.from('materials').select('*')).data || [];
    return cache.materials;
  };
  const getTxns = async () => {
    if (!cache.txns) cache.txns = (await supa.from('inventory_transactions').select('item_name,transaction_type,quantity')).data || [];
    return cache.txns;
  };

  if (name === 'find_products') {
    const [prods, mats, txns] = [await getProducts(), await getMaterials(), await getTxns()];
    const matched = fuzzy(prods, input.query, ['name', 'product_code', 'model']).slice(0, 25);
    return matched.map((p) => {
      const mat = mats.find((m) => m.id === p.material_id);
      return {
        제품명: p.name, 제품코드: p.product_code, 모델: p.model || null,
        현재고: productStock(p, txns), 단위: p.unit, 안전재고: p.min_stock,
        단가: p.unit_price, 상태: p.status,
        제품중량_g: p.product_weight, 런너중량_g: p.runner_weight, 캐비티: p.cavity_count,
        연결원재료: mat ? mat.material_name : null, 원재료재고: mat ? mat.stock : null, 원재료단위: mat ? mat.unit : null,
      };
    });
  }

  if (name === 'find_materials') {
    const mats = await getMaterials();
    return fuzzy(mats, input.query, ['material_name']).slice(0, 30).map((m) => ({
      원재료명: m.material_name, 현재고: m.stock, 단위: m.unit, 안전재고: m.min_stock, 단가: m.unit_price,
    }));
  }

  if (name === 'calc_material_requirement' || name === 'calc_producible_quantity') {
    const [prods, mats] = [await getProducts(), await getMaterials()];
    const matched = fuzzy(prods, input.product_query, ['name', 'product_code', 'model']);
    if (matched.length === 0) return { 오류: '해당 제품을 찾지 못했습니다.', 검색어: input.product_query };
    if (matched.length > 1) return { 안내: '여러 제품이 검색됨 — 더 정확한 제품명이 필요합니다.', 후보: matched.slice(0, 8).map((p) => p.name) };
    const p = matched[0];
    const perUnit = perUnitGram(p);
    if (perUnit == null) return { 오류: '제품 중량(product_weight) 정보가 없어 계산할 수 없습니다.', 제품: p.name };
    const mat = mats.find((m) => m.id === p.material_id);
    if (!mat) return { 오류: '제품에 연결된 원재료가 없습니다.', 제품: p.name };
    const stockKg = parseFloat(mat.stock) || 0;

    if (name === 'calc_producible_quantity') {
      const producible = Math.floor((stockKg * 1000) / perUnit);
      return {
        제품: p.name, 연결원재료: mat.material_name, 원재료재고_kg: stockKg,
        제품1개당_g: Math.round(perUnit * 1000) / 1000, 생산가능수량_개: producible,
      };
    }
    const qty = parseFloat(input.quantity) || 0;
    const scrap = parseFloat(input.scrap_rate) || 0;
    const neededG = qty * perUnit * (1 + scrap / 100);
    const neededKg = Math.round((neededG / 1000) * 1000) / 1000;
    return {
      제품: p.name, 목표수량_개: qty, 로스율_pct: scrap,
      연결원재료: mat.material_name, 제품1개당_g: Math.round(perUnit * 1000) / 1000,
      필요원재료_kg: neededKg, 현재원재료재고_kg: stockKg,
      생산가능여부: stockKg >= neededKg ? '가능' : '부족',
      부족분_kg: stockKg >= neededKg ? 0 : Math.round((neededKg - stockKg) * 1000) / 1000,
    };
  }

  if (name === 'sales_summary') {
    if (!isAdmin) return { 오류: '매출/매입 정보는 관리자만 조회할 수 있습니다.' };
    const type = input.type || '매출';
    let q = supa.from('vouchers').select('voucher_date,voucher_type,item_name,quantity,unit_price,total_amount,client').eq('voucher_type', type);
    if (input.start_date) q = q.gte('voucher_date', input.start_date);
    if (input.end_date) q = q.lte('voucher_date', input.end_date);
    const rows = (await q).data || [];
    const total = rows.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
    const byClient = {}, byItem = {};
    for (const r of rows) {
      byClient[r.client || '미지정'] = (byClient[r.client || '미지정'] || 0) + (parseFloat(r.total_amount) || 0);
      byItem[r.item_name || '미지정'] = (byItem[r.item_name || '미지정'] || 0) + (parseFloat(r.total_amount) || 0);
    }
    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ 이름: k, 금액: Math.round(v) }));
    return {
      유형: type, 기간: `${input.start_date || '전체'} ~ ${input.end_date || '전체'}`,
      전표수: rows.length, 총액: Math.round(total), 거래처상위: top(byClient), 품목상위: top(byItem),
    };
  }

  if (name === 'quality_summary') {
    let q = supa.from('inspections').select('*');
    if (input.start_date) q = q.gte('date', input.start_date);
    if (input.end_date) q = q.lte('date', input.end_date);
    const rows = (await q).data || [];
    const ng = rows.filter((r) => r.result === 'NG');
    const ngTypes = {};
    for (const r of ng) ngTypes[r.ng_type || '기타'] = (ngTypes[r.ng_type || '기타'] || 0) + 1;
    return {
      기간: `${input.start_date || '전체'} ~ ${input.end_date || '전체'}`,
      총검사: rows.length, 합격_OK: rows.length - ng.length, 불량_NG: ng.length,
      불량률_pct: rows.length ? Math.round((ng.length / rows.length) * 1000) / 10 : 0,
      불량유형: Object.entries(ngTypes).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ 유형: k, 건수: v })),
    };
  }

  if (name === 'list_work_orders') {
    const [orders, prods] = [(await supa.from('work_orders').select('*').order('created_at', { ascending: false })).data || [], await getProducts()];
    const filtered = input.status ? orders.filter((o) => o.status === input.status) : orders;
    return filtered.slice(0, 30).map((o) => {
      const p = prods.find((x) => x.id === o.product_id);
      const target = parseFloat(o.target_quantity) || 0, made = parseFloat(o.produced_quantity) || 0;
      return {
        작업번호: o.order_code, 제품: p ? p.name : null, 상태: o.status,
        목표: target, 생산: made, 진척률_pct: target ? Math.round((made / target) * 1000) / 10 : 0,
        지시일: o.order_date,
      };
    });
  }

  if (name === 'list_low_stock') {
    const [mats, prods, txns] = [await getMaterials(), await getProducts(), await getTxns()];
    const lowMats = mats.filter((m) => parseFloat(m.min_stock) > 0 && parseFloat(m.stock) < parseFloat(m.min_stock))
      .map((m) => ({ 구분: '원재료', 이름: m.material_name, 현재고: m.stock, 안전재고: m.min_stock, 단위: m.unit }));
    const lowProds = prods.filter((p) => parseFloat(p.min_stock) > 0 && productStock(p, txns) < parseFloat(p.min_stock))
      .map((p) => ({ 구분: '제품', 이름: p.name, 현재고: productStock(p, txns), 안전재고: p.min_stock, 단위: p.unit }));
    return { 미달항목수: lowMats.length + lowProds.length, 목록: [...lowMats, ...lowProds] };
  }

  if (name === 'equipment_mold_status') {
    const eqs = (await supa.from('equipments').select('*')).data || [];
    const molds = (await supa.from('molds').select('*')).data || [];
    const now = Date.now();
    const dueMolds = molds.filter((m) => {
      if (!m.last_check || m.status === '폐기' || m.status === '단종') return false;
      return (now - new Date(m.last_check).getTime()) / 86400000 >= 90;
    }).map((m) => ({ 금형: m.name || m.code, 최종점검: m.last_check, 타수: m.cycle_count }));
    const eqByStatus = {};
    for (const e of eqs) eqByStatus[e.status || '미지정'] = (eqByStatus[e.status || '미지정'] || 0) + 1;
    return {
      설비총수: eqs.length, 설비상태별: eqByStatus,
      가동중설비: eqs.filter((e) => e.status === '가동중').map((e) => e.eq_code || e.name),
      점검도래금형수: dueMolds.length, 점검도래금형: dueMolds.slice(0, 15),
    };
  }

  return { 오류: `알 수 없는 도구: ${name}` };
}

// ── 핸들러 ────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 가 설정되지 않았습니다.' });
  if (!SUPA_URL || !SUPA_SERVICE) return res.status(500).json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' });

  try {
    const { question, history, token } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ error: '질문이 비어 있습니다.' });

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const supa = createClient(SUPA_URL, SUPA_SERVICE);
    const cache = {};

    // 요청자 권한 확인 — 로그인 토큰을 서버에서 검증해 직급 조회 (클라이언트 신뢰 X)
    // 관리자만 매출/매입(sales_summary) 도구 사용 가능.
    let isAdmin = false;
    if (token) {
      try {
        const { data: { user: authUser } } = await supa.auth.getUser(token);
        if (authUser) {
          const { data: emp } = await supa.from('employees').select('position').eq('auth_user_id', authUser.id).single();
          if (emp?.position === '관리자') isAdmin = true;
        }
      } catch { /* 검증 실패 → 비관리자로 처리(안전 기본값) */ }
    }
    const tools = isAdmin ? TOOLS : TOOLS.filter((t) => t.name !== 'sales_summary');

    // 오늘 날짜(한국시간)를 시스템 프롬프트에 주입 — "이번 달/오늘/최근" 등 상대적 기간 해석용
    const todayKST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const system = `${SYSTEM_PROMPT}

오늘 날짜는 ${todayKST} (한국시간)입니다. "이번 달", "오늘", "최근", "올해" 같은 상대적 기간 표현은 반드시 이 날짜를 기준으로 해석하세요. 예: "이번 달"은 ${todayKST.slice(0, 7)}-01 부터 ${todayKST} 까지입니다.`;

    // 직전 대화 최대 6턴만 컨텍스트로 전달
    const prior = Array.isArray(history)
      ? history.slice(-6).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '') }))
      : [];
    const messages = [...prior, { role: 'user', content: String(question) }];

    let answer = '';
    for (let step = 0; step < 6; step++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools,
        messages,
      });

      const toolUses = resp.content.filter((c) => c.type === 'tool_use');
      const textPart = resp.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
      if (textPart) answer = textPart;

      if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) break;

      messages.push({ role: 'assistant', content: resp.content });
      const results = [];
      for (const tu of toolUses) {
        let out;
        try {
          out = await runTool(tu.name, tu.input || {}, supa, cache, isAdmin);
        } catch (e) {
          out = { 오류: e.message };
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
      }
      messages.push({ role: 'user', content: results });
    }

    return res.status(200).json({ ok: true, answer: answer || '죄송합니다, 답변을 생성하지 못했습니다.' });
  } catch (e) {
    console.error('[assistant] error:', e);
    return res.status(500).json({ error: e.message || '어시스턴트 오류' });
  }
}
