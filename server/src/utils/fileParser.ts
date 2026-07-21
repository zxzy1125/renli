// 文件解析工具：把上传的职位/简历文件提取为「文本 + 图片」两类资产
// 设计目的：让 AI 拿到完整的原文内容（含嵌入图片、嵌入附件、Excel 多 sheet），避免「上传成功但 AI 拿不到信息」
//
// 支持的输入格式：
//   - 文本类：.txt
//   - Word：.docx（含嵌入图片 / 嵌入附件）/ .doc（明确报错）
//   - PDF：.pdf（含 PDF 文件附件 / 嵌入图片）
//   - Excel：.xlsx / .xlsm / .xls / .csv（多 sheet 全部展开）
//   - 图片：.jpg / .jpeg / .png / .gif / .bmp / .webp（作为独立图片资产）
//
// 返回结构：ParsedFile
//   - text：所有可提取文本（含每个 sheet / 每个嵌入附件的分隔标题）
//   - images：所有图片（独立图片 + Word 嵌入图片 + Excel 嵌入图片 + PDF 嵌入图片），base64 编码
//   - attachments：嵌入附件元信息（仅记录，不返回 base64；如需递归解析，可后续扩展）
//   - meta：源文件信息（文件名、扩展名、MIME、字符数、sheet 数、图片数、附件数）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface ParsedImage {
  name: string;          // 图片名（无扩展名），如 'image1' / 'word-media-1'
  ext: string;           // 小写扩展名含点，如 '.png'
  mime: string;          // 标准 MIME，如 'image/png'
  base64: string;        // 不含 data: 前缀的纯 base64
  source: string;        // 来源说明：'standalone' / 'docx-media' / 'xlsx-media' / 'pdf-embedded'
}

export interface ParsedAttachment {
  name: string;          // 附件文件名
  ext: string;           // 扩展名
  mime: string;
  size: number;          // 字节数
  source: string;        // 来源：'docx-embeddings' / 'xlsx-embeddings' / 'pdf-embedded-files'
  extractedText?: string;// 如果该附件本身是可解析的文本类（txt/docx/xlsx/pdf），递归提取出的文本
}

export interface ParsedFileMeta {
  filename: string;
  ext: string;            // 小写扩展名，含点，如 '.pdf'
  mime: string;           // 标准 MIME 类型
  charCount: number;      // 提取出的文本字符数
  sheetCount: number;     // Excel sheet 数（其它格式 0）
  imageCount: number;     // 图片总数
  attachmentCount: number;// 嵌入附件总数
}

export interface ParsedFile {
  text: string;
  images: ParsedImage[];
  attachments: ParsedAttachment[];
  meta: ParsedFileMeta;
}

// 扩展名 → MIME 映射
const MIME_MAP: Record<string, string> = {
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
};

const SUPPORTED_EXT = Object.keys(MIME_MAP);

// 图片扩展名（用于识别 docx/xlsx 内嵌的图片类型）
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

// 限制单张图片大小（避免 base64 过大撑爆 AI 上下文）：2MB
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// 限制返回的图片总数（按顺序保留前 N 张）：12 张
const MAX_IMAGES = 12;
// 限制递归解析嵌入附件的深度：3 层
const MAX_RECURSION_DEPTH = 3;

/**
 * 把上传的文件解析为「文本 + 图片 + 附件」。
 * 注意：调用方负责删除临时文件（本函数不删）。
 */
