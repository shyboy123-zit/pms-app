-- 완제품 안전재고 관리를 위한 컬럼 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock integer DEFAULT 0;
