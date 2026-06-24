-- FLOW WMS デモデータ
-- 開発・デモ用のサンプルデータを投入します

-- ============================================================
-- 取引先マスタ
-- ============================================================
INSERT INTO partners (tenant_id, code, name, type, address, tel, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'SUP001', '山田電子部品株式会社', 'supplier', '埼玉県さいたま市大宮区1-1', '048-000-0001', 'contact@yamada-elec.example.com'),
  ('00000000-0000-0000-0000-000000000001', 'SUP002', '株式会社東京サプライ', 'supplier', '東京都港区芝浦2-2', '03-0000-0002', 'supply@tokyo-supply.example.com'),
  ('00000000-0000-0000-0000-000000000001', 'CUS001', '有限会社大阪トレーディング', 'customer', '大阪府大阪市北区梅田3-3', '06-0000-0003', 'order@osaka-trading.example.com'),
  ('00000000-0000-0000-0000-000000000001', 'CUS002', 'オンラインショップ合同会社', 'customer', '神奈川県横浜市西区1-4', '045-000-0004', 'wms@onlineshop.example.com'),
  ('00000000-0000-0000-0000-000000000001', 'SUP003', '全国物流センター株式会社', 'both', '千葉県船橋市本町5-5', '047-000-0005', 'info@zenkoku-logistics.example.com')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 商品マスタ
-- ============================================================
INSERT INTO items (tenant_id, code, name, category, unit, weight_g, barcode, reorder_point, reorder_qty, unit_price) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ITM001', 'USBケーブル Type-C 1m', 'ケーブル', '本', 80, '4901234567890', 50, 200, 980),
  ('00000000-0000-0000-0000-000000000001', 'ITM002', 'ワイヤレスマウス ブラック', 'PC周辺機器', '個', 120, '4901234567891', 30, 100, 2980),
  ('00000000-0000-0000-0000-000000000001', 'ITM003', 'メカニカルキーボード 日本語配列', 'PC周辺機器', '台', 850, '4901234567892', 10, 30, 8980),
  ('00000000-0000-0000-0000-000000000001', 'ITM004', 'モバイルバッテリー 10000mAh', '電源', '個', 250, '4901234567893', 20, 50, 3980),
  ('00000000-0000-0000-0000-000000000001', 'ITM005', 'HDMIケーブル 2m 4K対応', 'ケーブル', '本', 150, '4901234567894', 40, 150, 1480),
  ('00000000-0000-0000-0000-000000000001', 'ITM006', 'ノートPC用スタンド アルミ', 'PC周辺機器', '個', 540, '4901234567895', 15, 40, 4580),
  ('00000000-0000-0000-0000-000000000001', 'ITM007', 'Webカメラ 1080p', 'PC周辺機器', '個', 180, '4901234567896', 20, 60, 6980),
  ('00000000-0000-0000-0000-000000000001', 'ITM008', '液晶保護フィルム 15.6インチ', 'アクセサリ', '枚', 40, '4901234567897', 60, 200, 780)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 在庫データ（初期在庫）
-- ============================================================
DO $$
DECLARE
  wh_id UUID := '00000000-0000-0000-0000-000000000010';
  items_data RECORD;
  loc_id UUID;
  i INT := 1;
BEGIN
  FOR items_data IN
    SELECT id FROM items WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  LOOP
    -- ピッキングロケーションに在庫を配置
    SELECT id INTO loc_id FROM locations
    WHERE warehouse_id = wh_id AND code = 'A-01-0' || LPAD(i::TEXT, 1, '0') || '-1'
    LIMIT 1;

    IF loc_id IS NOT NULL THEN
      INSERT INTO inventory (warehouse_id, location_id, item_id, quantity, reserved_qty)
      VALUES (wh_id, loc_id, items_data.id, (RANDOM() * 200 + 50)::INT, 0)
      ON CONFLICT DO NOTHING;

      -- バルクロケーションにも配置
      SELECT id INTO loc_id FROM locations
      WHERE warehouse_id = wh_id AND code = 'B-01-0' || LPAD(i::TEXT, 1, '0') || '-1'
      LIMIT 1;

      IF loc_id IS NOT NULL THEN
        INSERT INTO inventory (warehouse_id, location_id, item_id, quantity, reserved_qty)
        VALUES (wh_id, loc_id, items_data.id, (RANDOM() * 500 + 100)::INT, 0)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    i := i + 1;
  END LOOP;
END;
$$;

