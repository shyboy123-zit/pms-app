-- ================================================
-- 중량 점검 — 캐비티(C/V)별 개별 측정 지원
-- weight_checks 테이블에 캐비티별 측정값 컬럼 추가
-- (add_weight_checks.sql 실행 이후에 실행)
-- ================================================

-- 측정 당시 C/V 수 스냅샷
ALTER TABLE weight_checks
ADD COLUMN IF NOT EXISTS cavity_count INTEGER DEFAULT 1;

-- 캐비티별 측정 중량 배열 (g). 예: [24.8, 25.1, 24.9, 25.0]
ALTER TABLE weight_checks
ADD COLUMN IF NOT EXISTS cavity_weights JSONB;

COMMENT ON COLUMN weight_checks.cavity_count IS '측정 당시 캐비티 수 (스냅샷)';
COMMENT ON COLUMN weight_checks.cavity_weights IS '캐비티별 측정 중량 배열 (g) — 인덱스+1 = 캐비티 번호';

-- measured_weight 는 캐비티 평균값으로 계속 사용 (하위호환/요약)
COMMENT ON COLUMN weight_checks.measured_weight IS '캐비티 평균 중량 (g) — 요약용';