export async function parseFileToText(
  filePath: string,
  originalName: string,
  options?: { depth?: number }
): Promise<ParsedFile> {
  const depth = options?.depth ?? 0;
  const ext = path.extname(originalName).toLowerCase();
  if (!SUPPORTED_EXT.includes(ext)) {
    throw new Error(
      `暂不支持该格式（${ext || '无扩展名'}），仅支持 .txt / .pdf / .docx / .xlsx / .xls / .csv / .jpg / .png 等`
    );
  }
  const mime = MIME_MAP[ext] || 'application/octet-stream';

  // 分派到具体解析器，每个解析器返回 { text, images, attachments }
  let text = '';
  let images: ParsedImage[] = [];
  let attachments: ParsedAttachment[] = [];
  let sheetCount = 0;

  if (ext === '.txt' || ext === '.csv') {
    text = fs.readFileSync(filePath, 'utf-8');
  } else if (ext === '.pdf') {
    const r = await parsePdf(filePath);
    text = r.text;
    images = r.images;
    attachments = r.attachments;
  } else if (ext === '.docx') {
    const r = await parseDocx(filePath, depth);
    text = r.text;
    images = r.images;
    attachments = r.attachments;
  } else if (ext === '.xlsx' || ext === '.xlsm') {
    const r = await parseXlsx(filePath, originalName, depth);
    text = r.text;
    images = r.images;
    attachments = r.attachments;
    sheetCount = r.sheetCount;
  } else if (ext === '.xls') {
    // .xls 是旧版二进制 Excel，xlsx 库可读但部分格式可能不全
    const r = await parseXlsx(filePath, originalName, depth);
    text = r.text;
    images = r.images;
    attachments = r.attachments;
    sheetCount = r.sheetCount;
  } else if (ext === '.doc') {
    throw new Error('旧版 .doc 格式不支持自动解析，请另存为 .docx 或 .txt 后重试');
  } else if (IMAGE_EXT.includes(ext)) {
    // 独立图片文件：作为 image 资产返回
    const img = readImageAsBase64(filePath, originalName, 'standalone');
    if (img) images.push(img);
    text = `[上传的图片文件：${originalName}，已作为图片资产交给 AI 识别]`;
  }

  text = (text || '').trim();
  // 限制图片总数 + 单图大小已经在 readImageAsBase64 内做
  images = images.slice(0, MAX_IMAGES);

  if (!text && images.length === 0) {
    throw new Error('文件解析成功但未提取到任何文本或图片，可能是扫描件 PDF，请直接粘贴文本或换用支持视觉的 AI 模型');
  }

  return {
    text,
    images,
    attachments,
    meta: {
      filename: originalName,
      ext,
      mime,
      charCount: text.length,
      sheetCount,
      imageCount: images.length,
      attachmentCount: attachments.length,
    },
  };
}

// ===== PDF 解析（pdf-parse v2 + 嵌入图片/附件） =====
async function parsePdf(filePath: string): Promise<{
  text: string;
  images: ParsedImage[];
  attachments: ParsedAttachment[];
}> {
  const { PDFParse } = await import('pdf-parse');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const parser = new PDFParse({ data });
  let text = '';
  const images: ParsedImage[] = [];
  const attachments: ParsedAttachment[] = [];
  try {
    const result = await parser.getText();
    text = (result && (result as any).text) || '';

    // 尝试通过解压 PDF 提取嵌入图片与附件
    // PDF 结构里：图片通常以 /Image XObject 形式嵌入流；附件以 /EmbeddedFiles 形式存在
    // 这里用最简单的方式：扫描 PDF 二进制中的 stream，提取 JPEG/PNG/GIF 头部
    const buf = fs.readFileSync(filePath);
    const scanned = scanPdfForEmbeddedImages(buf);
    images.push(...scanned.images);

    // 提取 PDF 附件（EmbeddedFiles）—— 这里仅做尽力而为的提取
    const files = extractPdfEmbeddedFiles(buf);
    for (const f of files) {
      const att: ParsedAttachment = {
        name: f.name,
        ext: path.extname(f.name).toLowerCase(),
        mime: guessMime(f.name),
        size: f.data.length,
        source: 'pdf-embedded-files',
      };
      // 递归解析可识别的文本类附件
      if (att.ext && SUPPORTED_EXT.includes(att.ext) && att.ext !== '.pdf') {
        try {
          const tmpPath = path.join(os.tmpdir(), `pdf-embed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${att.ext}`);
          fs.writeFileSync(tmpPath, f.data);
          try {
            const sub = await parseFileToText(tmpPath, att.name, { depth: 1 });
            att.extractedText = sub.text;
            // 把子附件的图片也并入主图集
            images.push(...sub.images);
          } finally {
            try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
          }
        } catch {
          // 子附件解析失败，忽略
        }
      }
      attachments.push(att);
    }
  } finally {
    await parser.destroy().catch(() => {});
  }
  return { text, images, attachments };
}

