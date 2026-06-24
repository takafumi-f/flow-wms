// FIFO/FEFO 在庫引き当てロジック

export interface InventoryLot {
  id: string;
  locationId: string;
  quantity: number;
  reservedQty: number;
  lotNumber: string | null;
  expiryDate: Date | null;
  receivedAt: Date;
  version: number;
}

export interface AllocationItem {
  inventoryId: string;
  locationId: string;
  quantity: number;
  lotNumber: string | null;
}

export interface AllocationResult {
  success: boolean;
  allocations: AllocationItem[];
  shortfall: number;
}

export function getAvailableQty(lot: InventoryLot): number {
  return Math.max(0, lot.quantity - lot.reservedQty);
}

export function getTotalAvailableQty(lots: InventoryLot[]): number {
  return lots.reduce((sum, lot) => sum + getAvailableQty(lot), 0);
}

// FIFO: receivedAt 昇順（古い入荷から引き当て）
export function allocateFIFO(lots: InventoryLot[], requiredQty: number): AllocationResult {
  if (requiredQty <= 0) {
    return { success: true, allocations: [], shortfall: 0 };
  }

  const sorted = [...lots].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
  );

  return allocateFromSorted(sorted, requiredQty);
}

// FEFO: expiryDate 昇順（期限切れに近い順）、null は最後
export function allocateFEFO(lots: InventoryLot[], requiredQty: number): AllocationResult {
  if (requiredQty <= 0) {
    return { success: true, allocations: [], shortfall: 0 };
  }

  const sorted = [...lots].sort((a, b) => {
    if (a.expiryDate === null && b.expiryDate === null) return 0;
    if (a.expiryDate === null) return 1;
    if (b.expiryDate === null) return -1;
    return a.expiryDate.getTime() - b.expiryDate.getTime();
  });

  return allocateFromSorted(sorted, requiredQty);
}

function allocateFromSorted(
  sortedLots: InventoryLot[],
  requiredQty: number,
): AllocationResult {
  const allocations: AllocationItem[] = [];
  let remaining = requiredQty;

  for (const lot of sortedLots) {
    if (remaining <= 0) break;

    const available = getAvailableQty(lot);
    if (available <= 0) continue;

    const allocQty = Math.min(available, remaining);
    allocations.push({
      inventoryId: lot.id,
      locationId: lot.locationId,
      quantity: allocQty,
      lotNumber: lot.lotNumber,
    });
    remaining -= allocQty;
  }

  return {
    success: remaining === 0,
    allocations,
    shortfall: remaining,
  };
}
