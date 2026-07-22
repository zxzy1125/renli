// 风险求职者红标警告组件
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskWarning } from '@/types';

interface RiskBadgeProps {
  risk: RiskWarning | null | undefined;
  variant?: 'inline' | 'banner';
  className?: string;
}

// 内联红标（用于卡片）
export function RiskBadge({ risk, className }: RiskBadgeProps) {
  if (!risk?.isRisky) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-risk-100 text-risk-700 dark:bg-risk-900/30 dark:text-risk-400',
        className
      )}
    >
      <AlertTriangle className="w-3 h-3" />
      <span>风险求职者</span>
    </span>
  );
}

// 醒目红条（用于详情页顶部）
export function RiskBanner({ risk, className }: RiskBadgeProps) {
  if (!risk?.isRisky) return null;
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg bg-risk-50 border border-risk-100 text-risk-700 dark:bg-risk-900/20 dark:border-risk-800 dark:text-risk-400',
        className
      )}
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold text-sm">⚠️ 风险求职者警告</div>
        {risk.reasons && risk.reasons.length > 0 ? (
          <ul className="mt-1 text-sm list-disc pl-5 space-y-0.5">
            {risk.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : (
          <div className="mt-1 text-sm">建议谨慎沟通，注意甄别身份与求职动机。</div>
        )}
      </div>
    </div>
  );
}

export default RiskBadge;
