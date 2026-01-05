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

  } catch (e: unknown) {
    // 구체적인 예외 유형에 따라 보다 자세한 에러 메시지를 제공합니다.
    const err = (e && typeof e === "object" ? (e as { name?: string; message?: string; code?: string }) : undefined);
    const message = err?.message || "알 수 없는 오류가 발생했습니다.";
    const lowerMessage = message.toLowerCase();

    // 1) 지원하지 않는 포맷 / 잘못된 파일 형식 (예: XLSX가 아닌 파일)
    if (
      lowerMessage.includes("unsupported file") ||
      lowerMessage.includes("unsupported format") ||
      lowerMessage.includes("unrecognized format") ||
      lowerMessage.includes("file type") ||
      lowerMessage.includes("password") ||
      lowerMessage.includes("encrypted")
    ) {
      errors.push("지원하지 않는 엑셀 형식이거나 잘못된 파일입니다. XLSX 형식의 정상적인 엑셀 파일을 업로드해 주세요.");

    // 2) 손상되었거나 일부만 업로드된 파일
    } else if (
      lowerMessage.includes("corrupt") ||
      lowerMessage.includes("corrupted") ||
      lowerMessage.includes("invalid") ||
      lowerMessage.includes("truncated") ||
      lowerMessage.includes("end-of-central-directory") ||
      lowerMessage.includes("zip") // XLSX는 ZIP 구조를 사용하므로 ZIP 관련 오류는 손상 가능성이 큽니다.
    ) {
      errors.push("엑셀 파일이 손상되었거나 올바르게 업로드되지 않았습니다. 파일을 다시 저장한 뒤 다시 시도해 주세요.");

    // 3) 메모리/용량 관련 문제 (너무 큰 파일 등)
    } else if (
      e instanceof RangeError ||
      lowerMessage.includes("out of memory") ||
      lowerMessage.includes("allocation failed") ||
      lowerMessage.includes("exceeds the maximum")
    ) {
      errors.push("엑셀 파일이 너무 크거나 서버 메모리 한계를 초과했습니다. 파일을 나누어 업로드해 주세요.");

    // 4) 그 외 예기치 못한 오류
    } else {
      // 기본적으로 내부 오류 메시지도 포함하여 디버깅에 도움을 줍니다.
      errors.push(`엑셀 파일 파싱 중 알 수 없는 오류가 발생했습니다: ${message}`);
    }
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
