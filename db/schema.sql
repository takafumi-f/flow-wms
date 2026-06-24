-- FLOW WMS Database Schema
-- PostgreSQL 16

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- テナント（SaaSマルチテナント）
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'free', -- free/starter/growth/enterprise
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  max_orders_per_month INTEGER NOT NULL DEFAULT 100,
  max_users INTEGER NOT NULL DEFAULT 2,
  max_warehouses INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 倉庫
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  tel VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- ============================================================
-- ユーザー
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'operator', -- admin/manager/operator/viewer
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 商品マスタ
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_kana VARCHAR(255),
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL DEFAULT '個',
  weight_g INTEGER,
  width_mm INTEGER,
  height_mm INTEGER,
  depth_mm INTEGER,
  barcode VARCHAR(100),
  lot_managed BOOLEAN NOT NULL DEFAULT false,
  serial_managed BOOLEAN NOT NULL DEFAULT false,
  expiry_managed BOOLEAN NOT NULL DEFAULT false,
  reorder_point INTEGER,
  reorder_qty INTEGER,
  unit_price INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- ============================================================
-- 取引先マスタ
-- ============================================================
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'both', -- supplier/customer/both
  postal_code VARCHAR(10),
  address TEXT,
  tel VARCHAR(20),
  fax VARCHAR(20),
  email VARCHAR(255),
  contact_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- ============================================================
-- ロケーション（棚）
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL, -- 例: A-01-01-1 (ゾーン-通路-棚-段)
  zone VARCHAR(50),
  aisle VARCHAR(10),
  bay VARCHAR(10),
  level VARCHAR(10),
  location_type VARCHAR(50) NOT NULL DEFAULT 'picking', -- receiving/picking/bulk/staging/shipping
  capacity_weight_g INTEGER,
  capacity_volume_cm3 INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

-- ============================================================
-- 在庫（メインテーブル）
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  item_id UUID NOT NULL REFERENCES items(id),
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  expiry_date DATE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_qty INTEGER NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  version INTEGER NOT NULL DEFAULT 1, -- 楽観的ロック
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- FIFO基準日
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 在庫履歴
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  item_id UUID NOT NULL REFERENCES items(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  transaction_type VARCHAR(50) NOT NULL, -- receive/ship/move/adjust/return
  quantity INTEGER NOT NULL,
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  before_qty INTEGER,
  after_qty INTEGER,
  reference_type VARCHAR(50), -- receiving_order/shipping_order/adjustment
  reference_id UUID,
  user_id UUID REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 入荷予定
-- ============================================================
CREATE TABLE IF NOT EXISTS receiving_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  order_number VARCHAR(100) NOT NULL,
  supplier_id UUID REFERENCES partners(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending/in_progress/completed/cancelled
  expected_date DATE,
  received_at TIMESTAMPTZ,
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, order_number)
);

-- ============================================================
-- 入荷予定明細
-- ============================================================
CREATE TABLE IF NOT EXISTS receiving_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_order_id UUID NOT NULL REFERENCES receiving_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  ordered_qty INTEGER NOT NULL CHECK (ordered_qty > 0),
  received_qty INTEGER NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  lot_number VARCHAR(100),
  expiry_date DATE,
  location_id UUID REFERENCES locations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 出荷指示
-- ============================================================
CREATE TABLE IF NOT EXISTS shipping_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  order_number VARCHAR(100) NOT NULL,
  customer_id UUID REFERENCES partners(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending/picking/packed/shipped/cancelled
  picking_method VARCHAR(50) NOT NULL DEFAULT 'single', -- single/batch/zone/wave
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  required_date DATE,
  ship_to_name VARCHAR(255),
  ship_to_postal VARCHAR(10),
  ship_to_address TEXT,
  ship_to_tel VARCHAR(20),
  shipped_at TIMESTAMPTZ,
  shipping_carrier VARCHAR(50), -- yamato/sagawa/japanpost
  tracking_number VARCHAR(100),
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, order_number)
);

-- ============================================================
-- 出荷指示明細
-- ============================================================
CREATE TABLE IF NOT EXISTS shipping_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_order_id UUID NOT NULL REFERENCES shipping_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  ordered_qty INTEGER NOT NULL CHECK (ordered_qty > 0),
  picked_qty INTEGER NOT NULL DEFAULT 0 CHECK (picked_qty >= 0),
  lot_number VARCHAR(100),
  location_id UUID REFERENCES locations(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending/picking/completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EC連携設定
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- amazon/shopify/rakuten/yahoo/base
  credentials_encrypted TEXT NOT NULL, -- AES-256-GCM暗号化済み
  shop_url VARCHAR(255),
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 5,
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, platform)
);

-- ============================================================
-- EC受注
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  platform VARCHAR(50) NOT NULL,
  external_order_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new', -- new/processing/shipped/cancelled
  shipping_order_id UUID REFERENCES shipping_orders(id),
  buyer_name VARCHAR(255),
  buyer_email VARCHAR(255),
  ship_to_postal VARCHAR(10),
  ship_to_address TEXT,
  total_amount INTEGER,
  raw_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, external_order_id)
);

-- ============================================================
-- 配送業者設定
-- ============================================================
CREATE TABLE IF NOT EXISTS carrier_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier VARCHAR(50) NOT NULL, -- yamato/sagawa/japanpost
  credentials_encrypted TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, carrier)
);

-- ============================================================
-- 送り状
-- ============================================================
CREATE TABLE IF NOT EXISTS shipment_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_order_id UUID NOT NULL REFERENCES shipping_orders(id),
  carrier VARCHAR(50) NOT NULL,
  tracking_number VARCHAR(100) NOT NULL UNIQUE,
  label_data TEXT, -- ZPL or base64 PDF
  label_format VARCHAR(10) NOT NULL DEFAULT 'PDF', -- PDF/ZPL
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 棚卸
-- ============================================================
CREATE TABLE IF NOT EXISTS stocktakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft/in_progress/completed/cancelled
  target_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stocktake_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id UUID NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id),
  item_id UUID NOT NULL REFERENCES items(id),
  lot_number VARCHAR(100),
  system_qty INTEGER NOT NULL DEFAULT 0,
  counted_qty INTEGER,
  difference INTEGER GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - system_qty) STORED,
  counted_by UUID REFERENCES users(id),
  counted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_items_tenant ON items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partners_tenant ON partners(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_item ON inventory(warehouse_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lot ON inventory(lot_number) WHERE lot_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_warehouse_item ON inventory_transactions(warehouse_id, item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receiving_orders_warehouse_status ON receiving_orders(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_receiving_orders_expected_date ON receiving_orders(expected_date);
CREATE INDEX IF NOT EXISTS idx_shipping_orders_warehouse_status ON shipping_orders(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_shipping_orders_priority ON shipping_orders(priority DESC, required_date ASC);
CREATE INDEX IF NOT EXISTS idx_ec_orders_tenant ON ec_orders(tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_ec_orders_status ON ec_orders(status);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','warehouses','users','items','partners',
    'receiving_orders','receiving_order_lines',
    'shipping_orders','shipping_order_lines',
    'ec_platform_settings','carrier_settings'
  ] LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END;
$$;
