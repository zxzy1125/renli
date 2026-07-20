"use strict";
// 招聘辅助工具 - 产品介绍 PPT 生成脚本
// 主题：深墨绿 + 暖米白 + 赭石橙
// 字体：Microsoft YaHei (Linux 下通过 fontconfig 别名映射到 Noto Sans CJK SC)

const pptxgen = require("pptxgenjs");
const H = require("./pptxgenjs_helpers");
const {
  autoFontSize,
  calcTextBox,
  warnIfSlideHasOverlaps,
  warnIfSlideElementsOutOfBounds,
} = H;

// ============ 主题色 ============
const C = {
  forest600: "2E6350",
  forest800: "1F4035",
  forest400: "4A8B73",
  forest100: "E8F0EC",
  bgWarm: "FDFBF7",
  bgWarmAlt: "FAF6EC",
  bgCard: "FFFFFF",
  ochre500: "D9761B",
  ochre400: "E69238",
  ochre100: "FDE6CE",
  ochre50: "FEF3E2",
  amber1: "F59E0B",
  amber2: "D97706",
  riskRed: "DC2626",
  riskRedBg: "FEE2E2",
  text: "15302A",
  textMuted: "5C6B66",
  textLight: "8A9A94",
  white: "FFFFFF",
  cream: "FDFBF7",
  divider: "E5DFD3",
  grayBg: "F3F1EC",
  grayText: "6B6B6B",
};

const FONT = "Microsoft YaHei";

// ============ PPTX 初始化 ============
const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "招聘辅助工具";
pptx.company = "人力代招公司";
pptx.title = "招聘辅助工具 - 产品介绍";
pptx.subject = "AI 半人工招聘提效系统";

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.5;
const CONTENT_W = SLIDE_W - 2 * MARGIN; // 12.333
const TITLE_Y = 0.35;
const CONTENT_Y = 1.35;
const CONTENT_BOTTOM = 6.95;
const CONTENT_H = CONTENT_BOTTOM - CONTENT_Y; // 5.6

// ============ 通用辅助函数 ============

function pageFooter(slide, num) {
  if (num == null) return;
  slide.addText(String(num) + " / 18", {
    x: SLIDE_W - 1.2,
    y: SLIDE_H - 0.4,
    w: 0.9,
    h: 0.25,
    fontSize: 9,
    fontFace: FONT,
    color: C.textLight,
    align: "right",
    valign: "middle",
  });
}

function contentBg(slide) {
  slide.background = { color: C.bgWarm };
}

// 标题栏：标题 + 副标题（互不重叠）
function titleBar(slide, title, subtitle) {
  // 左侧赭石色装饰条
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: TITLE_Y + 0.05,
    w: 0.1,
    h: 0.42,
    fill: { color: C.ochre500 },
    line: { type: "none" },
  });
  // 标题（h=0.46，与副标题不重叠）
  slide.addText(title, {
    x: MARGIN + 0.28,
    y: TITLE_Y,
    w: CONTENT_W - 0.28,
    h: 0.46,
    fontSize: 26,
    fontFace: FONT,
    bold: true,
    color: C.forest800,
    align: "left",
    valign: "middle",
  });
  if (subtitle) {
    // 副标题在标题下方，不重叠
    slide.addText(subtitle, {
      x: MARGIN + 0.28,
      y: TITLE_Y + 0.5,
      w: CONTENT_W - 0.28,
      h: 0.28,
      fontSize: 12,
      fontFace: FONT,
      color: C.textMuted,
      align: "left",
      valign: "middle",
    });
  }
  // 分割线
  slide.addShape(pptx.ShapeType.line, {
    x: MARGIN,
    y: CONTENT_Y - 0.1,
    w: CONTENT_W,
    h: 0,
    line: { color: C.divider, width: 1 },
  });
}

function finalize(slide, pageNum) {
  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
  pageFooter(slide, pageNum);
}

// 色条 + 文字：文字内缩 0.02 以保证 contained（避免误报 overlap）
function addBarText(slide, x, y, w, h, text, opts) {
  opts = opts || {};
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { color: opts.color || C.forest600 },
    line: { type: "none" },
    rectRadius: opts.rectRadius != null ? opts.rectRadius : 0.08,
  });
  // 文字内缩，使文字 contained 在色条内（muteContainment 默认静默）
  slide.addText(text, {
    x: x + 0.03,
    y: y + 0.03,
    w: w - 0.06,
    h: h - 0.06,
    fontSize: opts.fontSize || 15,
    fontFace: FONT,
    bold: true,
    color: opts.textColor || C.white,
    align: opts.align || "center",
    valign: "middle",
  });
}

// 卡片：圆角矩形背景 + 可选编号徽章 + 标题 + 描述
function addCard(slide, x, y, w, h, opts) {
  opts = opts || {};
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { color: opts.fill || C.bgCard },
    line: { color: opts.borderColor || C.divider, width: 1 },
    rectRadius: 0.06,
  });
  if (opts.topBar) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x,
      y: y,
      w: w,
      h: 0.08,
      fill: { color: opts.topBar },
      line: { type: "none" },
      rectRadius: 0.06,
    });
  }
  if (opts.badge != null) {
    const bx = x + 0.2;
    const by = y + 0.2;
    const bd = 0.46;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: bx,
      y: by,
      w: bd,
      h: bd,
      fill: { color: opts.badgeColor || C.forest600 },
      line: { type: "none" },
    });
    // 编号文字内缩，contained 在圆内
    slide.addText(String(opts.badge), {
      x: bx + 0.03,
      y: by + 0.03,
      w: bd - 0.06,
      h: bd - 0.06,
      fontSize: 15,
      fontFace: FONT,
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
    });
    if (opts.title) {
      slide.addText(opts.title, {
        x: x + 0.8,
        y: y + 0.2,
        w: w - 1.0,
        h: 0.46,
        fontSize: 14,
        fontFace: FONT,
        bold: true,
        color: C.forest800,
        align: "left",
        valign: "middle",
      });
    }
    if (opts.desc) {
      slide.addText(opts.desc, {
        x: x + 0.25,
        y: y + 0.8,
        w: w - 0.5,
        h: h - 1.0,
        fontSize: 11,
        fontFace: FONT,
        color: C.textMuted,
        align: "left",
        valign: "top",
      });
    }
  } else {
    if (opts.title) {
      slide.addText(opts.title, {
        x: x + 0.22,
        y: y + 0.18,
        w: w - 0.44,
        h: 0.4,
        fontSize: 14,
        fontFace: FONT,
        bold: true,
        color: opts.titleColor || C.forest800,
        align: "left",
        valign: "middle",
      });
    }
    if (opts.desc) {
      slide.addText(opts.desc, {
        x: x + 0.22,
        y: y + 0.62,
        w: w - 0.44,
        h: h - 0.8,
        fontSize: 11,
        fontFace: FONT,
        color: C.textMuted,
        align: "left",
        valign: "top",
      });
    }
  }
}

