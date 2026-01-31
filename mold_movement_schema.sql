-- Create mold_movement table for tracking outgoing/incoming molds
CREATE TABLE IF NOT EXISTS mold_movement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mold_id UUID NOT NULL REFERENCES molds(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('출고', '입고')),
    
    -- Outgoing information
    outgoing_date DATE,
    destination TEXT, -- 수리업체명 또는 위치
    repair_vendor TEXT, -- 수리업체
    expected_return_date DATE,
    outgoing_reason TEXT,
    
    -- Incoming information
    incoming_date DATE,
    actual_cost INTEGER DEFAULT 0,
    repair_result TEXT, -- 수리 결과
    incoming_notes TEXT,
    
    -- Common fields
    status TEXT NOT NULL DEFAULT '출고중' CHECK (status IN ('출고중', '입고완료', '취소됨')),
    responsible_person TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mold_movement_mold_id ON mold_movement(mold_id);
CREATE INDEX IF NOT EXISTS idx_mold_movement_status ON mold_movement(status);
CREATE INDEX IF NOT EXISTS idx_mold_movement_outgoing_date ON mold_movement(outgoing_date);

-- Enable Row Level Security
ALTER TABLE mold_movement ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users" ON mold_movement
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON mold_movement
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON mold_movement
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON mold_movement
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mold_movement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mold_movement_updated_at
    BEFORE UPDATE ON mold_movement
    FOR EACH ROW
    EXECUTE FUNCTION update_mold_movement_updated_at();
