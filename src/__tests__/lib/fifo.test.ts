import {
  allocateFIFO,
  allocateFEFO,
  getAvailableQty,
  getTotalAvailableQty,
  type InventoryLot,
} from '@/lib/utils/fifo';

const makeDate = (daysAgo: number): Date => {
  const d = new Date('2026-01-01T00:00:00Z');
  d.setDate(d.getDate() - daysAgo);
  return d;
};

const makeLot = (override: Partial<InventoryLot> & { id: string }): InventoryLot => ({
  locationId: 'loc-1',
  quantity: 100,
  reservedQty: 0,
  lotNumber: null,
  expiryDate: null,
  receivedAt: makeDate(0),
  version: 1,
  ...override,
});

describe('getAvailableQty', () => {
  it('returns quantity minus reserved', () => {
    const lot = makeLot({ id: 'a', quantity: 100, reservedQty: 30 });
    expect(getAvailableQty(lot)).toBe(70);
  });

  it('returns 0 when reserved exceeds quantity', () => {
    const lot = makeLot({ id: 'a', quantity: 10, reservedQty: 20 });
    expect(getAvailableQty(lot)).toBe(0);
  });

  it('returns full quantity when reserved is 0', () => {
    const lot = makeLot({ id: 'a', quantity: 50, reservedQty: 0 });
    expect(getAvailableQty(lot)).toBe(50);
  });
});

describe('getTotalAvailableQty', () => {
  it('sums available quantities across all lots', () => {
    const lots = [
      makeLot({ id: 'a', quantity: 100, reservedQty: 20 }),
      makeLot({ id: 'b', quantity: 50, reservedQty: 10 }),
      makeLot({ id: 'c', quantity: 30, reservedQty: 0 }),
    ];
    expect(getTotalAvailableQty(lots)).toBe(80 + 40 + 30);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalAvailableQty([])).toBe(0);
  });

  it('ignores fully reserved lots', () => {
    const lots = [
      makeLot({ id: 'a', quantity: 50, reservedQty: 50 }),
      makeLot({ id: 'b', quantity: 20, reservedQty: 0 }),
    ];
    expect(getTotalAvailableQty(lots)).toBe(20);
  });
});

describe('allocateFIFO', () => {
  const lots: InventoryLot[] = [
    makeLot({ id: 'new', quantity: 100, receivedAt: makeDate(1) }),  // 1日前
    makeLot({ id: 'old', quantity: 100, receivedAt: makeDate(10) }), // 10日前（古い）
    makeLot({ id: 'mid', quantity: 100, receivedAt: makeDate(5) }),  // 5日前
  ];

  it('allocates from oldest lot first', () => {
    const result = allocateFIFO(lots, 50);
    expect(result.success).toBe(true);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].inventoryId).toBe('old');
    expect(result.allocations[0].quantity).toBe(50);
  });

  it('spans multiple lots when single lot is insufficient', () => {
    const smallLots: InventoryLot[] = [
      makeLot({ id: 'old', quantity: 30, receivedAt: makeDate(10) }),
      makeLot({ id: 'mid', quantity: 30, receivedAt: makeDate(5) }),
      makeLot({ id: 'new', quantity: 30, receivedAt: makeDate(1) }),
    ];
    const result = allocateFIFO(smallLots, 70);
    expect(result.success).toBe(true);
    expect(result.allocations).toHaveLength(3);
    expect(result.shortfall).toBe(0);
    // 古い順に割り当て
    expect(result.allocations[0].inventoryId).toBe('old');
    expect(result.allocations[1].inventoryId).toBe('mid');
  });

  it('returns shortfall when total inventory is insufficient', () => {
    const result = allocateFIFO(lots, 400);
    expect(result.success).toBe(false);
    expect(result.shortfall).toBe(100);
    expect(result.allocations.reduce((s, a) => s + a.quantity, 0)).toBe(300);
  });

  it('does not allocate from fully reserved lots', () => {
    const reservedLots: InventoryLot[] = [
      makeLot({ id: 'old', quantity: 50, reservedQty: 50, receivedAt: makeDate(10) }),
      makeLot({ id: 'new', quantity: 50, reservedQty: 0, receivedAt: makeDate(1) }),
    ];
    const result = allocateFIFO(reservedLots, 30);
    expect(result.success).toBe(true);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].inventoryId).toBe('new');
  });

  it('returns empty allocations for 0 required quantity', () => {
    const result = allocateFIFO(lots, 0);
    expect(result.success).toBe(true);
    expect(result.allocations).toHaveLength(0);
    expect(result.shortfall).toBe(0);
  });

  it('preserves lot number in allocation result', () => {
    const lotsWithLot: InventoryLot[] = [
      makeLot({ id: 'a', lotNumber: 'LOT-001', receivedAt: makeDate(5) }),
    ];
    const result = allocateFIFO(lotsWithLot, 10);
    expect(result.allocations[0].lotNumber).toBe('LOT-001');
  });
});

describe('allocateFEFO', () => {
  const makeExpiry = (daysFromNow: number): Date => {
    const d = new Date('2026-06-01T00:00:00Z');
    d.setDate(d.getDate() + daysFromNow);
    return d;
  };

  const lots: InventoryLot[] = [
    makeLot({ id: 'far', quantity: 100, expiryDate: makeExpiry(90) }),
    makeLot({ id: 'near', quantity: 100, expiryDate: makeExpiry(10) }),
    makeLot({ id: 'mid', quantity: 100, expiryDate: makeExpiry(30) }),
    makeLot({ id: 'no-expiry', quantity: 100, expiryDate: null }),
  ];

  it('allocates from nearest expiry first', () => {
    const result = allocateFEFO(lots, 50);
    expect(result.success).toBe(true);
    expect(result.allocations[0].inventoryId).toBe('near');
  });

  it('places null expiry lots last', () => {
    const result = allocateFEFO(lots, 350);
    expect(result.success).toBe(true);
    const lastAlloc = result.allocations[result.allocations.length - 1];
    expect(lastAlloc.inventoryId).toBe('no-expiry');
  });

  it('correctly orders multiple expiry dates', () => {
    const result = allocateFEFO(lots, 200);
    expect(result.allocations[0].inventoryId).toBe('near');
    expect(result.allocations[1].inventoryId).toBe('mid');
  });

  it('handles all null expiry dates', () => {
    const noExpiryLots: InventoryLot[] = [
      makeLot({ id: 'a', quantity: 50, expiryDate: null, receivedAt: makeDate(10) }),
      makeLot({ id: 'b', quantity: 50, expiryDate: null, receivedAt: makeDate(5) }),
    ];
    const result = allocateFEFO(noExpiryLots, 60);
    expect(result.success).toBe(true);
  });
});