// 效果徽章（如 "-95%"）：文字内缩 contained
function addEffectBadge(slide, x, y, w, h, text, color) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { color: color || C.ochre500 },
    line: { type: "none" },
    rectRadius: 0.04,
  });
  slide.addText(text, {
    x: x + 0.03,
    y: y + 0.03,
    w: w - 0.06,
    h: h - 0.06,
    fontSize: 12,
    fontFace: FONT,
    bold: true,
    color: C.white,
    align: "center",
    valign: "middle",
  });
}

// 表格单元格样式工厂
function thCell(text) {
  return {
    text: text,
    options: {
      fill: { color: C.forest600 },
      color: C.white,
      bold: true,
      fontSize: 12,
      fontFace: FONT,
      align: "center",
      valign: "middle",
    },
  };
}
function tdCell(text, opts) {
  opts = opts || {};
  return {
    text: text,
    options: {
      fill: { color: opts.fill || C.bgCard },
      color: opts.color || C.text,
      bold: !!opts.bold,
      fontSize: opts.fontSize || 12,
      fontFace: FONT,
      align: opts.align || "left",
      valign: "middle",
    },
  };
}

// ============ Slide 1: 封面 ============
function slide1Cover() {
  const slide = pptx.addSlide();
  slide.background = { color: C.forest800 };

  // 顶部赭石色装饰条
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.12,
    fill: { color: C.ochre500 },
    line: { type: "none" },
  });
  // 右上装饰圆（不与文字重叠）
  slide.addShape(pptx.ShapeType.ellipse, {
    x: SLIDE_W - 3.0,
    y: -1.8,
    w: 4.5,
    h: 4.5,
    fill: { color: C.forest600 },
    line: { type: "none" },
  });

  // 主标题
  slide.addText("招聘辅助工具", {
    x: 1.0,
    y: 2.2,
    w: 11.0,
    h: 1.3,
    fontSize: 52,
    fontFace: FONT,
    bold: true,
    color: C.cream,
    align: "left",
    valign: "middle",
  });

  // 装饰短线
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.05,
    y: 3.65,
    w: 1.8,
    h: 0.06,
    fill: { color: C.ochre500 },
    line: { type: "none" },
  });

  // 副标题
  slide.addText("AI 半人工 · 让每个员工都拥有资深顾问的效率", {
    x: 1.0,
    y: 3.9,
    w: 11.0,
    h: 0.6,
    fontSize: 22,
    fontFace: FONT,
    color: C.ochre400,
    align: "left",
    valign: "middle",
  });

  // 底部角标
  slide.addText("人力代招公司专用 · v1.0", {
    x: 1.0,
    y: 6.55,
    w: 6,
    h: 0.35,
    fontSize: 13,
    fontFace: FONT,
    color: C.textLight,
    align: "left",
    valign: "middle",
  });

  finalize(slide, null);
}

// ============ Slide 2: 目录 ============
function slide2TOC() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "目录", "CONTENTS");

  const chapters = [
    { num: "01", title: "产品定位", desc: "AI 起草 + 人工审核 半人工工作流" },
    { num: "02", title: "给员工的优势", desc: "7 大提效能力" },
    { num: "03", title: "给公司管理的优势", desc: "9 大管理能力" },
    { num: "04", title: "员工绩效管理", desc: "8 大能力 + 10 指标" },
    { num: "05", title: "传统 vs 本工具对比", desc: "员工视角 + 管理视角" },
    { num: "06", title: "典型一天工作对比", desc: "从绝望到高效" },
    { num: "07", title: "ROI 投入产出分析", desc: "10 人团队月增 59.7 万" },
    { num: "08", title: "一句话总结", desc: "三层定位" },
  ];

  const cols = 2;
  const rows = 4;
  const gapX = 0.4;
  const gapY = 0.22;
  const cardW = (CONTENT_W - gapX) / cols;
  const cardH = (CONTENT_H - gapY * (rows - 1)) / rows;

  for (let i = 0; i < chapters.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX);
    const y = CONTENT_Y + row * (cardH + gapY);
    const ch = chapters[i];

    slide.addShape(pptx.ShapeType.roundRect, {
      x: x,
      y: y,
      w: cardW,
      h: cardH,
      fill: { color: C.bgCard },
      line: { color: C.divider, width: 1 },
      rectRadius: 0.05,
    });
    slide.addText(ch.num, {
      x: x + 0.25,
      y: y,
      w: 1.0,
      h: cardH,
      fontSize: 26,
      fontFace: FONT,
      bold: true,
      color: C.ochre500,
      align: "left",
      valign: "middle",
    });
    slide.addText(ch.title, {
      x: x + 1.3,
      y: y + 0.1,
      w: cardW - 1.5,
      h: 0.4,
      fontSize: 15,
      fontFace: FONT,
      bold: true,
      color: C.forest800,
      align: "left",
      valign: "middle",
    });
    slide.addText(ch.desc, {
      x: x + 1.3,
      y: y + 0.48,
      w: cardW - 1.5,
      h: 0.3,
      fontSize: 11,
      fontFace: FONT,
      color: C.textMuted,
      align: "left",
      valign: "middle",
    });
  }

  finalize(slide, 2);
}

// ============ Slide 3: 产品定位 ============
function slide3Positioning() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "AI 起草 + 人工审核 = 半人工工作流", "产品定位 · PRODUCT POSITIONING");

  const steps = [
    { num: "1", title: "管理员录入职位", desc: "AI 解析成结构化字段" },
    { num: "2", title: "员工录入简历", desc: "AI 识别画像/共同点/风险" },
    { num: "3", title: "选职位 + 简历", desc: "AI 生成匹配 + 18 条话术" },
    { num: "4", title: "自动跟进回访", desc: "AI 作战卡片 + 深度分析" },
    { num: "5", title: "管理员看板", desc: "团队漏斗 + 员工绩效" },
  ];

  const boxW = 2.1;
  const boxH = 2.9;
  const arrowW = 0.42;
  const totalW = steps.length * boxW + (steps.length - 1) * arrowW;
  const startX = (SLIDE_W - totalW) / 2;
  const boxY = 1.7;

  for (let i = 0; i < steps.length; i++) {
    const x = startX + i * (boxW + arrowW);
    const s = steps[i];
    const accent = i === 2 ? C.ochre500 : C.forest600;

    slide.addShape(pptx.ShapeType.roundRect, {
      x: x,
      y: boxY,
      w: boxW,
      h: boxH,
      fill: { color: C.bgCard },
      line: { color: C.divider, width: 1 },
      rectRadius: 0.08,
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x,
      y: boxY,
      w: boxW,
      h: 0.1,
      fill: { color: accent },
      line: { type: "none" },
      rectRadius: 0.08,
    });
    // 编号圆
    const cd = 0.7;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + (boxW - cd) / 2,
      y: boxY + 0.35,
      w: cd,
      h: cd,
      fill: { color: accent },
      line: { type: "none" },
    });
    // 编号文字内缩 contained
    slide.addText(s.num, {
      x: x + (boxW - cd) / 2 + 0.03,
      y: boxY + 0.35 + 0.03,
      w: cd - 0.06,
      h: cd - 0.06,
      fontSize: 24,
      fontFace: FONT,
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
    });
    slide.addText(s.title, {
      x: x + 0.15,
      y: boxY + 1.2,
      w: boxW - 0.3,
      h: 0.7,
      fontSize: 14,
      fontFace: FONT,
      bold: true,
      color: C.forest800,
      align: "center",
      valign: "middle",
    });
    slide.addText(s.desc, {
      x: x + 0.15,
      y: boxY + 1.95,
      w: boxW - 0.3,
      h: 0.8,
      fontSize: 11,
      fontFace: FONT,
      color: C.textMuted,
      align: "center",
      valign: "top",
    });

    if (i < steps.length - 1) {
      slide.addText("\u2192", {
        x: x + boxW,
        y: boxY + boxH / 2 - 0.15,
        w: arrowW,
        h: 0.3,
        fontSize: 22,
        fontFace: FONT,
        bold: true,
        color: C.ochre500,
        align: "center",
        valign: "middle",
      });
    }
  }

  // 底部核心理念（文字内缩 contained）
  const bottomY = 5.15;
  addBarText(
    slide,
    MARGIN + 1.5,
    bottomY,
    CONTENT_W - 3.0,
    0.85,
    "核心理念：AI 干脏活累活，员工干决策活",
    { color: C.forest800, textColor: C.ochre400, fontSize: 18 }
  );

  finalize(slide, 3);
}

