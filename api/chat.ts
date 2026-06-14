export const config = { runtime: 'edge' };

const GROQ_KEYS = [
  process.env.VITE_GROQ_API_KEY_1,
  process.env.VITE_GROQ_API_KEY_2,
  process.env.VITE_GROQ_API_KEY_3,
  process.env.VITE_GROQ_API_KEY,
].filter(Boolean) as string[];

let keyIdx = 0;

// ── 한자/금지표현 완전 제거 후처리 ────────────────────────────────
function sanitize(text: string): string {
  return text
    // ── 한자 → 한국어 변환 (자주 나타나는 규제 관련 한자) ──
    .replace(/充填/g, '충전')
    .replace(/报告/g, '보고서')
    .replace(/頻繁/g, '빈번')
    .replace(/申請/g, '신청')
    .replace(/登録/g, '등록')
    .replace(/認証/g, '인증')
    .replace(/認定/g, '인정')
    .replace(/許可/g, '허가')
    .replace(/承認/g, '승인')
    .replace(/評価/g, '평가')
    .replace(/試験/g, '시험')
    .replace(/製造/g, '제조')
    .replace(/医療/g, '의료')
    .replace(/機器/g, '기기')
    .replace(/医薬品/g, '의약품')
    .replace(/化粧品/g, '화장품')
    .replace(/食品/g, '식품')
    .replace(/安全/g, '안전')
    .replace(/品質/g, '품질')
    .replace(/管理/g, '관리')
    .replace(/規制/g, '규제')
    .replace(/基準/g, '기준')
    .replace(/標準/g, '표준')
    .replace(/検査/g, '검사')
    .replace(/審査/g, '심사')
    .replace(/設計/g, '설계')
    .replace(/文書/g, '문서')
    .replace(/技術/g, '기술')
    .replace(/提出/g, '제출')
    .replace(/適合/g, '적합')
    .replace(/適用/g, '적용')
    .replace(/変更/g, '변경')
    .replace(/確認/g, '확인')
    .replace(/注意/g, '주의')
    .replace(/必要/g, '필요')
    .replace(/要求/g, '요구')
    .replace(/対応/g, '대응')
    .replace(/実施/g, '실시')
    .replace(/実行/g, '실행')
    .replace(/情報/g, '정보')
    .replace(/内容/g, '내용')
    .replace(/方法/g, '방법')
    .replace(/手順/g, '순서')
    .replace(/期間/g, '기간')
    .replace(/費用/g, '비용')
    .replace(/申告/g, '신고')
    .replace(/届出/g, '신고')
    .replace(/免除/g, '면제')
    .replace(/除外/g, '제외')
    .replace(/追加/g, '추가')
    .replace(/更新/g, '갱신')
    .replace(/維持/g, '유지')
    .replace(/準備/g, '준비')
    .replace(/完了/g, '완료')
    .replace(/開始/g, '시작')
    .replace(/終了/g, '종료')
    .replace(/指定/g, '지정')
    .replace(/機関/g, '기관')
    .replace(/機構/g, '기구')
    .replace(/部門/g, '부문')
    .replace(/担当/g, '담당')
    .replace(/責任/g, '책임')
    .replace(/義務/g, '의무')
    .replace(/権利/g, '권리')
    // ── 중국어 간체 한자 ──
    .replace(/报告/g, '보고서')
    .replace(/频繁/g, '빈번')
    .replace(/注册/g, '등록')
    .replace(/许可/g, '허가')
    .replace(/审查/g, '심사')
    .replace(/评价/g, '평가')
    .replace(/评估/g, '평가')
    .replace(/检查/g, '검사')
    .replace(/检测/g, '시험검사')
    .replace(/认证/g, '인증')
    .replace(/认定/g, '인정')
    .replace(/申请/g, '신청')
    .replace(/文件/g, '문서')
    .replace(/标准/g, '기준')
    .replace(/规范/g, '규범')
    .replace(/要求/g, '요건')
    .replace(/需要/g, '필요')
    .replace(/提交/g, '제출')
    .replace(/变更/g, '변경')
    .replace(/确认/g, '확인')
    .replace(/信息/g, '정보')
    .replace(/证书/g, '인증서')
    .replace(/证明/g, '증명')
    .replace(/声明/g, '선언')
    .replace(/安全性/g, '안전성')
    .replace(/有效性/g, '유효성')
    .replace(/质量/g, '품질')
    .replace(/制造/g, '제조')
    .replace(/设计/g, '설계')
    .replace(/技术/g, '기술')
    .replace(/临床/g, '임상')
    .replace(/进口/g, '수입')
    .replace(/出口/g, '수출')
    // ── 일본어 혼용 제거 ──
    .replace(/신청者の/g, '신청인의')
    .replace(/者の/g, '의')
    .replace(/の(?=[가-힣])/g, '의')
    // ── 금지 표현 치환 ──
    .replace(/\[REQUIRED\]/g, '필수')
    .replace(/\[OPTIONAL\]/g, '선택')
    .replace(/\[required\]/gi, '필수')
    .replace(/\[optional\]/gi, '선택')
    .replace(/\[확인 필요\]/g, '(공식 사이트 확인 필요)')
    .replace(/WARNING:/g, '⚠️ 주의:')
    .replace(/NOTE:/g, '📝 참고:')
    .replace(/IMPORTANT:/g, '📌 중요:')
    // ── 직역 전문용어 교정 ──
    .replace(/좋은 실험실 실습/g, '우수실험실운영기준(GLP)')
    .replace(/좋은 제조 관행/g, '우수제조관리기준(GMP)')
    .replace(/좋은 임상 실습/g, '우수임상시험관리기준(GCP)')
    .replace(/좋은 유통 관행/g, '우수유통관리기준(GDP)')
    // ── 한자 범위 완전 제거 (정규식) ──
    // CJK 통합 한자 (U+4E00-U+9FFF): 중국어/일본어 한자 전체
    // CJK 확장 A (U+3400-U+4DBF)
    // CJK 호환 한자 (U+F900-U+FAFF)
    .replace(/[一-鿿㐀-䶿豈-﫿]/g, (char) => {
      // 한자를 발견하면 빈 문자열로 제거
      // (개별 치환으로 처리되지 않은 나머지 한자 일괄 제거)
      return '';
    });
}
}

