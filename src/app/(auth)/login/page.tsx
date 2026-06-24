'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError('メールアドレスまたはパスワードが正しくありません');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">FLOW WMS</h1>
          <p className="mt-1 text-sm text-gray-500">EC特化型SaaS倉庫管理システム</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">ログイン</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="メールアドレス"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="admin@demo.flowwms.jp"
            />
            <Input
              label="パスワード"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              ログイン
            </Button>
          </form>

          <p className="mt-6 text-xs text-center text-gray-400">
            デモ: admin@demo.flowwms.jp / admin1234
          </p>
        </div>
      </div>
    </div>
  );
}
