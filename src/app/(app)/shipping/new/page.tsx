'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Item { id: string; code: string; name: string; unit: string; }
interface Partner { id: string; code: string; name: string; }
interface Line { itemId: string; orderedQty: number; }

export default function NewShippingPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ itemId: '', orderedQty: 1 }]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/items?limit=100').then((r) => r.json()),
      fetch('/api/partners?type=customer&limit=100').then((r) => r.json()),
    ]).then(([itemsRes, partnersRes]) => {
      setItems(itemsRes.data ?? []);
      setPartners(partnersRes.data ?? []);
    });
  }, []);

  const addLine = () => setLines((prev) => [...prev, { itemId: '', orderedQty: 1 }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof Line, value: string | number) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);

    const payload = {
      orderNumber: form.get('orderNumber'),
      customerId: form.get('customerId') || null,
      pickingMethod: form.get('pickingMethod') || 'single',
      priority: Number(form.get('priority') || 5),
      requiredDate: form.get('requiredDate') || null,
      shippingCarrier: form.get('shippingCarrier') || null,
      note: form.get('note') || null,
      lines: lines.filter((l) => l.itemId).map((l) => ({
        itemId: l.itemId,
        orderedQty: Number(l.orderedQty),
      })),
    };

    if (payload.lines.length === 0) {
      setError('明細を1件以上入力してください');
      return;
    }

    setIsLoading(true);
    const res = await fetch('/api/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsLoading(false);
    if (res.ok) {
      router.push('/shipping');
    } else {
      const data = await res.json();
      setError(data.error ?? '登録に失敗しました');
    }
  }

  const itemOptions = [
    { value: '', label: '商品を選択' },
    ...items.map((i) => ({ value: i.id, label: `${i.code} - ${i.name}` })),
  ];

  const partnerOptions = [
    { value: '', label: '顧客を選択（任意）' },
    ...partners.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">出荷指示登録</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>基本情報</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="出荷番号" name="orderNumber" required placeholder="SHP-2026-XXX" />
            <Select label="顧客" name="customerId" options={partnerOptions} />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="ピッキング方式"
                name="pickingMethod"
                options={[
                  { value: 'single', label: 'シングルピッキング' },
                  { value: 'batch', label: 'バッチピッキング' },
                  { value: 'zone', label: 'ゾーンピッキング' },
                  { value: 'wave', label: 'ウェーブピッキング' },
                ]}
              />
              <Input label="出荷期日" name="requiredDate" type="date" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="配送業者"
                name="shippingCarrier"
                options={[
                  { value: '', label: '未設定' },
                  { value: 'yamato', label: 'ヤマト運輸' },
                  { value: 'sagawa', label: '佐川急便' },
                  { value: 'japanpost', label: '日本郵便' },
                ]}
              />
              <Input
                label="優先度（1-10）"
                name="priority"
                type="number"
                min={1}
                max={10}
                defaultValue={5}
              />
            </div>
            <Input label="備考" name="note" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>明細</CardTitle>
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>＋ 行追加</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select
                    label={i === 0 ? '商品' : undefined}
                    options={itemOptions}
                    value={line.itemId}
                    onChange={(e) => updateLine(i, 'itemId', e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <Input
                    label={i === 0 ? '数量' : undefined}
                    type="number"
                    min={1}
                    value={line.orderedQty}
                    onChange={(e) => updateLine(i, 'orderedQty', Number(e.target.value))}
                  />
                </div>
                {lines.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)} className="text-red-500 mb-0.5">
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" isLoading={isLoading}>登録する</Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>キャンセル</Button>
        </div>
      </form>
    </div>
  );
}
