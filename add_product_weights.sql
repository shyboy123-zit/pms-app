-- ================================================
-- Products 테이블에 중량 컬럼 추가
-- ================================================

-- 제품 중량 (g 단위)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_weight DECIMAL(10, 2) DEFAULT 0;

-- 런너 중량 (g 단위)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS runner_weight DECIMAL(10, 2) DEFAULT 0;

-- 컬럼 설명
COMMENT ON COLUMN products.product_weight IS '제품 1개의 중량 (g)';
COMMENT ON COLUMN products.runner_weight IS '런너/게이트 중량 (g)';

-- 예시: 1 Shot 중량 계산 함수 (선택 사항)
-- CREATE OR REPLACE FUNCTION get_shot_weight(product_id UUID)
-- RETURNS DECIMAL AS $$
--   SELECT (product_weight + runner_weight) FROM products WHERE id = product_id;
-- $$ LANGUAGE SQL;