-- ============================================================
-- 入荷予定データ
-- ============================================================
DO $$
DECLARE
  wh_id UUID := '00000000-0000-0000-0000-000000000010';
  sup1_id UUID;
  sup2_id UUID;
  itm1_id UUID;
  itm2_id UUID;
  itm3_id UUID;
  ro1_id UUID;
  ro2_id UUID;
BEGIN
  SELECT id INTO sup1_id FROM partners WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'SUP001';
  SELECT id INTO sup2_id FROM partners WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'SUP002';
  SELECT id INTO itm1_id FROM items WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'ITM001';
  SELECT id INTO itm2_id FROM items WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'ITM002';
  SELECT id INTO itm3_id FROM items WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'ITM003';

  -- 入荷予定1（処理中）
  INSERT INTO receiving_orders (id, warehouse_id, order_number, supplier_id, status, expected_date)
  VALUES (
    '00000000-0000-0000-0001-000000000001',
    wh_id, 'RCV-2026-001', sup1_id, 'in_progress', CURRENT_DATE
  ) ON CONFLICT DO NOTHING;
  ro1_id := '00000000-0000-0000-0001-000000000001';

  INSERT INTO receiving_order_lines (receiving_order_id, item_id, ordered_qty, received_qty) VALUES
    (ro1_id, itm1_id, 100, 60),
    (ro1_id, itm2_id, 50, 0)
  ON CONFLICT DO NOTHING;

  -- 入荷予定2（待機中）
  INSERT INTO receiving_orders (id, warehouse_id, order_number, supplier_id, status, expected_date)
  VALUES (
    '00000000-0000-0000-0001-000000000002',
    wh_id, 'RCV-2026-002', sup2_id, 'pending', CURRENT_DATE + 3
  ) ON CONFLICT DO NOTHING;
  ro2_id := '00000000-0000-0000-0001-000000000002';

  INSERT INTO receiving_order_lines (receiving_order_id, item_id, ordered_qty) VALUES
    (ro2_id, itm3_id, 20)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================
-- 出荷指示データ
-- ============================================================
DO $$
DECLARE
  wh_id UUID := '00000000-0000-0000-0000-000000000010';
  cus1_id UUID;
  cus2_id UUID;
  itm1_id UUID;
  itm4_id UUID;
  itm5_id UUID;
  so1_id UUID;
  so2_id UUID;
  so3_id UUID;
BEGIN
  SELECT id INTO cus1_id FROM partners WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'CUS001';
  SELECT id INTO cus2_id FROM partners WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'CUS002';
  SELECT id INTO itm1_id FROM items WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'ITM001';
  SELECT id INTO itm4_id FROM items WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'ITM004';
  SELECT id INTO itm5_id FROM items WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND code = 'ITM005';

  -- 出荷指示1（ピッキング中）
  INSERT INTO shipping_orders (id, warehouse_id, order_number, customer_id, status, priority, required_date, shipping_carrier)
  VALUES (
    '00000000-0000-0000-0002-000000000001',
    wh_id, 'SHP-2026-001', cus1_id, 'picking', 8, CURRENT_DATE, 'yamato'
  ) ON CONFLICT DO NOTHING;
  so1_id := '00000000-0000-0000-0002-000000000001';

  INSERT INTO shipping_order_lines (shipping_order_id, item_id, ordered_qty, status) VALUES
    (so1_id, itm1_id, 5, 'picking'),
    (so1_id, itm4_id, 2, 'pending')
  ON CONFLICT DO NOTHING;

  -- 出荷指示2（待機中）
  INSERT INTO shipping_orders (id, warehouse_id, order_number, customer_id, status, priority, required_date, shipping_carrier)
  VALUES (
    '00000000-0000-0000-0002-000000000002',
    wh_id, 'SHP-2026-002', cus2_id, 'pending', 5, CURRENT_DATE + 1, 'sagawa'
  ) ON CONFLICT DO NOTHING;
  so2_id := '00000000-0000-0000-0002-000000000002';

  INSERT INTO shipping_order_lines (shipping_order_id, item_id, ordered_qty) VALUES
    (so2_id, itm5_id, 10)
  ON CONFLICT DO NOTHING;

  -- 出荷指示3（出荷済み）
  INSERT INTO shipping_orders (id, warehouse_id, order_number, customer_id, status, priority, required_date, shipping_carrier, tracking_number, shipped_at)
  VALUES (
    '00000000-0000-0000-0002-000000000003',
    wh_id, 'SHP-2026-000', cus1_id, 'shipped', 5, CURRENT_DATE - 1, 'yamato', '1234-5678-9012', NOW() - INTERVAL '2 hours'
  ) ON CONFLICT DO NOTHING;
END;
$$;
