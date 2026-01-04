import * as XLSX from "xlsx";

export interface ParsedKeyword {
  keyword: string;
  url: string;
}

export interface ParseResult {
  keywords: ParsedKeyword[];
  errors: string[];
}

/**
 * 엑셀 파일 버퍼를 파싱하여 키워드 목록을 추출합니다.
 *
 * 예상 포맷:
 * | 키워드  | URL       |
 * | ------- | --------- |
 * | 네이버  | naver.com |
 *
 * @param buffer - 엑셀 파일 버퍼
 * @returns 파싱된 키워드 목록과 에러 목록
 */
export function parseExcelFile(buffer: Buffer): ParseResult {
  const keywords: ParsedKeyword[] = [];
  const errors: string[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (workbook.SheetNames.length === 0) {
      errors.push("엑셀 파일에 시트가 없습니다.");
      return { keywords, errors };
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

    if (jsonData.length === 0) {
      errors.push("엑셀 파일에 데이터가 없습니다.");
      return { keywords, errors };
    }

    // Parse each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // Excel row number (1-indexed + header)

      // Try to find keyword and url columns (flexible column names)
      const keyword =
        row["키워드"] ||
        row["keyword"] ||
        row["Keyword"] ||
        row["KEYWORD"] ||
        "";

      const url =
        row["URL"] ||
        row["url"] ||
        row["Url"] ||
        row["사이트"] ||
        row["웹사이트"] ||
        "";

      // Validate
      if (!keyword || !url) {
        errors.push(`${rowNumber}행: 키워드 또는 URL이 비어있습니다.`);
        continue;
      }

      // Trim whitespace
      const trimmedKeyword = String(keyword).trim();
      const trimmedUrl = String(url).trim();

      if (!trimmedKeyword || !trimmedUrl) {
        errors.push(`${rowNumber}행: 키워드 또는 URL이 비어있습니다.`);
        continue;
      }

      // Normalize URL (remove protocol and www)
      let normalizedUrl = trimmedUrl;
      normalizedUrl = normalizedUrl.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
      normalizedUrl = normalizedUrl.replace(/^www\./, "");

      keywords.push({
        keyword: trimmedKeyword,
        url: normalizedUrl,
      });
    }

  } catch (e: any) {
    errors.push(`엑셀 파일 파싱 오류: ${e.message}`);
  }

  return { keywords, errors };
}

/**
 * 대량 서치 결과를 엑셀 파일로 생성합니다.
 *
 * @param data - 키워드 결과 데이터
 * @returns 엑셀 파일 버퍼
 */
export function generateExcelFile(
  data: Array<{
    keyword: string;
    url: string;
    status: string;
    rank: number | null;
    completed_at: Date | null;
  }>
): Buffer {
  // Create worksheet data
  const worksheetData = data.map((item) => ({
    "키워드": item.keyword,
    "URL": item.url,
    "상태": item.status === "completed" ? "완료" :
           item.status === "cached" ? "캐시" :
           item.status === "processing" ? "처리중" : "대기",
    "순위": item.rank || "-",
    "완료 시간": item.completed_at
      ? new Date(item.completed_at).toLocaleString("ko-KR")
      : "-",
  }));

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "대량 서치 결과");

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer as Buffer;
}

/**
 * 대량 서치 템플릿 엑셀 파일을 생성합니다.
 *
 * @returns 템플릿 엑셀 파일 버퍼
 */
export function generateTemplateFile(): Buffer {
  const templateData = [
    { "키워드": "네이버", "URL": "naver.com" },
    { "키워드": "카카오", "URL": "kakao.com" },
    { "키워드": "구글", "URL": "google.com" },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "템플릿");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer as Buffer;
}
