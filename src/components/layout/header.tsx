'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  userName: string;
  role: string;
}

const roleLabel: Record<string, string> = {
  admin: '管理者',
  manager: 'マネージャー',
  operator: 'オペレーター',
  viewer: '閲覧者',
};

export function Header({ userName, role }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          <p className="text-xs text-gray-500">{roleLabel[role] ?? role}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          ログアウト
        </Button>
      </div>
    </header>
  );
}
