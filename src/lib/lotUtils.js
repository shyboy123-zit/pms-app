// ============================================================
// LOT(롯트) 관리 공용 로직
// ------------------------------------------------------------
// inventory_transactions 행들로부터 "제품 × LOT" 단위 원장을 만든다.
//  - 입고(IN)      : 해당 LOT 잔량 +
//  - 출고(OUT)     : 해당 LOT 잔량 -
//  - 재고조정(ADJUST): 해당 LOT 잔량 + (음수면 감소)
//
// 출고 시 "LOT 잔량보다 많이 못 나가게" 막고, 납품서 LOT와
// 시스템 LOT가 일치하는지 대조하는 데 쓰인다.
// ============================================================

export const UNSPECIFIED_LOT = '(미지정)';

/** LOT 표시용 정규화 — 빈 값/NULL은 '(미지정)' 한 덩어리로 묶는다. */
export const normalizeLot = (lot) => {
    const v = (lot ?? '').toString().trim();
    return v === '' ? UNSPECIFIED_LOT : v;
};

/**
 * DB 저장용 LOT 변환 — 빈 값과 '(미지정)'은 NULL 로 저장한다.
 * '(미지정)'은 "LOT를 모른다"는 뜻의 화면 표시용 라벨이므로 그대로 저장하면
 * 납품서 LOT와 비교됐을 때 '불일치'로 잡혀 버린다. NULL 이어야 '대조대기'가 된다.
 */
export const toStoredLot = (lot) => {
    const v = (lot ?? '').toString().trim();
    if (v === '' || v === UNSPECIFIED_LOT) return null;
    return v;
};

/** LOT 비교용 정규화 — 대소문자·공백·하이픈 차이를 무시한다. (납품서 표기 차이 흡수) */
export const canonicalLot = (lot) =>
    (lot ?? '').toString().trim().toUpperCase().replace(/[\s\-_/.]/g, '');

/** 두 LOT 번호가 실질적으로 같은지 */
export const isSameLot = (a, b) => canonicalLot(a) === canonicalLot(b);

// ============================================================
// 회사 LOT 체계 (금호정공 「LOT NO 체계표」) — 제조년월일 3자리
//   LOT = [제조년도 1자] + [제조월 1자] + [제조일 1자]
//   · 년도 : 2010=F 부터 한 글자씩 (…22=R, 23=S, 24=T, 25=U, 26=V)
//   · 월   : 1월=A … 12월=L
//   · 일   : 1일=A … 26일=Z, 27일=1, 28일=2 … 31일=5
//   예) 2026-11-23 → V(26년) K(11월) W(23일) = "VKW"
// ============================================================

// 년도 글자는 A~Z 26년 주기. 체계표의 2010=F 에 맞추면 2005=A, 2030=Z 이고
// 2031부터 다시 A 로 도는 것으로 본다. (체계표에 그 이후 규칙이 없음)
const LOT_YEAR_EPOCH = 2005;

/** 제조년도 → 글자 (2026 → 'V') */
export const lotYearChar = (year) => {
    const y = Math.trunc(Number(year));
    if (!Number.isFinite(y)) return '';
    const idx = (((y - LOT_YEAR_EPOCH) % 26) + 26) % 26;
    return String.fromCharCode(65 + idx);
};

/** 제조월 → 글자 (11 → 'K') */
export const lotMonthChar = (month) => {
    const m = Math.trunc(Number(month));
    if (!(m >= 1 && m <= 12)) return '';
    return String.fromCharCode(65 + m - 1);
};

/** 제조일 → 글자 (23 → 'W', 27 → '1') */
export const lotDayChar = (day) => {
    const d = Math.trunc(Number(day));
    if (!(d >= 1 && d <= 31)) return '';
    return d <= 26 ? String.fromCharCode(65 + d - 1) : String(d - 26);
};