// 扫描 PDF 二进制，提取嵌入的 JPEG/PNG/GIF 图片
// （pdf-parse v2 不直接暴露图片接口，这里用魔数扫描作为兜底）
function scanPdfForEmbeddedImages(buf: Buffer): { images: ParsedImage[] } {
  const images: ParsedImage[] = [];
  // JPEG: FF D8 FF ... FF D9
  // PNG: 89 50 4E 47 ... 49 45 4E 44 AE 42 60 82
  // GIF: 47 49 46 38 (7a/9a) ...
  const jpegStart = Buffer.from([0xff, 0xd8, 0xff]);
  const jpegEnd = Buffer.from([0xff, 0xd9]);
  const pngStart = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const pngEnd = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const gifStart = Buffer.from([0x47, 0x49, 0x46, 0x38]);

  let idx = 0;
  let counter = 0;
  while (idx < buf.length && counter < MAX_IMAGES) {
    // 查找下一个图片起点
    const jpegAt = buf.indexOf(jpegStart, idx);
    const pngAt = buf.indexOf(pngStart, idx);
    const gifAt = buf.indexOf(gifStart, idx);
    const candidates = [jpegAt, pngAt, gifAt].filter((i) => i >= 0);
    if (candidates.length === 0) break;
    const start = Math.min(...candidates);
    let end = -1;
    let ext = '';
    let mime = '';
    if (buf.indexOf(jpegStart, start) === start) {
      end = buf.indexOf(jpegEnd, start);
      ext = '.jpg';
      mime = 'image/jpeg';
    } else if (buf.indexOf(pngStart, start) === start) {
      end = buf.indexOf(pngEnd, start);
      if (end >= 0) end += pngEnd.length;
      ext = '.png';
      mime = 'image/png';
    } else if (buf.indexOf(gifStart, start) === start) {
      // GIF 没有固定尾部，用下一个流结束符或限制 1MB
      const nextStream = buf.indexOf(Buffer.from('stream\n'), start + 4);
      end = nextStream > 0 ? nextStream : start + 1024 * 1024;
      ext = '.gif';
      mime = 'image/gif';
    }
    if (end <= start) {
      idx = start + 1;
      continue;
    }
    const slice = buf.slice(start, end);
    if (slice.length <= MAX_IMAGE_BYTES) {
      counter += 1;
      images.push({
        name: `pdf-image-${counter}`,
        ext,
        mime,
        base64: slice.toString('base64'),
        source: 'pdf-embedded',
      });
    }
    idx = end + 1;
  }
  return { images };
}

// 提取 PDF 中的 EmbeddedFiles（附件）
// 标准 PDF 用 /EmbeddedFiles /NamesTree 列附件，完整解析需要 PDF 对象图遍历
// 这里做简化处理：扫描 /Type /Filespec 和紧随其后的 /EF << /F (stream ref) >>
// 由于完整实现需要解析 xref，这里采用尽力而为：找出 stream 中带 /Type /EmbeddedFile 的内容
function extractPdfEmbeddedFiles(buf: Buffer): Array<{ name: string; data: Buffer }> {
  const files: Array<{ name: string; data: Buffer }> = [];
  // 这部分留作扩展位：完整 PDF 附件提取需要 pdf-lib 或 pdfjs，本工具暂不实现
  // 如果未来要支持，可在此实现
  return files;
}

