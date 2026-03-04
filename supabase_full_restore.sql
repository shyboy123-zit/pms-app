-- ============================================
-- 전체 복구 스크립트 (한번에 실행)
-- ============================================

-- 1. 기존 매출 전표 있는지 확인 후 없으면 OUT 기록에서 복구
-- (이미 있으면 중복 방지를 위해 먼저 삭제)
DELETE FROM vouchers WHERE voucher_type = '매출';

-- 2. OUT 거래에서 매출 전표 생성
INSERT INTO vouchers (voucher_date, voucher_type, item_name, item_code, quantity, unit, unit_price, client, notes)
SELECT 
    transaction_date,
    '매출',
    item_name,
    COALESCE(item_code, ''),
    quantity,
    COALESCE(unit, 'EA'),
    unit_price,
    client,
    item_name || ' ' || quantity || COALESCE(unit, 'EA') || ' 출고'
FROM inventory_transactions
WHERE transaction_type = 'OUT'
  AND client IS NOT NULL;

-- 3. 제품 재고 재계산: ADJUST(~3/2) + IN(3/3~) - OUT(3/3~)
UPDATE products p
SET stock = COALESCE(calc.calculated_stock, 0)
FROM (
  SELECT 
    item_name,
    SUM(CASE 
      WHEN transaction_type = 'ADJUST' AND transaction_date <= '2026-03-02' THEN quantity
      ELSE 0
    END)
    + SUM(CASE 
      WHEN transaction_type = 'IN' AND transaction_date >= '2026-03-03' THEN quantity
      ELSE 0
    END)
    - SUM(CASE 
      WHEN transaction_type = 'OUT' AND transaction_date >= '2026-03-03' THEN quantity
      ELSE 0
    END) AS calculated_stock
  FROM inventory_transactions
  GROUP BY item_name
) calc
WHERE p.product_code = calc.item_name OR p.name = calc.item_name;

-- 4. 결과 확인
SELECT p.product_code, p.name, p.stock as "재고"
FROM products p
ORDER BY p.product_code;
