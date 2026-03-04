-- 입출고관리(inventory_transactions)에서 원재료 기록 삭제
-- 입출고관리는 제품 전용이므로 원재료 입고 기록은 여기 있으면 안 됨
-- 원재료 입고는 매입매출(vouchers)에서 매입 전표로만 관리

-- 원재료 테이블에 등록된 자재명과 일치하는 IN 기록 삭제
DELETE FROM inventory_transactions
WHERE transaction_type = 'IN'
  AND item_name IN (SELECT name FROM materials);

-- 확인: 삭제 후 남은 입출고 기록 확인 (모두 제품이어야 함)
-- SELECT id, item_name, transaction_type, quantity, unit, client 
-- FROM inventory_transactions 
-- ORDER BY transaction_date DESC;