// ============ Slide 4: 给员工的 7 大优势 ============
function slide4EmployeeAdvantages() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "给员工带来的 7 大优势", "EMPLOYEE VALUE · 让每个员工拥有资深顾问的效率");

  const cards = [
    { num: "1", title: "职位秒懂", desc: "杂乱 Excel → 结构化字段，20 分钟 → 30 秒" },
    { num: "2", title: "简历破冰", desc: "4 类共同点 + 8 类风险识别，破冰 +50%" },
    { num: "3", title: "18 条话术", desc: "3 渠道 × 6 场景，覆盖沟通全链路" },
    { num: "4", title: "跟进不漏", desc: "一个线索推 5 个职位，单线索转化 5 倍" },
    { num: "5", title: "AI 陪打仗", desc: "作战卡片 + 深度分析，新人 1 月顶 6 月" },
    { num: "6", title: "合规保障", desc: "BOSS 硬约束 7 条，封号风险 -90%" },
    { num: "7", title: "BOSS 文案", desc: "3 套风格一键生成，咨询量 +2-3 倍" },
  ];

  const cols = 4;
  const rows = 2;
  const gapX = 0.22;
  const gapY = 0.25;
  const cardW = (CONTENT_W - gapX * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gapY * (rows - 1)) / rows;

  for (let i = 0; i < cards.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX);
    const y = CONTENT_Y + row * (cardH + gapY);
    addCard(slide, x, y, cardW, cardH, {
      badge: cards[i].num,
      badgeColor: C.forest600,
      title: cards[i].title,
      desc: cards[i].desc,
      topBar: C.forest600,
    });
  }

  // 第 8 格放总结（文字内缩 contained）
  const x = MARGIN + 3 * (cardW + gapX);
  const y = CONTENT_Y + 1 * (cardH + gapY);
  addBarText(slide, x, y, cardW, cardH, "效率提升 50 倍", {
    color: C.ochre500,
    textColor: C.white,
    fontSize: 22,
    rectRadius: 0.06,
  });

  finalize(slide, 4);
}

// ============ Slide 5: 18 条话术矩阵 ============
function slide5ScriptMatrix() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "3 渠道 × 6 场景 = 18 条个性化话术", "SCRIPT MATRIX · 每条为求职者量身定制");

  const scenes = ["触达开场白", "职位介绍", "疑虑应对", "面试邀约", "薪资沟通", "Offer 促签"];
  const channels = ["微信文字", "电话话术", "站内信"];

  const headerRow = [thCell("场景 \\ 渠道")].concat(
    channels.map((c) => thCell(c))
  );

  const bodyRows = scenes.map((sc, idx) => {
    const fill = idx % 2 === 0 ? C.bgCard : C.bgWarmAlt;
    return [
      tdCell(sc, { fill: fill, bold: true, color: C.forest800, fontSize: 13 }),
      tdCell("\u221A", { fill: fill, align: "center", color: C.ochre500, bold: true, fontSize: 16 }),
      tdCell("\u221A", { fill: fill, align: "center", color: C.ochre500, bold: true, fontSize: 16 }),
      tdCell("\u221A", { fill: fill, align: "center", color: C.ochre500, bold: true, fontSize: 16 }),
    ];
  });

  const tableY = 1.65;
  const colW = [3.5, 2.94, 2.94, 2.94];
  slide.addTable([headerRow].concat(bodyRows), {
    x: (SLIDE_W - colW.reduce((a, b) => a + b, 0)) / 2,
    y: tableY,
    colW: colW,
    rowH: 0.6,
    valign: "middle",
    border: { type: "solid", color: C.divider, pt: 1 },
  });

  // 底部说明
  const noteY = 5.85;
  addBarText(
    slide,
    MARGIN + 1.0,
    noteY,
    CONTENT_W - 2.0,
    0.7,
    "每条话术为求职者量身定制，注入 BOSS 硬约束：不暴露甲方 / 不违反劳动法 / 符合平台规则",
    { color: C.ochre50, textColor: C.ochre500, fontSize: 12, rectRadius: 0.06 }
  );

  finalize(slide, 5);
}

