// 通用模态框组件
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  // 锁定背景滚动 + ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-forest-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* 内容 */}
      <div
        className={cn(
          'relative bg-white dark:bg-forest-900 rounded-xl shadow-cardHover w-full max-h-[90vh] flex flex-col',
          sizeClasses[size],
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-forest-100 dark:border-forest-800">
            <h3 className="text-base font-semibold text-forest-800 dark:text-cream-100">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-forest-50 dark:hover:bg-forest-800 text-forest-500 dark:text-forest-400"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-forest-100 dark:border-forest-800 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
