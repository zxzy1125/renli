// BOSS 直聘简历采集 Content Script
(() => {
  // 检测当前页面是否为候选人详情页
  function isResumePage() {
    const url = window.location.href;
    return (
      url.includes('/web/geek/info') ||
      url.includes('/resume/') ||
      (url.includes('zhipin.com') && document.querySelector('.resume-preview, .geek-info, .detail-content'))
    );
  }

  // 提取候选人数据（适配 BOSS 直聘多种页面结构）
  function extractCandidateData() {
    const data = {
      name: '',
      current_company: '',
      current_title: '',
      education: '',
      age: null,
      skills: '',
      work_experience: '',
      expected_city: '',
      expectation: '',
      raw_text: '',
      source_url: window.location.href,
    };

    // 姓名
    const nameEl = document.querySelector(
      '.geek-name, .name, [class*="name"], .base-info h1, .resume-preview .name'
    );
    if (nameEl) data.name = nameEl.textContent.trim().replace(/先生|女士/g, '');

    // 期望城市
    const cityEl = document.querySelector('.geek-city, .city, [class*="city"], .base-info .city');
    if (cityEl) data.expected_city = cityEl.textContent.trim();

    // 当前职位/公司（经验行）
    const expItems = document.querySelectorAll(
      '.experience-item, .work-experience-item, .geek-experience .item, [class*="experience"] .item'
    );
    if (expItems.length > 0) {
      const firstExp = expItems[0];
      const titleEl = firstExp.querySelector('[class*="title"], [class*="position"], .job-name');
      const companyEl = firstExp.querySelector('[class*="company"], .company-name');
      if (titleEl) data.current_title = titleEl.textContent.trim();
      if (companyEl) data.current_company = companyEl.textContent.trim();

      // 全部工作经历文本
      const expTexts = [];
      expItems.forEach(item => {
        const text = item.textContent.replace(/\s+/g, ' ').trim();
        if (text) expTexts.push(text);
      });
      data.work_experience = expTexts.join('\n');
    }

    // 学历
    const eduEl = document.querySelector(
      '.geek-edu, .edu, [class*="education"], .base-info .edu'
    );
    if (eduEl) {
      const eduText = eduEl.textContent.trim();
      data.education = eduText;
    }

    // 年龄（从文本中提取数字）
    const ageEl = document.querySelector('.geek-age, .age, [class*="age"], .base-info .age');
    if (ageEl) {
      const ageMatch = ageEl.textContent.match(/(\d{2})/);
      if (ageMatch) data.age = parseInt(ageMatch[1], 10);
    }

    // 技能标签
    const skillEls = document.querySelectorAll(
      '.tag-item, .skill-tag, [class*="skill"] span, [class*="tag"], .geek-tags span'
    );
    if (skillEls.length > 0) {
      data.skills = Array.from(skillEls).map(el => el.textContent.trim()).filter(Boolean).join(', ');
    }

    // 期望（薪资/岗位）
    const expectEls = document.querySelectorAll(
      '.expect-item, .geek-expect .item, [class*="expect"] span'
    );
    if (expectEls.length > 0) {
      data.expectation = Array.from(expectEls).map(el => el.textContent.trim()).filter(Boolean).join(' | ');
    }

    // 兜底：整页文本
    const mainContent = document.querySelector(
      '.resume-wrapper, .geek-detail, .detail-content, main, .main'
    );
    if (mainContent) {
      data.raw_text = mainContent.innerText.slice(0, 5000);
    }

    return data;
  }

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'EXTRACT_CANDIDATE') {
      const data = extractCandidateData();
      sendResponse({ ok: true, data, isResumePage: isResumePage() });
    }
    if (msg.type === 'PING') {
      sendResponse({ ok: true, isResumePage: isResumePage() });
    }
  });
})();
