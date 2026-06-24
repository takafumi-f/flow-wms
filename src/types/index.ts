// FLOW WMS 型定義

// ============================================================
// 列挙型
// ============================================================

export type Plan = 'free' | 'starter' | 'growth' | 'enterprise';
export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';
export type InventoryTransactionType = 'receive' | 'ship' | 'move' | 'adjust' | 'return';
export type ReceivingStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ShippingStatus = 'pending' | 'picking' | 'packed' | 'shipped' | 'cancelled';
export type PickingMethod = 'single' | 'batch' | 'zone' | 'wave';
export type LocationType = 'receiving' | 'picking' | 'bulk' | 'staging' | 'shipping';
export type PartnerType = 'supplier' | 'customer' | 'both';
export type ShippingCarrier = 'yamato' | 'sagawa' | 'japanpost';
export type EcPlatform = 'amazon' | 'shopify' | 'rakuten' | 'yahoo' | 'base';
export type ShippingOrderLineStatus = 'pending' | 'picking' | 'completed';

// ============================================================
// ドメインモデル
// ============================================================

export interface Tenant {
  id: string;
  name: string;
  plan: Plan;
  planExpiresAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  maxOrdersPerMonth: number;
  maxUsers: number;
  maxWarehouses: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  address: string | null;
  tel: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  warehouseId: string | null;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Item {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  nameKana: string | null;
  category: string | null;
  unit: string;
  weightG: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  barcode: string | null;
  lotManaged: boolean;
  serialManaged: boolean;
  expiryManaged: boolean;
  reorderPoint: number | null;
  reorderQty: number | null;
  unitPrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Partner {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: PartnerType;
  postalCode: string | null;
  address: string | null;
  tel: string | null;
  fax: string | null;
  email: string | null;
  contactName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  warehouseId: string;
  code: string;
  zone: string | null;
  aisle: string | null;
  bay: string | null;
  level: string | null;
  locationType: LocationType;
  capacityWeightG: number | null;
  capacityVolumeCm3: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface Inventory {
  id: string;
  warehouseId: string;
  locationId: string;
  itemId: string;
  lotNumber: string | null;
  serialNumber: string | null;
  expiryDate: Date | null;
  quantity: number;
  reservedQty: number;
  version: number;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // リレーション（JOINで取得時）
  item?: Item;
  location?: Location;
}

export interface InventoryTransaction {
  id: string;
  warehouseId: string;
  itemId: string;
  locationId: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  lotNumber: string | null;
  serialNumber: string | null;
  beforeQty: number | null;
  afterQty: number | null;
  referenceType: string | null;
  referenceId: string | null;
  userId: string | null;
  note: string | null;
  createdAt: Date;
}

export interface ReceivingOrder {
  id: string;
  warehouseId: string;
  orderNumber: string;
  supplierId: string | null;
  status: ReceivingStatus;
  expectedDate: Date | null;
  receivedAt: Date | null;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  // リレーション
  supplier?: Partner;
  lines?: ReceivingOrderLine[];
}

export interface ReceivingOrderLine {
  id: string;
  receivingOrderId: string;
  itemId: string;
  orderedQty: number;
  receivedQty: number;
  lotNumber: string | null;
  expiryDate: Date | null;
  locationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // リレーション
  item?: Item;
  location?: Location;
}

export interface ShippingOrder {
  id: string;
  warehouseId: string;
  orderNumber: string;
  customerId: string | null;
  status: ShippingStatus;
  pickingMethod: PickingMethod;
  priority: number;
  requiredDate: Date | null;
  shipToName: string | null;
  shipToPostal: string | null;
  shipToAddress: string | null;
  shipToTel: string | null;
  shippedAt: Date | null;
  shippingCarrier: ShippingCarrier | null;
  trackingNumber: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  // リレーション
  customer?: Partner;
  lines?: ShippingOrderLine[];
}

export interface ShippingOrderLine {
  id: string;
  shippingOrderId: string;
  itemId: string;
  orderedQty: number;
  pickedQty: number;
  lotNumber: string | null;
  locationId: string | null;
  status: ShippingOrderLineStatus;
  createdAt: Date;
  updatedAt: Date;
  // リレーション
  item?: Item;
  location?: Location;
}

// ============================================================
// API リクエスト/レスポンス型
// ============================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

// 在庫サマリ（一覧表示用）
export interface InventorySummary {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  totalQty: number;
  reservedQty: number;
  availableQty: number;
  locationCount: number;
  reorderPoint: number | null;
  isLowStock: boolean;
}

// KPI
export interface KpiData {
  todayReceiving: number;
  todayShipping: number;
  pendingReceiving: number;
  pendingShipping: number;
  lowStockItems: number;
  totalSkus: number;
  shippingLast7Days: DailyCount[];
  recentShippingOrders: ShippingOrder[];
  lowStockAlerts: InventorySummary[];
}

export interface DailyCount {
  date: string; // YYYY-MM-DD
  count: number;
}

// ============================================================
// セッション型（NextAuth拡張）
// ============================================================

export interface SessionUser {
  id: string;
  tenantId: string;
  warehouseId: string | null;
  name: string;
  email: string;
  role: UserRole;
}

// ============================================================
// フォーム入力型
// ============================================================

export interface ReceivingOrderInput {
  orderNumber: string;
  supplierId: string | null;
  expectedDate: string | null;
  note: string | null;
  lines: ReceivingOrderLineInput[];
}

export interface ReceivingOrderLineInput {
  itemId: string;
  orderedQty: number;
  lotNumber: string | null;
  expiryDate: string | null;
}

export interface InspectInput {
  lineId: string;
  scannedQty: number;
  locationId: string;
  lotNumber: string | null;
}

export interface ShippingOrderInput {
  orderNumber: string;
  customerId: string | null;
  pickingMethod: PickingMethod;
  priority: number;
  requiredDate: string | null;
  shippingCarrier: ShippingCarrier | null;
  note: string | null;
  lines: ShippingOrderLineInput[];
}

export interface ShippingOrderLineInput {
  itemId: string;
  orderedQty: number;
}

export interface PickingInput {
  lineId: string;
  pickedQty: number;
  locationId: string;
  lotNumber: string | null;
}

export interface InventoryMoveInput {
  inventoryId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  note: string | null;
}

export interface ItemInput {
  code: string;
  name: string;
  nameKana: string | null;
  category: string | null;
  unit: string;
  weightG: number | null;
  barcode: string | null;
  lotManaged: boolean;
  expiryManaged: boolean;
  reorderPoint: number | null;
  reorderQty: number | null;
  unitPrice: number;
}

export interface PartnerInput {
  code: string;
  name: string;
  type: PartnerType;
  postalCode: string | null;
  address: string | null;
  tel: string | null;
  email: string | null;
  contactName: string | null;
}
