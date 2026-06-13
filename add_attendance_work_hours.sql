-- 근태에 실 근무시간(휴게 제외) 기록용 컬럼 추가
-- Supabase SQL Editor에서 1회 실행하세요.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_hours numeric;

COMMENT ON COLUMN attendance.work_hours IS '해당일 실 근무시간(휴게 제외). 시급제 급여의 주별 근무시간 자동집계에 사용.';
