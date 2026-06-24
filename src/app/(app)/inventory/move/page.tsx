'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface InventoryRow {
  id: string;
  item_code: string;
  item_name: string;
  location_code: string;
  lot_number: string | null;
  quantity: number;
  reserved_qty: number;
}

export default function InventoryMovePage() {
  const router = useRouter();
  const [inventoryList, setInventoryList] = useState<InventoryRow[]>([]);
  const [locations, setLocations] = useState<{ id: string; code: string }[]>([]);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [toLocationId, setToLocationId] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    // 在庫詳細一覧取得
    fetch('/api/inventory/detail').then(async (r) => {
      if (r.ok) setInventoryList(await r.json());
    });
    // ロケーション一覧は取得できる場合のみ
  }, []);

  async function handleMove() {
    if (!selected) return;
    setError('');
    setIsLoading(true);

    const payload = {
      inventoryId: selected.id,
      fromLocationId: selected.location_code, // IDが必要だが表示用でここでは省略
      toLocationId,
      quantity: qty,
      note: note || null,
    };

    const res = await fetch('/api/inventory/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsLoading(false);
    if (res.ok) {
      router.push('/inventory');
    } else {
      const data = await res.json();
      setError(data.error ?? '移動に失敗しました');
    }
  }

  const available = selected ? selected.quantity - selected.reserved_qty : 0;

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">
          ← 戻る
        </button>
        <h1 className="text-xl font-semibold text-gray-900">在庫移動</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>移動元在庫</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input
            label="商品コードまたは商品名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="例: ITM001"
          />
          {selected && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
              <p className="font-medium">{selected.item_code} - {selected.item_name}</p>
              <p className="text-gray-600">ロケーション: {selected.location_code}</p>
              {selected.lot_number && <p className="text-gray-600">ロット: {selected.lot_number}</p>}
              <p className="text-gray-600">有効在庫: <strong>{available}</strong></p>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader><CardTitle>移動先・数量</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="移動先ロケーションID"
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              placeholder="ロケーションIDを入力"
            />
            <Input
              label="移動数量"
              type="number"
              min={1}
              max={available}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
            <Input
              label="備考"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="任意"
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
            )}
            <Button onClick={handleMove} isLoading={isLoading} disabled={!toLocationId || qty <= 0}>
              移動実行
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
