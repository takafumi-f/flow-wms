'use client';

import { useState, useRef } from 'react';
import { parseBarcode } from '@/lib/utils/barcode';
import { Button } from '@/components/ui/button';

interface ScanResult {
  barcode: string;
  type: string;
  isValid: boolean;
  timestamp: Date;
}

export default function HandyReceivePage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ScanResult[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleScan() {
    const raw = input.trim();
    if (!raw) return;

    const parsed = parseBarcode(raw);
    if (!parsed.isValid) {
      setLastError(`無効なバーコード: ${raw}`);
      setInput('');
      return;
    }

    setLastError(null);
    setResults((prev) => [
      { barcode: parsed.value, type: parsed.type, isValid: parsed.isValid, timestamp: new Date() },
      ...prev.slice(0, 19),
    ]);
    setInput('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleScan();
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <a href="/handy" className="text-blue-600 text-sm">← メニュー</a>
        <h1 className="text-xl font-bold text-gray-900">入荷検品スキャン</h1>
      </div>

      {/* スキャン入力 */}
      <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 space-y-3">
        <p className="text-sm font-medium text-blue-800">バーコードをスキャンまたは入力してください</p>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="バーコード値"
          className="w-full rounded-lg border border-blue-300 px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button onClick={handleScan} className="w-full py-3 text-base">
          確認 (Enter)
        </Button>
      </div>

      {/* エラー表示 */}
      {lastError && (
        <div className="rounded-lg bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-700">
          {lastError}
        </div>
      )}

      {/* スキャン履歴 */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">スキャン履歴</p>
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <span className="text-green-500 text-xl">✓</span>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm truncate">{r.barcode}</p>
                <p className="text-xs text-gray-400">{r.type} · {r.timestamp.toLocaleTimeString('ja-JP')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
