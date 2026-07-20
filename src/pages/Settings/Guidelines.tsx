// 运营规范知识库：BOSS 规范 / HR 话术方法论
import { useEffect, useState } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import { guidelinesApi, getErrorMsg } from '@/lib/api';
import Loading from '@/components/Loading';
import MarkdownView from '@/components/MarkdownView';
import { cn } from '@/lib/utils';

type DocKey = 'boss' | 'hr';

interface DocState {
  title: string;
  content: string;
  loading: boolean;
  error: string;
}

export default function Guidelines() {
  const [tab, setTab] = useState<DocKey>('boss');
  const [docs, setDocs] = useState<Record<DocKey, DocState>>({
    boss: { title: '', content: '', loading: true, error: '' },
    hr: { title: '', content: '', loading: true, error: '' },
  });

  const fetchDoc = async (key: DocKey) => {
    setDocs((d) => ({ ...d, [key]: { ...d[key], loading: true, error: '' } }));
    try {
      const res =
        key === 'boss' ? await guidelinesApi.boss() : await guidelinesApi.hrMethodology();
      setDocs((d) => ({
        ...d,
        [key]: {
          title: res.data.title || (key === 'boss' ? 'BOSS 规范' : 'HR 话术方法论'),
          content: res.data.content || '',
          loading: false,
          error: '',
        },
      }));
    } catch (err) {
      setDocs((d) => ({
        ...d,
        [key]: {
          title: key === 'boss' ? 'BOSS 规范' : 'HR 话术方法论',
          content: '',
          loading: false,
          error: getErrorMsg(err),
        },
      }));
    }
  };

  useEffect(() => {
    if (!docs[tab].content && !docs[tab].error) {
      fetchDoc(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const current = docs[tab];

  return (
    <div>
      <h2 className="font-serif text-lg font-semibold text-forest-800 mb-1">运营规范知识库</h2>
      <p className="text-sm text-forest-500 mb-4">
        内置 BOSS 直聘运营规范与 HR 招聘话术方法论，AI 调用时强制注入硬约束
      </p>

      {/* Tab */}
      <div className="border-b border-forest-100 mb-4 flex gap-2">
        <GuidelineTab active={tab === 'boss'} onClick={() => setTab('boss')} icon={BookOpen}>
          BOSS 规范
        </GuidelineTab>
        <GuidelineTab active={tab === 'hr'} onClick={() => setTab('hr')} icon={FileText}>
          HR 话术方法论
        </GuidelineTab>
      </div>

      {current.loading ? (
        <Loading />
      ) : current.error ? (
        <div className="px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {current.error}
          <button
            type="button"
            onClick={() => fetchDoc(tab)}
            className="ml-2 underline text-risk-700"
          >
            重试
          </button>
        </div>
      ) : (
        <article className="prose prose-sm max-w-none">
          <h1 className="font-serif text-xl font-bold text-forest-800 mb-4">{current.title}</h1>
          <MarkdownView content={current.content} />
        </article>
      )}
    </div>
  );
}

function GuidelineTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px',
        active
          ? 'border-forest-600 text-forest-700 font-medium'
          : 'border-transparent text-forest-500 hover:text-forest-700'
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}
