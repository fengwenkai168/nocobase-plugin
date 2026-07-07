import ExcelJS from 'exceljs';

export async function streamProcessExcel(
  filePath: string,
  targetSheet: string | undefined,
  headerRow: number,
  onRow: (excelRowNum: number, dataIndex: number, rowValues: any[]) => boolean | void | Promise<boolean | void>,
  onHeader?: (headers: string[]) => void,
): Promise<{ headers: string[]; totalRows: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  let ws: ExcelJS.Worksheet | undefined;
  if (targetSheet) {
    ws = wb.getWorksheet(targetSheet);
    if (!ws) ws = wb.worksheets[0];
  } else {
    ws = wb.worksheets[0];
  }
  if (!ws) {
    throw new Error('工作表未找到: ' + (targetSheet || '默认工作表'));
  }

  const hRowNum = headerRow || 1;
  let headers: string[] = [];
  let dataIndex = 0;
  let totalRows = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const rowValues = (row.values as any[]) || [];
    if (rowNum < hRowNum) return;
    if (rowNum === hRowNum) {
      headers = rowValues.slice(1).map((h: any) => String(h ?? ''));
      if (onHeader) onHeader(headers);
      return;
    }
    const vals = rowValues.slice(1);
    const empty = !vals.some((v: any) => v !== undefined && v !== null && v !== '');
    if (empty) {
      dataIndex++;
      return;
    }
    totalRows++;
    const shouldContinue = onRow(rowNum, dataIndex, vals);
    if (shouldContinue === false) return false;
    dataIndex++;
  });

  return { headers, totalRows };
}
