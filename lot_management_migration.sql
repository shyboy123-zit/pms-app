-- ============================================================
-- LOT(롯트) 관리 추가 — 입출고 LOT 추적 / 납품롯트 대조
-- Supabase SQL Editor에서 그대로 실행하세요 (몇 번 실행해도 안전)
-- ============================================================
-- 회사 LOT 체계 (「LOT NO 체계표」) — 제조년월일 3자리
--   · 년도 : 2010=F 부터 한 글자씩 (22=R, 23=S, 24=T, 25=U, 26=V)
--   · 월   : 1월=A … 12월=L
--   · 일   : 1일=A … 26일=Z, 27일=1 … 31일=5
--   예) 2026-11-23 → VKW
-- ============================================================

-- 1. 시스템 LOT 번호 (입고 시 부여, 출고 시 그 LOT 지정)
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS lot_no TEXT;

-- 2. 납품(출하) 서류에 적힌 LOT — 출고 전용 대조 필드
--    lot_no 와 다르면 앱에서 ⚠ 불일치로 표시된다.
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS delivery_lot_no TEXT;

-- 3. 조회 인덱스 (LOT별 잔량 집계가 자주 돌아감)
CREATE INDEX IF NOT EXISTS idx_inventory_trans_lot
  ON inventory_transactions(lot_no);
CREATE INDEX IF NOT EXISTS idx_inventory_trans_item_lot
  ON inventory_transactions(item_name, lot_no);

-- 4. 날짜 → 회사 LOT 코드 함수 (앱 밖에서도 같은 규칙을 쓰도록)
--    예) SELECT lot_code(DATE '2026-11-23');  →  VKW
CREATE OR REPLACE FUNCTION lot_code(d DATE) RETURNS TEXT AS $$
    SELECT CASE WHEN d IS NULL THEN NULL ELSE
        chr(65 + ((((EXTRACT(YEAR  FROM d)::INT - 2005) % 26) + 26) % 26))   -- 제조년도
     || chr(64 +     EXTRACT(MONTH FROM d)::INT)                             -- 제조월 1월=A
     || CASE WHEN    EXTRACT(DAY   FROM d)::INT <= 26                        -- 제조일
                 THEN chr(64 + EXTRACT(DAY FROM d)::INT)                     --   1~26일 = A~Z
                 ELSE (EXTRACT(DAY FROM d)::INT - 26)::TEXT                  --   27~31일 = 1~5
            END
    END;
$$ LANGUAGE SQL IMMUTABLE;

-- 5. LOT별 잔량 뷰 — 외부 스크립트/봇에서 바로 조회할 때 사용
--    앱 화면은 프론트에서 계산하므로 뷰가 없어도 동작한다.
CREATE OR REPLACE VIEW lot_balances AS
SELECT
    item_name,
    MAX(item_code)                                          AS item_code,
    COALESCE(NULLIF(lot_no, ''), '(미지정)')                AS lot_no,
    MAX(unit)                                               AS unit,
    SUM(CASE WHEN transaction_type = 'IN'     THEN quantity ELSE 0 END) AS in_qty,
    SUM(CASE WHEN transaction_type = 'OUT'    THEN quantity ELSE 0 END) AS out_qty,
    SUM(CASE WHEN transaction_type = 'ADJUST' THEN quantity ELSE 0 END) AS adjust_qty,
    SUM(CASE
            WHEN transaction_type = 'OUT' THEN -quantity
            ELSE quantity
        END)                                                AS remain_qty,
    MIN(CASE WHEN transaction_type = 'IN'  THEN transaction_date END)   AS first_in_date,
    MAX(CASE WHEN transaction_type = 'OUT' THEN transaction_date END)   AS last_out_date
FROM inventory_transactions
GROUP BY item_name, COALESCE(NULLIF(lot_no, ''), '(미지정)');

-- 6. 과거 데이터 처리 안내 (실행하지 않아도 됨)
--    기존 행들은 lot_no 가 NULL → 앱에서 '(미지정)' LOT 하나로 묶여 보인다.
--    과거 입고에만 LOT를 채우면 출고에는 LOT가 없어서 '(미지정)'이 크게 마이너스로
--    뜨므로, 처음에는 그냥 두고 앞으로 들어오는 입고부터 LOT를 매기는 쪽을 권한다.
-- UPDATE inventory_transactions
--    SET lot_no = lot_code(transaction_date)
--  WHERE lot_no IS NULL AND transaction_type = 'IN';
