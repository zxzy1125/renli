// AI 配置（管理员）：表单 + 测试连接
import { useEffect, useState } from 'react';
import { Save, Sparkles, Zap, Check, AlertCircle } from 'lucide-react';
import { aiConfigApi, getErrorMsg } from '@/lib/api';
import Loading from '@/components/Loading';
import type { AiConfig } from '@/types';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI（官方/兼容协议）' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'volcano', label: '火山方舟（豆包）' },
  { value: 'qwen', label: '通义千问（阿里云百炼）' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'custom', label: '自定义 OpenAI 兼容' },
] as const;

export default function AIConfigPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // 表单字段
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cfg = await aiConfigApi.get();
        if (cancelled) return;
        setConfig(cfg);
        setProvider(cfg.provider || 'openai');
        setApiKey(''); // 不回显 API Key（脱敏展示）
        setBaseUrl(cfg.base_url || '');
        setModel(cfg.model || '');
        setTemperature(cfg.temperature ?? 0.7);
      } catch (err) {
        setError(getErrorMsg(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: Partial<AiConfig> = {
        provider,
        base_url: baseUrl,
        model,
        temperature,
      };
      // API Key 仅在用户填写时更新
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      const updated = await aiConfigApi.update(payload);
      setConfig(updated);
      setApiKey(''); // 清空，下次展示脱敏
      setSuccess('AI 配置已保存');
    } catch (err) {
      setError(getErrorMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      // 如果用户填了新 API Key，先保存再测试
      if (apiKey.trim()) {
        await aiConfigApi.update({
          provider,
          api_key: apiKey.trim(),
          base_url: baseUrl,
          model,
          temperature,
        });
        setApiKey('');
      }
      const res = await aiConfigApi.test();
      const data = (res as { data?: { success?: boolean; message?: string } }).data ?? res;
      setTestResult({
        ok: Boolean((data as { success?: boolean })?.success),
        message:
          (data as { message?: string })?.message ||
          ((data as { success?: boolean })?.success ? '连接成功' : '连接失败'),
      });
    } catch (err) {
      setTestResult({ ok: false, message: getErrorMsg(err) });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Loading />;

  // 脱敏展示
  const maskedKey = config?.api_key ? maskApiKey(config.api_key) : '未配置';

  return (
    <div>
      <h2 className="font-serif text-lg font-semibold text-forest-800 mb-1">AI 配置</h2>
      <p className="text-sm text-forest-500 mb-4">
        配置 AI 服务商与凭证，用于简历解析、话术生成、回访分析等
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-risk-50 border border-risk-100 text-sm text-risk-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-forest-50 border border-forest-100 text-sm text-forest-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">服务商</label>
            <select
              className="input"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">模型</label>
            <input
              type="text"
              className="input font-mono"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="如：gpt-4o-mini / deepseek-chat"
            />
          </div>
        </div>

        <div>
          <label className="label">API Key</label>
          <input
            type="password"
            className="input font-mono"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`当前已配置：${maskedKey}（填写新值将覆盖）`}
            autoComplete="off"
          />
          <p className="text-xs text-forest-400 mt-1">
            当前：{maskedKey}。留空保存表示不修改；填写新值将覆盖。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Base URL</label>
            <input
              type="text"
              className="input font-mono"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="如：https://api.openai.com/v1"
            />
          </div>
          <div>
            <label className="label">温度（temperature）</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="flex-1 accent-forest-600"
              />
              <span className="font-mono text-sm text-forest-700 w-12 text-right">
                {temperature.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-forest-400 mt-1">
              值越高输出越发散，越低越确定。建议话术类 0.7-0.9，解析类 0.1-0.3。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-1 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="btn-ai flex items-center gap-1 disabled:opacity-60"
          >
            <Zap className="w-4 h-4" />
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${
              testResult.ok
                ? 'bg-forest-50 border-forest-100 text-forest-700'
                : 'bg-risk-50 border-risk-100 text-risk-700'
            }`}
          >
            {testResult.ok ? (
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <div className="font-medium">{testResult.ok ? '测试通过' : '测试失败'}</div>
              <div className="text-xs mt-0.5">{testResult.message}</div>
            </div>
          </div>
        )}
      </form>

      {/* 提示词说明 */}
      <div className="mt-6 p-4 rounded-lg bg-cream-50 border border-cream-200">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-ochre-500" />
          <span className="text-sm font-medium text-forest-700">已内置 9 套提示词</span>
        </div>
        <p className="text-xs text-forest-500">
          包括：职位解析、简历解析、匹配分析、18 条话术生成、回访前作战卡片、回访后深度分析、应对话术、话术润色、BOSS 岗位发布文案。
          提示词编辑能力将在后续版本开放。
        </p>
      </div>
    </div>
  );
}

// API Key 脱敏：只显示前 4 和后 4 位
function maskApiKey(key: string): string {
  if (!key) return '未配置';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}
