// src/lib/mcp-globalregai.ts - 최적화된 GlobalRegAI MCP 통합 모듈

/**
 * GlobalRegAI 커스텀 MCP 시스템
 * - korean-law-unified: 한국 규제 (MFDS + 법령 + 판례)
 * - FDA-Comprehensive: FDA 규제 (OpenFDA + 510(k) + 규정)
 * - EMA-Comprehensive: EMA 규제 (EMA API + MDR + 가이드라인)
 */

// ============================================================================
// 1️⃣ MCP 서버 설정
// ============================================================================

export const GLOBALREGAI_MCP_SERVERS = {
  // 한국 규제 MCP
  koreanRegulatory: {
    id: "korean-law-unified",
    name: "Korean Regulatory Intelligence",
    description: "한국 규제 통합 (MFDS + 법령 + 판례)",
    version: "1.0.0",
    priority: 1,
    sources: [
      {
        name: "MFDS-OpenAPI",
        url: "https://www.data.go.kr/api/v1",
        type: "REST-API",
        format: ["JSON", "XML"],
        endpoints: {
          medicalDevice: "15057456", // 의료기기 승인 정보
          importedFood: "15058273"   // 수입 식품 허가 정보
        },
        auth: "API_KEY",
        updateFreq: "daily",
        official: true
      },
      {
        name: "chrisryugj/korean-law",
        url: "https://github.com/chrisryugj/korean-law-mcp",
        type: "github",
        features: ["law_search", "caselaw", "law_detail"],
        official: false
      }
    ],
    tools: [
      "searchMFDSDevice",
      "searchImportedFood",
      "searchKoreanLaw",
      "searchCaselaw",
      "checkRegulatory"
    ]
  },

  // FDA 규제 MCP
  fdaComprehensive: {
    id: "FDA-Comprehensive",
    name: "FDA Regulatory Intelligence",
    description: "FDA 규제 통합 (OpenFDA + 510(k) + 규정)",
    version: "1.0.0",
    priority: 1,
    sources: [
      {
        name: "OpenFDA",
        url: "https://api.fda.gov",
        type: "REST-API",
        format: "JSON",
        endpoints: {
          drugs: "/drug/search.json",
          devices: "/device/search.json",
          adverseEvents: "/event/search.json",
          recalls: "/recall/search.json"
        },
        auth: "NONE",
        updateFreq: "daily",
        official: true
      },
      {
        name: "openpharma-org/fda-mcp",
        url: "https://github.com/openpharma-org/fda-mcp",
        type: "github",
        features: ["510k_predicate", "k_number_search"],
        official: false
      },
      {
        name: "fda-compliance-mcp",
        url: "https://github.com/kitchenbeats/fda-compliance-mcp",
        type: "github",
        features: ["compliance_check", "classification"],
        official: false
      }
    ],
    tools: [
      "searchDrugs",
      "searchDevices",
      "searchAdverseEvents",
      "searchRecalls",
      "search510kPredicate",
      "checkFDACompliance"
    ]
  },

  // EMA 규제 MCP
  emaComprehensive: {
    id: "EMA-Comprehensive",
    name: "EMA Regulatory Intelligence",
    description: "EMA 규제 통합 (EMA API + MDR + 가이드라인)",
    version: "1.0.0",
    priority: 1,
    sources: [
      {
        name: "EMA Official Data",
        url: "https://www.ema.europa.eu/en/medicines",
        type: "REST-API",
        format: ["JSON", "XML"],
        endpoints: {
          medicines: "/download-medicine-data",
          approvals: "/assessments",
          guidance: "/documents"
        },
        auth: "NONE",
        updateFreq: "daily",
        official: true
      },
      {
        name: "EU_compliance_MCP",
        url: "https://github.com/Ansvar-Systems/EU_compliance_MCP",
        type: "github",
        features: ["mdr_check", "ce_mark", "directive_search"],
        official: false
      },
      {
        name: "ema-mcp",
        url: "https://github.com/openpharma-org/ema-mcp",
        type: "github",
        features: ["guidance_search", "approved_drugs"],
        official: false
      }
    ],
    tools: [
      "searchMedicines",
      "searchApprovals",
      "checkMDRCompliance",
      "getCEMark",
      "searchEMAGuidance"
    ]
  }
};

// ============================================================================
// 2️⃣ MCP 라우팅 규칙
// ============================================================================

