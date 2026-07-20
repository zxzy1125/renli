// 标签输入组件：支持回车/逗号添加、删除
import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  max?: number;
}

export default function TagInput({
  value,
  onChange,
  placeholder = '输入后回车或逗号添加',
  className,
  max,
}: TagInputProps) {
  const [input, setInput] = useState('');

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (value.includes(t)) {
      setInput('');
      return;
    }
    if (max && value.length >= max) return;
    onChange([...value, t]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      // 退格删除最后一个
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-lg border border-forest-200 bg-white focus-within:ring-2 focus-within:ring-forest-400 focus-within:border-transparent transition',
        className
      )}
    >
      {value.map((tag, i) => (
        <span
          key={tag + i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-forest-50 text-forest-700 border border-forest-200"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="text-forest-400 hover:text-risk-600"
            aria-label={`删除 ${tag}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1 flex-1 min-w-[120px]">
        <Plus className="w-3 h-3 text-forest-400" />
        <input
          type="text"
          className="flex-1 px-1 py-0.5 text-sm bg-transparent outline-none border-0 focus:ring-0"
          placeholder={value.length === 0 ? placeholder : ''}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
        />
      </div>
    </div>
  );
}
