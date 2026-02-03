-- 구매 관리 시스템 테이블 생성

-- 1. 거래처 테이블
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    business_number TEXT,
    main_items TEXT,
    notes TEXT,
    status TEXT DEFAULT '활성' CHECK (status IN ('활성', '비활성')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 구매요청 테이블
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    item_description TEXT,
    quantity DECIMAL(10, 2) NOT NULL,
    unit TEXT NOT NULL,
    priority TEXT DEFAULT '일반' CHECK (priority IN ('긴급', '일반')),
    reason TEXT,
    required_date DATE,
    status TEXT DEFAULT '대기' CHECK (status IN ('대기', '승인됨', '발주완료', '입고완료', '반려')),
    approver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    order_date DATE,
    expected_date DATE,
    received_date DATE,
    unit_price DECIMAL(12, 2),
    total_price DECIMAL(12, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester ON purchase_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_priority ON purchase_requests(priority);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 활성화
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽기 가능
CREATE POLICY "Enable read access for all authenticated users" ON suppliers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all authenticated users" ON purchase_requests
    FOR SELECT USING (auth.role() = 'authenticated');

-- 모든 인증된 사용자가 삽입 가능
CREATE POLICY "Enable insert for authenticated users" ON suppliers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON purchase_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 모든 인증된 사용자가 수정/삭제 가능
CREATE POLICY "Enable update for authenticated users" ON suppliers
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON purchase_requests
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON suppliers
    FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON purchase_requests
    FOR DELETE USING (auth.role() = 'authenticated');
