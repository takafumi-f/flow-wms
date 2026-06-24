'use client';

import { useState, useRef } from 'react';
import { parseBarcode } from '@/lib/utils/barcode';
import { Button } from '@/components/ui/button';

type PickStep = 'location' | 'item' | 'qty';

interface PickRecord {
  locationCode: string;
  itemBarcode: string;
  qty: number;
  timestamp: Date;
}

export default function HandyPickPage() {
  const [step, setStep] = useState<PickStep>('location');
  const [locationCode, setLocationCode] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [qty, setQty] = useState('1');
  const [input, setInput] = useState('');
  const [records, setRecords] = useState<PickRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stepConfig = {
    location: { label: 'ロケーションをスキャン', placeholder: 'ロケーションコード (例: A-01-01)' },
    item:     { label: '品目バーコードをスキャン', placeholder: 'JANコード / 品目コード' },
    qty:      { label: 'ピッキング数量を入力', placeholder: '数量' },
  };

  function handleConfirm() {
    const val = input.trim();
    if (!val) return;

    if (step === 'location') {
      setLocationCode(val);
      setInput('');
      setStep('item');
    } else if (step === 'item') {
      const parsed = parseBarcode(val);
      if (!parsed.isValid) {
        setError(`無効なバーコード: ${val}`);
        return;
      }
      setError(null);
      setItemBarcode(parsed.value);
      setInput('1');
      setStep('qty');
    } else {
      const n = Number(val);
      if (!Number.isInteger(n) || n <= 0) {
        setError('正の整数を入力してください');
        return;
      }
      setError(null);
      setRecords((prev) => [
        { locationCode, itemBarcode, qty: n, timestamp: new Date() },
        ...prev.slice(0, 19),
      ]);
      setLocationCode('');
      setItemBarcode('');
      setQty('1');
      setInput('');
      setStep('location');
    }
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleConfirm();
  }

  const stepColors: Record<PickStep, string> = {
    location: 'border-purple-300 bg-purple-50',
    item:     'border-blue-300 bg-blue-50',
    qty:      'border-green-300 bg-green-50',
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <a href="/handy" className="text-blue-600 text-sm">← メニュー</a>
        <h1 className="text-xl font-bold text-gray-900">ピッキングスキャン</h1>
      </div>

      {/* 進捗インジケーター */}
      <div className="flex gap-2 text-xs">
        {(['location', 'item', 'qty'] as PickStep[]).map((s) => (
          <div
            key={s}
            className={`flex-1 rounded-full py-1 text-center font-medium ${
              step === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s === 'location' ? 'ロケーション' : s === 'item' ? '品目' : '数量'}
          </div>
        ))}
      </div>

      {/* スキャン入力 */}
      <div className={`rounded-xl border-2 p-4 space-y-3 ${stepColors[step]}`}>
        <p className="text-sm font-medium text-gray-700">{stepConfig[step].label}</p>
        {locationCode && <p className="text-xs text-gray-500">ロケーション: <strong>{locationCode}</strong></p>}
        {itemBarcode && <p className="text-xs text-gray-500">品目: <strong className="font-mono">{itemBarcode}</strong></p>}
        <input
          ref={inputRef}
          type={step === 'qty' ? 'number' : 'text'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder={stepConfig[step].placeholder}
          min={step === 'qty' ? 1 : undefined}
          className="w-full rounded-lg border px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button onClick={handleConfirm} className="w-full py-3 text-base">
          確認 (Enter)
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ピッキング履歴 */}
      {records.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">完了済み</p>
          {records.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <span className="text-green-500 text-xl">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded">{r.locationCode}</span>
                  {' '}{r.qty}個
                </p>
                <p className="font-mono text-xs text-gray-400 truncate">{r.itemBarcode}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
