'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Line {
  id: string;
  item_code: string;
  item_name: string;
  unit: string;
  ordered_qty: number;
  picked_qty: number;
  location_code: string | null;
  lot_number: string | null;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  lines: Line[];
}

export default function PickingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [pickingLine, setPickingLine] = useState<Line | null>(null);
  const [locationId, setLocationId] = useState('');
  const [pickedQty, setPickedQty] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/shipping/${id}`).then(async (r) => {
      if (r.ok) setOrder(await r.json());
    });
  }, [id]);

  async function handlePick() {
    if (!pickingLine) return;
    setError('');
    setIsLoading(true);

    const res = await fetch(`/api/shipping/${id}/picking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId: pickingLine.id,
        pickedQty,
        locationId,
        lotNumber: pickingLine.lot_number || null,
      }),
    });

    setIsLoading(false);
    if (res.ok) {
      // 再取得
      const updated = await fetch(`/api/shipping/${id}`);
      if (updated.ok) {
        const data = await updated.json();
        setOrder(data);
        setPickingLine(null);
        setLocationId('');
        setPickedQty(1);
      }
    } else {
      const data = await res.json();
      setError(data.error ?? 'ピッキングに失敗しました');
    }
  }

  if (!order) return <div className="p-6 text-gray-500">読み込み中...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">
          ← 出荷一覧へ
        </button>
        <h1 className="text-xl font-semibold text-gray-900">
          ピッキング: {order.order_number}
        </h1>
      </div>

      {/* ピッキング明細一覧 */}
      <Card>
        <CardHeader><CardTitle>ピッキングリスト</CardTitle></CardHeader>
        <Table>
          <Thead>
            <Tr>
              <Th>商品</Th>
              <Th className="text-right">必要数</Th>
              <Th className="text-right">ピッキング済</Th>
              <Th>状態</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {order.lines.map((line) => (
              <Tr key={line.id} className={pickingLine?.id === line.id ? 'bg-blue-50' : ''}>
                <Td>
                  <p className="font-mono text-xs">{line.item_code}</p>
                  <p className="text-sm">{line.item_name}</p>
                </Td>
                <Td className="text-right">{line.ordered_qty} {line.unit}</Td>
                <Td className="text-right">{line.picked_qty} {line.unit}</Td>
                <Td>
                  <Badge variant={
                    line.status === 'completed' ? 'success' :
                    line.status === 'picking' ? 'info' : 'outline'
                  }>
                    {line.status === 'completed' ? '完了' :
                     line.status === 'picking' ? 'ピッキング中' : '待機中'}
                  </Badge>
                </Td>
                <Td>
                  {line.status !== 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPickingLine(line);
                        setPickedQty(line.ordered_qty - line.picked_qty);
                      }}
                    >
                      ピック
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

      {/* ピッキング入力フォーム */}
      {pickingLine && (
        <Card>
          <CardHeader>
            <CardTitle>ピッキング入力: {pickingLine.item_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              必要数: <strong>{pickingLine.ordered_qty - pickingLine.picked_qty} {pickingLine.unit}</strong>
            </p>
            <Input
              label="ロケーションID"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="ロケーションIDを入力"
              required
            />
            <Input
              label="ピッキング数量"
              type="number"
              min={1}
              max={pickingLine.ordered_qty - pickingLine.picked_qty}
              value={pickedQty}
              onChange={(e) => setPickedQty(Number(e.target.value))}
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
            )}
            <div className="flex gap-3">
              <Button onClick={handlePick} isLoading={isLoading} disabled={!locationId}>
                ピッキング確定
              </Button>
              <Button variant="secondary" onClick={() => setPickingLine(null)}>
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
