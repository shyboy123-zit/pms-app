-- ============================================================
-- 거래처 통합: '금호정공'  →  '금호정공(주)'
-- 중복 거래처를 정리하고, 기존 전표/거래내역을 모두 정식 거래처명으로 이관한다.
-- Supabase SQL Editor 에서 1회만 실행. (실행 전 결과 확인용 SELECT 먼저 권장)
-- ============================================================

-- [확인] 옮겨질 데이터 미리보기 (실행 전 점검)
-- SELECT 'vouchers' AS tbl, count(*) FROM vouchers WHERE client = '금호정공'
-- UNION ALL
-- SELECT 'inventory_transactions', count(*) FROM inventory_transactions WHERE client = '금호정공';

-- 1) 전표(vouchers)의 거래처명 이관
UPDATE vouchers
SET client = '금호정공(주)'
WHERE client = '금호정공';

-- 2) 입출고 거래내역(inventory_transactions)의 거래처명 이관
UPDATE inventory_transactions
SET client = '금호정공(주)'
WHERE client = '금호정공';

-- 3) 중복 거래처 레코드 삭제
DELETE FROM suppliers
WHERE name = '금호정공';

-- [확인] 정리 후 남아있는 '금호정공' (0건이어야 정상)
-- SELECT 'vouchers' AS tbl, count(*) FROM vouchers WHERE client = '금호정공'
-- UNION ALL SELECT 'inventory_transactions', count(*) FROM inventory_transactions WHERE client = '금호정공'
-- UNION ALL SELECT 'suppliers', count(*) FROM suppliers WHERE name = '금호정공';
