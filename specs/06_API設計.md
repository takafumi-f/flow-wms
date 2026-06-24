# FLOW WMS API 設計仕様書

| 項目 | 内容 |
|------|------|
| ドキュメントバージョン | 1.0.0 |
| 作成日 | 2026-06-24 |
| 対象システム | FLOW WMS（Warehouse Management System） |
| 実装基盤 | Next.js App Router / Route Handlers |

## 概要

本ドキュメントは FLOW WMS の REST API 設計仕様を定義する。すべての API は Next.js App Router の Route Handlers として実装し、認証に NextAuth セッション（Bearer JWT）を使用する。

---

## 共通仕様

### 認証

すべての保護されたエンドポイントは HTTP ヘッダーに Bearer トークンを必要とする。

```
Authorization: Bearer <JWT_TOKEN>
```

### エラーレスポンス形式

```json
{
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "details": {}
}
```

| HTTPステータス | 説明 |
|--------------|------|
| 400 | バリデーションエラー / 不正なリクエスト |
| 401 | 認証エラー（未ログイン） |
| 403 | 権限エラー（ロール不足） |
| 404 | リソース未存在 |
| 409 | 競合エラー（重複登録等） |
| 422 | ビジネスロジックエラー |
| 500 | サーバー内部エラー |

### ページネーション

一覧取得系のエンドポイントはレスポンスに以下のメタ情報を含む。

```json
{
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20,
    "total_pages": 5
  }
}
```

クエリパラメータ: `page`（デフォルト: 1）、`per_page`（デフォルト: 20、最大: 100）

### 日時フォーマット

すべての日時は ISO 8601 形式（UTC）を使用する。

```
2026-06-24T10:30:00Z
```

### ロール定義

| ロール | 説明 |
|--------|------|
| `admin` | システム管理者（全操作可能） |
| `manager` | 倉庫マネージャー（マスタ管理・レポート閲覧） |
| `operator` | 倉庫オペレーター（入出荷・在庫操作） |
| `viewer` | 閲覧専用ユーザー |

---

## 認証 API

### API-001: ログイン

- **メソッド:** POST
- **パス:** `/api/auth/signin`
- **説明:** メールアドレスとパスワードで認証を行い、JWT トークンとユーザー情報を返す。
- **認証:** 不要
- **リクエスト Body:**

```json
{
  "email": "operator@example.com",
  "password": "SecurePassword123"
}
```

- **レスポンス（成功 200）:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-06-25T10:30:00Z",
  "user": {
    "id": "usr_01HXYZ",
    "name": "山田 太郎",
    "email": "operator@example.com",
    "role": "operator",
    "warehouse_id": "wh_01ABCD"
  }
}
```

- **レスポンス（エラー 401）:**

```json
{
  "error": "メールアドレスまたはパスワードが正しくありません",
  "code": "INVALID_CREDENTIALS"
}
```

- **備考:** NextAuth の credentials provider を使用。レート制限: 5回/分。

---

### API-002: ログアウト

- **メソッド:** POST
- **パス:** `/api/auth/signout`
- **説明:** セッションを無効化しログアウトする。
- **認証:** 必要（全ロール）
- **リクエスト Body:** なし
- **レスポンス（成功 200）:**

```json
{
  "message": "ログアウトしました"
}
```

- **備考:** サーバー側でセッションを破棄し、クライアント側のトークンも無効化する。

---

## 入荷管理 API

### API-003: 発注一覧取得

- **メソッド:** GET
- **パス:** `/api/receiving/orders`
- **説明:** 発注（Purchase Order）の一覧を取得する。ページネーションおよびフィルタリングに対応。
- **認証:** 必要（operator 以上）
- **リクエスト Query:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `status` | string | 任意 | `draft` / `ordered` / `receiving` / `completed` / `cancelled` |
| `date_from` | string | 任意 | 発注日 FROM（ISO 8601） |
| `date_to` | string | 任意 | 発注日 TO（ISO 8601） |
| `partner_id` | string | 任意 | 仕入先 ID |
| `page` | integer | 任意 | ページ番号（デフォルト: 1） |
| `per_page` | integer | 任意 | 件数（デフォルト: 20） |

- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "po_01HXYZ001",
      "po_number": "PO-2026-0001",
      "status": "ordered",
      "partner": {
        "id": "partner_01ABC",
        "name": "株式会社サプライヤー"
      },
      "ordered_at": "2026-06-20T09:00:00Z",
      "expected_arrival_at": "2026-06-25T12:00:00Z",
      "total_items": 5,
      "total_quantity": 100,
      "created_at": "2026-06-20T09:00:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "per_page": 20,
    "total_pages": 3
  }
}
```

---

### API-004: 発注登録

- **メソッド:** POST
- **パス:** `/api/receiving/orders`
- **説明:** 新規発注を登録する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "partner_id": "partner_01ABC",
  "expected_arrival_at": "2026-06-25T12:00:00Z",
  "note": "急ぎ対応",
  "lines": [
    {
      "item_id": "item_01XYZ",
      "quantity": 50,
      "unit_price": 1200
    },
    {
      "item_id": "item_02ABC",
      "quantity": 30,
      "unit_price": 800
    }
  ]
}
```

- **レスポンス（成功 201）:**

```json
{
  "id": "po_01HXYZ001",
  "po_number": "PO-2026-0001",
  "status": "draft",
  "partner_id": "partner_01ABC",
  "expected_arrival_at": "2026-06-25T12:00:00Z",
  "lines": [
    {
      "id": "pol_01AAA",
      "item_id": "item_01XYZ",
      "quantity": 50,
      "received_quantity": 0,
      "unit_price": 1200
    }
  ],
  "created_at": "2026-06-24T10:30:00Z"
}
```

- **レスポンス（エラー 400）:**

```json
{
  "error": "バリデーションエラー",
  "code": "VALIDATION_ERROR",
  "details": {
    "lines": "明細行が1件以上必要です"
  }
}
```

---

### API-005: 発注詳細取得

- **メソッド:** GET
- **パス:** `/api/receiving/orders/[id]`
- **説明:** 指定した発注の詳細情報を取得する。
- **認証:** 必要（operator 以上）
- **リクエスト Query:** なし
- **レスポンス（成功 200）:**

```json
{
  "id": "po_01HXYZ001",
  "po_number": "PO-2026-0001",
  "status": "receiving",
  "partner": {
    "id": "partner_01ABC",
    "name": "株式会社サプライヤー",
    "code": "SUP-001"
  },
  "ordered_at": "2026-06-20T09:00:00Z",
  "expected_arrival_at": "2026-06-25T12:00:00Z",
  "received_at": null,
  "note": "急ぎ対応",
  "lines": [
    {
      "id": "pol_01AAA",
      "item": {
        "id": "item_01XYZ",
        "code": "ITM-001",
        "name": "商品A",
        "unit": "個"
      },
      "quantity": 50,
      "received_quantity": 20,
      "unit_price": 1200
    }
  ],
  "receiving_sessions": [
    {
      "id": "rs_01BBB",
      "operator": { "id": "usr_01HXYZ", "name": "山田 太郎" },
      "started_at": "2026-06-24T10:00:00Z",
      "completed_at": null
    }
  ],
  "created_at": "2026-06-20T09:00:00Z",
  "updated_at": "2026-06-24T10:00:00Z"
}
```

- **レスポンス（エラー 404）:**

```json
{
  "error": "発注が見つかりません",
  "code": "NOT_FOUND"
}
```

---

### API-006: 発注更新

- **メソッド:** PUT
- **パス:** `/api/receiving/orders/[id]`
- **説明:** 発注情報を更新する。ステータスが `draft` または `ordered` の場合のみ更新可能。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "expected_arrival_at": "2026-06-26T12:00:00Z",
  "note": "修正: 翌日入荷に変更",
  "lines": [
    {
      "id": "pol_01AAA",
      "quantity": 60
    }
  ]
}
```