// ── 링크 자동 주입 ─────────────────────────────────────────────
function injectLinks(text: string): string {
  const hasLinks = text.includes('https://');
  if (hasLinks) return text;

  const keywordLinks: [string, string][] = [
    ['NMPA', '📌 중국 NMPA 전자신청: https://zwfw.nmpa.gov.cn'],
    ['FDA', '📌 미국 FDA 양식 전체: https://www.fda.gov/about-fda/reports-manuals-forms/forms'],
    ['EMA', '📌 EU EMA 신청 포털: https://plm.ema.europa.eu'],
    ['CE 마크', '📌 CE 마킹 안내: https://single-market-economy.ec.europa.eu/single-market/ce-marking_en'],
    ['MFDS', '📌 한국 MFDS 전자민원: https://emed.mfds.go.kr'],
    ['MHRA', '📌 영국 MHRA 양식: https://info.mhra.gov.uk/forms.aspx'],
    ['PMDA', '📌 일본 PMDA: https://www.pmda.go.jp/english'],
    ['ANVISA', '📌 브라질 ANVISA: https://solicita.anvisa.gov.br'],
    ['SFDA', '📌 사우디 SFDA: https://ghad.sfda.gov.sa'],
    ['필리핀', '📌 필리핀 FDA: https://fda.gov.ph/online-services/'],
    ['HSA', '📌 싱가포르 HSA: https://www.hsa.gov.sg'],
    ['BPOM', '📌 인도네시아 BPOM: https://e-bpom.pom.go.id'],
    ['CDSCO', '📌 인도 CDSCO: https://sugam.gov.in'],
    ['TGA', '📌 호주 TGA: https://www.tga.gov.au'],
    ['TFDA', '📌 대만 TFDA: https://www.fda.gov.tw/EN'],
    ['COFEPRIS', '📌 멕시코 COFEPRIS: https://www.gob.mx/cofepris'],
    ['TITCK', '📌 터키 TITCK: https://www.titck.gov.tr/en'],
  ];

  const injected: string[] = [];
  for (const [keyword, link] of keywordLinks) {
    if (text.includes(keyword) && !injected.includes(link)) {
      injected.push(link);
    }
  }

  if (injected.length > 0) {
    text += '\n\n---\n' + injected.join('\n');
  }
  return text;
}

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  if (GROQ_KEYS.length === 0) return new Response(
    JSON.stringify({ error: 'No API keys configured' }),
    { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
  );

  const { messages, system } = await req.json();

  let lastError = '';
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const key = GROQ_KEYS[(keyIdx + i) % GROQ_KEYS.length];
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: system },
            ...messages,
          ],
          max_tokens: 8192,
          temperature: 0.1,
        }),
      });

      const data = await res.json();

      if (data.choices?.[0]?.message?.content) {
        keyIdx = (keyIdx + i + 1) % GROQ_KEYS.length;
        let reply = data.choices[0].message.content;
        reply = sanitize(reply);
        reply = injectLinks(reply);
        return new Response(
          JSON.stringify({ reply }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      lastError = data.error?.message || 'No content';
      const is429 = res.status === 429 || lastError.includes('rate') || lastError.includes('limit') || lastError.includes('RESOURCE_EXHAUSTED');
      if (!is429) break;

    } catch (e: any) {
      lastError = e?.message || 'Fetch error';
    }
  }

  return new Response(
    JSON.stringify({ error: lastError }),
    { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
  );
}
