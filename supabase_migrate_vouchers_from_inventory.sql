-- 기존 입출고 기록 → 전표 일괄 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- 재고조정(ADJUST)은 제외, 입고(IN)→매입, 출고(OUT)→매출

INSERT INTO vouchers (voucher_date, voucher_type, item_name, item_code, quantity, unit, unit_price, client, notes)
SELECT 
    transaction_date,
    CASE WHEN transaction_type = 'OUT' THEN '매출' ELSE '매입' END,
    item_name,
    item_code,
    quantity,
    unit,
    unit_price,
    client,
    '[자동-입출고] 기존 데이터 마이그레이션'
FROM inventory_transactions
WHERE transaction_type IN ('IN', 'OUT')
ORDER BY transaction_date;
