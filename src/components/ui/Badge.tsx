// 徽章组件：基于 .badge 样式类 + 颜色变体
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'danger' | 'warning' | 'info';

interface BadgeProps {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

const variantClass: Record<Variant, string> = {
  default: 'bg-forest-100 text-forest-700',
  success: 'bg-green-100 text-green-800',
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
};

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span className={cn('badge', variantClass[variant], className)}>
      {children}
    </span>
  );
}