export const MCP_ROUTING_RULES = {
  language: {
    ko: ["koreanRegulatory"],
    "한국어": ["koreanRegulatory"],
    en: ["fdaComprehensive", "emaComprehensive"],
    ja: ["fdaComprehensive", "emaComprehensive"],
    "日本語": ["fdaComprehensive", "emaComprehensive"],
    zh: ["fdaComprehensive", "emaComprehensive"],
    "中文": ["fdaComprehensive", "emaComprehensive"]
  },

  country: {
    "Korea": ["koreanRegulatory"],
    "USA": ["fdaComprehensive"],
    "EU": ["emaComprehensive"],
    "Japan": ["fdaComprehensive", "emaComprehensive"],
    "China": ["fdaComprehensive", "emaComprehensive"]
  },

  keyword: {
    // 한국어 키워드
    "식약처": "koreanRegulatory",
    "MFDS": "koreanRegulatory",
    "의료기기": "koreanRegulatory",
    "수입식품": "koreanRegulatory",
    "법령": "koreanRegulatory",
    "판례": "koreanRegulatory",

    // FDA 키워드
    "FDA": "fdaComprehensive",
    "510k": "fdaComprehensive",
    "drug": "fdaComprehensive",
    "device": "fdaComprehensive",
    "adverse": "fdaComprehensive",
    "recall": "fdaComprehensive",

    // EMA 키워드
    "EMA": "emaComprehensive",
    "CE": "emaComprehensive",
    "MDR": "emaComprehensive",
    "medicine": "emaComprehensive",
    "approval": "emaComprehensive"
  },

  industry: {
    "Medical Device": ["koreanRegulatory", "fdaComprehensive", "emaComprehensive"],
    "Pharmaceutical": ["fdaComprehensive", "emaComprehensive"],
    "Nutraceutical": ["koreanRegulatory", "fdaComprehensive"],
    "Cosmetic": ["koreanRegulatory", "fdaComprehensive"],
    "Food & Beverage": ["koreanRegulatory", "fdaComprehensive"]
  }
};

// ============================================================================
// 3️⃣ API 호출 함수
// ============================================================================

/**
 * 한국 규제 MCP - MFDS OpenAPI 호출
 */
async function callMFDSOpenAPI(
  endpoint: string,
  params: Record<string, any>
): Promise<any> {
  const apiKey = process.env.MFDS_API_KEY;
  
  if (!apiKey) {
    console.warn("MFDS_API_KEY not configured");
    return null;
  }

  try {
    const queryParams = new URLSearchParams({
      serviceKey: apiKey,
      ...params,
      type: "json"
    }).toString();

    const url = `https://www.data.go.kr/api/v1/${endpoint}?${queryParams}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`MFDS API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("MFDS API Error:", error);
    return null;
  }
}

/**
 * FDA - OpenFDA API 호출
 */
async function callOpenFDAAPI(
  endpoint: string,
  params: Record<string, any>
): Promise<any> {
  try {
    const queryString = new URLSearchParams({
      limit: "100",
      skip: "0",
      ...params
    }).toString();

    const url = `https://api.fda.gov${endpoint}?${queryString}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`OpenFDA API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("OpenFDA API Error:", error);
    return null;
  }
}

/**
 * EMA API 호출
 */
async function callEMAAPI(
  endpoint: string,
  params: Record<string, any>
): Promise<any> {
  try {
    const queryString = new URLSearchParams(params).toString();
    const url = `https://www.ema.europa.eu/en/medicines${endpoint}${queryString ? `?${queryString}` : ""}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GlobalRegAI/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`EMA API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("EMA API Error:", error);
    return null;
  }
}

// ============================================================================
// 4️⃣ MCP 도구 구현
// ============================================================================

/**
 * 한국 규제 MCP 도구들
 */
