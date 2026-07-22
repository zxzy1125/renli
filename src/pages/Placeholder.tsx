// 通用占位页面（匹配管理、跟进管理、转化跟踪等）
import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description?: string;
}

export default function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      <Link
        to="/dashboard"
        className="btn-ghost inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> 返回工作台
      </Link>
      <div className="card p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ochre-50 dark:bg-ochre-900/20 text-ochre-600 dark:text-ochre-400 mb-4">
          <Construction className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-forest-800 dark:text-cream-100 mb-2">{title}</h1>
        <p className="text-sm text-forest-500 dark:text-forest-400 max-w-md mx-auto">
          {description || '此功能模块正在紧锣密鼓地开发中，敬请期待。'}
        </p>
        <div className="mt-6 inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-cream-100 dark:bg-forest-800 text-forest-600 dark:text-cream-300">
          🚧 即将上线
        </div>
      </div>
    </div>
  );
}