// ============ Slide 6: AI 回访双武器 ============
function slide6AIWeapons() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "回访前作战卡片 + 回访后深度分析", "AI WEAPONS · 新人也能做出老手业绩");

  const colW = 5.85;
  const gap = 0.6;
  const startX = (SLIDE_W - (colW * 2 + gap)) / 2;
  const cardY = 1.55;
  const cardH = 4.95;

  // 左卡：回访前
  const lx = startX;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: lx,
    y: cardY,
    w: colW,
    h: cardH,
    fill: { color: C.bgCard },
    line: { color: C.divider, width: 1 },
    rectRadius: 0.08,
  });
  addBarText(slide, lx, cardY, colW, 0.6, "回访前 · AI 作战卡片", {
    color: C.forest600,
    fontSize: 16,
    rectRadius: 0.08,
  });

  const leftItems = [
    "求职者画像速览",
    "本次回访目标",
    "预判求职者顾虑 3-5 条",
    "3 套开场话术可选",
    "推荐提问引导真实想法",
    "转化可能性预判",
  ];
  slide.addText(
    leftItems.map((t) => ({
      text: t,
      options: {
        bullet: { code: "25CF" },
        color: C.ochre500,
        fontSize: 14,
        fontFace: FONT,
        bold: true,
        breakLine: true,
        paraSpaceAfter: 8,
      },
    })),
    {
      x: lx + 0.4,
      y: cardY + 0.9,
      w: colW - 0.8,
      h: cardH - 1.15,
      valign: "top",
    }
  );

  // 右卡：回访后
  const rx = startX + colW + gap;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: rx,
    y: cardY,
    w: colW,
    h: cardH,
    fill: { color: C.bgCard },
    line: { color: C.divider, width: 1 },
    rectRadius: 0.08,
  });
  addBarText(slide, rx, cardY, colW, 0.6, "回访后 · AI 深度分析", {
    color: C.ochre500,
    fontSize: 16,
    rectRadius: 0.08,
  });

  const rightItems = [
    "顾虑深度解析（每个顾虑根源）",
    "跟进策略建议 4-6 条（按优先级）",
    "转化可能性更新（升/降 + 原因）",
    "下次回访时间 + 重点 + 物料",
    "一键生成 3 渠道应对话术",
  ];
  slide.addText(
    rightItems.map((t) => ({
      text: t,
      options: {
        bullet: { code: "25CF" },
        color: C.forest600,
        fontSize: 14,
        fontFace: FONT,
        bold: true,
        breakLine: true,
        paraSpaceAfter: 10,
      },
    })),
    {
      x: rx + 0.4,
      y: cardY + 0.9,
      w: colW - 0.8,
      h: cardH - 1.15,
      valign: "top",
    }
  );

  finalize(slide, 6);
}

// ============ Slide 7: 给公司管理的 9 大优势 ============
function slide7ManagementAdvantages() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "给公司管理带来的 9 大优势", "MANAGEMENT VALUE · 从凭感觉管人到看数据管人");

  const cards = [
    { num: "1", title: "撞单自动检测", desc: "全团队哈希检测，撞单内耗 -95%" },
    { num: "2", title: "手机号脱敏", desc: "138****5678，泄露风险 -80%" },
    { num: "3", title: "权限分级", desc: "数据隔离，权责清晰" },
    { num: "4", title: "操作审计", desc: "全程留痕，责任 100% 可追溯" },
    { num: "5", title: "客户集中管理", desc: "客户资产公司化，不依赖个人" },
    { num: "6", title: "团队报表", desc: "漏斗/绩效/客户，一键 Excel" },
    { num: "7", title: "风险预警", desc: "被动救火 → 主动预防" },
    { num: "8", title: "标准化运营", desc: "AI 沉淀公司资产，业绩稳定 3 倍" },
    { num: "9", title: "BOSS 合规", desc: "硬约束 + 知识库，封号风险 -90%" },
  ];

  const cols = 3;
  const rows = 3;
  const gapX = 0.3;
  const gapY = 0.2;
  const cardW = (CONTENT_W - gapX * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gapY * (rows - 1)) / rows;

  for (let i = 0; i < cards.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX);
    const y = CONTENT_Y + row * (cardH + gapY);
    addCard(slide, x, y, cardW, cardH, {
      badge: cards[i].num,
      badgeColor: C.ochre500,
      title: cards[i].title,
      desc: cards[i].desc,
      topBar: C.ochre500,
    });
  }

  finalize(slide, 7);
}

// ============ Slide 8: 撞单检测 + 数据安全 ============
function slide8CollisionSecurity() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "撞单自动检测 + 数据脱敏 = 杜绝内耗", "COLLISION & SECURITY · 内耗 -95% / 泄露 -80%");

  const colW = 5.85;
  const gap = 0.6;
  const startX = (SLIDE_W - (colW * 2 + gap)) / 2;
  const cardY = 1.55;
  const cardH = 5.15;

  // 左卡：撞单检测
  const lx = startX;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: lx,
    y: cardY,
    w: colW,
    h: cardH,
    fill: { color: C.bgCard },
    line: { color: C.divider, width: 1 },
    rectRadius: 0.08,
  });
  addBarText(slide, lx, cardY, colW, 0.55, "撞单检测流程", {
    color: C.forest600,
    fontSize: 15,
    rectRadius: 0.08,
  });

  const leftFlow = [
    { t: "员工录入简历", d: "手机号哈希 + 邮箱 + 姓名+公司" },
    { t: "系统自动检测", d: "全团队撞单比对" },
    { t: "提示员工 + 通知管理员", d: "撞单管理页处理" },
  ];
  leftFlow.forEach((item, i) => {
    const iy = cardY + 0.8 + i * 0.7;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: lx + 0.3,
      y: iy,
      w: colW - 0.6,
      h: 0.55,
      fill: { color: C.forest100 },
      line: { type: "none" },
      rectRadius: 0.05,
    });
    slide.addText(
      [
        { text: item.t, options: { bold: true, fontSize: 13, color: C.forest800, fontFace: FONT } },
        { text: "  —  " + item.d, options: { fontSize: 11, color: C.textMuted, fontFace: FONT } },
      ],
      { x: lx + 0.4, y: iy, w: colW - 0.8, h: 0.55, align: "left", valign: "middle" }
    );
    if (i < leftFlow.length - 1) {
      slide.addText("\u2193", {
        x: lx + 0.3,
        y: iy + 0.5,
        w: colW - 0.6,
        h: 0.2,
        fontSize: 14,
        fontFace: FONT,
        color: C.forest600,
        align: "center",
        valign: "middle",
      });
    }
  });

  const procY = cardY + 3.0;
  slide.addText("4 种处理方式：", {
    x: lx + 0.3,
    y: procY,
    w: colW - 0.6,
    h: 0.28,
    fontSize: 12,
    fontFace: FONT,
    bold: true,
    color: C.forest800,
    align: "left",
    valign: "middle",
  });
  slide.addText("归属 A  /  归属 B  /  共享独立跟进  /  标记误报", {
    x: lx + 0.3,
    y: procY + 0.28,
    w: colW - 0.6,
    h: 0.28,
    fontSize: 12,
    fontFace: FONT,
    color: C.textMuted,
    align: "left",
    valign: "middle",
  });
  addEffectBadge(slide, lx + 0.3, procY + 0.7, colW - 0.6, 0.5, "效果：撞单内耗 -95%", C.forest600);

  // 右卡：数据安全
  const rx = startX + colW + gap;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: rx,
    y: cardY,
    w: colW,
    h: cardH,
    fill: { color: C.bgCard },
    line: { color: C.divider, width: 1 },
    rectRadius: 0.08,
  });
  addBarText(slide, rx, cardY, colW, 0.55, "数据安全保障", {
    color: C.ochre500,
    fontSize: 15,
    rectRadius: 0.08,
  });

  const rightItems = [
    { t: "手机号脱敏", d: "138****5678，员工看不到完整号码" },
    { t: "SHA256 哈希", d: "做撞单检测，不存储明文" },
    { t: "软删除 + 回收站", d: "30 天可恢复，防误删" },
    { t: "操作日志全程留痕", d: "敏感操作单独审计" },
  ];
  rightItems.forEach((item, i) => {
    const iy = cardY + 0.8 + i * 0.6;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: rx + 0.3,
      y: iy,
      w: colW - 0.6,
      h: 0.5,
      fill: { color: C.ochre50 },
      line: { type: "none" },
      rectRadius: 0.05,
    });
    slide.addText(
      [
        { text: item.t, options: { bold: true, fontSize: 13, color: C.ochre500, fontFace: FONT } },
        { text: "  —  " + item.d, options: { fontSize: 11, color: C.textMuted, fontFace: FONT } },
      ],
      { x: rx + 0.4, y: iy, w: colW - 0.8, h: 0.5, align: "left", valign: "middle" }
    );
  });
  addEffectBadge(slide, rx + 0.3, cardY + 3.8, colW - 0.6, 0.5, "效果：数据泄露风险 -80%", C.ochre500);

  finalize(slide, 8);
}

