import { z } from 'zod';

// ============================================================
// 入荷予定
// ============================================================

export const ReceivingOrderLineSchema = z.object({
  itemId: z.string().uuid(),
  orderedQty: z.number().int().positive(),
  lotNumber: z.string().max(100).nullable().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const ReceivingOrderSchema = z.object({
  orderNumber: z.string().min(1).max(100),
  supplierId: z.string().uuid().nullable().optional(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  lines: z.array(ReceivingOrderLineSchema).min(1),
});

export const InspectSchema = z.object({
  lineId: z.string().uuid(),
  scannedQty: z.number().int().positive(),
  locationId: z.string().uuid(),
  lotNumber: z.string().max(100).nullable().optional(),
});

// ============================================================
// 出荷指示
// ============================================================

export const ShippingOrderLineSchema = z.object({
  itemId: z.string().uuid(),
  orderedQty: z.number().int().positive(),
});

export const ShippingOrderSchema = z.object({
  orderNumber: z.string().min(1).max(100),
  customerId: z.string().uuid().nullable().optional(),
  pickingMethod: z.enum(['single', 'batch', 'zone', 'wave']).default('single'),
  priority: z.number().int().min(1).max(10).default(5),
  requiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  shippingCarrier: z.enum(['yamato', 'sagawa', 'japanpost']).nullable().optional(),
  shipToName: z.string().max(255).nullable().optional(),
  shipToPostal: z.string().max(10).nullable().optional(),
  shipToAddress: z.string().max(500).nullable().optional(),
  shipToTel: z.string().max(20).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  lines: z.array(ShippingOrderLineSchema).min(1),
});

export const PickingSchema = z.object({
  lineId: z.string().uuid(),
  pickedQty: z.number().int().positive(),
  locationId: z.string().uuid(),
  lotNumber: z.string().max(100).nullable().optional(),
});

// ============================================================
// 在庫移動
// ============================================================

export const InventoryMoveSchema = z.object({
  inventoryId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.number().int().positive(),
  note: z.string().max(1000).nullable().optional(),
});

// ============================================================
// 商品マスタ
// ============================================================

export const ItemSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  nameKana: z.string().max(255).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  unit: z.string().max(50).default('個'),
  weightG: z.number().int().positive().nullable().optional(),
  barcode: z.string().max(100).nullable().optional(),
  lotManaged: z.boolean().default(false),
  expiryManaged: z.boolean().default(false),
  reorderPoint: z.number().int().nonnegative().nullable().optional(),
  reorderQty: z.number().int().positive().nullable().optional(),
  unitPrice: z.number().int().nonnegative().default(0),
});

// ============================================================
// 取引先マスタ
// ============================================================

export const PartnerSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  type: z.enum(['supplier', 'customer', 'both']),
  postalCode: z.string().max(10).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  tel: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  contactName: z.string().max(255).nullable().optional(),
});

// ============================================================
// ページネーション
// ============================================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ReceivingQuerySchema = PaginationSchema.extend({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ShippingQuerySchema = PaginationSchema.extend({
  status: z.enum(['pending', 'picking', 'packed', 'shipped', 'cancelled']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const InventoryQuerySchema = PaginationSchema.extend({
  itemCode: z.string().optional(),
  locationCode: z.string().optional(),
  lowStockOnly: z.coerce.boolean().default(false),
});
