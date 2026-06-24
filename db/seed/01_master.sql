-- FLOW WMS マスタデータ（初期シード）
-- 開発・テスト用テナント・ユーザーを作成します

-- ============================================================
-- デモテナント
-- ============================================================
INSERT INTO tenants (id, name, plan, max_orders_per_month, max_users, max_warehouses)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'デモ株式会社',
  'growth',
  30000,
  30,
  3
) ON CONFLICT DO NOTHING;

-- ============================================================
-- デモ倉庫
-- ============================================================
INSERT INTO warehouses (id, tenant_id, code, name, address)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'WH001',
  '東京第一倉庫',
  '東京都江東区東雲1-1-1'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 管理者ユーザー（パスワード: admin1234）
-- bcrypt hash of 'admin1234' with cost 10
-- ============================================================
INSERT INTO users (id, tenant_id, warehouse_id, email, password_hash, name, role)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'admin@demo.flowwms.jp',
  '$2a$10$IzXb5/GcC7idC/oxpWmm5.nzTTAXwtBgZFS3.B6iPLfgAGn6YdgKS',
  'デモ管理者',
  'admin'
) ON CONFLICT DO NOTHING;

-- オペレーターユーザー（パスワード: oper1234）
INSERT INTO users (id, tenant_id, warehouse_id, email, password_hash, name, role)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'operator@demo.flowwms.jp',
  '$2a$10$b0XrgVVlm423K/PxRPwQXOa1ZJvV0QMA5ClFJLjZdH8PamjlD66Ry',
  'デモオペレーター',
  'operator'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- ロケーション（棚）
-- ============================================================
DO $$
DECLARE
  wh_id UUID := '00000000-0000-0000-0000-000000000010';
  zone CHAR;
  aisle INT;
  bay INT;
  lv INT;
  code TEXT;
BEGIN
  -- A〜Cゾーン、通路1〜3、棚1〜5、段1〜4 を生成
  FOREACH zone IN ARRAY ARRAY['A','B','C'] LOOP
    FOR aisle IN 1..3 LOOP
      FOR bay IN 1..5 LOOP
        FOR lv IN 1..4 LOOP
          code := zone || '-' || LPAD(aisle::TEXT, 2, '0') || '-' || LPAD(bay::TEXT, 2, '0') || '-' || lv::TEXT;
          INSERT INTO locations (warehouse_id, code, zone, aisle, bay, level, location_type)
          VALUES (
            wh_id,
            code,
            zone,
            LPAD(aisle::TEXT, 2, '0'),
            LPAD(bay::TEXT, 2, '0'),
            lv::TEXT,
            CASE WHEN zone = 'A' THEN 'picking'
                 WHEN zone = 'B' THEN 'bulk'
                 ELSE 'staging' END
          ) ON CONFLICT DO NOTHING;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 入荷バッファ
  INSERT INTO locations (warehouse_id, code, zone, location_type)
  VALUES (wh_id, 'RECV-001', 'RECV', 'receiving')
  ON CONFLICT DO NOTHING;

  -- 出荷バッファ
  INSERT INTO locations (warehouse_id, code, zone, location_type)
  VALUES (wh_id, 'SHIP-001', 'SHIP', 'shipping')
  ON CONFLICT DO NOTHING;
END;
$$;
