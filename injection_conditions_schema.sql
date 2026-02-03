-- 사출조건표 테이블
CREATE TABLE injection_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- 온도 설정 (°C)
  hopper_temp NUMERIC(5,1),           -- 호퍼 온도
  cylinder_temp_zone1 NUMERIC(5,1),   -- 실린더 Zone 1
  cylinder_temp_zone2 NUMERIC(5,1),   -- 실린더 Zone 2
  cylinder_temp_zone3 NUMERIC(5,1),   -- 실린더 Zone 3
  cylinder_temp_zone4 NUMERIC(5,1),   -- 실린더 Zone 4
  nozzle_temp NUMERIC(5,1),           -- 노즐 온도
  mold_temp_fixed NUMERIC(5,1),       -- 금형 온도 (고정측)
  mold_temp_moving NUMERIC(5,1),      -- 금형 온도 (가동측)
  
  -- 압력/속도
  injection_pressure NUMERIC(6,1),    -- 1차 압력 (kgf/cm²)
  injection_speed NUMERIC(5,1),       -- 1차 속도 (mm/s or %)
  holding_pressure NUMERIC(6,1),      -- 2차 압력/보압 (kgf/cm²)
  holding_speed NUMERIC(5,1),         -- 2차 속도
  back_pressure NUMERIC(5,1),         -- 배압 (kgf/cm²)
  
  -- 시간 설정 (초)
  injection_time NUMERIC(5,2),        -- 사출 시간
  holding_time NUMERIC(5,2),          -- 보압 시간
  cooling_time NUMERIC(5,2),          -- 냉각 시간
  cycle_time NUMERIC(6,2),            -- 사이클 타임
  
  -- 기타
  shot_size NUMERIC(6,2),             -- 계량 위치/Shot Size (mm or cc)
  screw_rpm NUMERIC(5,1),             -- 스크류 회전수 (rpm)
  cushion NUMERIC(5,2),               -- 쿠션량 (mm)
  
  -- 메타
  notes TEXT,                         -- 비고
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_injection_conditions_product_id ON injection_conditions(product_id);

-- RLS 정책
ALTER TABLE injection_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view injection conditions"
  ON injection_conditions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert injection conditions"
  ON injection_conditions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update injection conditions"
  ON injection_conditions FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete injection conditions"
  ON injection_conditions FOR DELETE
  USING (auth.role() = 'authenticated');
