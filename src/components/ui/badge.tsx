import type { HTMLAttributes } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const variantClasses: Record<Variant, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  outline: 'border border-gray-300 text-gray-700',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

// ステータスバッジ（WMSドメイン固有）
export function ReceivingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: Variant }> = {
    pending: { label: '待機中', variant: 'outline' },
    in_progress: { label: '検品中', variant: 'info' },
    completed: { label: '完了', variant: 'success' },
    cancelled: { label: 'キャンセル', variant: 'danger' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'default' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ShippingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: Variant }> = {
    pending: { label: '待機中', variant: 'outline' },
    picking: { label: 'ピッキング中', variant: 'info' },
    packed: { label: '梱包済み', variant: 'warning' },
    shipped: { label: '出荷済み', variant: 'success' },
    cancelled: { label: 'キャンセル', variant: 'danger' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'default' };
  return <Badge variant={variant}>{label}</Badge>;
}