- **レスポンス（成功 200）:** 更新後の発注詳細（API-005 と同形式）
- **レスポンス（エラー 422）:**

```json
{
  "error": "入荷中の発注は更新できません",
  "code": "INVALID_STATUS_TRANSITION"
}
```

---

### API-007: 入荷開始

- **メソッド:** POST
- **パス:** `/api/receiving/orders/[id]/start`
- **説明:** 入荷作業を開始する。入荷セッションを生成し、ステータスを `receiving` に変更する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:** なし
- **レスポンス（成功 200）:**

```json
{
  "session_id": "rs_01BBB",
  "order_id": "po_01HXYZ001",
  "status": "receiving",
  "operator": {
    "id": "usr_01HXYZ",
    "name": "山田 太郎"
  },
  "started_at": "2026-06-24T10:00:00Z"
}
```

- **レスポンス（エラー 422）:**

```json
{
  "error": "既に入荷セッションが開始されています",
  "code": "SESSION_ALREADY_STARTED"
}
```

- **備考:** 複数オペレーターによる同時入荷は可能。セッションごとに担当者を記録する。

---

### API-008: 入荷スキャン登録

- **メソッド:** POST
- **パス:** `/api/receiving/orders/[id]/receive`
- **説明:** バーコードスキャンによる入荷数量を登録する。ロット番号・賞味期限を記録する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "session_id": "rs_01BBB",
  "barcode": "4901234567890",
  "quantity": 10,
  "lot_number": "LOT-2026-001",
  "expiry_date": "2027-03-31",
  "location_id": "loc_01ZONE_A_01"
}
```

- **レスポンス（成功 200）:**

```json
{
  "receipt_line_id": "rl_01CCC",
  "item": {
    "id": "item_01XYZ",
    "code": "ITM-001",
    "name": "商品A"
  },
  "quantity": 10,
  "lot_number": "LOT-2026-001",
  "expiry_date": "2027-03-31",
  "location": {
    "id": "loc_01ZONE_A_01",
    "code": "A-01-01"
  },
  "received_at": "2026-06-24T10:05:00Z",
  "order_line": {
    "id": "pol_01AAA",
    "ordered_quantity": 50,
    "total_received_quantity": 30
  }
}
```

- **レスポンス（エラー 404）:**

```json
{
  "error": "バーコードに対応する品目が見つかりません",
  "code": "ITEM_NOT_FOUND",
  "details": { "barcode": "4901234567890" }
}
```

- **備考:** バーコードは GS1-128 / QR コードに対応。在庫テーブルへの即時反映はトランザクション内で実行する。

---

### API-009: 入荷完了

- **メソッド:** POST
- **パス:** `/api/receiving/orders/[id]/complete`
- **説明:** 入荷作業を完了する。ステータスを `completed` に変更し、在庫を確定する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "session_id": "rs_01BBB",
  "force": false
}
```

- **レスポンス（成功 200）:**

```json
{
  "order_id": "po_01HXYZ001",
  "status": "completed",
  "received_at": "2026-06-24T11:30:00Z",
  "summary": {
    "total_lines": 2,
    "completed_lines": 2,
    "shortage_lines": 0,
    "total_received_quantity": 80
  }
}
```

- **レスポンス（エラー 422）:**

```json
{
  "error": "未入荷の明細があります。強制完了する場合は force: true を指定してください",
  "code": "INCOMPLETE_LINES",
  "details": {
    "shortage_lines": [
      { "item_id": "item_02ABC", "ordered": 30, "received": 20 }
    ]
  }
}
```

- **備考:** `force: true` の場合は短納入として記録し完了処理を実行する。

---

## 出荷管理 API

### API-010: 受注一覧取得

- **メソッド:** GET
- **パス:** `/api/shipping/orders`
- **説明:** 受注（Sales Order）の一覧を取得する。
- **認証:** 必要（operator 以上）
- **リクエスト Query:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `status` | string | 任意 | `draft` / `confirmed` / `allocated` / `picking` / `shipped` / `cancelled` |
| `date_from` | string | 任意 | 受注日 FROM |
| `date_to` | string | 任意 | 受注日 TO |
| `partner_id` | string | 任意 | 得意先 ID |
| `page` | integer | 任意 | ページ番号 |

- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "so_01HXYZ002",
      "so_number": "SO-2026-0010",
      "status": "confirmed",
      "partner": {
        "id": "partner_02DEF",
        "name": "株式会社得意先"
      },
      "ordered_at": "2026-06-24T09:00:00Z",
      "requested_ship_at": "2026-06-25T15:00:00Z",
      "total_items": 3,
      "total_quantity": 60
    }
  ],
  "meta": {
    "total": 30,
    "page": 1,
    "per_page": 20,
    "total_pages": 2
  }
}
```

---

### API-011: 受注登録

- **メソッド:** POST
- **パス:** `/api/shipping/orders`
- **説明:** 新規受注を登録する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "partner_id": "partner_02DEF",
  "requested_ship_at": "2026-06-25T15:00:00Z",
  "delivery_address": "東京都港区虎ノ門1-1-1",
  "note": "時間指定: 午後",
  "lines": [
    {
      "item_id": "item_01XYZ",
      "quantity": 20
    },
    {
      "item_id": "item_02ABC",
      "quantity": 10
    }
  ]
}
```

- **レスポンス（成功 201）:**

```json
{
  "id": "so_01HXYZ002",
  "so_number": "SO-2026-0010",
  "status": "draft",
  "partner_id": "partner_02DEF",
  "requested_ship_at": "2026-06-25T15:00:00Z",
  "lines": [
    {
      "id": "sol_01DDD",
      "item_id": "item_01XYZ",
      "quantity": 20,
      "allocated_quantity": 0
    }
  ],
  "created_at": "2026-06-24T10:30:00Z"
}
```

