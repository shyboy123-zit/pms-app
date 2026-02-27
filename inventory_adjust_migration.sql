-- 재고조정(ADJUST) 기능 추가를 위한 DB 마이그레이션
-- Supabase SQL Editor에서 실행하세요

-- 1. transaction_type CHECK 제약조건에 'ADJUST' 추가
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_transaction_type_check 
  CHECK (transaction_type IN ('IN', 'OUT', 'ADJUST'));

-- 2. quantity CHECK 제약조건 제거 (재고조정 시 음수 가능)
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_quantity_check;