/** 거래일자 → 회사 LOT 번호 (2026-11-23 → 'VKW') */
export const suggestLotNo = (dateStr) => {
    const m = (dateStr || '').toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    const y = lotYearChar(parseInt(m[1], 10));
    const mo = lotMonthChar(parseInt(m[2], 10));
    const d = lotDayChar(parseInt(m[3], 10));
    return (y && mo && d) ? `${y}${mo}${d}` : '';
};

/**
 * 회사 LOT 번호 → 제조일자 해석 (3자리 체계일 때만, 아니면 null)
 * 년도 글자가 26년 주기라 후보가 여러 개 → 기준일(+1년)을 넘지 않는 가장 최근 년도로 본다.
 * @returns {{ year:number, month:number, day:number, dateStr:string }|null}
 */
export const parseLotNo = (lot, today = new Date()) => {
    const s = canonicalLot(lot);
    if (!/^[A-Z][A-L][A-Z1-5]$/.test(s)) return null;

    const month = s.charCodeAt(1) - 64;                 // A=1 … L=12
    const dc = s[2];
    const day = (dc >= '1' && dc <= '5') ? 26 + Number(dc) : s.charCodeAt(2) - 64;
    if (!(day >= 1 && day <= 31)) return null;

    const limit = today.getFullYear() + 1;
    let year = LOT_YEAR_EPOCH + (s.charCodeAt(0) - 65);
    while (year + 26 <= limit) year += 26;

    // 실제로 존재하는 날짜인지 확인 (예: 2월 30일 → 무효)
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

    const pad = (n) => String(n).padStart(2, '0');
    return { year, month, day, dateStr: `${year}-${pad(month)}-${pad(day)}` };
};

/** LOT 번호를 사람이 읽는 제조일자로 ('VKW' → '2026-11-23'), 해석 불가면 null */
export const lotDateLabel = (lot, today = new Date()) => {
    const parsed = parseLotNo(lot, today);
    return parsed ? parsed.dateStr : null;
};

const itemKey = (itemName) => (itemName || '').trim();

/**
 * 제품 × LOT 원장 집계
 * @param {Array} transactions inventory_transactions 행 배열
 * @returns {Array} [{ itemName, itemCode, lotNo, unit, inQty, outQty, adjustQty, remain,
 *                     firstInDate, lastOutDate, lastPrice, txCount }]
 */
export const buildLotLedger = (transactions) => {
    const map = new Map();

    (transactions || []).forEach(t => {
        const name = itemKey(t.item_name);
        if (!name) return;
        const lotNo = normalizeLot(t.lot_no);
        const key = `${name}\u0000${canonicalLot(lotNo)}`;
        let row = map.get(key);
        if (!row) {
            row = {
                itemName: name,
                itemCode: t.item_code || '',
                lotNo,
                unit: t.unit || 'EA',
                inQty: 0, outQty: 0, adjustQty: 0, remain: 0,
                firstInDate: null, lastOutDate: null,
                lastPrice: parseFloat(t.unit_price) || 0,
                txCount: 0
            };
            map.set(key, row);
        }
        if (!row.itemCode && t.item_code) row.itemCode = t.item_code;
        row.txCount += 1;

        const qty = parseFloat(t.quantity) || 0;
        const date = t.transaction_date || '';

        if (t.transaction_type === 'IN') {
            row.inQty += qty;
            row.remain += qty;
            if (date && (!row.firstInDate || date < row.firstInDate)) row.firstInDate = date;
            if (parseFloat(t.unit_price)) row.lastPrice = parseFloat(t.unit_price);
        } else if (t.transaction_type === 'OUT') {
            row.outQty += qty;
            row.remain -= qty;
            if (date && (!row.lastOutDate || date > row.lastOutDate)) row.lastOutDate = date;
        } else if (t.transaction_type === 'ADJUST') {
            row.adjustQty += qty;
            row.remain += qty;
        }
    });

    return Array.from(map.values());
};

/**
 * 특정 제품의 LOT 목록 (출고 선택용)
 * 기본 정렬: 선입선출(FIFO) — 최초 입고일 오래된 순, 날짜 없으면 LOT 번호순
 * @param {Array} ledger buildLotLedger 결과
 * @param {string} itemName 제품명
 * @param {object} opts { onlyRemaining: true면 잔량 > 0 만 }
 */
