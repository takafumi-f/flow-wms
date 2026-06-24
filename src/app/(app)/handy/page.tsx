import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'ハンディ端末' };

const menus = [
  { href: '/handy/receive', label: '入荷検品', icon: '📦', desc: 'バーコードスキャンで入荷検品' },
  { href: '/handy/pick',    label: 'ピッキング', icon: '🔍', desc: 'ロケーション・品目をスキャン確認' },
];

export default function HandyMenuPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-2xl font-bold text-gray-900">ハンディ端末メニュー</h1>
      <div className="grid w-full max-w-sm gap-4">
        {menus.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex items-center gap-4 rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md active:scale-95 transition-all"
          >
            <span className="text-4xl">{m.icon}</span>
            <div>
              <p className="text-lg font-semibold text-gray-900">{m.label}</p>
              <p className="text-sm text-gray-500">{m.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
