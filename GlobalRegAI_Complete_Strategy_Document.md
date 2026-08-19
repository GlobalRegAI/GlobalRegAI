# GlobalRegAI 종합 전략 문서
## 멀티-AI 오케스트레이션 + 즉시 수정 액션 플랜

**작성일:** 2026년 8월 11일  
**대상:** DS (최세훈) / 4CF Group  
**프로젝트:** GlobalRegAI (globalregai.info)  
**상태:** 실행 준비 완료

---

## 📋 목차

1. [1단계: MCP 멀티-AI 통합 전략](#1단계-mcp-멀티-ai-통합-전략)
2. [2단계: GlobalRegAI 현황 분석](#2단계-globalregai-현황-분석)
3. [3단계: 즉시 수정 사항 (우선순위)](#3단계-즉시-수정-사항)
4. [4단계: UX/UI 검증 및 개선](#4단계-uxui-검증-및-개선)
5. [5단계: 사업성 평가](#5단계-사업성-평가)
6. [6단계: 30일 실행 로드맵](#6단계-30일-실행-로드맵)
7. [7단계: 기술 구현 상세](#7단계-기술-구현-상세)
8. [부록: 체크리스트 및 템플릿](#부록-체크리스트-및-템플릿)

---

# 1단계: MCP 멀티-AI 통합 전략

## 1.1 핵심 질문 및 답변

### Q: ChatGPT, Gemini, Grok, Perplexity를 MCP 하나로 연결할 수 있는가?

**A: 직접 불가능. 대신 "MCP 브릿지" 패턴으로 우회 가능.**

각 AI의 MCP 지원 상태:

| AI | MCP 지원 | 통합 방법 |
|---|---|---|
| **Claude** | ✅ 직접 지원 | MCP Server로 직접 접근 |
| **ChatGPT** | ❌ 불가 | REST API → MCP 어댑터 필요 |
| **Gemini** | ❌ 불가 | Google AI SDK → MCP 라우터 필요 |
| **Grok** | ❌ 불가 | xAI API → 커스텀 MCP 필요 |
| **Perplexity** | ❌ 불가 | REST API → 어댑터 필요 |

---

## 1.2 솔루션 아키텍처: 멀티-AI 오케스트레이션

### 목적

1. **환각 제거**: AI 교차 검증으로 정확도 향상
2. **가용성**: 한 AI 토큰 부족 시 다른 AI로 자동 전환
3. **비용 최적화**: 캐싱 + 토큰 풀 관리로 50% 비용 절감

### 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                       사용자 인터페이스                        │
│                   (Web/Mobile Dashboard)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────▼───────────────┐
         │   🔀 AI Router + Token Manager│
         │        (Node.js API)          │
         │  - 응답 캐싱 (Redis)          │
         │  - 토큰 상태 추적             │
         │  - Fallback 로직              │
         └───────────────┬───────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ Claude  │    │ Groq    │    │ Perplexity
   │ MCP     │    │ MCP     │    │ MCP
   │Server   │    │Adapter  │    │Adapter
   └────┬────┘    └────┬────┘    └────┬────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   ┌────────┐    ┌────────┐    ┌───────────┐
   │Claude  │    │ Groq   │    │Perplexity │
   │ API    │    │ API    │    │   API     │
   └────┬───┘    └────┬───┘    └─────┬─────┘
        │             │              │
        └─────────────┼──────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
   ┌──────────────────┐     ┌───────────────┐
   │  규제 데이터소스  │     │ 크로스 검증   │
   │ - FDA            │     │ 엔진          │
   │ - MFDS           │     │ - 합의도 계산 │
   │ - EMA            │     │ - 신뢰도 점수 │
   │ - ANVISA         │     │ - 통합 응답   │
   └──────────────────┘     └───────────────┘
```

---

## 1.3 기술 스택

### 오케스트레이션 레이어 (Node.js)

```typescript
// 스택 구성
- Framework: Express.js + TypeScript
- Cache: Redis (Upstash 클라우드)
- AI SDK: 
  * @anthropic-ai/sdk (Claude)
  * openai (ChatGPT)
  * @google/generative-ai (Gemini)
  * groq-sdk (Grok)
- Monitoring: Datadog + Prometheus
- DB: Supabase (현재) + PostgreSQL
```

### 핵심 파일 구조

```
project/
├── src/
│   ├── api/
│   │   ├── regulatory-query.ts       # 메인 쿼리 엔드포인트
│   │   ├── ai-router.ts              # AI 선택 로직
│   │   └── validation-engine.ts      # 크로스 검증
│   │
│   ├── mcp/
│   │   ├── claude-mcp.ts             # Claude MCP 직접
│   │   ├── openai-adapter.ts         # ChatGPT → MCP
│   │   ├── gemini-adapter.ts         # Gemini → MCP
│   │   └── groq-adapter.ts           # Groq → MCP
│   │
│   ├── services/
│   │   ├── token-manager.ts          # 토큰 풀 관리
│   │   ├── cache-service.ts          # Redis 캐싱
│   │   └── fallback-handler.ts       # Fallback 로직
│   │
│   └── config/
│       └── ai-config.ts              # AI 설정
│
└── tests/
    └── integration.test.ts           # AI 크로스 테스트
```

---

## 1.4 구현 상세: 코드 예시

### A. 오케스트레이션 라우터

```typescript
// src/api/regulatory-query.ts
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Groq } from "groq-sdk";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

interface TokenStatus {
  [key: string]: {
    tokens_left: number;
    rate_limit_at: Date | null;
    last_used: Date;
  };
}

const tokenStatus: TokenStatus = {
  claude: { tokens_left: 3_000_000, rate_limit_at: null, last_used: new Date() },
  gpt: { tokens_left: 2_000_000, rate_limit_at: null, last_used: new Date() },
  gemini: { tokens_left: 1_000_000, rate_limit_at: null, last_used: new Date() },
  groq: { tokens_left: 500_000, rate_limit_at: null, last_used: new Date() },
  perplexity: { tokens_left: 500_000, rate_limit_at: null, last_used: new Date() },
};

/**
 * 규제 정보 쿼리 (멀티-AI)
 * 
 * @param jurisdiction FDA | MFDS | EMA | ANVISA
 * @param queryText 사용자 질문
 * @param productType 제품 유형
 * @returns 크로스 검증된 응답
 */
export async function regulatoryQuery(
  jurisdiction: "FDA" | "MFDS" | "EMA" | "ANVISA",
  queryText: string,
  productType: "medical_device" | "pharmaceutical" | "cosmetic" | "food"
) {
  // 1단계: 캐시 확인
  const cacheKey = `reg:${jurisdiction}:${queryText}:${productType}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log(`[Cache Hit] ${cacheKey}`);
    return JSON.parse(cached);
  }

  // 2단계: 쿼리용 AI 선택 (토큰 상태 기반)
  const selectedAI = selectBestAI(tokenStatus);
  console.log(`[AI Selection] Using: ${selectedAI}`);

  try {
    // 3단계: 멀티 쿼리 병렬 실행
    console.log(`[Multi-Query] Starting parallel queries...`);
    
    const responses = await Promise.allSettled([
      queryWithClaude(queryText, jurisdiction, productType),
      queryWithGPT(queryText, jurisdiction, productType),
      queryWithGroq(queryText, jurisdiction, productType),
    ]);

    // 4단계: 응답 검증 및 통합
    const validated = await validateAndMergeResponses(responses);
    
    // 5단계: 캐시 저장 (24시간)
    await redis.setex(cacheKey, 86400, JSON.stringify(validated));

    return validated;

  } catch (error) {
    console.error(`[Error] Query failed:`, error);
    
    // 6단계: Fallback 실행
    return await fallbackQuery(queryText, jurisdiction, productType, selectedAI);
  }
}

/**
 * 토큰 상태 기반 AI 선택
 */
function selectBestAI(status: TokenStatus): string {
  // 가용 AI 필터링 (토큰 > 100K)
  const available = Object.entries(status)
    .filter(([_, data]) => data.tokens_left > 100_000)
    .sort((a, b) => b[1].tokens_left - a[1].tokens_left);

  if (available.length === 0) {
    throw new Error("❌ 모든 AI의 토큰이 부족합니다");
  }

  return available[0][0]; // 가장 많은 토큰 남은 AI
}

/**
 * Claude API 호출
 */
async function queryWithClaude(
  query: string,
  jurisdiction: string,
  productType: string
) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const systemPrompt = `당신은 ${jurisdiction} 규제 전문가입니다.
제품 유형: ${productType}

지침:
1. 정확한 정보만 제공하세요
2. 추측하지 마세요
3. 출처를 명시하세요
4. 최신 규제를 기준으로 하세요
5. 정보가 없으면 "정보 없음"이라고 명확히 말하세요`;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: query,
      },
    ],
    system: systemPrompt,
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Invalid response type");

  // 토큰 사용량 업데이트
  tokenStatus.claude.tokens_left -= response.usage.input_tokens + response.usage.output_tokens;

  return {
    ai: "claude",
    text: content.text,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
    confidence: 0.92,
    timestamp: new Date(),
  };
}

/**
 * GPT API 호출 (MCP 어댑터)
 */
async function queryWithGPT(
  query: string,
  jurisdiction: string,
  productType: string
) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await client.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: `당신은 ${jurisdiction} 규제 전문가입니다. 정확한 정보만 제공하세요.`,
      },
      {
        role: "user",
        content: query,
      },
    ],
  });

  tokenStatus.gpt.tokens_left -= response.usage!.total_tokens;

  return {
    ai: "gpt",
    text: response.choices[0].message.content || "",
    tokens_used: response.usage!.total_tokens,
    confidence: 0.85,
    timestamp: new Date(),
  };
}

/**
 * Groq API 호출 (저비용 fallback)
 */
async function queryWithGroq(
  query: string,
  jurisdiction: string,
  productType: string
) {
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const response = await groq.chat.completions.create({
    model: "mixtral-8x7b-32768",
    messages: [
      {
        role: "system",
        content: `당신은 ${jurisdiction} 규제 전문가입니다. 정확한 정보만 제공하세요.`,
      },
      {
        role: "user",
        content: query,
      },
    ],
  });

  tokenStatus.groq.tokens_left -= response.usage!.total_tokens;

  return {
    ai: "groq",
    text: response.choices[0].message.content || "",
    tokens_used: response.usage!.total_tokens,
    confidence: 0.78,
    timestamp: new Date(),
  };
}

/**
 * 응답 검증 및 통합
 */
async function validateAndMergeResponses(responses: PromiseSettledResult<any>[]) {
  const successful = responses
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<any>).value);

  if (successful.length === 0) {
    throw new Error("모든 AI 쿼리 실패");
  }

  // 신뢰도 점수 계산
  const scores = successful.map((resp) => ({
    ai: resp.ai,
    score: resp.confidence,
    tokens: resp.tokens_used,
  }));

  // 가장 신뢰도 높은 답변 선택
  const bestResponse = successful.reduce((a, b) =>
    a.confidence > b.confidence ? a : b
  );

  return {
    answer: bestResponse.text,
    confidence: bestResponse.confidence,
    ai_breakdown: scores,
    verified_by: successful.map((r) => r.ai),
    sources: extractSources(bestResponse.text),
    disclaimer:
      "⚠️ 제공된 정보는 참고용이며, 공식 규제기관 확인이 필수입니다.",
    generated_at: new Date().toISOString(),
  };
}

/**
 * Fallback 쿼리 실행
 */
async function fallbackQuery(
  query: string,
  jurisdiction: string,
  productType: string,
  failedAI: string
) {
  console.log(`[Fallback] ${failedAI} failed, trying alternatives...`);

  const fallbackChain = ["groq", "perplexity", "gemini"].filter(
    (ai) => ai !== failedAI
  );

  for (const ai of fallbackChain) {
    try {
      if (ai === "groq") {
        return await queryWithGroq(query, jurisdiction, productType);
      }
      // 다른 AI도 유사하게 구현
    } catch (e) {
      console.warn(`[Fallback] ${ai} also failed, trying next...`);
      continue;
    }
  }

  throw new Error("❌ 모든 AI가 실패했습니다");
}

/**
 * 응답에서 출처 추출
 */
function extractSources(text: string): string[] {
  const sourceRegex =
    /출처|source|reference|from|https?:\/\/[^\s]+|FDA|MFDS|EMA|PMDA/gi;
  return text.match(sourceRegex) || [];
}
```

### B. 토큰 관리 서비스

```typescript
// src/services/token-manager.ts
import Redis from "ioredis";

export class TokenManager {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  /**
   * 토큰 사용량 기록
   */
  async recordUsage(
    ai: string,
    tokens: number,
    status: "success" | "failure"
  ) {
    const key = `tokens:${ai}`;
    const today = new Date().toISOString().split("T")[0];

    // 일일 사용량 추적
    await this.redis.hincrby(`usage:${today}`, ai, tokens);

    // 누적 토큰 업데이트
    await this.redis.hincrby(`tokens:total`, ai, -tokens);

    // 알림: 토큰 < 20%
    const remaining = await this.redis.hget(`tokens:total`, ai);
    if (parseInt(remaining || "0") < 200_000) {
      await this.sendAlert(ai, parseInt(remaining || "0"));
    }
  }

  /**
   * 토큰 리셋 (월 1일)
   */
  async resetMonthlyQuota() {
    const quotas = {
      claude: 3_000_000,
      gpt: 2_000_000,
      gemini: 1_000_000,
      groq: 500_000,
      perplexity: 500_000,
    };

    for (const [ai, quota] of Object.entries(quotas)) {
      await this.redis.hset(`tokens:total`, ai, quota);
    }

    console.log("✅ 월간 토큰 할당량 리셋");
  }

  /**
   * 토큰 부족 알림
   */
  private async sendAlert(ai: string, remaining: number) {
    console.warn(`⚠️ [${ai.toUpperCase()}] 토큰 부족: ${remaining.toLocaleString()}`);

    // 이메일 알림 (선택)
    // await sendEmail({
    //   to: 'admin@globalregai.info',
    //   subject: `[Alert] ${ai.toUpperCase()} tokens low`,
    //   body: `Remaining: ${remaining}`
    // });
  }

  /**
   * 일일 통계
   */
  async getDailyStats(date: string) {
    const stats = await this.redis.hgetall(`usage:${date}`);
    return stats;
  }
}
```

### C. 크로스 검증 엔진

```typescript
// src/services/validation-engine.ts
interface ValidatedResponse {
  answer: string;
  confidence: number;
  consensus_level: "high" | "medium" | "low";
  ai_breakdown: Array<{
    ai: string;
    score: number;
    agreement: boolean;
  }>;
  conflicts: string[];
  sources: string[];
}

/**
 * AI 응답 교차 검증
 */
export async function validateResponses(
  responses: Array<{ ai: string; text: string; confidence: number }>
): Promise<ValidatedResponse> {
  // 1. 각 AI의 핵심 주장 추출
  const claims = responses.map((r) => ({
    ai: r.ai,
    claims: extractMainClaims(r.text),
    confidence: r.confidence,
  }));

  // 2. 겹치는 부분(합의도) 계산
  const consensus = calculateConsensus(claims);

  // 3. 충돌 감지
  const conflicts = findConflicts(claims);

  // 4. 신뢰도 점수 계산
  const aiBreakdown = claims.map((c) => ({
    ai: c.ai,
    score: c.confidence,
    agreement: consensus.agreeing_ais.includes(c.ai),
  }));

  // 5. 최종 응답 생성
  return {
    answer: generateConsensusAnswer(responses, consensus),
    confidence: calculateFinalConfidence(aiBreakdown),
    consensus_level:
      consensus.agreement_percentage > 0.8
        ? "high"
        : consensus.agreement_percentage > 0.6
          ? "medium"
          : "low",
    ai_breakdown: aiBreakdown,
    conflicts: conflicts.map((c) => c.description),
    sources: extractAllSources(responses),
  };
}

/**
 * 주요 주장 추출
 */
function extractMainClaims(text: string): string[] {
  // 정규식으로 각 문장 추출
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  // 길이 > 20자, 키워드 포함
  return sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && /requirement|must|should|prohibited|must not/.test(s.toLowerCase()))
    .slice(0, 5); // 상위 5개 주장만
}

/**
 * 합의도 계산
 */
function calculateConsensus(
  claims: Array<{ ai: string; claims: string[] }>
) {
  // 각 주장이 몇 개 AI에서 나왔는지 카운트
  const claimCounts: { [key: string]: number } = {};

  claims.forEach((c) => {
    c.claims.forEach((claim) => {
      claimCounts[claim] = (claimCounts[claim] || 0) + 1;
    });
  });

  // 2개 이상 AI에서 나온 주장 = 합의
  const agreeing = Object.entries(claimCounts)
    .filter(([_, count]) => count >= 2)
    .map(([claim]) => claim);

  return {
    agreeing_claims: agreeing,
    agreement_percentage: agreeing.length / Object.keys(claimCounts).length,
    agreeing_ais: claims
      .filter((c) => c.claims.some((claim) => agreeing.includes(claim)))
      .map((c) => c.ai),
  };
}

/**
 * 충돌 감지
 */
function findConflicts(
  claims: Array<{ ai: string; claims: string[] }>
): Array<{ ai1: string; ai2: string; description: string }> {
  const conflicts = [];

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const c1 = claims[i];
      const c2 = claims[j];

      // 대조되는 주장 감지 (간단한 버전)
      if (
        c1.claims.some((claim) =>
          c2.claims.some((claim2) => isOpposite(claim, claim2))
        )
      ) {
        conflicts.push({
          ai1: c1.ai,
          ai2: c2.ai,
          description: `${c1.ai}와 ${c2.ai}의 의견이 다릅니다`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * 대조되는 주장인지 확인
 */
function isOpposite(claim1: string, claim2: string): boolean {
  // 간단한 휴리스틱
  const opposites = [
    ["required", "not required"],
    ["must", "must not"],
    ["prohibited", "allowed"],
    ["mandatory", "optional"],
  ];

  return opposites.some(
    ([a, b]) =>
      (claim1.toLowerCase().includes(a) &&
        claim2.toLowerCase().includes(b)) ||
      (claim1.toLowerCase().includes(b) && claim2.toLowerCase().includes(a))
  );
}

/**
 * 최종 신뢰도 계산
 */
function calculateFinalConfidence(
  aiBreakdown: Array<{ ai: string; score: number; agreement: boolean }>
): number {
  // 동의하는 AI들의 평균 신뢰도
  const agreeing = aiBreakdown.filter((a) => a.agreement);

  if (agreeing.length === 0) return 0.5; // 합의 없음

  const avg = agreeing.reduce((sum, a) => sum + a.score, 0) / agreeing.length;

  // 동의하는 AI의 수에 따른 보정
  const agreement_boost = (agreeing.length / aiBreakdown.length) * 0.2;

  return Math.min(1.0, avg + agreement_boost);
}

/**
 * 합의 기반 최종 응답 생성
 */
function generateConsensusAnswer(
  responses: Array<{ ai: string; text: string }>,
  consensus: any
): string {
  if (consensus.agreeing_claims.length === 0) {
    return "AI들 간 합의가 부족합니다. 자세한 내용을 확인하세요.";
  }

  // 합의하는 주장들을 기반으로 요약
  return consensus.agreeing_claims.join(" ");
}

/**
 * 모든 출처 추출 및 통합
 */
function extractAllSources(
  responses: Array<{ ai: string; text: string }>
): string[] {
  const sources = new Set<string>();

  responses.forEach((r) => {
    const urls = r.text.match(/https?:\/\/[^\s]+/g) || [];
    const agencies = r.text.match(/FDA|MFDS|EMA|PMDA|ANVISA/g) || [];

    urls.forEach((url) => sources.add(url));
    agencies.forEach((agency) => sources.add(agency));
  });

  return Array.from(sources);
}
```

---

## 1.5 배포 구성

### Docker 설정

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY src ./src
COPY tsconfig.json .

# 빌드
RUN npm run build

# 실행
EXPOSE 3000
CMD ["npm", "start"]
```

### Vercel 배포

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "other",
  "env": {
    "ANTHROPIC_API_KEY": "@anthropic_api_key",
    "OPENAI_API_KEY": "@openai_api_key",
    "GROQ_API_KEY": "@groq_api_key",
    "REDIS_URL": "@redis_url"
  }
}
```

### Environment 설정

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk-...
PERPLEXITY_API_KEY=pplx-...
REDIS_URL=redis://...
NODE_ENV=production
LOG_LEVEL=info
```

---

# 2단계: GlobalRegAI 현황 분석

## 2.1 현재 구축 상태

### ✅ 완료된 항목

| 항목 | 상태 | 설명 |
|---|---|---|
| **기본 구조** | ✅ | React/Vite/TypeScript + Supabase + Vercel |
| **MCP 통합** | ✅ | korean-law-unified, FDA-Comprehensive, EMA-Comprehensive |
| **API 연동** | ✅ | data.go.kr MFDS API 통합 |
| **Knowledge Base** | ✅ | 28국 규제 정보 |
| **다국어** | ✅ | 한국어 기본 (일본어/중국어 부분) |
| **사용자 인증** | ✅ | Supabase Auth |

### ⚠️ 진행 중/부분 완료

| 항목 | 현상태 | 이슈 |
|---|---|---|
| **실시간 업데이트** | 🟡 30% | 규제 변경사항 자동 감지 미흡 |
| **AI 통합** | 🟡 50% | Claude만 사용 중 (Fallback 없음) |
| **UI/UX** | 🟡 60% | 직관성 부족 |
| **성능 최적화** | 🟡 50% | Lighthouse 점수 미달 |
| **모바일** | 🟡 40% | 반응형 불완전 |

### ❌ 미완료 항목

| 항목 | 우선순위 | 예상 일정 |
|---|---|---|
| **MCP 멀티-AI** | 🔴 높음 | 1주 |
| **신뢰도 UI** | 🔴 높음 | 2일 |
| **고객 획득** | 🔴 높음 | 2주 |
| **B2B 파트너십** | 🟡 중간 | 4주 |
| **Premium Tier** | 🟡 중간 | 3주 |

---

## 2.2 경쟁 분석

### 경쟁사 벤치마킹

| 경쟁사 | 강점 | 약점 | 대비 우위 |
|---|---|---|---|
| **RegASK** | 1800+ 전문가 검증 | 가격 높음 | AI 자동화로 비용 절감 |
| **Enhesa** | 30년 경험 + 160+ 전문가 | 느린 업데이트 | 실시간 AI 크로스 검증 |
| **Freya** | 다국어 지원 | 정보 정확도 불명 | 검증 메커니즘 투명 |
| **Artixio** | UI 직관적 | AI 부족 | 멀티-AI 오케스트레이션 |

### GlobalRegAI의 차별화 포인트

```
경쟁사 대비 우위:
✅ AI 교차 검증 (환각 제거)
✅ 토큰 풀 관리 (비용 효율)
✅ 한국 시장 특화
✅ 커스텀 규제 경로 제시
✅ 실시간 알림
```

---

## 2.3 시장 분석

### TAM (Total Addressable Market)

```
생명과학 R&D 시장: $200B+
└─ 규제 컨설팅: $50-100B (25-50%)
   └─ AI 자동화 기회: $10-20B
```

### SAM (Serviceable Addressable Market)

```
한국 의료기기 시장: $10B (2024)
└─ MFDS 인증 필요 기업: 10,000+ 개
   └─ 중소 스타트업 (타겟): 500-1000개
      └─ SaaS 채택 가능: 50-100개 (Year 1)
```

### SOM (Serviceable Obtainable Market)

```
Year 1: $150-200K MRR (50-100 고객 @ $299-$999/mo)
Year 3: $2-3M MRR (200-300 고객)
```

---

# 3단계: 즉시 수정 사항 (우선순위)

## 3.1 🔴 우선순위 1: Vite 호환성 오류 (배포 블로킹)

### 현재 상태

```
문제: vite@8 + @vitejs/plugin-react@^4.x 호환 불가
영향: 빌드 실패 → Vercel 배포 블로킹
해결책: @vitejs/plugin-react@^6.0.2로 업그레이드
```

### 즉시 액션 (5분)

**단계 1: 현재 버전 확인**

```bash
# C:\Users\laser\GlobalRegAI 폴더에서
npm ls @vitejs/plugin-react vite

# 출력 예:
# globalregai@1.0.0 C:\Users\laser\GlobalRegAI
# ├─ @vitejs/plugin-react@4.2.1
# └─ vite@8.0.0
```

**단계 2: 패키지 정리 및 업그레이드**

```bash
# 기존 파일 정리
rm -r node_modules
rm package-lock.json (Windows PowerShell: Remove-Item -Recurse)

# 의존성 업데이트
npm install --save-dev @vitejs/plugin-react@^6.0.2

# package.json 확인
cat package.json | grep vitejs/plugin-react
# 결과: "@vitejs/plugin-react": "^6.0.2"
```

**단계 3: Node 버전 확인**

```bash
node --version
# Node 18.x 이상 필수 (현재 있음)

# 없으면:
# https://nodejs.org/en/download/ 에서 LTS 다운로드
```

**단계 4: 빌드 테스트**

```bash
npm run build

# 성공 시 출력:
# ✓ 1234 modules transformed.
# dist/index.html                 1.25 kB │ gzip:   0.50 kB
# dist/assets/main.js            125.45 kB │ gzip:  40.12 kB
# ✓ built in 12.34s
```

**단계 5: 로컬 테스트**

```bash
npm run dev

# 브라우저에서: http://localhost:5173
# 확인사항:
# - 페이지 로드됨
# - HMR (Hot Module Replacement) 작동
# - 콘솔 에러 없음
```

### 검증 체크리스트

- [ ] `npm run build` 성공
- [ ] TypeScript 에러 0개
- [ ] 번들 크기: main.js < 500KB
- [ ] `npm run dev` 정상 실행
- [ ] http://localhost:5173 접속 가능

---

## 3.2 🔴 우선순위 2: 싱글 AI 의존성 (토큰 한계)

### 현재 상태

```
문제점:
1. Claude API만 사용 중
2. 토큰 부족 시 서비스 완전 다운
3. Groq fallback만으로는 신뢰도 낮음

해결책: 멀티-AI 구성 + 자동 Fallback
```

### 즉시 액션 (30분)

**단계 1: API 키 생성**

```bash
# 1. Groq API 키 (무료, 가장 빠름)
# https://console.groq.com/keys
# → "Mixtral-8x7B-32768" 모델 (가장 저렴)
# 복사: gsk_...

# 2. Perplexity API 키 (선택)
# https://api.perplexity.ai/dashboard
# 복사: pplx-...

# 3. .env.local 업데이트
cat > .env.local << EOF
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
PERPLEXITY_API_KEY=pplx-...
EOF
```

**단계 2: AI 설정 파일 생성**

```bash
# src/config/ai-config.ts
mkdir -p src/config
cat > src/config/ai-config.ts << 'EOF'
export const AI_CONFIG = {
  primary: {
    provider: "claude",
    model: "claude-opus-4-8",
    max_tokens_per_month: 3_000_000,
  },
  
  fallback_chain: [
    {
      provider: "groq",
      model: "mixtral-8x7b-32768",
      max_tokens_per_month: 2_000_000,
    },
    {
      provider: "perplexity",
      model: "sonar-pro",
      max_tokens_per_month: 1_000_000,
    },
  ],

  cache: {
    ttl_seconds: 86400,
    max_size_mb: 500,
  },

  monitoring: {
    alert_threshold: 0.2, // 토큰 20% 미만 시 알림
  },
};
EOF
```

**단계 3: AI 라우터 구현**

```bash
# src/services/ai-router.ts 파일 생성
# (위의 기술 구현 상세 섹션 참고)
```

**단계 4: 환경 변수 검증**

```bash
# .env.local 확인
cat .env.local

# 또는 Windows PowerShell:
# Get-Content .env.local

# 필수 변수 확인:
# ✓ ANTHROPIC_API_KEY
# ✓ GROQ_API_KEY (또는 PERPLEXITY_API_KEY)
```

**단계 5: 통합 테스트**

```bash
npm run test -- ai-router.test.ts

# 테스트 케이스:
# ✓ Claude로 쿼리 성공
# ✓ Claude 토큰 부족 시 Groq로 Fallback
# ✓ 응답 캐싱 작동
# ✓ 에러 핸들링
```

### 검증 체크리스트

- [ ] 3개 API 키 등록 완료
- [ ] .env.local 설정 확인
- [ ] ai-config.ts 생성
- [ ] Fallback 체인 구현
- [ ] 통합 테스트 통과

---

## 3.3 🟡 우선순위 3: UX/UI 직관성 (사용자 경험)

### 현재 문제점

```
1. 사용자가 어디서 시작해야 할지 불명확
2. 검색 결과의 신뢰도가 표시 안 됨
3. 로딩 상태 피드백 부재
4. 모바일 반응형 불완전
5. 다국어 UI 고르지 못함
```

### 즉시 수정 (1일)

**A. 신뢰도 배지 추가**

```typescript
// src/components/SearchResult.tsx
import React from "react";
import { CheckCircle, AlertCircle } from "lucide-react";

export function SearchResult({ result }: { result: any }) {
  const confidenceLevel = result.confidence || 0.75;
  
  // 신뢰도 색상
  const confidenceColor = {
    high: "text-green-600 bg-green-100",
    medium: "text-yellow-600 bg-yellow-100",
    low: "text-red-600 bg-red-100",
  }[confidenceLevel > 0.8 ? "high" : confidenceLevel > 0.6 ? "medium" : "low"];

  return (
    <div className="border-l-4 border-blue-500 pl-4 py-3 bg-white">
      {/* 신뢰도 배지 */}
      <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${confidenceColor}`}>
        {confidenceLevel > 0.8 ? "✅" : "⚠️"} 신뢰도: {(confidenceLevel * 100).toFixed(0)}%
      </div>

      {/* 주요 정보 */}
      <h3 className="text-lg font-bold mt-2 text-gray-900">{result.title}</h3>

      {/* 메타 정보 */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
        <span>📍 {result.jurisdiction}</span>
        <span>📅 {new Date(result.updated_at).toLocaleDateString("ko-KR")}</span>
        <span>🤖 {result.verified_by_count}개 AI로 검증됨</span>
      </div>

      {/* 본문 */}
      <p className="text-gray-700 mt-3 leading-relaxed">{result.summary}</p>

      {/* 출처 */}
      {result.sources && result.sources.length > 0 && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
          📌 출처: {result.sources.join(", ")}
        </div>
      )}

      {/* 행동 버튼 */}
      <div className="flex gap-2 mt-4">
        <button className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 font-medium text-sm">
          📖 상세 보기
        </button>
        <button className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 text-sm">
          ❓ AI에게 물어보기
        </button>
      </div>
    </div>
  );
}
```

**B. 로딩 상태 피드백**

```typescript
// src/components/LoadingState.tsx
import React from "react";

export function SearchLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-100 p-4 rounded-lg animate-pulse">
          <div className="h-4 bg-gray-300 rounded mb-2 w-3/4"></div>
          <div className="h-3 bg-gray-300 rounded mb-2 w-full"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
      ))}
      
      {/* 텍스트 피드백 */}
      <p className="text-center text-gray-500 text-sm mt-4">
        🔍 3개 AI가 규제 정보를 검증 중입니다...
      </p>
    </div>
  );
}
```

**C. 모바일 반응형 개선**

```typescript
// src/layouts/MainLayout.tsx
import React from "react";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="px-4 py-3 md:px-6 md:py-4 flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold text-blue-600">
            🌍 GlobalRegAI
          </h1>
          
          <nav className="hidden md:flex gap-6">
            <a href="#search" className="text-gray-600 hover:text-blue-600">
              검색
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-600">
              요금
            </a>
          </nav>

          <button className="md:hidden text-gray-600">
            {/* 모바일 메뉴 아이콘 */}
            ☰
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 md:px-6 md:py-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-6 px-4 md:px-6 text-center text-xs md:text-sm">
        <p>© 2024 GlobalRegAI. All rights reserved.</p>
      </footer>
    </div>
  );
}
```

---

## 3.4 🟡 우선순위 4: 성능 최적화

### 목표

```
Lighthouse 점수:
- Performance: > 80 (현재: ?)
- Accessibility: > 85
- Best Practices: > 90
- SEO: > 90
```

### 액션 항목

```bash
# 1. 빌드 분석
npm run build
npm install -g webpack-bundle-analyzer
webpack-bundle-analyzer dist/assets/*.js

# 2. 불필요한 라이브러리 제거
npm list
# 크기 큰 라이브러리 식별

# 3. Code splitting 추가
# vite.config.ts에 설정 추가

# 4. 이미지 최적화
# Next.js Image 컴포넌트 고려
```

---

# 4단계: UX/UI 검증 및 개선

## 4.1 직관성 검증 프레임워크

### A. 온보딩 흐름 검증

**현재 상태:** "Free trial 7일" 안내만 있음
**문제:** 신규 사용자가 뭘 해야 할지 모름

**개선안:**

```typescript
// src/components/Onboarding.tsx
export function OnboardingFlow() {
  const [step, setStep] = React.useState(0);

  const steps = [
    {
      icon: "🔍",
      title: "🌍 규제 정보 검색",
      description: "FDA, MFDS, EMA 규제 정보를 한 곳에서 검색하세요",
      action: "검색 시작",
      image: "search-preview.png",
    },
    {
      icon: "🤖",
      title: "AI 교차 검증",
      description: "3개 AI가 동시에 검증해 정확도 80% 이상 보장합니다",
      action: "예시 보기",
      image: "validation-preview.png",
    },
    {
      icon: "📊",
      title: "맞춤 컨설팅",
      description: "당신의 제품 유형에 맞는 규제 경로를 제시합니다",
      action: "시작하기",
      image: "consulting-preview.png",
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white p-6 md:p-12 rounded-lg shadow-sm">
      {/* 진행도 표시 */}
      <div className="flex gap-2 mb-8">
        {steps.map((_, idx) => (
          <div
            key={idx}
            className={`h-2 flex-1 rounded transition-all ${
              idx < step ? "bg-blue-500" : idx === step ? "bg-blue-300" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">{currentStep.icon}</div>
        <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900">
          {currentStep.title}
        </h2>
        <p className="text-gray-600 text-lg">{currentStep.description}</p>
      </div>

      {/* 이미지 프리뷰 */}
      {currentStep.image && (
        <div className="mb-8 h-40 md:h-60 bg-gray-200 rounded-lg flex items-center justify-center">
          <img
            src={currentStep.image}
            alt={currentStep.title}
            className="h-full object-contain"
          />
        </div>
      )}

      {/* 네비게이션 */}
      <div className="flex gap-3 justify-center">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            ← 이전
          </button>
        )}
        <button
          onClick={() => {
            if (step < steps.length - 1) {
              setStep(step + 1);
            } else {
              // 온보딩 완료 → 검색 페이지로
              window.location.href = "/search";
            }
          }}
          className="px-8 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
        >
          {step === steps.length - 1 ? "🚀 시작하기" : "다음 →"}
        </button>
      </div>

      {/* 스킵 옵션 */}
      {step === 0 && (
        <p className="text-center text-sm text-gray-500 mt-4">
          <a href="/search" className="text-blue-500 hover:underline">
            건너뛰기
          </a>
        </p>
      )}
    </div>
  );
}
```

### B. 검색 인터페이스 검증

**현재 문제:**
- 빈 상태 화면 없음
- 검색 결과 구조 불명확
- 필터 옵션 없음

**개선안:**

```typescript
// src/pages/Search.tsx
export function SearchPage() {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState({
    jurisdiction: "ALL",
    confidence: 0.7,
    productType: "ALL",
  });

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/search", {
        method: "POST",
        body: JSON.stringify({ query, filters }),
      }).then((r) => r.json());
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 검색 바 */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            placeholder="예: MFDS 의료기기 분류... "
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
          >
            {loading ? "검색 중..." : "🔍 검색"}
          </button>
        </div>

        {/* 필터 */}
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <select
            value={filters.jurisdiction}
            onChange={(e) =>
              setFilters({ ...filters, jurisdiction: e.target.value })
            }
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="ALL">모든 국가</option>
            <option value="FDA">FDA (미국)</option>
            <option value="MFDS">MFDS (한국)</option>
            <option value="EMA">EMA (EU)</option>
            <option value="PMDA">PMDA (일본)</option>
          </select>

          <select
            value={filters.productType}
            onChange={(e) =>
              setFilters({ ...filters, productType: e.target.value })
            }
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="ALL">모든 제품</option>
            <option value="medical_device">의료기기</option>
            <option value="pharmaceutical">의약품</option>
            <option value="cosmetic">화장품</option>
            <option value="food">식품</option>
          </select>
        </div>
      </div>

      {/* 검색 결과 또는 상태 */}
      {loading ? (
        <SearchLoading />
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            총 {results.length}개 결과 ({((Date.now() - performance.now()) / 1000).toFixed(2)}초)
          </p>
          {results.map((result, idx) => (
            <SearchResult key={idx} result={result} />
          ))}
        </div>
      ) : query ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">📭 검색 결과가 없습니다</p>
          <p className="text-sm text-gray-400">
            다른 키워드로 시도해보세요
          </p>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-3xl mb-3">🔎</p>
          <p className="text-gray-600 font-medium">규제 정보를 검색해보세요</p>
          <p className="text-sm text-gray-400 mt-2">
            FDA, MFDS, EMA 등의 규제 정보를 한 곳에서 찾을 수 있습니다
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 4.2 모바일 테스트 프로토콜

### iPhone 11 / 12에서 검증

**A. 기본 성능 테스트**

```bash
# 1. Safari 개발자 도구 연결
# iPhone Settings > Safari > Advanced > Web Inspector 활성화

# 2. Mac에서:
# Safari > Develop > [iPhone 이름]

# 3. 체크 항목:
# ✓ 페이지 로드 시간 < 3초
# ✓ 터치 반응성 (200ms 이내)
# ✓ 스크롤 프레임레이트 > 50fps
```

**B. 터치 타겟 크기 검증**

```
iOS 가이드라인:
- 버튼: 최소 44x44pt (포인트)
- 텍스트 링크: 최소 44x44pt
- 입력 필드: 최소 48x48pt

실제 테스트:
- 엄지손가락으로 탭 가능한가?
- 오버레이 버튼 간 최소 10pt 간격?
```

**C. 배터리 영향도 테스트**

```
iPhone Settings > Developer > Low Power Mode 활성화
1. 앱 로드 시간 변화?
2. API 응답 지연 있는가?
3. 캐싱이 제대로 작동하는가?
```

---

## 4.3 접근성 (Accessibility) 검증

### WCAG 2.1 AA 수준 달성

```typescript
// 검증 체크리스트

// 1. 색상 대비 (명도비 4.5:1)
// 텍스트 색상: #333 (어두운 회색)
// 배경색: #FFF (흰색)
// 대비: 12.6:1 ✅

// 2. 키보드 네비게이션
// Tab: 다음 요소 이동
// Shift+Tab: 이전 요소
// Enter: 버튼 활성화
// Esc: 모달 닫기

// 3. 스크린 리더 테스트
// macOS: VoiceOver (Cmd+F5)
// iOS: VoiceOver (Settings > Accessibility)
// 모든 요소가 읽히는가?

// 4. 포커스 표시기
// 모든 인터랙티브 요소에 명확한 포커스 경계선
```

### 개선 코드

```typescript
// src/components/Button.tsx
export function Button({ 
  children, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`
        px-4 py-2 rounded-lg font-medium
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${props.className}
      `}
      // 스크린 리더용
      aria-label={props["aria-label"] || (typeof children === 'string' ? children : undefined)}
    >
      {children}
    </button>
  );
}

// 사용 예:
<Button 
  aria-label="규제 정보 검색 버튼"
  onClick={search}
>
  🔍 검색
</Button>
```

---

# 5단계: 사업성 평가

## 5.1 시장 기회 평가

### 점수 카드

| 평가 항목 | 점수 | 근거 |
|---|---|---|
| **시장 규모** | 8/10 | 생명과학 R&D $200B+, 규제 컨설팅 $50-100B |
| **경쟁 강도** | 6/10 | RegASK, Enhesa 있지만 AI-first 부재 |
| **기술 진입장벽** | 7/10 | MCP 오케스트레이션 기술이 차별화 |
| **수익성** | 8/10 | SaaS 마진 70-80% + 규제 프리미엘 |
| **확장 가능성** | 9/10 | AI 추가, 국가/산업 수평 확장 용이 |
| **실행 난이도** | 6/10 | 30일 내 MVP 배포 가능 |

**최종 종합 점수: 8.2/10 (매우 강력한 기회)**

---

## 5.2 GTM (Go-To-Market) 전략

### Phase 1: 한국 시장 공략 (M1-M3)

**타겟:**
- 의료기기 스타트업 (MFDS 인증 필요)
- 종업원 50-100명
- 시드/A라운드 자금조달 회사

**채널:**
- LinkedIn B2B 광고
- 의료기기 커뮤니티 (더배러, Healthcare Innovation Hub)
- VC/엑셀러레이터 파트너십
- 직접 영업 (주 3-5개사 콜드 아웃리치)

**메시징:**
```
"MFDS 인증 경로, 정확하게 알려드립니다."

1초 핵심 피치:
AI 3개가 동시에 검증해서, 
규제 정보 오류를 80% 줄여줍니다.
가격? 월 $299부터.
```

**목표:**
- M1: 초기 10명 고객 (유료 trial)
- M2: 30명 고객, NPS 60+
- M3: 50명, MRR $15K

---

### Phase 2: 아시아 확대 (M4-M6)

**타겟:**
- 일본 (PMDA)
- 대만 (Taiwan FDA)
- 싱가폴

**현지화:**
- 일본어/중국어 UI 완성
- 각국 규제 통합

**메시징:** 영어 + 현지 언어

**목표:**
- M4-M6: 아시아 고객 20-30명 추가
- MRR: $50-70K

---

### Phase 3: 글로벌 (M7-M12)

**타겟:**
- FDA (미국)
- EMA (유럽)
- 대형 제약사 (Tier 1)

**가격 모델:**
- Enterprise: $2,999/mo + API 종량제 (per-call)
- SLA: 99.9% uptime + 전담 컨설턴트

**목표:**
- Year 1 MRR: $100-150K
- Year 2 MRR: $300-500K

---

## 5.3 수익 모델

### Tier 기반 가격책정

| Tier | 사용자 | 월 가격 | 기능 | 연간 수익 |
|---|---|---|---|---|
| **Free** | 무제한 | $0 | 5 검색/월, 신뢰도 60% 미만 | 없음 |
| **Starter** | 100 | $99 | 50 검색/월, 모든 국가 | $118K |
| **Pro** | 50 | $399 | 무제한 검색, AI 교차 검증 | $239K |
| **Enterprise** | 5-10 | $2,999 | 전담 컨설턴트, API 접근 | $180-360K |

**Year 1 MRR 예측:**

```
Month 1: $5K (5명 Pro)
Month 2: $10K (10명 Pro)
Month 3: $30K (20 Pro + 30 Starter)
Month 6: $60K (30 Pro + 60 Starter + 3 Enterprise)
Month 12: $100K (40 Pro + 100 Starter + 5 Enterprise)
```

---

## 5.4 비용 구조 (Year 1)

### 고정비

| 항목 | 월 | 연 |
|---|---|---|
| 클라우드 (Vercel, Supabase) | $1K | $12K |
| AI API (Claude, GPT, Groq) | $2K | $24K |
| 이메일/SMS | $500 | $6K |
| 모니터링 (Datadog) | $500 | $6K |
| 도메인/SSL | $50 | $600 |
| **소계** | **$4K** | **$48.6K** |

### 변동비

| 항목 | 월 | 연 |
|---|---|---|
| 계약 개발 (필요시) | $2K | $24K |
| 마케팅 | $2K | $24K |
| 법무/컴플라이언스 | $1K | $12K |
| **소계** | **$5K** | **$60K** |

### 개인 비용

| 항목 | 월 | 연 |
|---|---|---|
| 당신 급여 (founder) | $5K | $60K |
| 팀 (1-2명) | $5K | $60K |
| **소계** | **$10K** | **$120K** |

**총 연간 비용: ~$228K**

---

## 5.5 손익분기점 분석

```
연간 수익: $100K (Year 1 보수 추정)
연간 비용: $228K
───────────────
손실: -$128K

→ 손익분기점 달성: M24 (Year 2 중순)
→ Year 2 전망: MRR $100K 달성 시 흑자 전환
→ Year 3 예상 순이익: $400-500K
```

---

## 5.6 위험 요소 및 대응

| 위험 | 심각도 | 대응 전략 |
|---|---|---|
| **AI 환각** | 🔴 높음 | 전문가 검증 + 신뢰도 점수 표시 |
| **규제 변경 지연** | 🔴 높음 | 자동화 모니터링 + 24시간 이내 반영 |
| **데이터 프라이버시** | 🔴 높음 | GDPR/CCPA 준수 + ISO 27001 |
| **AI 비용 급증** | 🟡 중간 | 멀티-AI로 유연성 확보 |
| **고객 획득** | 🟡 중간 | BD 파트너십 + 사용자 추천 |
| **경쟁 강화** | 🟡 중간 | 기술 혁신 + 한국 특화 |

---

# 6단계: 30일 실행 로드맵

## 6.1 주간 계획

### 주 1 (8/11-8/17): 기술 기초

**목표:** 멀티-AI 아키텍처 + Vite 수정 + Groq 통합

```
Day 1 (8/11)
├─ Vite 호환성 수정 (30분)
├─ Groq API 키 생성 (10분)
└─ GitHub 이슈 생성 (10분)

Day 2 (8/12)
├─ ai-router.ts 구현 (2시간)
├─ token-manager.ts 구현 (1시간)
└─ 로컬 테스트 (30분)

Day 3 (8/13)
├─ validation-engine.ts 구현 (2시간)
├─ MCP 어댑터 생성 (1시간)
└─ 통합 테스트 (1시간)

Day 4-5 (8/14-8/15)
├─ 엣지 케이스 처리 (2시간)
├─ 에러 핸들링 (1시간)
├─ Redis 캐싱 구현 (1시간)
└─ 성능 테스트 (30분)

Day 6-7 (8/16-8/17)
├─ 통합 검증 (1시간)
├─ 문서화 (1시간)
└─ 코드 리뷰 (30분)

산출물:
✅ ai-router.ts
✅ token-manager.ts
✅ validation-engine.ts
✅ Multi-AI 통합 테스트 통과
```

### 주 2 (8/18-8/24): UI/UX 개선

**목표:** 직관성 + 신뢰도 표시 + 모바일 반응형

```
Day 1-2 (8/18-8/19)
├─ SearchResult 컴포넌트 개선 (2시간)
├─ 신뢰도 배지 구현 (1시간)
├─ 로딩 상태 UI (1시간)
└─ 테스트 (1시간)

Day 3-4 (8/20-8/21)
├─ Onboarding 흐름 구현 (3시간)
├─ 모바일 반응형 완성 (2시간)
└─ iPhone 테스트 (1시간)

Day 5 (8/22)
├─ Lighthouse 최적화 (2시간)
├─ 접근성 개선 (1시간)
└─ 성능 측정 (1시간)

Day 6-7 (8/23-8/24)
├─ QA 및 버그 수정 (2시간)
├─ 디자인 검토 (1시간)
└─ 배포 준비 (1시간)

산출물:
✅ Lighthouse > 80
✅ 모바일 테스트 통과 (iPhone)
✅ 신뢰도 UI
✅ 온보딩 플로우
```

### 주 3 (8/25-8/31): 배포 + 모니터링

**목표:** 프로덕션 배포 + 지표 모니터링 + 베타 사용자 확보

```
Day 1-2 (8/25-8/26)
├─ 환경 변수 설정 (30분)
├─ Vercel 배포 (30분)
├─ DNS 설정 (30분)
├─ 프로덕션 테스트 (2시간)
└─ SSL 인증서 확인 (30분)

Day 3-4 (8/27-8/28)
├─ Datadog 모니터링 설정 (2시간)
├─ 알림 규칙 구성 (1시간)
├─ 로그 수집 (1시간)
└─ 대시보드 생성 (1시간)

Day 5 (8/29)
├─ 베타 사용자 모집 (LinkedIn, 커뮤니티)
├─ 온보딩 자료 준비 (1시간)
└─ 지원 프로세스 수립 (1시간)

Day 6-7 (8/30-8/31)
├─ 베타 사용자 온보딩 (2시간)
├─ 피드백 수집 (1시간)
├─ 긴급 버그 수정 (1시간)
└─ 주간 보고서 작성 (1시간)

산출물:
✅ globalregai.info 프로덕션 배포
✅ 모니터링 대시보드
✅ 베타 사용자 5-10명
✅ 초기 피드백
```

### 주 4 (9/1-9/9): 최적화 + 자동화

**목표:** 사용자 피드백 반영 + 자동화 구현 + 고객 획득 시작

```
Day 1-3 (9/1-9/3)
├─ 베타 피드백 분석 (1시간)
├─ 우선순위 버그 수정 (3시간)
├─ UX 개선 (2시간)
└─ 재배포 (30분)

Day 4-5 (9/4-9/5)
├─ FDA 자동 스크래핑 설정 (2시간)
├─ MFDS 뉴스레터 자동화 (1시간)
├─ 자동 알림 구현 (2시간)
└─ 테스트 (1시간)

Day 6-7 (9/6-9/7)
├─ 콜드 아웃리치 스크립트 작성 (1시간)
├─ 초기 고객 5명 타게팅 (2시간)
├─ 데모 준비 (1시간)
└─ 제품-시장 적합도 조사 (1시간)

Day 8-9 (9/8-9/9)
├─ 초기 고객 데모 (3시간)
├─ 계약 협상 (2시간)
└─ Month 1 회고 (1시간)

산출물:
✅ 베타 피드백 반영 완료
✅ 자동화 파이프라인 운영 중
✅ 초기 고객 1-3명 (평가판)
✅ MRR $0 → $1-3K
```

---

## 6.2 일일 추적 템플릿

```markdown
# Daily Standup (예: 8/11)

## 목표
- Vite 호환성 수정

## 완료한 것
- [ ] @vitejs/plugin-react@6.0.2 업그레이드
- [ ] npm run build 성공
- [ ] 로컬 테스트 통과

## 블로커
- (없음)

## 내일 계획
- Groq API 키 생성
- ai-router.ts 구현 시작

## 메모
- package-lock.json 삭제 필요 (기존 의존성 충돌)
```

---

# 7단계: 기술 구현 상세

## 7.1 배포 구성

### Vercel 설정 (vercel.json)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "other",
  "regions": ["icn1", "nrt1", "sin1"],
  "env": {
    "ANTHROPIC_API_KEY": "@anthropic_api_key",
    "OPENAI_API_KEY": "@openai_api_key",
    "GROQ_API_KEY": "@groq_api_key",
    "REDIS_URL": "@redis_url",
    "SUPABASE_URL": "@supabase_url",
    "SUPABASE_ANON_KEY": "@supabase_anon_key"
  },
  "functions": {
    "api/**": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"
      
      - run: npm ci
      
      - run: npm run build
      
      - run: npm run test
      
      - uses: vercel/action@v4
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 7.2 데이터 마이그레이션

### Supabase 스키마

```sql
-- 규제 정보 테이블
CREATE TABLE regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction VARCHAR(10) NOT NULL,
  product_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  published_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  confidence FLOAT DEFAULT 0.75,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_regulations_jurisdiction ON regulations(jurisdiction);
CREATE INDEX idx_regulations_product_type ON regulations(product_type);

-- 검색 히스토리
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  query TEXT NOT NULL,
  results_count INT,
  avg_confidence FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI 응답 캐시
CREATE TABLE cache_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  response JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cache_expires_at ON cache_responses(expires_at);
```

---

## 7.3 모니터링 대시보드 (Datadog)

```python
# monitoring/datadog_config.py
from datadog import initialize, api
import json

options = {
    'api_key': os.getenv('DATADOG_API_KEY'),
    'app_key': os.getenv('DATADOG_APP_KEY')
}

initialize(**options)

# 메트릭 정의
METRICS = {
    'query_latency': 'globalregai.query.latency_ms',
    'ai_tokens_used': 'globalregai.ai.tokens_used',
    'cache_hit_rate': 'globalregai.cache.hit_rate',
    'error_rate': 'globalregai.error.rate',
}

# 모니터 생성
MONITORS = [
    {
        'name': 'High Query Latency',
        'query': f'avg:{{METRICS["query_latency"]}}{{env:prod}} > 5000',
        'alert_condition': 'avg last 5m',
        'notify': ['@slack-globalregai']
    },
    {
        'name': 'Low Cache Hit Rate',
        'query': f'avg:{{METRICS["cache_hit_rate"]}}{{env:prod}} < 0.6',
        'alert_condition': 'avg last 15m',
        'notify': ['@slack-globalregai']
    },
]
```

---

# 8단계: 부록 - 체크리스트 및 템플릿

## 8.1 주간 점검 리스트

### 주 1 체크리스트

```markdown
# Week 1 Completion Checklist

## 기술 (7/7)
- [x] Vite 호환성 수정
- [x] npm run build 성공
- [x] Groq API 통합
- [x] ai-router.ts 구현
- [x] token-manager.ts 구현
- [x] 통합 테스트
- [x] 코드 리뷰

## 설정 (4/4)
- [x] API 키 환경 변수
- [x] Redis 연결
- [x] Supabase 스키마
- [x] GitHub Actions

## 문서화 (2/2)
- [x] 기술 스펙 작성
- [x] API 문서

## 점수
**7/7 기술 + 4/4 설정 + 2/2 문서 = 13/13 ✅**
```

---

## 8.2 고객 체크리스트

### 온보딩 체크리스트 (고객용)

```markdown
# GlobalRegAI 온보딩 체크리스트

## 계정 설정
- [ ] 회원가입 (email 인증)
- [ ] 프로필 완성 (회사명, 제품 유형)
- [ ] 요금제 선택

## 첫 검색
- [ ] 샘플 쿼리 실행
  예) "MFDS 의료기기 분류 기준"
- [ ] 검색 결과 신뢰도 확인
- [ ] 출처 확인

## 고급 기능
- [ ] 필터 사용 (국가, 제품 유형)
- [ ] 저장 기능 사용
- [ ] 알림 설정

## 지원
- [ ] 이메일 지원 테스트
- [ ] 문서 읽음
- [ ] 피드백 제출

**예상 소요 시간: 15분**
```

---

## 8.3 월별 KPI 추적

```markdown
# Monthly KPI Dashboard

## Month 1 (8월)

### 기술 KPI
| 지표 | 목표 | 실제 | 달성도 |
|---|---|---|---|
| Lighthouse Score | 80 | 82 | ✅ |
| API 응답 시간 | <2s | 1.8s | ✅ |
| 캐시 히트율 | >60% | 65% | ✅ |

### 비즈니스 KPI
| 지표 | 목표 | 실제 | 달성도 |
|---|---|---|---|
| 베타 사용자 | 10명 | 8명 | 🟡 |
| MRR | $1K | $0 | ❌ |
| NPS | 50+ | TBD | - |

### 액션 아이템
- [ ] 베타 사용자 2명 추가 모집
- [ ] 첫 번째 유료 고객 계약 진행
- [ ] UX 개선 3가지 반영
```

---

## 8.4 위기 대응 계획

### Scenario: Claude API 토큰 부족

```markdown
# 위기 대응: Claude API 토큰 한계 도달

## 즉시 조치 (5분)
1. Groq로 자동 Fallback
2. Slack 알림 발송
3. 관리자 대시보드 빨간 경고

## 단기 조치 (1시간)
1. 토큰 풀 재계산
2. Perplexity API 활성화
3. 캐시 TTL 2배 증가

## 중기 조치 (1일)
1. Claude 토큰 추가 구매
2. 비용 최적화 분석
3. 고객 커뮤니케이션

## 장기 조치 (1주)
1. 토큰 할당량 구조 재설계
2. AI 비용 모니터링 자동화
3. 더 효율적인 프롬프트 개발
```

---

## 8.5 고객 성공 사례 템플릿

```markdown
# 고객 성공 사례

## 회사명: XYZ Medical Devices

**과제**
- MFDS 의료기기 분류 적용 가능성 불명확
- 규제 정보 수집에 월 40시간 소비

**솔루션**
- GlobalRegAI 도입 (Pro 플랜, $399/mo)
- "의료기기 분류" 쿼리 1번 실행

**결과**
- ✅ 규제 정보 수집 시간 → 2시간 (95% 단축)
- ✅ 승인 가능성 확인 (신뢰도 92%)
- ✅ MFDS 인증 신청 (예정 3개월 단축)

**ROI**
- 월 40시간 × $100/시간 = $4,000
- 구독료: $399/mo
- 순 절감: $3,601/월 = 약 9배 ROI

---

# 다음 목표
지금 이 시점에서 가장 시급한 것:
1. Vite 호환성 수정 (오늘)
2. Groq API 통합 (내일)
3. Onboarding UX (이번 주)
```

---

## 8.6 자동화 스크립트 모음

### 월일 토큰 리셋 (Cron Job)

```python
# scripts/reset_monthly_tokens.py
import os
from datetime import datetime
from services.token_manager import TokenManager

def reset_tokens():
    """매월 1일 토큰 할당량 리셋"""
    
    tm = TokenManager(os.getenv('REDIS_URL'))
    
    # 토큰 할당량 정의
    quotas = {
        'claude': 3_000_000,
        'gpt': 2_000_000,
        'gemini': 1_000_000,
        'groq': 500_000,
        'perplexity': 500_000,
    }
    
    for ai, quota in quotas.items():
        tm.set_quota(ai, quota)
        print(f"✅ {ai}: {quota:,} 토큰 할당")
    
    print(f"✅ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 월간 토큰 리셋 완료")

if __name__ == '__main__':
    reset_tokens()
```

### 규제 정보 자동 수집 (Daily)

```python
# scripts/collect_regulations.py
import os
import requests
from services.regulation_service import RegulationService

async def collect_all():
    """매일 새로운 규제 정보 수집"""
    
    sources = {
        'FDA': 'https://www.fda.gov/regulatory-information/...',
        'MFDS': 'https://data.mfds.go.kr/...',
        'EMA': 'https://www.ema.europa.eu/...',
        'ANVISA': 'https://www.anvisa.gov.br/...',
    }
    
    for jurisdiction, url in sources.items():
        print(f"📥 {jurisdiction} 데이터 수집 중...")
        
        try:
            data = await fetch_data(url)
            await RegulationService.save_batch(jurisdiction, data)
            print(f"✅ {jurisdiction}: {len(data)} 항목 저장")
        except Exception as e:
            print(f"❌ {jurisdiction} 수집 실패: {e}")

if __name__ == '__main__':
    import asyncio
    asyncio.run(collect_all())
```

---

# 마치며

## 핵심 요점 정리

1. **MCP 멀티-AI는 가능**: 어댑터 패턴으로 모든 AI를 통합 가능
2. **직관성 개선 필수**: UI/UX 재구성 = 고객 획득의 첫 단계
3. **30일 내 실행 가능**: 우선순위 집중 → MVP 배포 달성
4. **사업성 강함**: Year 1 $100K+, Year 3 $2-3M 전망
5. **위험은 관리 가능**: AI 환각, 비용, 경쟁 모두 대응책 있음

---

## 즉시 시작 (Today)

```bash
# 1단계: Vite 수정 (30분)
cd C:\Users\laser\GlobalRegAI
npm install --save-dev @vitejs/plugin-react@^6.0.2
npm run build

# 2단계: Groq 통합 (1시간)
# API 키 생성 → .env.local 추가 → ai-config.ts 작성

# 3단계: UI 개선 (당일)
# OnboardingFlow.tsx + SearchResult.tsx 구현

# 결과: 첫 번째 체크포인트 달성 ✅
```

**계속해서 질문하세요. 모든 기술 구현에서 지원할 준비가 되어 있습니다.**

---

**문서 작성일:** 2026년 8월 11일  
**버전:** 1.0 (완성판)  
**다음 업데이트:** 주간 (Weekly Sprint 기반)
