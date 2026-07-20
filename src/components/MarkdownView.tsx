// Markdown 渲染组件
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownViewProps {
  content?: string | null;
  className?: string;
}

export default function MarkdownView({ content, className }: MarkdownViewProps) {
  if (!content || !content.trim()) {
    return <p className="text-sm text-forest-400 italic">（无内容）</p>;
  }
  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
