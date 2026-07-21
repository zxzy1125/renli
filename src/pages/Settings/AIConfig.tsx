// AI 配置（管理员）：文本模型 + 多模态模型 + 测试连接
import { useEffect, useState } from 'react';
import { Save, Sparkles, Zap, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
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

// 常见多模态模型参考（仅作 placeholder 提示，不限制输入）
const MM_MODEL_HINTS: Record<string, string> = {
  openai: 'gpt-4o / gpt-4o-mini',
  qwen: 'qwen-vl-max / qwen-vl-plus',
  volcano: 'doubao-vision-pro-32k',
  anthropic: 'claude-3-5-sonnet-20241022',
  deepseek: 'deepseek-vl2（如支持）',
  custom: '自定义多模态模型名',
};

export default function AIConfigPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingMm, setTestingMm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testMmResult, setTestMmResult] = useState<{ ok: boolean; message: string } | null>(null);

  // 文本模型字段
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);

  // 多模态模型字段
  const [mmEnabled, setMmEnabled] = useState(false);
  const [mmProvider, setMmProvider] = useState('');
  const [mmApiKey, setMmApiKey] = useState('');
  const [mmBaseUrl, setMmBaseUrl] = useState('');
  const [mmModel, setMmModel] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cfg = await aiConfigApi.get();
        if (cancelled) return;
        setConfig(cfg);
        setProvider(cfg.provider || 'openai');
        setApiKey('');
        setBaseUrl(cfg.base_url || '');
        setModel(cfg.model || '');
        setTemperature(cfg.temperature ?? 0.7);
        // 多模态字段
        setMmEnabled(cfg.mm_enabled === 1);
        setMmProvider(cfg.mm_provider || 'openai');
        setMmApiKey('');
        setMmBaseUrl(cfg.mm_base_url || '');
        setMmModel(cfg.mm_model || '');
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
        mm_enabled: mmEnabled ? 1 : 0,
        mm_provider: mmProvider,
        mm_base_url: mmBaseUrl,
        mm_model: mmModel,
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      if (mmApiKey.trim()) payload.mm_api_key = mmApiKey.trim();
      const updated = await aiConfigApi.update(payload);
      setConfig(updated);
      setApiKey('');
      setMmApiKey('');
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
      const data = (res as { data?: { success?: boolean; message?: string; ok?: boolean } }).data ?? res;
      const ok = Boolean((data as { success?: boolean; ok?: boolean })?.success ?? (data as { ok?: boolean })?.ok);
      setTestResult({
        ok,
        message: (data as { message?: string })?.message || (ok ? '连接成功' : '连接失败'),
      });
    } catch (err) {
      setTestResult({ ok: false, message: getErrorMsg(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleTestMultimodal = async () => {
    setTestingMm(true);
    setTestMmResult(null);
    setError('');
    try {
      // 先保存（如果用户填了新 mm_api_key 或改了配置）
      const payload: Partial<AiConfig> = {
        mm_enabled: mmEnabled ? 1 : 0,
        mm_provider: mmProvider,
        mm_base_url: mmBaseUrl,
        mm_model: mmModel,
      };
      if (mmApiKey.trim()) payload.mm_api_key = mmApiKey.trim();
      await aiConfigApi.update(payload);
      setMmApiKey('');
      const res = await aiConfigApi.testMultimodal();
      const data = (res as { data?: { ok?: boolean; message?: string } }).data ?? res;
      setTestMmResult({
        ok: Boolean((data as { ok?: boolean })?.ok),
        message: (data as { message?: string })?.message || '测试完成',
      });
    } catch (err) {
      setTestMmResult({ ok: false, message: getErrorMsg(err) });
    } finally {
      setTestingMm(false);
    }
  };

  if (loading) return <Loading />;

  const maskedKey = config?.api_key ? maskApiKey(config.api_key) : '未配置';
  const maskedMmKey = config?.mm_api_key ? maskApiKey(config.mm_api_key) : '未配置（回退到文本模型 Key）';

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
        {/* ===== 文本模型配置 ===== */}
        <div className="p-4 rounded-lg bg-cream-50 border border-cream-200">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-ochre-500" />
            <span className="text-sm font-medium text-forest-800">文本模型</span>
            <span className="text-xs text-forest-500">· 用于话术生成、匹配分析、回访分析等纯文本任务</span>
          </div>

          <div className="space-y-3">
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
                  placeholder="如：gpt-4o-mini / deepseek-chat / glm-4-plus"
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="btn-ai flex items-center gap-1 disabled:opacity-60"
              >
                <Zap className="w-4 h-4" />
                {testing ? '测试中...' : '测试文本模型连接'}
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
          </div>
        </div>

        {/* ===== 多模态模型配置 ===== */}
        <div className="p-4 rounded-lg bg-ochre-50/40 border border-ochre-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-ochre-600" />
              <span className="text-sm font-medium text-forest-800">多模态模型（图片解析）</span>
              <span className="text-xs text-forest-500">· 文件含图片时自动调用</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mmEnabled}
                onChange={(e) => setMmEnabled(e.target.checked)}
                className="w-4 h-4 accent-ochre-600"
              />
              <span className="text-xs text-forest-700">启用独立多模态配置</span>
            </label>
          </div>

          {!mmEnabled ? (
            <div className="text-xs text-forest-500 px-3 py-2 bg-cream-50 rounded border border-cream-200">
              未启用时，文件解析有图片会回退到上方「文本模型」处理（要求文本模型本身支持视觉，如 gpt-4o / glm-4v-plus）。
              启用后可单独配置多模态专用模型，文本任务继续用文本模型，互不影响。
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">多模态服务商</label>
                  <select
                    className="input"
                    value={mmProvider}
                    onChange={(e) => {
                      setMmProvider(e.target.value);
                      // 切换服务商时清空模型，避免遗留错误选项
                      setMmModel('');
                    }}
                  >
                    {PROVIDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">多模态模型</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={mmModel}
                    onChange={(e) => setMmModel(e.target.value)}
                    placeholder={MM_MODEL_HINTS[mmProvider] || '多模态模型名'}
                  />
                </div>
              </div>

              <div>
                <label className="label">多模态 API Key</label>
                <input
                  type="password"
                  className="input font-mono"
                  value={mmApiKey}
                  onChange={(e) => setMmApiKey(e.target.value)}
                  placeholder={`当前：${maskedMmKey}（留空表示回退到文本模型 Key）`}
                  autoComplete="off"
                />
                <p className="text-xs text-forest-400 mt-1">
                  留空保存则使用文本模型的 API Key（适用于多模态模型和文本模型同服务商的情况）。
                </p>
              </div>

              <div>
                <label className="label">多模态 Base URL</label>
                <input
                  type="text"
                  className="input font-mono"
                  value={mmBaseUrl}
                  onChange={(e) => setMmBaseUrl(e.target.value)}
                  placeholder="留空表示回退到文本模型的 Base URL"
                />
                <p className="text-xs text-forest-400 mt-1">
                  留空则使用文本模型的 Base URL（适用于同服务商不同模型的情况）。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestMultimodal}
                  disabled={testingMm}
                  className="btn-ai flex items-center gap-1 disabled:opacity-60"
                >
                  <Zap className="w-4 h-4" />
                  {testingMm ? '测试中...' : '测试多模态连接'}
                </button>
              </div>

              {testMmResult && (
                <div
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${
                    testMmResult.ok
                      ? 'bg-forest-50 border-forest-100 text-forest-700'
                      : 'bg-risk-50 border-risk-100 text-risk-700'
                  }`}
                >
                  {testMmResult.ok ? (
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <div className="font-medium">{testMmResult.ok ? '多模态测试通过' : '多模态测试失败'}</div>
                    <div className="text-xs mt-0.5">{testMmResult.message}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== 保存按钮 ===== */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-1 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </form>

      {/* 提示词说明 */}
      <div className="mt-6 p-4 rounded-lg bg-cream-50 border border-cream-200">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-ochre-500" />
          <span className="text-sm font-medium text-forest-700">已内置 11 套提示词</span>
        </div>
        <p className="text-xs text-forest-500">
          包括：职位解析、简历解析、匹配分析、18 条话术生成、回访前作战卡片、回访后深度分析、应对话术、话术润色、BOSS 岗位发布文案等。
          职位/简历解析均支持多模态图片识别（需配置多模态模型）。
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
