-- ================================================
-- Products Table (제품 정보)
-- ================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    model TEXT,
    unit TEXT DEFAULT 'EA',
    standard_cycle_time INTEGER DEFAULT 30,
    status TEXT DEFAULT '생산중' CHECK (status IN ('생산중', '단종')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Index
CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_products_status ON products(status);

-- ================================================
-- Work Orders Table (작업지시)
-- ================================================
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT UNIQUE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES equipments(id) ON DELETE SET NULL,
    target_quantity INTEGER NOT NULL DEFAULT 0,
    produced_quantity INTEGER DEFAULT 0,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT '대기' CHECK (status IN ('대기', '진행중', '완료', '취소')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work Orders Indexes
CREATE INDEX idx_work_orders_code ON work_orders(order_code);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_product ON work_orders(product_id);
CREATE INDEX idx_work_orders_equipment ON work_orders(equipment_id);
CREATE INDEX idx_work_orders_date ON work_orders(order_date);

-- ================================================
-- Equipments Table 수정 (current_work_order_id 컬럼 추가)
-- ================================================
-- 기존 equipments 테이블에 컬럼 추가
ALTER TABLE equipments 
ADD COLUMN IF NOT EXISTS current_work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL;

-- ================================================
-- RLS (Row Level Security) Policies
-- ================================================

-- Products RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON products
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON products
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON products
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON products
    FOR DELETE TO authenticated USING (true);

-- Work Orders RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON work_orders
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON work_orders
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON work_orders
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON work_orders
    FOR DELETE TO authenticated USING (true);

-- ================================================
-- 초기 데이터 (선택 사항)
-- ================================================
-- 샘플 제품 추가 (필요시)
-- INSERT INTO products (product_code, name, model, unit, standard_cycle_time) 
-- VALUES ('PRD-001', '플라스틱 커버 A', 'CV-100', 'EA', 30);