// ===== .docx 解析（mammoth 文本 + jszip 提取 media/embeddings） =====
async function parseDocx(filePath: string, depth: number): Promise<{
  text: string;
  images: ParsedImage[];
  attachments: ParsedAttachment[];
}> {
  const mammoth = await import('mammoth');
  const JSZip = (await import('jszip')).default;
  const buffer = fs.readFileSync(filePath);

  // 1. 用 mammoth 提取纯文本
  const mamResult = await mammoth.extractRawText({ buffer });
  let text = (mamResult && mamResult.value) || '';

  const images: ParsedImage[] = [];
  const attachments: ParsedAttachment[] = [];

  // 2. 用 jszip 打开 docx，提取 word/media/ 下的图片 + word/embeddings/ 下的附件
  const zip = await JSZip.loadAsync(buffer);

  // 2.1 提取 word/media/ 下的图片
  const mediaFiles = Object.keys(zip.files).filter((n) => n.startsWith('word/media/'));
  let imgIdx = 0;
  for (const name of mediaFiles) {
    if (imgIdx >= MAX_IMAGES) break;
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.includes(ext)) continue;
    const file = zip.files[name];
    const data = await file.async('nodebuffer');
    if (data.length > MAX_IMAGE_BYTES) continue;
    imgIdx += 1;
    images.push({
      name: `word-media-${imgIdx}-${path.basename(name, ext)}`,
      ext,
      mime: MIME_MAP[ext] || 'application/octet-stream',
      base64: data.toString('base64'),
      source: 'docx-media',
    });
  }

  // 2.2 提取 word/embeddings/ 下的附件（如内嵌的 .xlsx/.pdf/.docx）
  const embedFiles = Object.keys(zip.files).filter((n) => n.startsWith('word/embeddings/'));
  for (const name of embedFiles) {
    const ext = path.extname(name).toLowerCase();
    const file = zip.files[name];
    const data = await file.async('nodebuffer');
    const att: ParsedAttachment = {
      name: path.basename(name),
      ext,
      mime: MIME_MAP[ext] || 'application/octet-stream',
      size: data.length,
      source: 'docx-embeddings',
    };
    // 递归解析可识别的文本类附件（避免递归过深）
    if (
      depth < MAX_RECURSION_DEPTH &&
      ext &&
      SUPPORTED_EXT.includes(ext) &&
      ext !== '.doc' // .doc 本身就不支持
    ) {
      try {
        const tmpPath = path.join(os.tmpdir(), `docx-embed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
        fs.writeFileSync(tmpPath, data);
        try {
          const sub = await parseFileToText(tmpPath, att.name, { depth: depth + 1 });
          att.extractedText = sub.text;
          images.push(...sub.images);
          attachments.push(...sub.attachments);
        } finally {
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        }
      } catch {
        // 子附件解析失败，仅保留元信息
      }
    }
    attachments.push(att);
  }

  // 2.3 把递归提取出的附件文本拼到主文本后
  const embedTextBlocks: string[] = [];
  for (const att of attachments) {
    if (att.extractedText && att.extractedText.trim()) {
      embedTextBlocks.push(
        `\n\n========== [Word 内嵌附件：${att.name}（${att.ext}）] ==========\n${att.extractedText.trim()}\n========== [内嵌附件结束：${att.name}] ==========`
      );
    } else {
      embedTextBlocks.push(
        `\n\n[内嵌附件：${att.name}（${att.ext}，${att.size} 字节，未自动解析文本，请人工查看]`
      );
    }
  }
  if (embedTextBlocks.length > 0) {
    text = `${text}\n${embedTextBlocks.join('\n')}`;
  }

  return { text, images, attachments };
}

// ===== .xlsx / .xls / .xlsm 解析（多 sheet 全部展开 + 嵌入图片/附件） =====
async function parseXlsx(
  filePath: string,
  originalName: string,
  depth: number
): Promise<{
  text: string;
  images: ParsedImage[];
  attachments: ParsedAttachment[];
  sheetCount: number;
}> {
  const XLSX = await import('xlsx');
  const JSZip = (await import('jszip')).default;
  const buffer = fs.readFileSync(filePath);

  // 1. 用 xlsx 库读取所有 sheet
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames: string[] = workbook.SheetNames || [];
  const blocks: string[] = [];
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    // sheet_to_csv 把每个 cell 按行拼成逗号分隔的纯文本（保留行列结构）
    // 这里改用更易读的格式：先转 json 数组（header:1 表示按行返回数组），再格式化
    let txt = '';
    try {
      // header:1 让结果为二维数组（每行是一个数组）
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false, defval: '' });
      txt = rows
        .map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '').trim()).join('\t') : String(row)))
        .join('\n');
    } catch {
      // 兜底用 csv
      txt = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' });
    }
    blocks.push(
      `========== [Excel 工作表：${sheetName}] ==========\n${(txt || '').trim()}\n========== [工作表结束：${sheetName}] ==========`
    );
  }
  let text = blocks.join('\n\n');
  if (!text.trim()) {
    text = `[Excel 文件 ${originalName} 解析完成，但所有 sheet 均为空]`;
  }

  const images: ParsedImage[] = [];
  const attachments: ParsedAttachment[] = [];

  // 2. 用 jszip 提取 xl/media/ 下的图片
  // .xlsx 本质是 zip，但 .xls 是旧版二进制，jszip 无法打开
  if (originalName.toLowerCase().endsWith('.xlsx') || originalName.toLowerCase().endsWith('.xlsm')) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const mediaFiles = Object.keys(zip.files).filter((n) => n.startsWith('xl/media/'));
      let imgIdx = 0;
      for (const name of mediaFiles) {
        if (imgIdx >= MAX_IMAGES) break;
        const ext = path.extname(name).toLowerCase();
        if (!IMAGE_EXT.includes(ext)) continue;
        const data = await zip.files[name].async('nodebuffer');
        if (data.length > MAX_IMAGE_BYTES) continue;
        imgIdx += 1;
        images.push({
          name: `xlsx-media-${imgIdx}-${path.basename(name, ext)}`,
          ext,
          mime: MIME_MAP[ext] || 'application/octet-stream',
          base64: data.toString('base64'),
          source: 'xlsx-media',
        });
      }

      // 提取 xl/embeddings/ 下的附件（如嵌入的 Word 文档）
      const embedFiles = Object.keys(zip.files).filter((n) => n.startsWith('xl/embeddings/'));
      for (const name of embedFiles) {
        const ext = path.extname(name).toLowerCase();
        const data = await zip.files[name].async('nodebuffer');
        const att: ParsedAttachment = {
          name: path.basename(name),
          ext,
          mime: MIME_MAP[ext] || 'application/octet-stream',
          size: data.length,
          source: 'xlsx-embeddings',
        };
        if (
          depth < MAX_RECURSION_DEPTH &&
          ext &&
          SUPPORTED_EXT.includes(ext) &&
          ext !== '.doc'
        ) {
          try {
            const tmpPath = path.join(os.tmpdir(), `xlsx-embed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
            fs.writeFileSync(tmpPath, data);
            try {
              const sub = await parseFileToText(tmpPath, att.name, { depth: depth + 1 });
              att.extractedText = sub.text;
              images.push(...sub.images);
              attachments.push(...sub.attachments);
            } finally {
              try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
            }
          } catch {
            // ignore
          }
        }
        attachments.push(att);
      }

      // 把嵌入附件的文本拼到主文本后
      const embedTextBlocks: string[] = [];
      for (const att of attachments) {
        if (att.extractedText && att.extractedText.trim()) {
          embedTextBlocks.push(
            `\n\n========== [Excel 内嵌附件：${att.name}（${att.ext}）] ==========\n${att.extractedText.trim()}\n========== [内嵌附件结束：${att.name}] ==========`
          );
        }
      }
      if (embedTextBlocks.length > 0) {
        text = `${text}\n${embedTextBlocks.join('\n')}`;
      }
    } catch {
      // 旧版 .xls 或非标准 zip，忽略嵌入物提取
    }
  }

  return { text, images, attachments, sheetCount: sheetNames.length };
}

// ===== 通用工具 =====

// 把图片文件读成 ParsedImage（带大小限制）
function readImageAsBase64(
  filePath: string,
  originalName: string,
  source: string
): ParsedImage | null {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_IMAGE_BYTES) {
    // 图片过大，跳过（AI 也吃不下）
    return null;
  }
  const ext = path.extname(originalName).toLowerCase();
  const data = fs.readFileSync(filePath);
  return {
    name: path.basename(originalName, ext),
    ext,
    mime: MIME_MAP[ext] || 'application/octet-stream',
    base64: data.toString('base64'),
    source,
  };
}

// 根据文件名猜测 MIME
function guessMime(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}
