-- ============================================================
-- 지출관리(expenses) 테이블 — 모든 지출 통합 (원재료매입/카드/공과금/기타)
-- ============================================================
-- 이세로(국세청 전자세금계산서)·사업용카드 사용내역을 외부 수집 API로 적재하거나
-- 수동/엑셀로 입력하여 "각 월 총지출금액"을 집계합니다.
--
-- ⚠️ Supabase SQL Editor에서 1회 실행하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 지출(세금계산서 작성/카드 승인) 일자 — 월별 집계 기준
    expense_date DATE NOT NULL,

    -- 분류: 원재료매입 / 카드 / 공과금 / 인건비 / 임차료 / 기타 등 (자유 텍스트)
    category TEXT NOT NULL DEFAULT '기타',

    -- 수집 경로(데이터 출처): 세금계산서 / 카드 / 현금영수증 / 수동 / 엑셀
    source TEXT NOT NULL DEFAULT '수동',

    -- 거래처 / 가맹점명
    vendor TEXT,
    -- 거래처 사업자번호 (중복 매칭/조회용)
    vendor_biz_no TEXT,

    -- 품목 / 적요
    description TEXT,

    -- 금액: amount = 실제 지출 총액(월 총지출 집계 기준). 부가세 포함 합계.
    amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
    -- 세금계산서일 때만 채워지는 분해값 (선택)
    supply_amount NUMERIC DEFAULT 0,  -- 공급가액
    tax_amount NUMERIC DEFAULT 0,     -- 세액(부가세)

    -- 결제수단(카드명/계좌/현금 등)
    payment_method TEXT,

    -- 외부 수집 API의 고유 식별자(승인번호/NTS 일련번호 등) — 중복 적재 방지(upsert 키)
    external_id TEXT,

    -- 원본 응답 보관(디버깅/재처리용)
    raw JSONB,

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- external_id 유일성 보장 — 외부 수집 시 중복 적재(upsert) 방지.
-- Postgres 는 NULL 을 서로 다른 값으로 보므로 수동입력(NULL)은 다수 허용됨.
-- (PostgREST upsert onConflict 와의 호환을 위해 부분 인덱스 대신 일반 유니크 사용)
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_external_id
    ON expenses(external_id);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_source ON expenses(source);

-- updated_at 자동 갱신 (purchase_management_schema.sql 에서 만든 함수 재사용)
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated" ON expenses;
CREATE POLICY "Enable read for authenticated" ON expenses
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated" ON expenses;
CREATE POLICY "Enable insert for authenticated" ON expenses
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated" ON expenses;
CREATE POLICY "Enable update for authenticated" ON expenses
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for authenticated" ON expenses;
CREATE POLICY "Enable delete for authenticated" ON expenses
    FOR DELETE USING (auth.role() = 'authenticated');

-- service_role(서버사이드 동기화 함수)에서 upsert 할 수 있도록 별도 정책
-- (service_role 키는 RLS를 우회하므로 정책 불필요하지만, 명시적으로 둠)

-- 확인 쿼리
-- SELECT date_trunc('month', expense_date) AS 월, SUM(amount) AS 총지출
-- FROM expenses GROUP BY 1 ORDER BY 1 DESC;