// ============ Slide 9: 员工绩效管理 8 大能力 ============
function slide9PerformanceCapabilities() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "员工绩效管理 8 大能力", "PERFORMANCE MANAGEMENT · 从月底加班到实时一键");

  const cards = [
    { num: "1", title: "多维指标自动统计", desc: "10 个指标实时计算" },
    { num: "2", title: "员工排行榜", desc: "激发良性竞争 +30%" },
    { num: "3", title: "个人能力诊断", desc: "精准辅导，成长 +2 倍" },
    { num: "4", title: "业绩趋势预警", desc: "异常提前 2 周发现" },
    { num: "5", title: "客户公司维度", desc: "责任到人，满意度 +40%" },
    { num: "6", title: "报表导出推送", desc: "一键 Excel + 邮件周报" },
    { num: "7", title: "数据驱动人事决策", desc: "晋升/培训/淘汰有据" },
    { num: "8", title: "团队协作透明化", desc: "协作效率 +40%" },
  ];

  const cols = 4;
  const rows = 2;
  const gapX = 0.22;
  const gapY = 0.25;
  const cardW = (CONTENT_W - gapX * (cols - 1)) / cols;
  const cardH = (CONTENT_H - gapY * (rows - 1)) / rows;

  for (let i = 0; i < cards.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX);
    const y = CONTENT_Y + row * (cardH + gapY);
    addCard(slide, x, y, cardW, cardH, {
      badge: cards[i].num,
      badgeColor: i % 2 === 0 ? C.forest600 : C.ochre500,
      title: cards[i].title,
      desc: cards[i].desc,
      topBar: i % 2 === 0 ? C.forest600 : C.ochre500,
    });
  }

  finalize(slide, 9);
}

// ============ Slide 10: 10 个绩效指标 ============
function slide10Indicators() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "10 个绩效指标自动统计", "KPI · 实时一键查看 · 从月底加班 2 天到一键");

  const indicators = [
    { name: "简历录入数", use: "线索开拓能力" },
    { name: "匹配创建数", use: "匹配主动性" },
    { name: "邀面数", use: "初筛能力" },
    { name: "面过数", use: "岗位匹配精度" },
    { name: "Offer 数", use: "谈薪促签能力" },
    { name: "入职数", use: "核心业绩指标" },
    { name: "转化率", use: "整体效率" },
    { name: "平均周期", use: "推进效率" },
    { name: "回访次数", use: "跟进勤奋度" },
    { name: "话术使用量", use: "工具使用度" },
  ];

  const headerRow = [thCell("指标"), thCell("衡量用途")];
  const bodyRows = indicators.map((it, idx) => {
    const fill = idx % 2 === 0 ? C.bgCard : C.bgWarmAlt;
    const isCore = it.name === "入职数";
    return [
      tdCell(it.name, {
        fill: fill,
        bold: true,
        color: isCore ? C.ochre500 : C.forest800,
        fontSize: 13,
      }),
      tdCell(it.use, {
        fill: fill,
        color: isCore ? C.ochre500 : C.text,
        bold: isCore,
        fontSize: 13,
      }),
    ];
  });

  const tableY = 1.55;
  const colW = [4.0, 8.333];
  slide.addTable([headerRow].concat(bodyRows), {
    x: MARGIN,
    y: tableY,
    colW: colW,
    rowH: 0.5,
    valign: "middle",
    border: { type: "solid", color: C.divider, pt: 1 },
  });

  // 底部提示
  slide.addText("「入职数」为核心业绩指标，其余 9 项为过程指标，全部自动统计", {
    x: MARGIN,
    y: 6.65,
    w: CONTENT_W,
    h: 0.25,
    fontSize: 11,
    fontFace: FONT,
    color: C.textMuted,
    align: "center",
    valign: "middle",
    italic: true,
  });

  finalize(slide, 10);
}

// ============ Slide 11: 个人能力诊断 ============
function slide11Diagnosis() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "自动诊断员工薄弱环节", "DIAGNOSIS · 数据来源 + 辅导建议 · 成长速度 +2 倍");

  const rows = [
    { dim: "简历录入少", src: "简历数", advice: "加强线索开拓" },
    { dim: "匹配多邀面少", src: "匹配数 vs 邀面数", advice: "提升话术质量" },
    { dim: "邀面多面过少", src: "邀面数 vs 面过数", advice: "优化岗位匹配精度" },
    { dim: "面过多 Offer 少", src: "面过数 vs Offer 数", advice: "加强谈薪技巧" },
    { dim: "Offer 多入职少", src: "Offer 数 vs 入职数", advice: "强化 Offer 促签" },
    { dim: "回访次数少", src: "回访记录", advice: "加强持续跟进" },
    { dim: "转化周期长", src: "平均周期", advice: "提升推进效率" },
  ];

  const headerRow = [thCell("诊断维度"), thCell("数据来源"), thCell("辅导建议")];
  const bodyRows = rows.map((r, idx) => {
    const fill = idx % 2 === 0 ? C.bgCard : C.bgWarmAlt;
    return [
      tdCell(r.dim, { fill: fill, bold: true, color: C.riskRed, fontSize: 13 }),
      tdCell(r.src, { fill: fill, color: C.textMuted, fontSize: 12, align: "center" }),
      tdCell(r.advice, { fill: fill, color: C.forest600, bold: true, fontSize: 13 }),
    ];
  });

  const tableY = 1.65;
  const colW = [3.5, 3.8, 5.033];
  slide.addTable([headerRow].concat(bodyRows), {
    x: MARGIN,
    y: tableY,
    colW: colW,
    rowH: 0.55,
    valign: "middle",
    border: { type: "solid", color: C.divider, pt: 1 },
  });

  // 底部
  addBarText(
    slide,
    MARGIN + 1.5,
    6.5,
    CONTENT_W - 3.0,
    0.4,
    "管理员根据诊断结果定向辅导，员工成长速度提升 2 倍",
    { color: C.forest100, textColor: C.forest600, fontSize: 12, rectRadius: 0.05 }
  );

  finalize(slide, 11);
}

