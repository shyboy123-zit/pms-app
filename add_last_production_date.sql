-- work_orders 테이블에 last_production_date 컬럼 추가
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS last_production_date TIMESTAMP WITH TIME ZONE;

-- 기존 데이터를 위해 created_at 값으로 초기화 (또는 NULL로 두어도 됨)
UPDATE work_orders
SET last_production_date = created_at
WHERE last_production_date IS NULL;