---

### API-012: 受注詳細取得

- **メソッド:** GET
- **パス:** `/api/shipping/orders/[id]`
- **説明:** 指定した受注の詳細情報を取得する。引当状況・ピッキング状況を含む。
- **認証:** 必要（operator 以上）
- **レスポンス（成功 200）:**

```json
{
  "id": "so_01HXYZ002",
  "so_number": "SO-2026-0010",
  "status": "picking",
  "partner": {
    "id": "partner_02DEF",
    "name": "株式会社得意先",
    "code": "CUS-002"
  },
  "ordered_at": "2026-06-24T09:00:00Z",
  "requested_ship_at": "2026-06-25T15:00:00Z",
  "shipped_at": null,
  "delivery_address": "東京都港区虎ノ門1-1-1",
  "note": "時間指定: 午後",
  "lines": [
    {
      "id": "sol_01DDD",
      "item": {
        "id": "item_01XYZ",
        "code": "ITM-001",
        "name": "商品A",
        "unit": "個"
      },
      "quantity": 20,
      "allocated_quantity": 20,
      "picked_quantity": 15
    }
  ],
  "allocations": [
    {
      "id": "alloc_01EEE",
      "item_id": "item_01XYZ",
      "lot_number": "LOT-2026-001",
      "location_id": "loc_01ZONE_A_01",
      "quantity": 20
    }
  ],
  "picking_tasks": [
    {
      "id": "pt_01FFF",
      "status": "in_progress",
      "operator": { "id": "usr_01HXYZ", "name": "山田 太郎" }
    }
  ],
  "created_at": "2026-06-24T09:00:00Z",
  "updated_at": "2026-06-24T11:00:00Z"
}
```

---

### API-013: 在庫引当

- **メソッド:** POST
- **パス:** `/api/shipping/orders/[id]/allocate`
- **説明:** 受注に対して在庫の引当を行う。引当ロジックは先入先出（FIFO）または期限優先（FEFO）を選択可能。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "strategy": "FEFO",
  "force_partial": false
}
```

| フィールド | 説明 |
|-----------|------|
| `strategy` | `FIFO`（先入先出） / `FEFO`（期限優先） |
| `force_partial` | 在庫不足時に部分引当を許可するか |

- **レスポンス（成功 200）:**

```json
{
  "order_id": "so_01HXYZ002",
  "status": "allocated",
  "strategy": "FEFO",
  "allocations": [
    {
      "id": "alloc_01EEE",
      "item_id": "item_01XYZ",
      "item_name": "商品A",
      "lot_number": "LOT-2026-001",
      "expiry_date": "2027-03-31",
      "location_id": "loc_01ZONE_A_01",
      "location_code": "A-01-01",
      "quantity": 20
    }
  ],
  "shortage_lines": []
}
```

- **レスポンス（エラー 422）:**

```json
{
  "error": "在庫不足のため引当できません",
  "code": "INSUFFICIENT_STOCK",
  "details": {
    "shortage_lines": [
      {
        "item_id": "item_02ABC",
        "item_name": "商品B",
        "requested": 10,
        "available": 5
      }
    ]
  }
}
```

---

### API-014: ピッキングタスク生成

- **メソッド:** POST
- **パス:** `/api/shipping/orders/[id]/create-picking`
- **説明:** 引当済み受注のピッキングタスクを生成する。ロケーション順に最適化したタスクリストを作成する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "operator_id": "usr_01HXYZ",
  "optimize_route": true
}
```

- **レスポンス（成功 201）:**

```json
{
  "task_id": "pt_01FFF",
  "order_id": "so_01HXYZ002",
  "operator": {
    "id": "usr_01HXYZ",
    "name": "山田 太郎"
  },
  "status": "pending",
  "items_count": 3,
  "estimated_duration_minutes": 15,
  "created_at": "2026-06-24T11:00:00Z"
}
```

- **備考:** タスク生成後にハンディ端末へプッシュ通知（WebSocket）を送信する。

---

### API-015: ピッキングタスク取得（ハンディ端末用）

- **メソッド:** GET
- **パス:** `/api/shipping/picking/[taskId]`
- **説明:** ハンディ端末向けにピッキングタスクの詳細を取得する。ロケーション順に並び替えた作業リストを返す。
- **認証:** 必要（operator 以上）
- **レスポンス（成功 200）:**

```json
{
  "task_id": "pt_01FFF",
  "order_id": "so_01HXYZ002",
  "so_number": "SO-2026-0010",
  "status": "in_progress",
  "operator": {
    "id": "usr_01HXYZ",
    "name": "山田 太郎"
  },
  "lines": [
    {
      "id": "ptl_01GGG",
      "sequence": 1,
      "status": "pending",
      "location": {
        "id": "loc_01ZONE_A_01",
        "code": "A-01-01",
        "zone": "A",
        "aisle": "01",
        "shelf": "01"
      },
      "item": {
        "id": "item_01XYZ",
        "code": "ITM-001",
        "name": "商品A",
        "barcode": "4901234567890",
        "unit": "個"
      },
      "lot_number": "LOT-2026-001",
      "expiry_date": "2027-03-31",
      "quantity": 20,
      "picked_quantity": 0
    }
  ],
  "progress": {
    "total": 3,
    "completed": 0,
    "percentage": 0
  },
  "started_at": "2026-06-24T11:05:00Z"
}
```

---

### API-016: ピッキングスキャン

- **メソッド:** POST
- **パス:** `/api/shipping/picking/[taskId]/scan`
- **説明:** ハンディ端末からのバーコードスキャンでピッキング実績を記録する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "line_id": "ptl_01GGG",
  "barcode": "4901234567890",
  "quantity": 20,
  "location_barcode": "LOC-A-01-01"
}
```

- **レスポンス（成功 200）:**

```json
{
  "line_id": "ptl_01GGG",
  "status": "completed",
  "picked_quantity": 20,
  "task_progress": {
    "total": 3,
    "completed": 1,
    "percentage": 33
  },
  "next_line": {
    "id": "ptl_02HHH",
    "sequence": 2,
    "location_code": "A-02-03",
    "item_name": "商品B",
    "quantity": 10
  }
}
```

- **レスポンス（エラー 400）:**

```json
{
  "error": "バーコードが一致しません",
  "code": "BARCODE_MISMATCH",
  "details": {
    "expected_barcode": "4901234567890",
    "scanned_barcode": "4901234500000"
  }
}
```

- **備考:** ピッキング完了時に WebSocket でリアルタイム進捗を配信する。

---

### API-017: 出荷確定

- **メソッド:** POST
- **パス:** `/api/shipping/orders/[id]/ship`
- **説明:** ピッキング完了後に出荷を確定する。在庫を減算し、ステータスを `shipped` に変更する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "shipped_at": "2026-06-25T14:30:00Z",
  "tracking_number": "1234-5678-9012",
  "carrier": "ヤマト運輸",
  "note": "冷蔵便"
}
```