// ============ Slide 12: 传统 vs 本工具（员工视角） ============
function slide12CompareEmployee() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "员工视角：效率提升 50 倍", "COMPARISON · EMPLOYEE · 从 6 个月成熟到 1 个月成熟");

  const rows = [
    { dim: "职位理解", trad: "20 分钟翻表格", tool: "30 秒看清结构化", gain: "40 倍" },
    { dim: "话术撰写", trad: "30 分钟手写 1 条", tool: "30 秒生成 18 条", gain: "50 倍" },
    { dim: "破冰成功率", trad: "凭运气", tool: "共同点加持", gain: "+50%" },
    { dim: "回复率", trad: "10-20%", tool: "30-50%", gain: "+100%" },
    { dim: "线索利用率", trad: "20%（聊完就忘）", tool: "80%（持续跟进）", gain: "4 倍" },
    { dim: "单线索转化", trad: "1 个职位", tool: "5 个职位", gain: "5 倍" },
    { dim: "学习曲线", trad: "6 个月成熟", tool: "1 个月成熟", gain: "6 倍" },
    { dim: "封号风险", trad: "高", tool: "极低", gain: "-90%" },
  ];

  const headerRow = [thCell("维度"), thCell("传统方式"), thCell("本工具"), thCell("提升")];
  const bodyRows = rows.map((r, idx) => {
    const fill = idx % 2 === 0 ? C.bgCard : C.bgWarmAlt;
    return [
      tdCell(r.dim, { fill: fill, bold: true, color: C.forest800, fontSize: 12 }),
      tdCell(r.trad, { fill: fill, color: C.grayText, fontSize: 12, align: "center" }),
      tdCell(r.tool, { fill: fill, color: C.forest600, bold: true, fontSize: 12, align: "center" }),
      tdCell(r.gain, { fill: fill, color: C.ochre500, bold: true, fontSize: 13, align: "center" }),
    ];
  });

  const tableY = 1.55;
  const colW = [2.4, 3.5, 3.5, 2.933];
  slide.addTable([headerRow].concat(bodyRows), {
    x: MARGIN,
    y: tableY,
    colW: colW,
    rowH: 0.55,
    valign: "middle",
    border: { type: "solid", color: C.divider, pt: 1 },
  });

  finalize(slide, 12);
}

// ============ Slide 13: 传统 vs 本工具（管理视角） ============
function slide13CompareManagement() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "管理视角：管理效率提升 100 倍", "COMPARISON · MANAGEMENT · 从依赖销冠到系统化运营");

  const rows = [
    { dim: "撞单内耗", trad: "严重", tool: "自动检测", gain: "-95%" },
    { dim: "数据安全", trad: "风险高", tool: "脱敏 + 审计", gain: "-80%" },
    { dim: "绩效统计", trad: "月底加班 2 天", tool: "实时一键看", gain: "100 倍" },
    { dim: "客户管理", trad: "散落个人", tool: "公司化集中", gain: "显著" },
    { dim: "风险预警", trad: "被动救火", tool: "主动预防", gain: "显著" },
    { dim: "团队报表", trad: "手动 Excel", tool: "自动生成", gain: "10 倍" },
    { dim: "新人培养", trad: "6 个月", tool: "1 个月", gain: "6 倍" },
    { dim: "业绩稳定性", trad: "依赖销冠", tool: "系统化", gain: "3 倍" },
  ];

  const headerRow = [thCell("维度"), thCell("传统方式"), thCell("本工具"), thCell("提升")];
  const bodyRows = rows.map((r, idx) => {
    const fill = idx % 2 === 0 ? C.bgCard : C.bgWarmAlt;
    return [
      tdCell(r.dim, { fill: fill, bold: true, color: C.forest800, fontSize: 12 }),
      tdCell(r.trad, { fill: fill, color: C.grayText, fontSize: 12, align: "center" }),
      tdCell(r.tool, { fill: fill, color: C.forest600, bold: true, fontSize: 12, align: "center" }),
      tdCell(r.gain, { fill: fill, color: C.ochre500, bold: true, fontSize: 13, align: "center" }),
    ];
  });

  const tableY = 1.55;
  const colW = [2.4, 3.5, 3.5, 2.933];
  slide.addTable([headerRow].concat(bodyRows), {
    x: MARGIN,
    y: tableY,
    colW: colW,
    rowH: 0.55,
    valign: "middle",
    border: { type: "solid", color: C.divider, pt: 1 },
  });

  finalize(slide, 13);
}

// ============ Slide 14: 典型一天工作对比 ============
function slide14DayComparison() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "员工的一天：从绝望到高效", "A DAY IN LIFE · 传统 vs 本工具");

  const colW = 5.85;
  const gap = 0.6;
  const startX = (SLIDE_W - (colW * 2 + gap)) / 2;
  const cardY = 1.55;

  // 左栏：传统方式
  const lx = startX;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: lx,
    y: cardY,
    w: colW,
    h: 5.15,
    fill: { color: C.grayBg },
    line: { color: C.divider, width: 1 },
    rectRadius: 0.08,
  });
  addBarText(slide, lx, cardY, colW, 0.55, "传统方式 · 一天入职 0 人", {
    color: C.grayText,
    fontSize: 14,
    rectRadius: 0.08,
  });

  const leftEntries = [
    { time: "9:00", act: "翻客户职位表格，看不懂" },
    { time: "10:00", act: "手写 3 份求职者触达话术" },
    { time: "11:00", act: "微信群发，回复率低" },
    { time: "14:00", act: "打电话临场发挥，谈崩 2 个" },
    { time: "16:00", act: '求职者说"再考虑"，没下文' },
    { time: "18:00", act: "一天入职 0 人" },
  ];
  leftEntries.forEach((e, i) => {
    const ey = cardY + 0.7 + i * 0.72;
    slide.addText(e.time, {
      x: lx + 0.25,
      y: ey,
      w: 0.85,
      h: 0.4,
      fontSize: 12,
      fontFace: FONT,
      bold: true,
      color: C.grayText,
      align: "left",
      valign: "middle",
    });
    slide.addText(e.act, {
      x: lx + 1.1,
      y: ey,
      w: colW - 1.4,
      h: 0.4,
      fontSize: 12,
      fontFace: FONT,
      color: C.grayText,
      align: "left",
      valign: "middle",
    });
  });

  // 右栏：本工具
  const rx = startX + colW + gap;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: rx,
    y: cardY,
    w: colW,
    h: 5.15,
    fill: { color: C.forest100 },
    line: { color: C.forest400, width: 1 },
    rectRadius: 0.08,
  });
  addBarText(slide, rx, cardY, colW, 0.55, "本工具 · 一天入职 1 人，3 人面试", {
    color: C.forest600,
    fontSize: 14,
    rectRadius: 0.08,
  });

  const rightEntries = [
    { time: "9:00", act: "看今日待回访 3 人" },
    { time: "9:15", act: "看 AI 作战卡片" },
    { time: "9:30", act: "复制 AI 话术，3 分钟触达" },
    { time: "10:00", act: "求职者回复，AI 生成应对" },
    { time: "11:00", act: "回访昨天咨询的" },
    { time: "14:00", act: "电话沟通，AI 预判顾虑" },
    { time: "16:00", act: "设置 3 天后回访" },
    { time: "18:00", act: "一天入职 1 人，3 人面试" },
  ];
  rightEntries.forEach((e, i) => {
    const ey = cardY + 0.7 + i * 0.54;
    slide.addText(e.time, {
      x: rx + 0.25,
      y: ey,
      w: 0.85,
      h: 0.4,
      fontSize: 12,
      fontFace: FONT,
      bold: true,
      color: C.forest600,
      align: "left",
      valign: "middle",
    });
    slide.addText(e.act, {
      x: rx + 1.1,
      y: ey,
      w: colW - 1.4,
      h: 0.4,
      fontSize: 12,
      fontFace: FONT,
      color: C.forest800,
      align: "left",
      valign: "middle",
    });
  });

  finalize(slide, 14);
}

