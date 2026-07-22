import { cn } from '@/lib/utils'

// Empty component
interface EmptyProps {
  description?: string;
  className?: string;
}

export default function Empty({ description, className }: EmptyProps) {
  return (
    <div className={cn('flex h-full items-center justify-center text-forest-400 dark:text-forest-500 text-sm', className)}>
      {description || '暂无数据'}
    </div>
  )
}
