// 加载中占位组件
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  className?: string;
  text?: string;
}

export default function Loading({ className, text = '加载中...' }: LoadingProps) {
  return (
    <div className={cn('flex items-center justify-center py-10 text-forest-500', className)}>
      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

// 全屏加载
export function FullScreenLoading({ text = '加载中...' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-cream-50">
      <div className="flex flex-col items-center text-forest-500">
        <Loader2 className="w-8 h-8 mb-3 animate-spin" />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  );
}
