-- 호기별 사출조건 관리를 위한 스키마 업데이트
-- injection_conditions 테이블에 equipment_id 추가

-- 1. equipment_id 컬럼 추가
ALTER TABLE injection_conditions 
ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipments(id) ON DELETE SET NULL;

-- 2. 기존 UNIQUE 제약조건 제거 (product_id만 유니크였음)
ALTER TABLE injection_conditions 
DROP CONSTRAINT IF EXISTS injection_conditions_product_id_key;

-- 3. 새 UNIQUE 제약조건: product_id + equipment_id 조합이 유니크
-- NULL 값도 고유성 체크에서 제외되도록 처리
ALTER TABLE injection_conditions 
ADD CONSTRAINT injection_conditions_product_equipment_unique 
UNIQUE NULLS NOT DISTINCT (product_id, equipment_id);

-- 4. equipment_id에 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_injection_conditions_equipment 
ON injection_conditions(equipment_id);

-- 5. 확인용 쿼리 (선택사항)
-- SELECT 
--     ic.id,
--     p.name as product_name,
--     e.name as equipment_name,
--     ic.created_at
-- FROM injection_conditions ic
-- LEFT JOIN products p ON ic.product_id = p.id
-- LEFT JOIN equipments e ON ic.equipment_id = e.id
-- ORDER BY ic.created_at DESC;
