-- 전표(Voucher) 매입/매출 관리 테이블 생성
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS vouchers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
    voucher_type TEXT NOT NULL CHECK (voucher_type IN ('매입', '매출')),
    item_name TEXT NOT NULL,
    item_code TEXT,
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'EA',
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
    client TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 날짜/구분별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_type ON vouchers(voucher_type);

-- RLS 활성화
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 허용 (기존 PMS 패턴과 동일)
CREATE POLICY "Enable all access for authenticated users" ON vouchers
    FOR ALL USING (auth.role() = 'authenticated');

-- 확인
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vouchers';
