# MCP(Model Context Protocol) 통합 제안서

## 📋 목차
1. [개요](#개요)
2. [MCP 통합 아키텍처 옵션](#mcp-통합-아키텍처-옵션)
3. [제안 1: 클라이언트 MCP 통합 (추천)](#제안-1-클라이언트-mcp-통합-추천)
4. [제안 2: 백엔드 MCP 서버](#제안-2-백엔드-mcp-서버)
5. [제안 3: AI 에이전트 서비스 레이어](#제안-3-ai-에이전트-서비스-레이어)
6. [구현 로드맵](#구현-로드맵)
7. [기술 스택 및 의존성](#기술-스택-및-의존성)

---

## 개요

**MCP(Model Context Protocol)**는 AI 모델이 외부 데이터와 도구에 접근할 수 있게 하는 표준 프로토콜입니다. Charles MVP 프로젝트에 MCP를 통합하면 다음과 같은 가치를 제공할 수 있습니다:

### 🎯 비즈니스 가치
- **AI 기반 키워드 전략 수립**: 순위 데이터를 분석하여 키워드 최적화 제안
- **자동화된 인사이트**: 순위 변동 패턴 자동 분석 및 원인 추론
- **자연어 인터페이스**: 복잡한 쿼리를 자연어로 수행 ("지난 주 순위가 10위 이상 하락한 키워드는?")
- **스마트 알림**: 맥락을 이해하는 AI가 중요한 변동만 선별 알림
- **경쟁사 분석 자동화**: AI가 경쟁사 키워드 전략을 분석하고 대응 방안 제시

### 🔧 기술적 이점
- 표준화된 AI-Application 연동
- 확장 가능한 Tool 아키텍처
- 다양한 LLM 모델 지원 (Claude, GPT-4, Gemini 등)
- 프롬프트 재사용 및 관리

---

## MCP 통합 아키텍처 옵션

```
┌─────────────────────────────────────────────────────────────────────┐
│                    옵션 1: 클라이언트 MCP 통합                       │
│                          (추천 ⭐)                                    │
└─────────────────────────────────────────────────────────────────────┘

  Electron App (Client)
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  ┌──────────────────────┐       ┌──────────────────────────┐   │
  │  │   React UI           │       │   MCP Client             │   │
  │  │   - 대시보드          │←─────→│   - Claude Desktop SDK  │   │
  │  │   - AI 채팅 패널      │       │   - Tool Executor        │   │
  │  │   - 키워드 관리       │       │   - Prompt Manager       │   │
  │  └──────────────────────┘       └──────────────────────────┘   │
  │             ↓                              ↓                    │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │  MCP Tools (로컬 실행)                                    │  │
  │  │  - 키워드 CRUD, 순위 조회, 데이터 분석, Excel 생성       │  │
  │  └──────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────┘
                         ↓ REST API
  ┌─────────────────────────────────────────────────────────────────┐
  │            Backend (기존 API 서버 그대로 사용)                   │
  └─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                    옵션 2: 백엔드 MCP 서버                           │
└─────────────────────────────────────────────────────────────────────┘

  Electron App                      외부 AI 클라이언트
  ┌─────────────────┐              ┌──────────────────┐
  │  React UI       │              │  Claude Desktop  │
  │  (기존 유지)     │              │  ChatGPT Plugin  │
  └─────────────────┘              │  Custom Agent    │
           ↓                        └──────────────────┘
                                            ↓ MCP Protocol
  ┌─────────────────────────────────────────────────────────────────┐
  │                    Backend                                      │
  │  ┌────────────────┐       ┌────────────────────────────┐       │
  │  │  Express API   │       │  MCP Server (SSE)          │       │
  │  │  (기존)         │       │  - Tool Registry           │       │
  │  └────────────────┘       │  - Prompt Templates        │       │
  │                            │  - Authentication          │       │
  │                            └────────────────────────────┘       │
  └─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│            옵션 3: AI 에이전트 서비스 레이어 (고급)                  │
└─────────────────────────────────────────────────────────────────────┘

  Electron App                         Admin Dashboard
  ┌─────────────────┐                 ┌──────────────────┐
  │  React UI       │                 │  Agent Monitor   │
  └─────────────────┘                 └──────────────────┘
           ↓                                     ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │                  AI Agent Service (독립 서버)                    │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │  Autonomous Agents                                       │  │
  │  │  - Keyword Optimizer Agent: 순위 분석 → 최적화 제안      │  │
  │  │  - Alert Manager Agent: 스마트 알림 필터링              │  │
  │  │  - Competitor Analyzer Agent: 경쟁사 동향 파악          │  │
  │  │  - Report Generator Agent: 주간/월간 리포트 자동 생성   │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │             ↓                                                   │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │  MCP Tools Layer                                         │  │
  │  │  - 백엔드 API 호출, 데이터 분석, 외부 API 연동           │  │
  │  └──────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────┘
                         ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │                    Backend (기존)                               │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 제안 1: 클라이언트 MCP 통합 (추천)

### ⭐ 왜 추천하는가?

1. **빠른 개발**: 기존 백엔드 API를 그대로 활용
2. **로컬 우선**: 민감한 키워드 데이터를 외부로 보내지 않음
3. **UX 향상**: Electron UI 내에서 AI 채팅으로 모든 작업 가능
4. **점진적 마이그레이션**: 기존 기능은 유지하면서 AI 기능만 추가

### 🏗️ 아키텍처 상세

```typescript
// client/src/mcp/
├── server.ts              // MCP 서버 (Electron Main Process)
├── tools/                 // MCP Tools 구현
│   ├── keywords.ts        // 키워드 관리 도구
│   ├── rankings.ts        // 순위 조회 도구
│   ├── analytics.ts       // 데이터 분석 도구
│   ├── export.ts          // 내보내기 도구
│   └── crawl.ts           // 크롤링 제어 도구
├── prompts/               // 재사용 가능한 프롬프트
│   ├── analyze-trends.ts
│   ├── optimize-keywords.ts
│   └── generate-report.ts
└── client.ts              // MCP 클라이언트 (Renderer Process)

// client/src/renderer/features/
└── ai-assistant/
    ├── AIChatPanel.tsx    // AI 채팅 UI
    ├── useAIChat.ts       // AI 상태 관리
    └── ToolResultView.tsx // Tool 실행 결과 시각화
```

### 🛠️ 제공할 MCP Tools

#### 1. **Keyword Management Tools**
```typescript
// keywords_add
{
  name: "keywords_add",
  description: "새로운 키워드를 추가합니다",
  inputSchema: {
    keyword: { type: "string", description: "모니터링할 키워드" },
    url: { type: "string", description: "타겟 도메인 URL" },
    tags: { type: "array", description: "분류 태그" },
    targetRank: { type: "number", description: "목표 순위" }
  }
}

// keywords_bulk_add
// keywords_update
// keywords_delete
// keywords_search
```

#### 2. **Ranking Analysis Tools**
```typescript
// rankings_get_current
{
  name: "rankings_get_current",
  description: "현재 모든 키워드의 최신 순위를 조회합니다",
  inputSchema: {
    tags?: string[],
    sortBy?: "rank" | "keyword" | "updated"
  }
}

// rankings_get_history
{
  name: "rankings_get_history",
  description: "특정 키워드의 순위 변동 이력을 조회합니다",
  inputSchema: {
    keywordId: number,
    days?: number  // 기본 30일
  }
}

// rankings_compare
{
  name: "rankings_compare",
  description: "여러 키워드의 순위를 비교 분석합니다",
  inputSchema: {
    keywordIds: number[],
    startDate: string,
    endDate: string
  }
}
```

#### 3. **Analytics Tools**
```typescript
// analytics_trend_analysis
{
  name: "analytics_trend_analysis",
  description: "키워드 순위 트렌드를 분석합니다 (상승/하락/안정)",
  inputSchema: {
    keywordId?: number,  // 미지정 시 전체 분석
    period: "7d" | "30d" | "90d"
  }
}

// analytics_underperforming
{
  name: "analytics_underperforming",
  description: "목표 순위에 미달하는 키워드를 찾습니다",
  inputSchema: {
    threshold?: number  // 목표 대비 차이 임계값
  }
}

// analytics_volatility
{
  name: "analytics_volatility",
  description: "순위 변동성이 큰 키워드를 찾습니다",
  inputSchema: {
    days: number,
    volatilityThreshold: number
  }
}

// analytics_tag_performance
{
  name: "analytics_tag_performance",
  description: "태그별 평균 순위 및 성과를 분석합니다"
}
```

#### 4. **Crawling Control Tools**
```typescript
// crawl_trigger_priority
{
  name: "crawl_trigger_priority",
  description: "특정 키워드를 우선 순위로 즉시 크롤링합니다",
  inputSchema: {
    keywordIds: number[]
  }
}

// crawl_queue_status
{
  name: "crawl_queue_status",
  description: "현재 크롤링 큐 상태를 조회합니다"
}

// crawl_retry_failed
{
  name: "crawl_retry_failed",
  description: "실패한 크롤링 작업을 재시도합니다"
}
```

#### 5. **Export & Reporting Tools**
```typescript
// export_to_excel
{
  name: "export_to_excel",
  description: "데이터를 Excel 파일로 내보냅니다",
  inputSchema: {
    type: "current" | "history" | "analytics",
    filters?: {
      tags?: string[],
      dateRange?: { start: string, end: string }
    },
    filePath: string
  }
}

// generate_report
{
  name: "generate_report",
  description: "AI가 분석한 리포트를 생성합니다",
  inputSchema: {
    reportType: "weekly" | "monthly" | "custom",
    format: "markdown" | "html" | "pdf"
  }
}
```

### 🎨 사용자 시나리오 예시

#### 시나리오 1: 자연어로 키워드 추가
```
User: "네이버 검색 최적화"라는 키워드를 추가해줘.
      내 블로그 URL은 https://myblog.com이고, 목표는 5위야.

AI: 알겠습니다. 키워드를 추가하겠습니다.
    [keywords_add 실행]

    ✅ "네이버 검색 최적화" 키워드가 추가되었습니다.
    - URL: https://myblog.com
    - 목표 순위: 5위
    - 첫 크롤링이 큐에 등록되었습니다.
```

#### 시나리오 2: 순위 하락 원인 분석
```
User: 지난 일주일간 순위가 많이 떨어진 키워드를 찾아서
      왜 떨어졌는지 분석해줘.

AI: [analytics_trend_analysis 실행]
    [rankings_get_history 실행 (하락 키워드들)]

    📊 **순위 하락 키워드 분석 결과**

    다음 3개 키워드의 순위가 큰 폭으로 하락했습니다:

    1. "SEO 최적화" (5위 → 12위, -7)
       - 하락 시점: 2025-12-20 오후
       - 추정 원인: 네이버 알고리즘 업데이트 가능성
       - 경쟁사 "competitor.com"이 상위에 진입

    2. "키워드 분석" (8위 → 15위, -7)
       ...

    **권장 조치:**
    - 컨텐츠 업데이트 (신선도 개선)
    - 백링크 확인
    - 경쟁사 페이지 벤치마킹
```

#### 시나리오 3: 주간 리포트 자동 생성
```
User: 이번 주 리포트 만들어줘.

AI: [generate_report 실행]
    [analytics_trend_analysis: period=7d]
    [analytics_tag_performance]
    [export_to_excel]

    📈 **주간 리포트 (2025-12-21 ~ 2025-12-27)**

    **전체 현황:**
    - 총 키워드: 50개
    - 평균 순위: 8.2위 (전주 대비 +0.3위 개선)
    - 상위 10위 이내: 32개 (64%)

    **순위 변동:**
    ↗️ 상승: 18개 (평균 +2.5위)
    ↘️ 하락: 12개 (평균 -1.8위)
    → 유지: 20개

    **태그별 성과:**
    - #브랜딩: 평균 5.2위 ⭐ 최우수
    - #제품: 평균 8.7위
    - #정보성: 평균 12.3위 ⚠️ 개선 필요

    **주목할 변화:**
    - "브랜드 마케팅" 키워드가 15위 → 3위로 급상승
    - "경쟁사 분석" 키워드가 목표 순위(5위) 달성

    Excel 파일이 ~/Downloads/report_20251227.xlsx에 저장되었습니다.
```

### 💻 구현 예시 코드

#### MCP Tool 구현 (keywords.ts)
```typescript
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiClient } from "../../lib/api";

export const keywordsAddTool: Tool = {
  name: "keywords_add",
  description: "새로운 키워드를 추가하고 모니터링을 시작합니다",
  inputSchema: {
    type: "object",
    properties: {
      keyword: {
        type: "string",
        description: "모니터링할 검색 키워드"
      },
      url: {
        type: "string",
        description: "타겟 도메인 URL (예: https://example.com)"
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "분류를 위한 태그들"
      },
      targetRank: {
        type: "number",
        description: "목표 순위 (1-100)"
      }
    },
    required: ["keyword", "url"]
  }
};

export async function executeKeywordsAdd(args: {
  keyword: string;
  url: string;
  tags?: string[];
  targetRank?: number;
}) {
  try {
    const response = await apiClient.post("/api/keywords", {
      keyword: args.keyword,
      url: args.url,
      tags: args.tags || [],
      targetRank: args.targetRank
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            keywordId: response.data.id,
            message: `키워드 "${args.keyword}"가 추가되었습니다.`,
            data: response.data
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}
```

#### MCP 서버 설정 (server.ts)
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Tools 임포트
import { keywordsAddTool, executeKeywordsAdd } from "./tools/keywords";
import { rankingsGetCurrentTool, executeRankingsGetCurrent } from "./tools/rankings";
// ... 기타 tools

const server = new Server(
  {
    name: "charles-mvp-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {}
    },
  }
);

// Tools 등록
const tools = [
  keywordsAddTool,
  rankingsGetCurrentTool,
  // ... 모든 tools
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "keywords_add":
      return executeKeywordsAdd(args);
    case "rankings_get_current":
      return executeRankingsGetCurrent(args);
    // ... 모든 tool handlers
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Charles MCP Server running on stdio");
}

main().catch(console.error);
```

#### React UI 통합 (AIChatPanel.tsx)
```typescript
import { useState } from "react";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { useQuery, useMutation } from "@tanstack/react-query";

export function AIChatPanel() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      // MCP 클라이언트를 통해 AI에게 메시지 전송
      const response = await mcpClient.chat({
        messages: [...messages, { role: "user", content: message }],
        tools: tools // 사용 가능한 tools 전달
      });

      return response;
    },
    onSuccess: (response) => {
      setMessages(prev => [
        ...prev,
        { role: "user", content: input },
        { role: "assistant", content: response.content }
      ]);
      setInput("");
    }
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage.mutate(input)}
            placeholder="AI에게 질문하세요... (예: 순위가 떨어진 키워드 분석해줘)"
            className="flex-1 border rounded-lg px-4 py-2"
          />
          <button
            onClick={() => sendMessage.mutate(input)}
            disabled={!input || sendMessage.isPending}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 제안 2: 백엔드 MCP 서버

### 🎯 적합한 경우
- 여러 클라이언트(웹, 모바일, 외부 AI 도구)에서 접근 필요
- 중앙 집중식 AI 관리
- API로 MCP 기능 제공하고 싶은 경우

### 🏗️ 아키텍처

```typescript
// backend/src/mcp/
├── server.ts              // MCP 서버 (SSE 또는 WebSocket)
├── tools/                 // 백엔드에서 직접 DB 접근
│   ├── keywords.ts
│   ├── rankings.ts
│   └── analytics.ts
└── auth/
    └── middleware.ts      // API 키 인증
```

### 🔧 구현 방식

#### SSE 기반 MCP 서버
```typescript
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const mcpServer = new Server({
  name: "charles-backend-mcp",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

// MCP SSE 엔드포인트
app.get("/mcp/sse", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/messages", res);
  await mcpServer.connect(transport);
});

app.post("/mcp/messages", async (req, res) => {
  // MCP 메시지 처리
});

app.listen(3001, () => {
  console.log("MCP Server running on port 3001");
});
```

### 🌐 외부 연동 예시

**Claude Desktop 설정**
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "charles-mvp": {
      "url": "http://localhost:3001/mcp/sse",
      "apiKey": "your-api-key"
    }
  }
}
```

**사용 예시**
```
[Claude Desktop에서]
User: Charles 시스템에서 "AI 챗봇" 키워드의 순위를 조회해줘.

Claude: [rankings_get_history 실행]

        "AI 챗봇" 키워드의 최근 순위:
        - 현재: 8위
        - 어제: 7위 (-1)
        - 일주일 전: 5위 (-3)

        최근 하락 추세가 보입니다.
```

### ⚖️ 장단점

**장점:**
- 다중 클라이언트 지원
- 중앙화된 AI 로직
- 확장성 우수

**단점:**
- 백엔드 복잡도 증가
- 추가 인증 구현 필요
- 네트워크 의존성

---

## 제안 3: AI 에이전트 서비스 레이어

### 🎯 적합한 경우
- **자율 실행 AI 에이전트**가 필요한 경우
- 사용자 개입 없이 주기적으로 분석/알림 수행
- 고급 AI 기능 (Multi-agent 협업)

### 🏗️ 아키텍처

```typescript
// ai-service/
├── agents/
│   ├── keyword-optimizer.agent.ts     // 키워드 최적화 에이전트
│   ├── alert-manager.agent.ts         // 스마트 알림 에이전트
│   ├── competitor-analyzer.agent.ts   // 경쟁사 분석 에이전트
│   └── report-generator.agent.ts      // 리포트 생성 에이전트
├── orchestrator/
│   └── agent-manager.ts               // 에이전트 스케줄링 및 관리
├── mcp/
│   ├── tools/                         // MCP Tools
│   └── server.ts
└── workflows/
    ├── daily-analysis.workflow.ts
    └── weekly-report.workflow.ts
```

### 🤖 자율 에이전트 예시

#### 1. Keyword Optimizer Agent
```typescript
/**
 * 매일 오전 9시 실행
 * - 전일 순위 데이터 분석
 * - 목표 미달 키워드 식별
 * - 최적화 제안 생성
 * - Slack/이메일로 알림
 */
class KeywordOptimizerAgent {
  async run() {
    // 1. 데이터 수집
    const underperforming = await this.tools.analytics_underperforming();

    // 2. AI 분석
    const analysis = await this.llm.analyze({
      prompt: "다음 키워드들의 순위가 목표에 미달합니다. 원인과 해결책을 제시하세요.",
      data: underperforming
    });

    // 3. 액션 제안
    const actions = this.generateActions(analysis);

    // 4. 알림 전송
    await this.notify(actions);
  }
}
```

#### 2. Alert Manager Agent
```typescript
/**
 * 실시간 모니터링 (WebSocket 연결)
 * - 순위 변동 감지
 * - 중요도 판단 (AI)
 * - 중요한 변동만 사용자에게 알림
 */
class AlertManagerAgent {
  async onRankingUpdate(event) {
    const { keywordId, oldRank, newRank } = event;

    // AI가 중요도 판단
    const isImportant = await this.llm.evaluate({
      prompt: `
        키워드 순위 변동:
        - 이전: ${oldRank}위
        - 현재: ${newRank}위
        - 변동: ${newRank - oldRank}위
        - 최근 트렌드: [데이터]

        이 변동이 사용자에게 알릴 만큼 중요한가? (예/아니오로 답하고 이유 설명)
      `
    });

    if (isImportant.decision === "예") {
      await this.sendAlert({
        keyword: event.keyword,
        reason: isImportant.reason
      });
    }
  }
}
```

#### 3. Competitor Analyzer Agent
```typescript
/**
 * 주 1회 실행 (일요일 밤)
 * - 상위 랭킹 경쟁사 URL 수집
 * - 경쟁사 컨텐츠 분석 (Web Scraping + AI)
 * - 우리와의 차이점 분석
 * - 개선 제안
 */
class CompetitorAnalyzerAgent {
  async run() {
    const keywords = await this.tools.keywords_list();

    for (const keyword of keywords) {
      // 네이버 검색 결과 상위 10개 수집
      const topResults = await this.crawl(keyword.keyword);

      // 우리 순위보다 상위 경쟁사만 분석
      const competitors = topResults.filter(r => r.rank < keyword.last_rank);

      // 각 경쟁사 페이지 분석
      const analysis = await this.analyzeCompetitors(competitors);

      // 리포트 생성
      await this.generateCompetitorReport(keyword, analysis);
    }
  }
}
```

### 🔄 워크플로우 예시

```typescript
// workflows/daily-analysis.workflow.ts
export const dailyAnalysisWorkflow = {
  name: "Daily Analysis",
  schedule: "0 9 * * *", // 매일 오전 9시

  steps: [
    {
      agent: "KeywordOptimizerAgent",
      action: "analyze"
    },
    {
      agent: "AlertManagerAgent",
      action: "summarize_yesterday"
    },
    {
      agent: "ReportGeneratorAgent",
      action: "daily_brief",
      config: {
        recipients: ["user@example.com"]
      }
    }
  ]
};
```

### 🌐 배포 옵션

```yaml
# docker-compose.yml
services:
  ai-service:
    build: ./ai-service
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - BACKEND_URL=http://backend:3000
    depends_on:
      - backend
      - redis
```

### ⚖️ 장단점

**장점:**
- 완전 자율 실행
- 고급 AI 기능
- 다양한 LLM 모델 조합 가능
- 사용자 개입 최소화

**단점:**
- 구현 복잡도 매우 높음
- AI API 비용 발생 (GPT-4 등)
- 별도 서버 관리 필요
- 오버 엔지니어링 위험

---

## 구현 로드맵

### 🎯 Phase 1: MVP (2-3주)
**목표:** 클라이언트 MCP 통합 - 기본 Tool 제공

- [ ] MCP SDK 설정 및 서버 구현
- [ ] 핵심 Tools 구현 (5개)
  - [ ] `keywords_add`, `keywords_search`
  - [ ] `rankings_get_current`, `rankings_get_history`
  - [ ] `analytics_trend_analysis`
- [ ] Electron UI에 AI 채팅 패널 추가
- [ ] 기본 프롬프트 템플릿 작성
- [ ] 테스트 및 문서화

**성공 기준:**
- AI에게 자연어로 키워드 추가/조회 가능
- 순위 트렌드 분석 가능

---

### 🚀 Phase 2: 확장 (3-4주)
**목표:** 고급 분석 및 자동화

- [ ] 추가 Tools 구현 (10개)
  - [ ] `analytics_underperforming`, `analytics_volatility`
  - [ ] `crawl_trigger_priority`, `crawl_queue_status`
  - [ ] `export_to_excel`, `generate_report`
- [ ] Prompts 고도화
  - [ ] 경쟁사 분석 프롬프트
  - [ ] 최적화 제안 프롬프트
  - [ ] 주간/월간 리포트 프롬프트
- [ ] Tool 실행 결과 시각화 UI
- [ ] 에러 핸들링 및 로깅

**성공 기준:**
- AI가 복합적인 분석 요청 처리 가능
- 자동 리포트 생성 가능

---

### 🌟 Phase 3: 자율 에이전트 (4-6주)
**목표:** AI 에이전트 서비스 레이어 추가 (선택)

- [ ] AI 서비스 서버 구축
- [ ] 자율 에이전트 구현
  - [ ] Keyword Optimizer Agent
  - [ ] Alert Manager Agent
  - [ ] Report Generator Agent
- [ ] Workflow 엔진 구현
- [ ] 에이전트 모니터링 대시보드
- [ ] Slack/Email 통합

**성공 기준:**
- 사용자 개입 없이 일일 분석 수행
- 중요한 순위 변동 자동 알림

---

## 기술 스택 및 의존성

### 📦 새로 추가할 패키지

#### 클라이언트 (제안 1)
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@anthropic-ai/sdk": "^0.20.0",  // Claude API (옵션)
    "openai": "^4.0.0",               // OpenAI API (옵션)
    "marked": "^11.0.0",              // Markdown 렌더링
    "highlight.js": "^11.9.0"         // 코드 하이라이팅
  }
}
```

#### 백엔드 (제안 2)
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

#### AI 서비스 (제안 3)
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "langchain": "^0.1.0",            // Multi-agent 프레임워크
    "cheerio": "^1.0.0-rc.12",        // 경쟁사 스크래핑
    "playwright": "^1.40.0",          // 고급 스크래핑
    "bull": "^4.12.0",                // 에이전트 스케줄링
    "nodemailer": "^6.9.0",           // 이메일 알림
    "@slack/web-api": "^6.11.0"       // Slack 알림
  }
}
```

### 🔑 환경 변수

```env
# .env.example

# AI API Keys (하나 이상 필요)
ANTHROPIC_API_KEY=sk-ant-...        # Claude
OPENAI_API_KEY=sk-...               # GPT-4
GOOGLE_AI_API_KEY=...               # Gemini

# MCP 설정
MCP_SERVER_PORT=3001
MCP_AUTH_TOKEN=your-secret-token

# AI Agent 설정 (제안 3)
AI_SERVICE_ENABLED=true
AGENT_SCHEDULE_ENABLED=true
ALERT_EMAIL=admin@example.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# 기존 설정 (유지)
DATABASE_URL=...
REDIS_URL=...
```

---

## 비용 추정

### 💰 AI API 사용 비용 (월간)

#### 시나리오 1: 소규모 사용 (개인/소기업)
- **사용량:** 월 1,000 AI 요청
- **Claude Sonnet:** $3/M tokens × 평균 2K tokens = **$6/월**
- **GPT-4o mini:** $0.15/M tokens × 평균 2K tokens = **$0.30/월**

#### 시나리오 2: 중규모 사용 (중소기업)
- **사용량:** 월 10,000 AI 요청
- **Claude Sonnet:** **$60/월**
- **GPT-4o:** **$150/월** (고급 분석 필요 시)

#### 시나리오 3: 자율 에이전트 활성화
- **일일 분석:** 100개 키워드 × 매일 = **$30/월**
- **실시간 알림:** 평균 50회/일 = **$15/월**
- **주간 리포트:** 4회/월 = **$5/월**
- **합계:** **$50~100/월**

### 💡 비용 절감 방안
- 로컬 LLM 사용 (Ollama + Llama 3.1)
- 캐싱 활용
- 간단한 분석은 룰 기반으로 처리

---

## 결론 및 추천사항

### ⭐ 최종 추천: **제안 1 (클라이언트 MCP 통합)** + **선택적 제안 3 (에이전트)**

#### 1단계: 클라이언트 MCP (필수)
- **기간:** 2-3주
- **비용:** 최소 ($6~20/월)
- **효과:** 즉각적인 UX 개선

#### 2단계: AI 에이전트 (선택)
- **기간:** 4-6주 (1단계 이후)
- **비용:** 추가 $50~100/월
- **효과:** 자동화된 인사이트

### 🎯 기대 효과

1. **사용자 경험 혁신**
   - 복잡한 데이터 조회를 자연어로 수행
   - AI가 데이터 패턴 자동 발견

2. **업무 효율 향상**
   - 수동 분석 시간 70% 절감
   - 중요한 변동 자동 감지

3. **의사결정 품질 개선**
   - AI 기반 인사이트 제공
   - 경쟁사 분석 자동화

4. **제품 차별화**
   - AI 네이티브 키워드 모니터링 도구
   - 시장 선점 기회

---

## 다음 단계

1. **프로토타입 개발** (1주)
   - 3개 핵심 Tool 구현
   - 간단한 채팅 UI

2. **내부 테스트** (1주)
   - 실제 키워드 데이터로 검증
   - 프롬프트 튜닝

3. **베타 출시** (2주)
   - 사용자 피드백 수집
   - 추가 Tool 우선순위 결정

4. **정식 릴리스** (4주)
   - 문서화 완성
   - 마케팅 자료 준비

---

**문의사항이나 추가 논의가 필요하시면 언제든 말씀해 주세요!**