// ============ Slide 15: ROI 投入产出分析 ============
function slide15ROI() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "10 人团队月增 ¥59.7 万", "ROI ANALYSIS · 保守估算，实际效果因团队而异");

  const colW = 5.85;
  const gap = 0.6;
  const startX = (SLIDE_W - (colW * 2 + gap)) / 2;
  const cardY = 1.55;
  const cardH = 3.6;

  // 左卡：投入
  const lx = startX;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: lx,
    y: cardY,
    w: colW,
    h: cardH,
    fill: { color: C.bgCard },
    line: { color: C.divider, width: 1 },
    rectRadius: 0.08,
  });
  addBarText(slide, lx, cardY, colW, 0.55, "投入", {
    color: C.grayText,
    fontSize: 16,
    rectRadius: 0.08,
  });

  const investItems = [
    { t: "系统使用费", d: "一次性部署 + 维护" },
    { t: "AI API 调用", d: "约 ¥0.5-2/天/人（约 40K token/天）" },
    { t: "培训成本", d: "1 小时上手" },
  ];
  investItems.forEach((item, i) => {
    const iy = cardY + 0.75 + i * 0.85;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: lx + 0.3,
      y: iy,
      w: colW - 0.6,
      h: 0.7,
      fill: { color: C.grayBg },
      line: { type: "none" },
      rectRadius: 0.05,
    });
    slide.addText(item.t, {
      x: lx + 0.5,
      y: iy + 0.05,
      w: colW - 1.0,
      h: 0.3,
      fontSize: 14,
      fontFace: FONT,
      bold: true,
      color: C.forest800,
      align: "left",
      valign: "middle",
    });
    slide.addText(item.d, {
      x: lx + 0.5,
      y: iy + 0.35,
      w: colW - 1.0,
      h: 0.3,
      fontSize: 11,
      fontFace: FONT,
      color: C.textMuted,
      align: "left",
      valign: "middle",
    });
  });

  // 右卡：产出
  const rx = startX + colW + gap;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: rx,
    y: cardY,
    w: colW,
    h: cardH,
    fill: { color: C.bgCard },
    line: { color: C.ochre400, width: 1.5 },
    rectRadius: 0.08,
  });
  addBarText(slide, rx, cardY, colW, 0.55, "产出（10 人团队测算）", {
    color: C.ochre500,
    fontSize: 16,
    rectRadius: 0.08,
  });

  const outputItems = [
    { t: "月入职数", d: "30 → 60（翻倍）" },
    { t: "月营收", d: "¥60 万 → ¥120 万" },
    { t: "月增量", d: "+¥60 万" },
    { t: "AI 成本", d: "¥300/月" },
  ];
  outputItems.forEach((item, i) => {
    const iy = cardY + 0.75 + i * 0.6;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: rx + 0.3,
      y: iy,
      w: colW - 0.6,
      h: 0.5,
      fill: { color: C.ochre50 },
      line: { type: "none" },
      rectRadius: 0.05,
    });
    slide.addText(
      [
        { text: item.t, options: { bold: true, fontSize: 13, color: C.forest800, fontFace: FONT } },
        { text: "  " + item.d, options: { fontSize: 13, color: C.ochre500, bold: true, fontFace: FONT } },
      ],
      { x: rx + 0.5, y: iy, w: colW - 1.0, h: 0.5, align: "left", valign: "middle" }
    );
  });

  // 净收益大数字（文字内缩 contained）
  const netY = cardY + cardH + 0.2;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: startX,
    y: netY,
    w: colW * 2 + gap,
    h: 0.9,
    fill: { color: C.forest800 },
    line: { type: "none" },
    rectRadius: 0.08,
  });
  slide.addText(
    [
      { text: "净收益：", options: { fontSize: 18, color: C.cream, fontFace: FONT } },
      { text: "+¥59.7 万/月", options: { fontSize: 28, bold: true, color: C.ochre400, fontFace: FONT } },
    ],
    {
      x: startX + 0.03,
      y: netY + 0.03,
      w: colW * 2 + gap - 0.06,
      h: 0.84,
      align: "center",
      valign: "middle",
    }
  );

  finalize(slide, 15);
}

// ============ Slide 16: 一句话总结（三视角） ============
function slide16Summary() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "三层定位", "SUMMARY · 给员工 / 给管理者 / 给公司");

  const cards = [
    {
      header: "给员工",
      headerColor: C.forest600,
      quote: "不是替代你，而是让你拥有 10 年资深顾问的脑子和效率",
      sub: "AI 干脏活累活（解析、生成、分析），你干决策活（审核、发送、跟进）",
      accent: C.forest600,
    },
    {
      header: "给管理者",
      headerColor: C.ochre500,
      quote: '从"凭感觉管人"变成"看数据管人"',
      sub: "撞单自动检测、绩效实时统计、风险主动预警、新人 1 个月成熟",
      accent: C.ochre500,
    },
    {
      header: "给公司",
      headerColor: C.forest800,
      quote: "业绩翻倍、成本减半、风险可控、可复制可扩张",
      sub: "从依赖个人能力 → 依赖系统能力，从作坊式 → 标准化运营",
      accent: C.forest800,
    },
  ];

  const cols = 3;
  const gap = 0.35;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = 4.55;
  const cardY = 1.65;

  for (let i = 0; i < cards.length; i++) {
    const x = MARGIN + i * (cardW + gap);
    const c = cards[i];

    slide.addShape(pptx.ShapeType.roundRect, {
      x: x,
      y: cardY,
      w: cardW,
      h: cardH,
      fill: { color: C.bgCard },
      line: { color: C.divider, width: 1 },
      rectRadius: 0.08,
    });
    // 顶部色块 + 文字（用 addBarText 保证 contained）
    addBarText(slide, x, cardY, cardW, 0.65, c.header, {
      color: c.headerColor,
      fontSize: 18,
      rectRadius: 0.08,
    });
    // 引号装饰
    slide.addText("\u201C", {
      x: x + 0.2,
      y: cardY + 0.8,
      w: 0.8,
      h: 0.6,
      fontSize: 40,
      fontFace: FONT,
      bold: true,
      color: c.accent,
      align: "left",
      valign: "top",
    });
    // 主语录
    slide.addText(c.quote, {
      x: x + 0.3,
      y: cardY + 1.45,
      w: cardW - 0.6,
      h: 1.5,
      fontSize: 15,
      fontFace: FONT,
      bold: true,
      color: C.forest800,
      align: "left",
      valign: "top",
    });
    // 分割线
    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.3,
      y: cardY + 3.05,
      w: cardW - 0.6,
      h: 0,
      line: { color: C.divider, width: 1 },
    });
    // 副文
    slide.addText(c.sub, {
      x: x + 0.3,
      y: cardY + 3.2,
      w: cardW - 0.6,
      h: 1.2,
      fontSize: 11,
      fontFace: FONT,
      color: C.textMuted,
      align: "left",
      valign: "top",
    });
  }

  finalize(slide, 16);
}

