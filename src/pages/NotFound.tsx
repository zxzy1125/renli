// 404 页面
import { Link } from 'react-router-dom';
import { Home, ShieldAlert } from 'lucide-react';

interface NotFoundProps {
  code?: 404 | 403;
  title?: string;
  message?: string;
}

export default function NotFound({
  code = 404,
  title,
  message,
}: NotFoundProps) {
  const is403 = code === 403;
  const heading = title || (is403 ? '无权访问' : '页面不存在');
  const desc =
    message ||
    (is403
      ? '您当前角色无权访问此页面，请联系管理员。'
      : '您访问的页面不存在或已被删除。');

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cream-100 text-forest-500 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="font-mono text-5xl font-bold text-forest-700 mb-2">{code}</div>
        <h1 className="font-serif text-xl font-semibold text-forest-800 mb-2">{heading}</h1>
        <p className="text-sm text-forest-500 mb-6">{desc}</p>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
          <Home className="w-4 h-4" />
          返回工作台
        </Link>
      </div>
    </div>
  );
}
