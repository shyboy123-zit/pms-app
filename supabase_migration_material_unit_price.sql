-- materials 테이블에 단가(unit_price) 컬럼 추가
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;
