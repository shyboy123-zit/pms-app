-- 원재료 입고 검수 기능을 위한 inventory_transactions 테이블 확장
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS ordered_quantity NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT NULL;

-- 확인
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inventory_transactions';
