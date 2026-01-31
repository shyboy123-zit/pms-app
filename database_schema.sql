-- PMS App - Inventory Management Enhancement
-- Database Schema for Material Usage and Inventory Transactions

-- Table 1: Material Usage Tracking
-- Tracks raw materials consumed in production work
CREATE TABLE IF NOT EXISTS material_usage (
  id BIGSERIAL PRIMARY KEY,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  work_order TEXT,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_material_usage_material_id ON material_usage(material_id);
CREATE INDEX IF NOT EXISTS idx_material_usage_date ON material_usage(usage_date DESC);

-- Table 2: Inventory Transactions (In/Out)
-- Tracks all inventory movements with pricing for ball joint bearings
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('IN', 'OUT')),
  item_name TEXT NOT NULL,
  item_code TEXT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'EA',
  unit_price NUMERIC DEFAULT 0 CHECK (unit_price >= 0),
  total_amount NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries and reporting
CREATE INDEX IF NOT EXISTS idx_inventory_trans_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_trans_date ON inventory_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_trans_item ON inventory_transactions(item_name);
CREATE INDEX IF NOT EXISTS idx_inventory_trans_code ON inventory_transactions(item_code);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_inventory_transactions_updated_at ON inventory_transactions;
CREATE TRIGGER update_inventory_transactions_updated_at
  BEFORE UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) if needed
ALTER TABLE material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth setup)
-- Allow authenticated users to read all records
CREATE POLICY "Enable read for authenticated users" ON material_usage
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON material_usage
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users" ON inventory_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON inventory_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON inventory_transactions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON inventory_transactions
  FOR DELETE TO authenticated USING (true);

-- Optional: Sample data for testing
-- INSERT INTO inventory_transactions (transaction_type, item_name, item_code, quantity, unit, unit_price, transaction_date, client)
-- VALUES 
--   ('IN', 'Ball Joint Bearing Type A', 'BJB-001', 100, 'EA', 5000, CURRENT_DATE, '공급사 A'),
--   ('OUT', 'Ball Joint Bearing Type A', 'BJB-001', 50, 'EA', 5000, CURRENT_DATE, '현대자동차');
