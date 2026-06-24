'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { href: '/', label: 'ダッシュボード', icon: '📊' },
  { href: '/receiving', label: '入荷管理', icon: '📦' },
  { href: '/shipping', label: '出荷管理', icon: '🚚' },
  { href: '/inventory', label: '在庫管理', icon: '🗄️' },
  { href: '/master/items', label: '商品マスタ', icon: '📋', roles: ['admin', 'manager'] },
  { href: '/master/partners', label: '取引先マスタ', icon: '🏢', roles: ['admin', 'manager'] },
  { href: '/master/users', label: 'ユーザー管理', icon: '👤', roles: ['admin'] },
];

interface SidebarProps {
  role: UserRole;
  tenantName?: string;
}

export function Sidebar({ role, tenantName }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-gray-900">
      {/* ロゴ */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-700 px-6">
        <span className="text-lg font-bold text-white">FLOW WMS</span>
      </div>

      {/* テナント名 */}
      {tenantName && (
        <div className="px-6 py-3 text-xs text-gray-400 truncate">{tenantName}</div>
      )}

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {visibleItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium
                    transition-colors
                    ${isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
