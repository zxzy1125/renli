// XLSX/XLS/CSV 文件解析为纯文本
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const EXCEL_EXTS = ['.xlsx', '.xls', '.csv'];

export function isExcelFile(filename: string): boolean {
  return EXCEL_EXTS.includes(path.extname(filename).toLowerCase());
}

/**
 * 解析 XLSX/XLS/CSV 文件，返回可读文本。
 * 多 sheet 时按 sheet 名分段拼接。
 */
export function parseExcelFile(filePath: string): string {
  const wb = XLSX.readFile(filePath, { type: 'file' });
  const parts: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    // 转为 CSV 文本（每行换行，单元格逗号分隔）
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ',', RS: '\n' });
    if (!csv.trim()) continue;
    if (wb.SheetNames.length > 1) {
      parts.push(`[${sheetName}]\n${csv}`);
    } else {
      parts.push(csv);
    }
  }

  return parts.join('\n\n');
}
