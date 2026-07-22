// 代招助手 Chrome 插件 Popup 逻辑
(() => {
  const apiUrlInput = document.getElementById('apiUrl');
  const apiTokenInput = document.getElementById('apiToken');
  const saveConfigBtn = document.getElementById('saveConfig');
  const cancelConfigBtn = document.getElementById('cancelConfig');
  const configPanel = document.getElementById('configPanel');
  const mainPanel = document.getElementById('mainPanel');
  const statusEl = document.getElementById('status');
  const candidatePreview = document.getElementById('candidatePreview');
  const previewName = document.getElementById('previewName');
  const previewDetail = document.getElementById('previewDetail');
  const previewSkills = document.getElementById('previewSkills');
  const importBtn = document.getElementById('importBtn');
  const resultMsg = document.getElementById('resultMsg');
  const openSettingsLink = document.getElementById('openSettings');
  const connectionStatus = document.getElementById('connectionStatus');

  let candidateData = null;
  let config = { apiUrl: '', token: '' };

  // 加载配置
  async function loadConfig() {
    const stored = await chrome.storage.local.get(['apiUrl', 'token']);
    config.apiUrl = stored.apiUrl || '';
    config.token = stored.token || '';
    connectionStatus.textContent = config.apiUrl ? '已配置' : '未配置';
    connectionStatus.className = 'conn-status' + (config.apiUrl ? ' connected' : '');
  }

  // 保存配置
  saveConfigBtn.addEventListener('click', async () => {
    const url = apiUrlInput.value.trim().replace(/\/+$/, '');
    const token = apiTokenInput.value.trim();
    if (!url) { alert('请输入服务器地址'); return; }
    config.apiUrl = url;
    config.token = token;
    await chrome.storage.local.set({ apiUrl: url, token });
    configPanel.style.display = 'none';
    mainPanel.style.display = '';
    connectionStatus.textContent = '已配置';
    connectionStatus.className = 'conn-status connected';
    checkPage();
  });

  cancelConfigBtn.addEventListener('click', () => {
    configPanel.style.display = 'none';
    mainPanel.style.display = '';
  });

  openSettingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    mainPanel.style.display = 'none';
    configPanel.style.display = '';
    apiUrlInput.value = config.apiUrl;
    apiTokenInput.value = config.token;
  });

  // 检测当前页面
  async function checkPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus('无法获取当前标签页', 'error');
        return;
      }

      // 尝试注入 content script（如果尚未注入）
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch { /* 已注入或无权限，忽略 */ }

      // ping content script
      chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          setStatus('请在 BOSS 直聘候选人页面使用此插件', 'warn');
          importBtn.disabled = true;
          return;
        }

        if (response.isResumePage) {
          // 提取数据
          chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CANDIDATE' }, (res) => {
            if (res?.ok && res.data) {
              candidateData = res.data;
              showCandidate(res.data);
              importBtn.disabled = !config.apiUrl;
            } else {
              setStatus('数据提取失败，请刷新页面重试', 'error');
            }
          });
        } else {
          setStatus('当前页面未检测到候选人信息，请打开候选人详情页', 'warn');
          importBtn.disabled = true;
        }
      });
    } catch (err) {
      setStatus('检测页面失败: ' + err.message, 'error');
    }
  }

  function setStatus(text, type = 'info') {
    statusEl.textContent = text;
    statusEl.className = 'status ' + type;
  }

  function showCandidate(data) {
    setStatus('已检测到候选人', 'success');
    candidatePreview.style.display = '';
    previewName.textContent = data.name || '未知';
    const details = [data.current_title, data.current_company, data.education, data.expected_city]
      .filter(Boolean).join(' · ') || '暂无详细信息';
    previewDetail.textContent = details;
    if (data.skills) {
      previewSkills.innerHTML = data.skills.split(',').slice(0, 6).map(s =>
        `<span class="skill-tag">${s.trim()}</span>`
      ).join('');
    }
  }

  // 导入简历
  importBtn.addEventListener('click', async () => {
    if (!candidateData || !config.apiUrl) return;
    importBtn.disabled = true;
    importBtn.textContent = '导入中...';
    resultMsg.style.display = 'none';

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (config.token) {
        headers['Authorization'] = config.token.startsWith('Bearer ')
          ? config.token
          : 'Bearer ' + config.token;
      }

      const resp = await fetch(config.apiUrl + '/api/resumes/extension-import', {
        method: 'POST',
        headers,
        body: JSON.stringify(candidateData),
      });

      const body = await resp.json();
      if (resp.ok) {
        const conflictText = body.conflictCount > 0
          ? `（警告：检测到 ${body.conflictCount} 条撞单）`
          : '';
        showResult(`导入成功！${candidateData.name} ${conflictText}`, 'success');
      } else {
        showResult('导入失败: ' + (body.error || resp.statusText), 'error');
      }
    } catch (err) {
      showResult('网络错误: ' + err.message, 'error');
    } finally {
      importBtn.disabled = false;
      importBtn.innerHTML = '<span class="btn-icon">+</span> 导入简历';
    }
  });

  function showResult(text, type) {
    resultMsg.textContent = text;
    resultMsg.className = 'result-msg ' + type;
    resultMsg.style.display = '';
  }

  // 初始化
  loadConfig().then(checkPage);
})();
