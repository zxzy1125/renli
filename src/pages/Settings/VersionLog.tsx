// 版本更新日志页面
import {
  GitCommit,
  Package,
  Sparkles,
  Wrench,
  Bug,
  Check,
  Calendar,
} from 'lucide-react';
import { VERSION_HISTORY, CURRENT_VERSION, type VersionType } from '@/versionHistory';

const TYPE_META: Record<VersionType, { label: string; color: string; icon: typeof Sparkles }> = {
  feature: { label: '新功能', color: 'text-emerald-700 bg-emerald-50 border-emerald-100', icon: Sparkles },
  improvement: { label: '优化', color: 'text-ochre-700 bg-ochre-50 border-ochre-100', icon: Wrench },
  fix: { label: '修复', color: 'text-risk-700 bg-risk-50 border-risk-100', icon: Bug },
};

export default function VersionLog() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Package className="w-5 h-5 text-forest-600 dark:text-cream-300" />
        <h2 className="font-serif text-lg font-semibold text-forest-800 dark:text-cream-100">版本更新</h2>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-forest-100 dark:bg-forest-800 text-forest-700 dark:text-cream-200 border border-forest-200 dark:border-forest-700">
          当前 v{CURRENT_VERSION}
        </span>
      </div>
      <p className="text-sm text-forest-500 dark:text-forest-400 mb-5">
        代招助手版本迭代记录，每次更新会在此展示新增功能、优化和修复内容
      </p>

      {/* 版本时间线 */}
      <div className="relative">
        {/* 左侧时间线竖线 */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-forest-100 dark:bg-forest-800" />

        <div className="space-y-6">
          {VERSION_HISTORY.map((v, idx) => {
            const meta = TYPE_META[v.type];
            const TypeIcon = meta.icon;
            const isLatest = idx === 0;

            return (
              <div key={v.version} className="relative pl-10">
                {/* 时间线节点 */}
                <div
                  className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isLatest
                      ? 'bg-ochre-100 border-ochre-400 text-ochre-600'
                      : 'bg-forest-50 dark:bg-forest-800/50 border-forest-200 dark:border-forest-700 text-forest-500 dark:text-forest-400'
                  }`}
                >
                  <GitCommit className="w-4 h-4" />
                </div>

                {/* 版本卡片 */}
                <div
                  className={`p-4 rounded-lg border ${
                    isLatest
                      ? 'bg-ochre-50/40 border-ochre-200'
                      : 'bg-cream-50 dark:bg-forest-800 border-cream-200 dark:border-forest-700'
                  }`}
                >
                  {/* 版本头：版本号 + 日期 + 类型标签 */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-mono font-semibold text-forest-800 dark:text-cream-100">
                      v{v.version}
                    </span>
                    {isLatest && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-ochre-500 text-cream-50">
                        最新
                      </span>
                    )}
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${meta.color}`}
                    >
                      <TypeIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-forest-500 dark:text-forest-400 ml-auto">
                      <Calendar className="w-3 h-3" />
                      {v.date}
                    </span>
                  </div>

                  {/* 更新标题 */}
                  <h3 className="font-serif text-base font-medium text-forest-800 dark:text-cream-100 mb-2">
                    {v.title}
                  </h3>

                  {/* 更新内容列表 */}
                  <ul className="space-y-1.5">
                    {v.changes.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-forest-600 dark:text-cream-300"
                      >
                        <Check className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500 flex-shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部说明 */}
      <div className="mt-6 p-3 rounded-lg bg-cream-50 dark:bg-forest-800 border border-cream-200 dark:border-forest-700 text-xs text-forest-500 dark:text-forest-400">
        <div className="flex items-center gap-1.5 mb-1">
          <Package className="w-3.5 h-3.5" />
          <span className="font-medium text-forest-700 dark:text-cream-200">关于版本号</span>
        </div>
        <p>
          版本号采用语义化版本（主版本.次版本.修订号）。主版本=不兼容的 API 修改；
          次版本=向下兼容的功能新增；修订号=向下兼容的问题修复。
        </p>
      </div>
    </div>
  );
}