- **レスポンス（成功 200）:**

```json
{
  "order_id": "so_01HXYZ002",
  "so_number": "SO-2026-0010",
  "status": "shipped",
  "shipped_at": "2026-06-25T14:30:00Z",
  "tracking_number": "1234-5678-9012",
  "carrier": "ヤマト運輸",
  "shipped_lines": [
    {
      "item_id": "item_01XYZ",
      "item_name": "商品A",
      "quantity": 20,
      "lot_number": "LOT-2026-001"
    }
  ]
}
```

- **備考:** 出荷確定と同時に在庫トランザクションを記録する。取消は不可（返品処理で対応）。

---

## 在庫管理 API

### API-018: 在庫一覧取得

- **メソッド:** GET
- **パス:** `/api/inventory`
- **説明:** 現在の在庫一覧を取得する。品目・ロケーション・ロット番号でフィルタリング可能。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `item_id` | string | 任意 | 品目 ID |
| `location_id` | string | 任意 | ロケーション ID |
| `lot_number` | string | 任意 | ロット番号 |
| `zone_id` | string | 任意 | ゾーン ID |
| `expiry_date_to` | string | 任意 | 賞味期限 TO |
| `page` | integer | 任意 | ページ番号 |

- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "inv_01AAA",
      "item": {
        "id": "item_01XYZ",
        "code": "ITM-001",
        "name": "商品A",
        "unit": "個"
      },
      "location": {
        "id": "loc_01ZONE_A_01",
        "code": "A-01-01",
        "zone": "A"
      },
      "lot_number": "LOT-2026-001",
      "expiry_date": "2027-03-31",
      "quantity": 80,
      "reserved_quantity": 20,
      "available_quantity": 60,
      "received_at": "2026-06-24T11:30:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  }
}
```

---

### API-019: 品目別在庫サマリ取得

- **メソッド:** GET
- **パス:** `/api/inventory/summary`
- **説明:** 品目別に在庫数量を集計したサマリを返す。安全在庫との比較情報を含む。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:** `item_id`（任意）、`category_id`（任意）
- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "item": {
        "id": "item_01XYZ",
        "code": "ITM-001",
        "name": "商品A",
        "unit": "個",
        "category": "カテゴリA"
      },
      "total_quantity": 250,
      "reserved_quantity": 40,
      "available_quantity": 210,
      "safety_stock": 100,
      "is_below_safety_stock": false,
      "lot_count": 3,
      "earliest_expiry_date": "2027-01-31"
    }
  ],
  "meta": {
    "total": 80,
    "page": 1,
    "per_page": 20,
    "total_pages": 4
  }
}
```

---

### API-020: 在庫移動

- **メソッド:** POST
- **パス:** `/api/inventory/move`
- **説明:** 指定した在庫を別のロケーションへ移動する。
- **認証:** 必要（operator 以上）
- **リクエスト Body:**

```json
{
  "from_location_id": "loc_01ZONE_A_01",
  "to_location_id": "loc_02ZONE_B_05",
  "item_id": "item_01XYZ",
  "lot_number": "LOT-2026-001",
  "quantity": 30,
  "reason": "棚整理"
}
```

- **レスポンス（成功 200）:**

```json
{
  "transaction_id": "txn_01III",
  "type": "MOVE",
  "item_id": "item_01XYZ",
  "lot_number": "LOT-2026-001",
  "quantity": 30,
  "from_location": {
    "id": "loc_01ZONE_A_01",
    "code": "A-01-01"
  },
  "to_location": {
    "id": "loc_02ZONE_B_05",
    "code": "B-05-02"
  },
  "executed_at": "2026-06-24T14:00:00Z",
  "operator": { "id": "usr_01HXYZ", "name": "山田 太郎" }
}
```

- **レスポンス（エラー 422）:**

```json
{
  "error": "移動元の在庫が不足しています",
  "code": "INSUFFICIENT_STOCK",
  "details": { "available": 20, "requested": 30 }
}
```

---

### API-021: 在庫調整

- **メソッド:** POST
- **パス:** `/api/inventory/adjust`
- **説明:** 棚卸差異・破損等による在庫数量の調整を行う。調整理由の記録が必須。
- **認証:** 必要（manager 以上）
- **リクエスト Body:**

```json
{
  "location_id": "loc_01ZONE_A_01",
  "item_id": "item_01XYZ",
  "lot_number": "LOT-2026-001",
  "quantity_after": 75,
  "reason": "棚卸差異",
  "note": "実地棚卸により数量修正"
}
```

- **レスポンス（成功 200）:**

```json
{
  "transaction_id": "txn_02JJJ",
  "type": "ADJUSTMENT",
  "item_id": "item_01XYZ",
  "lot_number": "LOT-2026-001",
  "quantity_before": 80,
  "quantity_after": 75,
  "quantity_diff": -5,
  "reason": "棚卸差異",
  "location": {
    "id": "loc_01ZONE_A_01",
    "code": "A-01-01"
  },
  "executed_at": "2026-06-24T15:00:00Z",
  "operator": { "id": "usr_02YYY", "name": "鈴木 花子" }
}
```

- **備考:** 在庫調整は監査ログに記録される。大幅な調整（差異 > 10%）は自動でアラートを生成する。

---

### API-022: 在庫トランザクション履歴取得

- **メソッド:** GET
- **パス:** `/api/inventory/transactions`
- **説明:** 在庫の入出庫・移動・調整トランザクション履歴を取得する。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `item_id` | string | 任意 | 品目 ID |
| `location_id` | string | 任意 | ロケーション ID |
| `type` | string | 任意 | `RECEIVE` / `SHIP` / `MOVE` / `ADJUSTMENT` |
| `date_from` | string | 任意 | 日付 FROM |
| `date_to` | string | 任意 | 日付 TO |

- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "txn_01III",
      "type": "MOVE",
      "item": { "id": "item_01XYZ", "code": "ITM-001", "name": "商品A" },
      "lot_number": "LOT-2026-001",
      "quantity": 30,
      "quantity_diff": 0,
      "from_location": { "code": "A-01-01" },
      "to_location": { "code": "B-05-02" },
      "reference_id": null,
      "reference_type": null,
      "reason": "棚整理",
      "executed_at": "2026-06-24T14:00:00Z",
      "operator": { "name": "山田 太郎" }
    }
  ],
  "meta": {
    "total": 500,
    "page": 1,
    "per_page": 20,
    "total_pages": 25
  }
}
```

---

### API-023: アラート一覧取得

- **メソッド:** GET
- **パス:** `/api/inventory/alerts`
- **説明:** 安全在庫割れ・期限接近などのアラート一覧を取得する。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:** `type`（任意: `BELOW_SAFETY_STOCK` / `EXPIRY_SOON`）、`page`（任意）
- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "alert_01KKK",
      "type": "BELOW_SAFETY_STOCK",
      "severity": "warning",
      "item": {
        "id": "item_03GHI",
        "code": "ITM-003",
        "name": "商品C"
      },
      "current_quantity": 45,
      "safety_stock": 100,
      "shortage": 55,
      "created_at": "2026-06-24T08:00:00Z",
      "acknowledged": false
    },
    {
      "id": "alert_02LLL",
      "type": "EXPIRY_SOON",
      "severity": "critical",
      "item": {
        "id": "item_04JKL",
        "code": "ITM-004",
        "name": "商品D"
      },
      "lot_number": "LOT-2026-000",
      "expiry_date": "2026-06-30",
      "days_until_expiry": 6,
      "quantity": 200,
      "created_at": "2026-06-24T08:00:00Z",
      "acknowledged": false
    }
  ],
  "meta": {
    "total": 8,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

---

## ロケーション管理 API

### API-024: ロケーション一覧取得

- **メソッド:** GET
- **パス:** `/api/locations`
- **説明:** ロケーション（棚・ゾーン）の一覧を取得する。ゾーン ID でフィルタリング可能。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:** `zone_id`（任意）、`status`（任意: `active` / `inactive`）、`page`（任意）
- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "loc_01ZONE_A_01",
      "code": "A-01-01",
      "zone": {
        "id": "zone_01A",
        "name": "ゾーンA",
        "temperature": "常温"
      },
      "aisle": "01",
      "shelf": "01",
      "bin": null,
      "capacity": 100,
      "current_quantity": 80,
      "utilization_rate": 0.80,
      "status": "active",
      "storage_conditions": ["常温", "乾燥"]
    }
  ],
  "meta": {
    "total": 200,
    "page": 1,
    "per_page": 20,
    "total_pages": 10
  }
}
```

---

### API-025: ロケーション登録

- **メソッド:** POST
- **パス:** `/api/locations`
- **説明:** 新規ロケーションを登録する。
- **認証:** 必要（manager 以上）
- **リクエスト Body:**

```json
{
  "code": "A-01-02",
  "zone_id": "zone_01A",
  "aisle": "01",
  "shelf": "02",
  "bin": null,
  "capacity": 100,
  "storage_conditions": ["常温", "乾燥"],
  "note": "重量物専用棚"
}
```

- **レスポンス（成功 201）:**

```json
{
  "id": "loc_02ZONE_A_02",
  "code": "A-01-02",
  "zone_id": "zone_01A",
  "capacity": 100,
  "current_quantity": 0,
  "status": "active",
  "created_at": "2026-06-24T10:00:00Z"
}
```

---

### API-026: ロケーション詳細取得

- **メソッド:** GET
- **パス:** `/api/locations/[id]`
- **説明:** 指定したロケーションの詳細情報を取得する。現在の在庫情報を含む。
- **認証:** 必要（viewer 以上）
- **レスポンス（成功 200）:**

```json
{
  "id": "loc_01ZONE_A_01",
  "code": "A-01-01",
  "zone": {
    "id": "zone_01A",
    "name": "ゾーンA",
    "temperature": "常温"
  },
  "aisle": "01",
  "shelf": "01",
  "capacity": 100,
  "current_quantity": 80,
  "utilization_rate": 0.80,
  "status": "active",
  "storage_conditions": ["常温", "乾燥"],
  "inventories": [
    {
      "item": { "id": "item_01XYZ", "code": "ITM-001", "name": "商品A" },
      "lot_number": "LOT-2026-001",
      "expiry_date": "2027-03-31",
      "quantity": 80,
      "reserved_quantity": 20
    }
  ],
  "note": null,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-06-24T11:30:00Z"
}
```

---

### API-027: ロケーション更新

- **メソッド:** PUT
- **パス:** `/api/locations/[id]`
- **説明:** ロケーション情報（キャパシティ・保管条件・ステータス等）を更新する。
- **認証:** 必要（manager 以上）
- **リクエスト Body:**

```json
{
  "capacity": 120,
  "storage_conditions": ["常温", "乾燥", "防虫"],
  "status": "active",
  "note": "更新: キャパシティ拡張"
}
```

- **レスポンス（成功 200）:** 更新後のロケーション詳細（API-026 と同形式）

---

### API-028: 空きロケーション一覧取得

- **メソッド:** GET
- **パス:** `/api/locations/available`
- **説明:** 在庫保管可能な空き（または余裕のある）ロケーション一覧を取得する。アイテムの保管条件に合わせた絞り込みをサポート。
- **認証:** 必要（operator 以上）
- **リクエスト Query:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `item_id` | string | 任意 | 保管条件絞り込み用の品目 ID |
| `min_capacity` | integer | 任意 | 必要な最低空き容量 |
| `zone_id` | string | 任意 | ゾーン絞り込み |

- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "loc_05ZONE_A_05",
      "code": "A-05-01",
      "zone": { "id": "zone_01A", "name": "ゾーンA" },
      "capacity": 100,
      "current_quantity": 10,
      "available_capacity": 90,
      "utilization_rate": 0.10,
      "storage_conditions": ["常温", "乾燥"]
    }
  ],
  "meta": {
    "total": 35,
    "page": 1,
    "per_page": 20,
    "total_pages": 2
  }
}
```

---

## マスタ管理 API

### API-029: 品目一覧取得

- **メソッド:** GET
- **パス:** `/api/master/items`
- **説明:** 品目マスタの一覧を取得する。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:** `category_id`（任意）、`keyword`（任意: コード・名称検索）、`page`（任意）
- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "item_01XYZ",
      "code": "ITM-001",
      "name": "商品A",
      "name_kana": "ショウヒンA",
      "category": { "id": "cat_01", "name": "カテゴリA" },
      "unit": "個",
      "barcode": "4901234567890",
      "safety_stock": 100,
      "storage_conditions": ["常温", "乾燥"],
      "expiry_management": true,
      "lot_management": true,
      "status": "active",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 80,
    "page": 1,
    "per_page": 20,
    "total_pages": 4
  }
}
```

---

### API-030: 品目登録

- **メソッド:** POST
- **パス:** `/api/master/items`
- **説明:** 新規品目マスタを登録する。
- **認証:** 必要（manager 以上）
- **リクエスト Body:**