export const getLotsForItem = (ledger, itemName, opts = {}) => {
    const { onlyRemaining = false } = opts;
    const name = itemKey(itemName);
    return (ledger || [])
        .filter(r => r.itemName === name)
        .filter(r => (onlyRemaining ? r.remain > 0 : true))
        .sort((a, b) => {
            const da = a.firstInDate || '9999-12-31';
            const db = b.firstInDate || '9999-12-31';
            if (da !== db) return da < db ? -1 : 1;
            return a.lotNo.localeCompare(b.lotNo, 'ko');
        });
};

/**
 * FIFO 자동 분할 — 요청 수량을 오래된 LOT부터 채운다.
 * LOT가 찍힌 재고를 먼저 쓰고, '(미지정)' 기초재고는 마지막에만 쓴다.
 * (납품서에 LOT를 적어야 하므로 미지정분을 먼저 털지 않는다)
 * @returns {{ allocations: [{lotNo, qty, remain}], shortage: number }}
 *          shortage > 0 이면 LOT 잔량 합계가 요청 수량보다 부족하다는 뜻
 */
export const allocateFifo = (lots, requestQty) => {
    let left = parseFloat(requestQty) || 0;
    const allocations = [];
    const ordered = [
        ...(lots || []).filter(l => l.lotNo !== UNSPECIFIED_LOT),
        ...(lots || []).filter(l => l.lotNo === UNSPECIFIED_LOT)
    ];
    for (const lot of ordered) {
        if (left <= 0) break;
        const avail = parseFloat(lot.remain) || 0;
        if (avail <= 0) continue;
        const take = Math.min(avail, left);
        allocations.push({ lotNo: lot.lotNo, qty: take, remain: avail });
        left -= take;
    }
    return { allocations, shortage: left > 0 ? left : 0 };
};

/** 경과일수 (LOT 최초 입고일 ~ 오늘). 날짜 없으면 null */
export const lotAgeDays = (firstInDate, today = new Date()) => {
    if (!firstInDate) return null;
    const d = new Date(`${firstInDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.round((base - d) / 86400000));
};

/**
 * 특정 LOT의 잔량 조회 (없는 LOT이면 0)
 * excludeTxId: 수정 모드에서 자기 자신 거래의 영향을 되돌려 계산할 때 사용
 */
export const getLotRemain = (transactions, itemName, lotNo, excludeTxId = null) => {
    const name = itemKey(itemName);
    const canon = canonicalLot(normalizeLot(lotNo));
    let remain = 0;
    (transactions || []).forEach(t => {
        if (excludeTxId != null && t.id === excludeTxId) return;
        if (itemKey(t.item_name) !== name) return;
        if (canonicalLot(normalizeLot(t.lot_no)) !== canon) return;
        const qty = parseFloat(t.quantity) || 0;
        if (t.transaction_type === 'OUT') remain -= qty;
        else remain += qty; // IN, ADJUST
    });
    return remain;
};

/**
 * 출고 행의 납품LOT 대조 상태
 *  'ok'       : 시스템 LOT = 납품서 LOT (확인 완료)
 *  'mismatch' : 둘 다 있는데 다르다 → 반드시 확인해야 하는 건
 *  'pending'  : 납품서 LOT만 있고 시스템 LOT 미지정 (텔레그램 출하요청 예정분 등) → 대조 대기
 *  'none'     : 대조할 납품 LOT이 없음
 */
export const deliveryLotStatus = (row) => {
    if (!row || row.transaction_type !== 'OUT') return 'none';
    const sys = (row.lot_no ?? '').toString().trim();
    const dlv = (row.delivery_lot_no ?? '').toString().trim();
    if (!dlv) return 'none';
    if (!sys) return 'pending';
    return isSameLot(sys, dlv) ? 'ok' : 'mismatch';
};
