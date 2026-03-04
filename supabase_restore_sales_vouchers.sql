-- 매출 전표 복구: 입출고관리의 OUT 기록을 기반으로 매출 전표 재생성
-- (실수로 삭제된 매출 전표 복구)

-- 1) 입출고 OUT 기록에서 매출 전표 생성
INSERT INTO vouchers (voucher_date, voucher_type, item_name, item_code, quantity, unit, unit_price, client, notes)
SELECT 
    transaction_date AS voucher_date,
    '매출' AS voucher_type,
    item_name,
    '' AS item_code,
    quantity,
    unit,
    unit_price,
    client,
    '[복구] ' || item_name || ' ' || quantity || unit || ' 출고'
FROM inventory_transactions
WHERE transaction_type = 'OUT'
  AND client IS NOT NULL
  AND client != '';

-- 2) 성신사 매입 전표 중복 확인 (GP2300G가 2개 있을 수 있음)
-- SELECT id, item_name, quantity, unit_price, client, voucher_date, created_at
-- FROM vouchers 
-- WHERE voucher_type = '매입' AND client = '성신사'
-- ORDER BY created_at;

-- 3) 복구 결과 확인
-- SELECT voucher_type, client, COUNT(*) as 건수, SUM(quantity * unit_price) as 총액
-- FROM vouchers
-- GROUP BY voucher_type, client
-- ORDER BY voucher_type, client;