```json
{
  "code": "ITM-100",
  "name": "新商品Z",
  "name_kana": "シンショウヒンZ",
  "category_id": "cat_02",
  "unit": "箱",
  "barcode": "4900000000001",
  "safety_stock": 50,
  "storage_conditions": ["冷蔵"],
  "expiry_management": true,
  "lot_management": true,
  "expiry_alert_days": 30,
  "note": "冷蔵品のため2〜8℃で保管"
}
```

- **レスポンス（成功 201）:** 登録後の品目詳細（API-031 と同形式）
- **レスポンス（エラー 409）:**

```json
{
  "error": "同じ品目コードが既に存在します",
  "code": "DUPLICATE_CODE"
}
```

---

### API-031: 品目詳細取得

- **メソッド:** GET
- **パス:** `/api/master/items/[id]`
- **説明:** 指定した品目の詳細情報を取得する。
- **認証:** 必要（viewer 以上）
- **レスポンス（成功 200）:**

```json
{
  "id": "item_01XYZ",
  "code": "ITM-001",
  "name": "商品A",
  "name_kana": "ショウヒンA",
  "category": { "id": "cat_01", "name": "カテゴリA" },
  "unit": "個",
  "barcode": "4901234567890",
  "safety_stock": 100,
  "storage_conditions": ["常温", "乾燥"],
  "expiry_management": true,
  "lot_management": true,
  "expiry_alert_days": 60,
  "status": "active",
  "note": null,
  "current_stock": 250,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-06-20T09:00:00Z"
}
```

---

### API-032: 品目更新

- **メソッド:** PUT
- **パス:** `/api/master/items/[id]`
- **説明:** 品目マスタ情報を更新する。
- **認証:** 必要（manager 以上）
- **リクエスト Body:** 変更対象フィールドのみ指定（部分更新）

```json
{
  "safety_stock": 150,
  "expiry_alert_days": 90,
  "note": "安全在庫引き上げ"
}
```

- **レスポンス（成功 200）:** 更新後の品目詳細（API-031 と同形式）

---

### API-033: 品目削除

- **メソッド:** DELETE
- **パス:** `/api/master/items/[id]`
- **説明:** 品目マスタを削除する。在庫が存在する場合は削除不可（論理削除で無効化）。
- **認証:** 必要（admin）
- **レスポンス（成功 200）:**

```json
{
  "message": "品目を削除しました",
  "deleted": true
}
```

- **レスポンス（エラー 422）:**

```json
{
  "error": "在庫が存在するため削除できません。ステータスを無効化してください",
  "code": "HAS_STOCK"
}
```

---

### API-034: 取引先一覧取得

