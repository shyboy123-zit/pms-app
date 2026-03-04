-- 제품 재고 재계산: ADJUST(3/2까지) 기준 + IN/OUT(3/3~3/4) 반영
-- 로직: 각 제품별 마지막 ADJUST 수량 + 이후 IN 합계 - 이후 OUT 합계

-- 먼저 현재 상태 확인 (실행 전 결과 확인용)
-- SELECT p.product_code, p.name, p.stock as 현재재고,
--   COALESCE(adj.qty, 0) as ADJUST기준,
--   COALESCE(ins.qty, 0) as IN합계,
--   COALESCE(outs.qty, 0) as OUT합계,
--   COALESCE(adj.qty, 0) + COALESCE(ins.qty, 0) - COALESCE(outs.qty, 0) as 계산재고
-- FROM products p
-- LEFT JOIN (
--   SELECT item_name, SUM(quantity) as qty FROM inventory_transactions
--   WHERE transaction_type = 'ADJUST' AND transaction_date <= '2026-03-02'
--   GROUP BY item_name
-- ) adj ON (p.product_code = adj.item_name OR p.name = adj.item_name)
-- LEFT JOIN (
--   SELECT item_name, SUM(quantity) as qty FROM inventory_transactions
--   WHERE transaction_type = 'IN' AND transaction_date >= '2026-03-03'
--   GROUP BY item_name
-- ) ins ON (p.product_code = ins.item_name OR p.name = ins.item_name)
-- LEFT JOIN (
--   SELECT item_name, SUM(quantity) as qty FROM inventory_transactions
--   WHERE transaction_type = 'OUT' AND transaction_date >= '2026-03-03'
--   GROUP BY item_name
-- ) outs ON (p.product_code = outs.item_name OR p.name = outs.item_name)
-- ORDER BY p.product_code;

-- 실제 업데이트: products.stock = ADJUST(~3/2) + IN(3/3~) - OUT(3/3~)
UPDATE products p
SET stock = COALESCE(calc.calculated_stock, 0)
FROM (
  SELECT 
    t.item_name,
    SUM(CASE 
      WHEN t.transaction_type = 'ADJUST' AND t.transaction_date <= '2026-03-02' THEN t.quantity
      ELSE 0
    END) +
    SUM(CASE 
      WHEN t.transaction_type = 'IN' AND t.transaction_date >= '2026-03-03' THEN t.quantity
      ELSE 0
    END) -
    SUM(CASE 
      WHEN t.transaction_type = 'OUT' AND t.transaction_date >= '2026-03-03' THEN t.quantity
      ELSE 0
    END) AS calculated_stock
  FROM inventory_transactions t
  GROUP BY t.item_name
) calc
WHERE p.product_code = calc.item_name OR p.name = calc.item_name;