// ============ Slide 17: 下一步行动 ============
function slide17NextSteps() {
  const slide = pptx.addSlide();
  contentBg(slide);
  titleBar(slide, "立即开始使用", "NEXT STEPS · 3 步走 · 1 小时上手");

  const steps = [
    { num: "1", title: "管理员配置 AI", desc: "进入「AI 配置」填入 API Key，选择模型" },
    { num: "2", title: "录入职位 + 简历", desc: "管理员录入客户职位，员工录入求职者简历" },
    { num: "3", title: "发起匹配 → 跟进", desc: "选职位 + 简历 → 生成话术 → 持续跟进回访" },
  ];

  const stepW = 3.6;
  const arrowW = 0.6;
  const totalW = steps.length * stepW + (steps.length - 1) * arrowW;
  const startX = (SLIDE_W - totalW) / 2;
  const stepY = 1.9;
  const stepH = 2.6;

  for (let i = 0; i < steps.length; i++) {
    const x = startX + i * (stepW + arrowW);
    const s = steps[i];

    slide.addShape(pptx.ShapeType.roundRect, {
      x: x,
      y: stepY,
      w: stepW,
      h: stepH,
      fill: { color: C.bgCard },
      line: { color: C.divider, width: 1 },
      rectRadius: 0.08,
    });
    // 编号圆 + 文字（文字内缩 contained）
    const cd = 0.9;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + (stepW - cd) / 2,
      y: stepY + 0.35,
      w: cd,
      h: cd,
      fill: { color: i === 0 ? C.ochre500 : C.forest600 },
      line: { type: "none" },
    });
    slide.addText(s.num, {
      x: x + (stepW - cd) / 2 + 0.03,
      y: stepY + 0.35 + 0.03,
      w: cd - 0.06,
      h: cd - 0.06,
      fontSize: 30,
      fontFace: FONT,
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
    });
    slide.addText(s.title, {
      x: x + 0.2,
      y: stepY + 1.4,
      w: stepW - 0.4,
      h: 0.5,
      fontSize: 16,
      fontFace: FONT,
      bold: true,
      color: C.forest800,
      align: "center",
      valign: "middle",
    });
    slide.addText(s.desc, {
      x: x + 0.25,
      y: stepY + 1.9,
      w: stepW - 0.5,
      h: 0.6,
      fontSize: 12,
      fontFace: FONT,
      color: C.textMuted,
      align: "center",
      valign: "top",
    });

    if (i < steps.length - 1) {
      slide.addText("\u2192", {
        x: x + stepW,
        y: stepY + stepH / 2 - 0.2,
        w: arrowW,
        h: 0.4,
        fontSize: 24,
        fontFace: FONT,
        bold: true,
        color: C.ochre500,
        align: "center",
        valign: "middle",
      });
    }
  }

  // 底部访问信息（文字内缩 contained）
  const infoY = 5.2;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: MARGIN + 0.8,
    y: infoY,
    w: CONTENT_W - 1.6,
    h: 1.35,
    fill: { color: C.forest800 },
    line: { type: "none" },
    rectRadius: 0.08,
  });
  slide.addText(
    [
      { text: "访问地址：", options: { fontSize: 13, color: C.textLight, fontFace: FONT } },
      { text: "http://localhost:5174/", options: { fontSize: 13, color: C.ochre400, bold: true, fontFace: FONT } },
      { text: "    默认账号：", options: { fontSize: 13, color: C.textLight, fontFace: FONT } },
      { text: "admin / admin123", options: { fontSize: 13, color: C.ochre400, bold: true, fontFace: FONT } },
      { text: "\n", options: { breakLine: true } },
      { text: "后续可打包成 exe 桌面版，离线可用", options: { fontSize: 12, color: C.textLight, fontFace: FONT, italic: true } },
    ],
    {
      x: MARGIN + 0.83,
      y: infoY + 0.03,
      w: CONTENT_W - 1.66,
      h: 1.29,
      align: "center",
      valign: "middle",
    }
  );

  finalize(slide, 17);
}

// ============ Slide 18: 封底 ============
function slide18Closing() {
  const slide = pptx.addSlide();
  slide.background = { color: C.forest800 };

  // 顶部 + 底部装饰条
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.12,
    fill: { color: C.ochre500 },
    line: { type: "none" },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: SLIDE_H - 0.12,
    w: SLIDE_W,
    h: 0.12,
    fill: { color: C.ochre500 },
    line: { type: "none" },
  });

  // 大标题
  slide.addText("谢谢观看", {
    x: 1.0,
    y: 2.5,
    w: 11.333,
    h: 1.5,
    fontSize: 56,
    fontFace: FONT,
    bold: true,
    color: C.cream,
    align: "center",
    valign: "middle",
  });

  // 装饰线
  slide.addShape(pptx.ShapeType.rect, {
    x: SLIDE_W / 2 - 1.0,
    y: 4.15,
    w: 2.0,
    h: 0.06,
    fill: { color: C.ochre500 },
    line: { type: "none" },
  });

  // 副标题
  slide.addText("AI 半人工 · 让招聘更高效", {
    x: 1.0,
    y: 4.4,
    w: 11.333,
    h: 0.7,
    fontSize: 22,
    fontFace: FONT,
    color: C.ochre400,
    align: "center",
    valign: "middle",
  });

  finalize(slide, null);
}

// ============ 构建 ============
slide1Cover();
slide2TOC();
slide3Positioning();
slide4EmployeeAdvantages();
slide5ScriptMatrix();
slide6AIWeapons();
slide7ManagementAdvantages();
slide8CollisionSecurity();
slide9PerformanceCapabilities();
slide10Indicators();
slide11Diagnosis();
slide12CompareEmployee();
slide13CompareManagement();
slide14DayComparison();
slide15ROI();
slide16Summary();
slide17NextSteps();
slide18Closing();

const outPath = "/workspace/ppt/产品介绍.pptx";
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log("PPTX generated: " + outPath);
});