- **メソッド:** GET
- **パス:** `/api/master/partners`
- **説明:** 取引先（仕入先・得意先）マスタの一覧を取得する。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:** `type`（任意: `supplier` / `customer`）、`keyword`（任意）、`page`（任意）
- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "partner_01ABC",
      "code": "SUP-001",
      "name": "株式会社サプライヤー",
      "type": "supplier",
      "contact_email": "order@supplier.co.jp",
      "contact_phone": "03-1234-5678",
      "address": "東京都千代田区1-1-1",
      "status": "active"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "per_page": 20,
    "total_pages": 2
  }
}
```

---

### API-035: 取引先登録

- **メソッド:** POST
- **パス:** `/api/master/partners`
- **説明:** 新規取引先を登録する。
- **認証:** 必要（manager 以上）
- **リクエスト Body:**

```json
{
  "code": "SUP-010",
  "name": "新規仕入先株式会社",
  "type": "supplier",
  "contact_email": "contact@newsupplier.co.jp",
  "contact_phone": "06-9876-5432",
  "address": "大阪府大阪市北区1-2-3",
  "note": "月末締め翌月払い"
}
```

- **レスポンス（成功 201）:** 登録後の取引先詳細（API-036 と同形式）

---

### API-036: 取引先詳細取得

- **メソッド:** GET
- **パス:** `/api/master/partners/[id]`
- **説明:** 指定した取引先の詳細情報を取得する。
- **認証:** 必要（viewer 以上）
- **レスポンス（成功 200）:**

```json
{
  "id": "partner_01ABC",
  "code": "SUP-001",
  "name": "株式会社サプライヤー",
  "type": "supplier",
  "contact_email": "order@supplier.co.jp",
  "contact_phone": "03-1234-5678",
  "address": "東京都千代田区1-1-1",
  "status": "active",
  "note": null,
  "transaction_count": 42,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-06-01T00:00:00Z"
}
```

---

### API-037: 取引先更新

- **メソッド:** PUT
- **パス:** `/api/master/partners/[id]`
- **説明:** 取引先マスタ情報を更新する。
- **認証:** 必要（manager 以上）
- **リクエスト Body:** 変更対象フィールドのみ指定

```json
{
  "contact_email": "new-order@supplier.co.jp",
  "contact_phone": "03-9999-0000"
}
```

- **レスポンス（成功 200）:** 更新後の取引先詳細（API-036 と同形式）

---

### API-038: 取引先削除

- **メソッド:** DELETE
- **パス:** `/api/master/partners/[id]`
- **説明:** 取引先を削除する（論理削除）。進行中の取引がある場合は削除不可。
- **認証:** 必要（admin）
- **レスポンス（成功 200）:**

```json
{
  "message": "取引先を削除しました",
  "deleted": true
}
```

---

### API-039: ユーザー一覧取得

- **メソッド:** GET
- **パス:** `/api/master/users`
- **説明:** システムユーザーの一覧を取得する。
- **認証:** 必要（manager 以上）
- **リクエスト Query:** `role`（任意）、`status`（任意）、`page`（任意）
- **レスポンス（成功 200）:**

```json
{
  "data": [
    {
      "id": "usr_01HXYZ",
      "name": "山田 太郎",
      "email": "yamada@example.com",
      "role": "operator",
      "warehouse_id": "wh_01ABCD",
      "status": "active",
      "last_login_at": "2026-06-24T09:00:00Z",
      "created_at": "2026-01-15T00:00:00Z"
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

---

### API-040: ユーザー登録

- **メソッド:** POST
- **パス:** `/api/master/users`
- **説明:** 新規ユーザーを登録する。初期パスワードをメールで送信する。
- **認証:** 必要（admin）
- **リクエスト Body:**

```json
{
  "name": "佐藤 次郎",
  "email": "sato@example.com",
  "role": "operator",
  "warehouse_id": "wh_01ABCD"
}
```

- **レスポンス（成功 201）:**

```json
{
  "id": "usr_02MMM",
  "name": "佐藤 次郎",
  "email": "sato@example.com",
  "role": "operator",
  "warehouse_id": "wh_01ABCD",
  "status": "active",
  "created_at": "2026-06-24T10:00:00Z"
}
```

---

### API-041: ユーザー詳細取得

- **メソッド:** GET
- **パス:** `/api/master/users/[id]`
- **説明:** 指定したユーザーの詳細情報を取得する。
- **認証:** 必要（manager 以上 / 本人は自分自身を参照可能）
- **レスポンス（成功 200）:**

```json
{
  "id": "usr_01HXYZ",
  "name": "山田 太郎",
  "email": "yamada@example.com",
  "role": "operator",
  "warehouse": { "id": "wh_01ABCD", "name": "東京倉庫" },
  "status": "active",
  "last_login_at": "2026-06-24T09:00:00Z",
  "created_at": "2026-01-15T00:00:00Z",
  "updated_at": "2026-06-01T00:00:00Z"
}
```

---

### API-042: ユーザー更新

- **メソッド:** PUT
- **パス:** `/api/master/users/[id]`
- **説明:** ユーザー情報を更新する。ロール変更は admin のみ可能。
- **認証:** 必要（admin / manager）
- **リクエスト Body:**

```json
{
  "name": "山田 太郎（更新）",
  "role": "manager"
}
```

- **レスポンス（成功 200）:** 更新後のユーザー詳細（API-041 と同形式）

---

### API-043: ユーザー削除

- **メソッド:** DELETE
- **パス:** `/api/master/users/[id]`
- **説明:** ユーザーを削除する（論理削除・無効化）。自分自身の削除は不可。
- **認証:** 必要（admin）
- **レスポンス（成功 200）:**

```json
{
  "message": "ユーザーを削除しました",
  "deleted": true
}
```

- **レスポンス（エラー 403）:**

```json
{
  "error": "自分自身は削除できません",
  "code": "CANNOT_DELETE_SELF"
}
```

---

## KPI・レポート API

### API-044: 当日 KPI 取得

- **メソッド:** GET
- **パス:** `/api/reports/kpi/daily`
- **説明:** 当日の主要 KPI（入荷件数・出荷件数・在庫回転率等）を取得する。日付指定でその日の KPI も取得可能。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:** `date`（任意: ISO 8601 日付。デフォルト: 当日）
- **レスポンス（成功 200）:**

```json
{
  "date": "2026-06-24",
  "receiving": {
    "orders_count": 5,
    "completed_count": 3,
    "in_progress_count": 2,
    "total_received_quantity": 350
  },
  "shipping": {
    "orders_count": 12,
    "shipped_count": 10,
    "in_progress_count": 2,
    "total_shipped_quantity": 580
  },
  "inventory": {
    "total_items": 80,
    "below_safety_stock_count": 3,
    "expiry_alert_count": 2,
    "inventory_turnover_rate": 2.5
  },
  "operations": {
    "active_operators": 4,
    "picking_tasks_completed": 8,
    "average_picking_time_minutes": 18
  },
  "generated_at": "2026-06-24T15:00:00Z"
}
```

---

### API-045: KPI 推移グラフ用データ取得

- **メソッド:** GET
- **パス:** `/api/reports/kpi/trends`
- **説明:** 指定した期間の KPI 推移データを取得する。グラフ表示用に日次または週次・月次で集計する。
- **認証:** 必要（viewer 以上）
- **リクエスト Query:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `date_from` | string | 必須 | 開始日（ISO 8601） |
| `date_to` | string | 必須 | 終了日（ISO 8601） |
| `granularity` | string | 任意 | `daily`（デフォルト）/ `weekly` / `monthly` |
| `metrics` | string | 任意 | カンマ区切りで指定（デフォルト: 全て） |

- **レスポンス（成功 200）:**

```json
{
  "date_from": "2026-06-01",
  "date_to": "2026-06-24",
  "granularity": "daily",
  "data": [
    {
      "date": "2026-06-01",
      "receiving_count": 4,
      "shipping_count": 9,
      "inventory_turnover": 2.1,
      "picking_accuracy_rate": 0.99
    },
    {
      "date": "2026-06-02",
      "receiving_count": 6,
      "shipping_count": 11,
      "inventory_turnover": 2.3,
      "picking_accuracy_rate": 1.00
    }
  ]
}
```

---

### API-046: 作業実績レポート取得

- **メソッド:** GET
- **パス:** `/api/reports/operations`
- **説明:** オペレーター別・日付別の作業実績レポートを取得する。
- **認証:** 必要（manager 以上）
- **リクエスト Query:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `date_from` | string | 必須 | 開始日 |
| `date_to` | string | 必須 | 終了日 |
| `operator_id` | string | 任意 | オペレーター ID |
| `type` | string | 任意 | `receiving` / `picking` / `all` |

- **レスポンス（成功 200）:**

```json
{
  "date_from": "2026-06-01",
  "date_to": "2026-06-24",
  "summary": {
    "total_receiving_operations": 45,
    "total_picking_operations": 120,
    "total_items_handled": 8500
  },
  "by_operator": [
    {
      "operator": {
        "id": "usr_01HXYZ",
        "name": "山田 太郎"
      },
      "receiving_operations": 15,
      "picking_operations": 45,
      "items_handled": 3200,
      "average_picking_time_minutes": 16,
      "picking_accuracy_rate": 0.998,
      "working_days": 20
    }
  ],
  "by_date": [
    {
      "date": "2026-06-24",
      "receiving_operations": 3,
      "picking_operations": 8,
      "items_handled": 580
    }
  ]
}
```

---

## WebSocket API

### WS-001: ダッシュボードリアルタイム更新

- **エンドポイント:** `ws://host/ws/dashboard`
- **説明:** ダッシュボード画面向けに入出荷・在庫アラート等の情報をリアルタイムで配信する。
- **認証:** 接続時に `Authorization: Bearer <JWT_TOKEN>` ヘッダーまたはクエリパラメータ `?token=<JWT_TOKEN>` を付与する。
- **接続後に受信するイベント例:**

```json
{
  "event": "RECEIVING_COMPLETED",
  "timestamp": "2026-06-24T11:30:00Z",
  "data": {
    "order_id": "po_01HXYZ001",
    "po_number": "PO-2026-0001",
    "partner_name": "株式会社サプライヤー",
    "total_received_quantity": 80
  }
}
```

```json
{
  "event": "INVENTORY_ALERT",
  "timestamp": "2026-06-24T12:00:00Z",
  "data": {
    "alert_id": "alert_01KKK",
    "type": "BELOW_SAFETY_STOCK",
    "item_name": "商品C",
    "current_quantity": 45,
    "safety_stock": 100
  }
}
```

```json
{
  "event": "KPI_UPDATE",
  "timestamp": "2026-06-24T12:00:00Z",
  "data": {
    "shipping_count_today": 11,
    "receiving_count_today": 4,
    "active_operators": 5
  }
}
```

| イベント種別 | 説明 |
|------------|------|
| `RECEIVING_COMPLETED` | 入荷完了 |
| `SHIPPING_COMPLETED` | 出荷完了 |
| `INVENTORY_ALERT` | 在庫アラート発生 |
| `KPI_UPDATE` | KPI 定期更新（5分間隔） |

- **備考:** Next.js での実装は `/app/api/ws/dashboard/route.ts` に `socket.io` または ネイティブ WebSocket サーバーを使用する。

---

### WS-002: ピッキング進捗リアルタイム更新

- **エンドポイント:** `ws://host/ws/picking/[taskId]`
- **説明:** ピッキング作業の進捗をリアルタイムで配信する。管理者モニタリング画面・ハンディ端末の両方が接続可能。
- **認証:** 接続時に Bearer JWT を付与する。
- **接続後に受信するイベント例:**

```json
{
  "event": "PICKING_PROGRESS",
  "timestamp": "2026-06-24T11:10:00Z",
  "data": {
    "task_id": "pt_01FFF",
    "line_id": "ptl_01GGG",
    "status": "completed",
    "progress": {
      "total": 3,
      "completed": 1,
      "percentage": 33
    },
    "next_location": "A-02-03",
    "operator": { "id": "usr_01HXYZ", "name": "山田 太郎" }
  }
}
```

```json
{
  "event": "PICKING_COMPLETED",
  "timestamp": "2026-06-24T11:25:00Z",
  "data": {
    "task_id": "pt_01FFF",
    "order_id": "so_01HXYZ002",
    "so_number": "SO-2026-0010",
    "completed_at": "2026-06-24T11:25:00Z",
    "duration_minutes": 20,
    "operator": { "id": "usr_01HXYZ", "name": "山田 太郎" }
  }
}
```

| イベント種別 | 説明 |
|------------|------|
| `PICKING_PROGRESS` | ピッキング行完了（逐次） |
| `PICKING_COMPLETED` | タスク全完了 |
| `PICKING_ERROR` | スキャンエラー発生 |

---

## API エンドポイント一覧

| API ID | メソッド | パス | 説明 | 認証ロール |
|--------|--------|------|------|----------|
| API-001 | POST | `/api/auth/signin` | ログイン | 不要 |
| API-002 | POST | `/api/auth/signout` | ログアウト | 全ロール |
| API-003 | GET | `/api/receiving/orders` | 発注一覧取得 | operator 以上 |
| API-004 | POST | `/api/receiving/orders` | 発注登録 | operator 以上 |
| API-005 | GET | `/api/receiving/orders/[id]` | 発注詳細取得 | operator 以上 |
| API-006 | PUT | `/api/receiving/orders/[id]` | 発注更新 | operator 以上 |
| API-007 | POST | `/api/receiving/orders/[id]/start` | 入荷開始 | operator 以上 |
| API-008 | POST | `/api/receiving/orders/[id]/receive` | 入荷スキャン登録 | operator 以上 |
| API-009 | POST | `/api/receiving/orders/[id]/complete` | 入荷完了 | operator 以上 |
| API-010 | GET | `/api/shipping/orders` | 受注一覧取得 | operator 以上 |
| API-011 | POST | `/api/shipping/orders` | 受注登録 | operator 以上 |
| API-012 | GET | `/api/shipping/orders/[id]` | 受注詳細取得 | operator 以上 |
| API-013 | POST | `/api/shipping/orders/[id]/allocate` | 在庫引当 | operator 以上 |
| API-014 | POST | `/api/shipping/orders/[id]/create-picking` | ピッキングタスク生成 | operator 以上 |
| API-015 | GET | `/api/shipping/picking/[taskId]` | ピッキングタスク取得 | operator 以上 |
| API-016 | POST | `/api/shipping/picking/[taskId]/scan` | ピッキングスキャン | operator 以上 |
| API-017 | POST | `/api/shipping/orders/[id]/ship` | 出荷確定 | operator 以上 |
| API-018 | GET | `/api/inventory` | 在庫一覧取得 | viewer 以上 |
| API-019 | GET | `/api/inventory/summary` | 品目別在庫サマリ取得 | viewer 以上 |
| API-020 | POST | `/api/inventory/move` | 在庫移動 | operator 以上 |
| API-021 | POST | `/api/inventory/adjust` | 在庫調整 | manager 以上 |
| API-022 | GET | `/api/inventory/transactions` | 在庫トランザクション履歴取得 | viewer 以上 |
| API-023 | GET | `/api/inventory/alerts` | アラート一覧取得 | viewer 以上 |
| API-024 | GET | `/api/locations` | ロケーション一覧取得 | viewer 以上 |
| API-025 | POST | `/api/locations` | ロケーション登録 | manager 以上 |
| API-026 | GET | `/api/locations/[id]` | ロケーション詳細取得 | viewer 以上 |
| API-027 | PUT | `/api/locations/[id]` | ロケーション更新 | manager 以上 |
| API-028 | GET | `/api/locations/available` | 空きロケーション一覧取得 | operator 以上 |
| API-029 | GET | `/api/master/items` | 品目一覧取得 | viewer 以上 |
| API-030 | POST | `/api/master/items` | 品目登録 | manager 以上 |
| API-031 | GET | `/api/master/items/[id]` | 品目詳細取得 | viewer 以上 |
| API-032 | PUT | `/api/master/items/[id]` | 品目更新 | manager 以上 |
| API-033 | DELETE | `/api/master/items/[id]` | 品目削除 | admin |
| API-034 | GET | `/api/master/partners` | 取引先一覧取得 | viewer 以上 |
| API-035 | POST | `/api/master/partners` | 取引先登録 | manager 以上 |
| API-036 | GET | `/api/master/partners/[id]` | 取引先詳細取得 | viewer 以上 |
| API-037 | PUT | `/api/master/partners/[id]` | 取引先更新 | manager 以上 |
| API-038 | DELETE | `/api/master/partners/[id]` | 取引先削除 | admin |
| API-039 | GET | `/api/master/users` | ユーザー一覧取得 | manager 以上 |
| API-040 | POST | `/api/master/users` | ユーザー登録 | admin |
| API-041 | GET | `/api/master/users/[id]` | ユーザー詳細取得 | manager 以上 |
| API-042 | PUT | `/api/master/users/[id]` | ユーザー更新 | admin / manager |
| API-043 | DELETE | `/api/master/users/[id]` | ユーザー削除 | admin |
| API-044 | GET | `/api/reports/kpi/daily` | 当日 KPI 取得 | viewer 以上 |
| API-045 | GET | `/api/reports/kpi/trends` | KPI 推移グラフ用データ取得 | viewer 以上 |
| API-046 | GET | `/api/reports/operations` | 作業実績レポート取得 | manager 以上 |
| WS-001 | WS | `ws://host/ws/dashboard` | ダッシュボードリアルタイム更新 | 全ロール |
| WS-002 | WS | `ws://host/ws/picking/[taskId]` | ピッキング進捗リアルタイム更新 | operator 以上 |
