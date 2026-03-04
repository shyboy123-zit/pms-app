-- ★ Step 1: OUT 거래 데이터 확인 ★
SELECT id, item_name, item_code, quantity, unit, unit_price, 
       transaction_date, client, supplier, notes
FROM inventory_transactions
WHERE transaction_type = 'OUT'
ORDER BY transaction_date DESC;

-- ★ Step 2: 확인 후 - 이 아래 쿼리로 매출 전표 복구 ★
-- (client가 실제로 있으면 이대로, 없으면 supplier 등 다른 필드 사용)
-- INSERT INTO vouchers (voucher_date, voucher_type, item_name, item_code, quantity, unit, unit_price, client, notes)
-- SELECT 
--     transaction_date,
--     '매출',
--     item_name,
--     COALESCE(item_code, ''),
--     quantity,
--     COALESCE(unit, 'EA'),
--     unit_price,
--     COALESCE(client, ''),
--     '[복구] ' || item_name || ' ' || quantity || COALESCE(unit, 'EA') || ' 출고'
-- FROM inventory_transactions
-- WHERE transaction_type = 'OUT';

-- ★ Step 3: 재고 확인 (제품별 현재재고 vs 계산재고) ★
-- SELECT 
--   p.product_code, 
--   p.name, 
--   p.stock as "현재재고",
--   COALESCE(adj.qty, 0) as "ADJUST기준",
--   COALESCE(ins.qty, 0) as "IN합계",
--   COALESCE(outs.qty, 0) as "OUT합계",
--   COALESCE(adj.qty, 0) + COALESCE(ins.qty, 0) - COALESCE(outs.qty, 0) as "계산재고"
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