export const koreanLawTools = {
  async searchMFDSDevice(params: {
    deviceName?: string;
    company?: string;
    approvalStatus?: string;
  }): Promise<any> {
    return await callMFDSOpenAPI("15057456", {
      productName: params.deviceName,
      manufacturerName: params.company
    });
  },

  async searchImportedFood(params: {
    foodName?: string;
    company?: string;
  }): Promise<any> {
    return await callMFDSOpenAPI("15058273", {
      foodName: params.foodName,
      importerName: params.company
    });
  },

  async searchKoreanLaw(_params: {
    keyword: string;
    lawType?: string;
  }): Promise<any> {
    // GitHub API 호출 (chrisryugj/korean-law-mcp)
    try {
      const response = await fetch(
        `https://api.github.com/repos/chrisryugj/korean-law-mcp/contents/database`
      );
      return await response.json();
    } catch (error) {
      return null;
    }
  },

  async searchCaselaw(_params: {
    keyword: string;
    court?: string;
  }): Promise<any> {
    // 판례 검색 로직
    return {
      results: [],
      source: "korean-law-mcp"
    };
  },

  async checkRegulatory(params: {
    deviceName: string;
    industry: string;
    country: string;
  }): Promise<any> {
    // MFDS 데이터와 법령 통합 검사
    const mfdsData = await koreanLawTools.searchMFDSDevice({
      deviceName: params.deviceName
    });

    return {
      mfdsInfo: mfdsData,
      regulatory: {
        country: params.country,
        industry: params.industry,
        requirements: []
      }
    };
  }
};

/**
 * FDA MCP 도구들
 */
export const fdaTools = {
  async searchDrugs(params: {
    brandName?: string;
    genericName?: string;
  }): Promise<any> {
    let search = "";
    if (params.brandName) search += `brand_name:"${params.brandName}"`;
    if (params.genericName) {
      if (search) search += " AND ";
      search += `generic_name:"${params.genericName}"`;
    }

    return await callOpenFDAAPI("/drug/search.json", { search });
  },

  async searchDevices(params: {
    deviceName?: string;
    kNumber?: string;
  }): Promise<any> {
    let search = "";
    if (params.deviceName) search += `device_name:"${params.deviceName}"`;
    if (params.kNumber) {
      if (search) search += " AND ";
      search += `k_number:"${params.kNumber}"`;
    }

    return await callOpenFDAAPI("/device/search.json", { search });
  },

  async searchAdverseEvents(params: {
    product: string;
    outcomes?: string[];
  }): Promise<any> {
    let search = `products.product_type:"${params.product}"`;

    return await callOpenFDAAPI("/event/search.json", { search });
  },

  async searchRecalls(params: {
    product: string;
    classification?: string;
  }): Promise<any> {
    let search = `product_description:"${params.product}"`;
    if (params.classification) {
      search += ` AND classification:"${params.classification}"`;
    }

    return await callOpenFDAAPI("/recall/search.json", { search });
  },

  async search510kPredicate(params: {
    deviceType: string;
    predicateK?: string;
  }): Promise<any> {
    // 510(k) 동등 기기 검색
    const deviceSearch = await fdaTools.searchDevices({
      deviceName: params.deviceType
    });

    return {
      predicates: deviceSearch?.results || [],
      source: "OpenFDA"
    };
  },

  async checkFDACompliance(params: {
    deviceClassification: string;
    regulatoryPathway?: string;
  }): Promise<any> {
    return {
      classification: params.deviceClassification,
      pathway: params.regulatoryPathway || "unknown",
      requirements: []
    };
  }
};

/**
 * EMA MCP 도구들
 */
export const emaTools = {
  async searchMedicines(params: {
    medicineName?: string;
    activeSubstance?: string;
  }): Promise<any> {
    return await callEMAAPI("/download-medicine-data", {
      search: params.medicineName || params.activeSubstance
    });
  },

  async searchApprovals(params: {
    approvalDate?: string;
    procedureType?: string;
  }): Promise<any> {
    return await callEMAAPI("/assessments", {
      date: params.approvalDate,
      type: params.procedureType
    });
  },

  async checkMDRCompliance(params: {
    deviceClass: string;
    riskClass?: string;
  }): Promise<any> {
    return {
      device: params.deviceClass,
      mdrRequired: ["I", "II", "III"].includes(params.deviceClass),
      requirements: []
    };
  },

  async getCEMark(params: {
    directive: string;
    class: string;
  }): Promise<any> {
    return {
      directive: params.directive,
      class: params.class,
      ceRequired: true,
      modules: []
    };
  },

  async searchEMAGuidance(params: {
    topic: string;
    documentType?: string;
  }): Promise<any> {
    return await callEMAAPI("/documents", {
      search: params.topic,
      type: params.documentType
    });
  }
};

// ============================================================================
// 5️⃣ MCP 자동 감지 및 라우팅
// ============================================================================

/**
 * 필요한 MCP 자동 감지
 */
