-- 매입매출 전표 데이터 수정
-- 1. 잘못된 매입 전표 삭제 (입출고 제품 입고에서 온 매입)
-- 2. 원재료 입고 데이터에서 올바른 매입 전표 생성

-- Step 1: 기존 잘못된 매입 전표 삭제 (입출고 마이그레이션에서 온 것)
DELETE FROM vouchers
WHERE voucher_type = '매입'
  AND notes = '[자동-입출고] 기존 데이터 마이그레이션';

-- Step 2: 원재료 입고 기록에서 매입 전표 생성
-- inventory_transactions에서 material_id가 있는 IN 기록 = 원재료 입고
INSERT INTO vouchers (voucher_date, voucher_type, item_name, item_code, quantity, unit, unit_price, client, notes)
SELECT 
    transaction_date,
    '매입',
    item_name,
    '',
    quantity,
    unit,
    COALESCE(unit_price, 0),
    COALESCE(supplier, client, ''),
    '[자동-원재료] 기존 데이터 마이그레이션'
FROM inventory_transactions
WHERE transaction_type = 'IN'
  AND material_id IS NOT NULL
ORDER BY transaction_date;