export function detectRequiredMCPs(
  query: string,
  _language: string,
  country: string,
  industry: string
): string[] {
  const requiredMCPs: Set<string> = new Set();

  // 언어별 라우팅
  const langKey = Object.keys(MCP_ROUTING_RULES.language).find(
    k => k.toLowerCase() === language.toLowerCase()
  );
  if (langKey && MCP_ROUTING_RULES.language[langKey as keyof typeof MCP_ROUTING_RULES.language]) {
    const mcps = MCP_ROUTING_RULES.language[langKey as keyof typeof MCP_ROUTING_RULES.language];
    mcps.forEach(mcp => requiredMCPs.add(mcp));
  }

  // 국가별 라우팅
  if (MCP_ROUTING_RULES.country[country as keyof typeof MCP_ROUTING_RULES.country]) {
    const mcps = MCP_ROUTING_RULES.country[country as keyof typeof MCP_ROUTING_RULES.country];
    mcps.forEach(mcp => requiredMCPs.add(mcp));
  }

  // 키워드 기반 라우팅
  Object.entries(MCP_ROUTING_RULES.keyword).forEach(([keyword, mcpName]) => {
    if (
      query.toLowerCase().includes(keyword.toLowerCase()) ||
      industry.toLowerCase().includes(keyword.toLowerCase())
    ) {
      requiredMCPs.add(mcpName);
    }
  });

  // 산업별 라우팅
  if (MCP_ROUTING_RULES.industry[industry as keyof typeof MCP_ROUTING_RULES.industry]) {
    const mcps = MCP_ROUTING_RULES.industry[industry as keyof typeof MCP_ROUTING_RULES.industry];
    mcps.forEach(mcp => requiredMCPs.add(mcp));
  }

  return Array.from(requiredMCPs);
}

/**
 * MCP 도구 호출
 */
export async function callMCPTool(
  mcpType: string,
  toolName: string,
  params: Record<string, any>
): Promise<any> {
  try {
    switch (mcpType) {
      case "koreanRegulatory":
        return await (koreanLawTools as any)[toolName](params);

      case "fdaComprehensive":
        return await (fdaTools as any)[toolName](params);

      case "emaComprehensive":
        return await (emaTools as any)[toolName](params);

      default:
        return null;
    }
  } catch (error) {
    console.error(`MCP Tool Error (${mcpType}/${toolName}):`, error);
    return null;
  }
}

/**
 * 여러 MCP 결과 통합
 */
export async function integrateMultipleMCPs(
  query: string,
  _language: string,
  country: string,
  industry: string
): Promise<Record<string, any>> {
  const requiredMCPs = detectRequiredMCPs(query, language, country, industry);
  const results: Record<string, any> = {};

  for (const mcpType of requiredMCPs) {
    const mcp = GLOBALREGAI_MCP_SERVERS[mcpType as keyof typeof GLOBALREGAI_MCP_SERVERS];
    if (!mcp) continue;

    try {
      // 각 MCP의 첫 번째 도구 호출
      const toolName = mcp.tools[0];
      const toolResult = await callMCPTool(mcpType, toolName, {
        query,
        industry,
        country
      });

      if (toolResult) {
        results[mcpType] = {
          source: mcp.name,
          type: mcpType,
          data: toolResult,
          timestamp: new Date().toISOString(),
          official: mcp.sources.some(s => s.official)
        };
      }
    } catch (error) {
      console.error(`Failed to call MCP: ${mcpType}`, error);
    }
  }

  return results;
}

/**
 * MCP 결과 포맷팅
 */
export function formatMCPResponse(
  mcpResults: Record<string, any>,
  _language: string
): string {
  if (Object.keys(mcpResults).length === 0) {
    return "규제 데이터를 조회할 수 없습니다.";
  }

  const sources = Object.entries(mcpResults)
    .map(([_key, value]) => {
      const official = value.official ? "✅ 공식 데이터" : "📊 보조 데이터";
      return `
[${value.source}] ${official}
데이터: ${JSON.stringify(value.data, null, 2).substring(0, 500)}...
`;
    })
    .join("\n---\n");

  return `
📋 [규제 정보 통합 결과]

${sources}

⏰ 마지막 업데이트: ${new Date().toLocaleString('ko-KR')}
`;
}

export default {
  GLOBALREGAI_MCP_SERVERS,
  MCP_ROUTING_RULES,
  detectRequiredMCPs,
  callMCPTool,
  integrateMultipleMCPs,
  formatMCPResponse,
  koreanLawTools,
  fdaTools,
  emaTools
};
