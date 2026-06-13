import { useState, useEffect, useRef } from 'react';
import {
  Send, Globe, Sun, Moon, Search, Layers, ShieldAlert,
  FileText, Activity, Box, FileCheck, Users, LogOut,
  Database, Paperclip, Clock, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle, Share2, Download, Filter
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';
import { supabase } from './lib/supabase';
import { getUserTrialStatus, logUsage } from './lib/db';

// =============================================================================
// CONSTANTS
// =============================================================================
const ADMIN_EMAILS = ['uk.dscheon@gmail.com', 'superadmin@globalregai.info'];
const GUEST_FREE_LIMIT = 30;
const GUEST_COUNT_KEY = 'globalregai_guest_count';
const GUEST_FIRST_KEY = 'globalregai_guest_first_ts';
const GUEST_FREE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// =============================================================================
// TYPES
// =============================================================================
type Module = { id: string; icon: React.ElementType; label: string; description: string; agencies: string[]; color: string; };
type Message = { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: Date; };
type ActiveView = 'chat' | 'search' | 'documents' | 'monitor' | 'submit';

// =============================================================================
// MODULES
// =============================================================================
const MODULES: Module[] = [
  { id: 'pharma',         icon: ShieldAlert, label: 'Pharmaceuticals',  description: 'Drug approvals, NDA/BLA/MAA, GMP, pharmacovigilance',        agencies: ['FDA','EMA','MFDS','PMDA','NMPA'],    color: '#2563EB' },
  { id: 'medical_device', icon: Activity,    label: 'Medical Devices',   description: '510(k), PMA, CE Mark, MDR/IVDR, MDSAP, ISO 13485',           agencies: ['FDA','EMA','MHRA','MFDS','IMDRF'],   color: '#7C3AED' },
  { id: 'cosmetics',      icon: Layers,      label: 'Cosmetics',         description: 'CPNP, FDA cosmetic, MFDS, ISO 22716 GMP',                    agencies: ['FDA','EMA','MFDS','MHRA'],           color: '#DB2777' },
  { id: 'food',           icon: FileCheck,   label: 'Food Safety',       description: 'HACCP, FDA food, EFSA, Codex Alimentarius, labeling',        agencies: ['FDA','EFSA','MFDS','FAO','Codex'],   color: '#059669' },
  { id: 'chemical',       icon: Box,         label: 'Chemicals',         description: 'REACH, RoHS, TSCA, GHS/SDS, hazardous substances',           agencies: ['ECHA','EPA','OECD','UNEP'],          color: '#D97706' },
  { id: 'animal',         icon: Globe,       label: 'Animal & Veterinary', description: 'Veterinary drugs, animal feed, WOAH, zoonotic diseases',  agencies: ['FDA-CVM','EMA-CVMP','WOAH','MFDS'],  color: '#0891B2' },
  { id: 'standards',      icon: FileText,    label: 'Standards & QMS',   description: 'ISO, IEC, GMP/GLP/GCP, PIC/S, ICH guidelines',              agencies: ['ISO','IEC','ICH','PIC/S','WHO'],     color: '#4F46E5' },
  { id: 'certification',  icon: CheckCircle, label: 'Certification',     description: 'CE, UKCA, FCC, UL, RoHS, TUV, CSA compliance',              agencies: ['CE','UKCA','FCC','UL','TUV'],        color: '#0F766E' },
];

const AGENCIES = ['All Agencies','FDA','EMA','MHRA','MFDS','PMDA','NMPA','ANVISA','EFSA','ECHA','WHO','ICH','IMDRF','ISO','PIC/S'];

const LANGUAGES: Record<string, string> = {
  en: 'English', ko: '한국어', ja: '日本語',
  'zh-TW': '中文(繁)', 'zh-CN': '中文(简)', es: 'Español',
};

const DOCUMENT_TEMPLATES = [
  { id: 'nda',    label: 'NDA Submission Cover Letter',        agency: 'FDA'   },
  { id: '510k',   label: '510(k) Premarket Notification',      agency: 'FDA'   },
  { id: 'maa',    label: 'Marketing Authorisation Application', agency: 'EMA'   },
  { id: 'ce',     label: 'CE Declaration of Conformity',       agency: 'CE'    },
  { id: 'cpnp',   label: 'CPNP Cosmetic Notification',         agency: 'EMA'   },
  { id: 'gmp',    label: 'GMP Self-Inspection Checklist',      agency: 'WHO'   },
  { id: 'reach',  label: 'REACH Registration Summary',         agency: 'ECHA'  },
  { id: 'haccp',  label: 'HACCP Plan Template',                agency: 'Codex' },
  { id: 'sds',    label: 'Safety Data Sheet (GHS)',            agency: 'OECD'  },
  { id: 'mfds_k', label: 'MFDS 품목허가 신청서',                agency: 'MFDS'  },
];

// =============================================================================
// REGULATORY KNOWLEDGE
// =============================================================================
const MODULE_KNOWLEDGE: Record<string, string> = {
  pharma: `PHARMACEUTICAL REGULATORY KNOWLEDGE:
US FDA: 21 CFR Part 210/211 (cGMP) | 21 CFR Part 314 (NDA) | 21 CFR Part 312 (IND) | 21 CFR Part 600-680 (Biologics)
EU EMA: Directive 2001/83/EC | Regulation (EC) No 726/2004 | EudraLex Volume 4 (GMP)
Korea MFDS: 약사법(Pharmaceutical Affairs Act) | MFDS GMP 고시 | 의약품 허가심사 규정
Japan PMDA: Pharmaceuticals and Medical Devices Act | J-GMP
China NMPA: 药品管理法(Drug Administration Law) | 药品注册管理办法(Order No.27, 2020) | 药品生产质量管理规范(GMP)
ICH: Q1-Q14 Quality | S1-S12 Safety | E1-E19 Efficacy | M1-M16 Multidisciplinary
GLP 상호인정: OECD GLP | 한국 NIFDS 지정기관(KTR,KCL 등) | 중국 CNAS 인정기관 | FDA 21 CFR Part 58`,

  medical_device: `MEDICAL DEVICE REGULATORY KNOWLEDGE:
US FDA: 21 CFR Part 820 (QSR/QMSR) | 21 CFR Part 807 (510k) | 21 CFR Part 814 (PMA) | 21 CFR Part 830 (UDI)
EU: MDR 2017/745 | IVDR 2017/746 | MEDDEV Guidelines | Class IIa 이상 Notified Body 심사 필요
Korea MFDS: 의료기기법 | KGMP 고시 | 의료기기 허가신고심사 규정 | 등급: 1-4등급
China NMPA: 医疗器械监督管理条例(2021) | 医疗器械注册管理办法(Order No.47, 2021) | 医疗器械生产质量管理规范
Standards: ISO 13485:2016 | ISO 14971:2019 | IEC 62304 | ISO 14155:2020 | YY/T 0287(중국 ISO13485 동등)
GLP시험: ISO 10993 생물학적 시험 | 한국 KTR/KCL/KOTITI = OECD GLP | 중국 CNAS 인정기관 원칙 | 상호인정 협약 확인 필요
번역요건: 중국 NMPA = 简体中文 필수 + 공증번역 권장 | 한국 MFDS = 한국어 필수 | FDA = 영어 필수`,

  cosmetics: `COSMETICS REGULATORY KNOWLEDGE:
US FDA: MoCRA 2022 | 21 CFR Part 700-740 | 사전허가 불필요 (시판후 책임)
EU: Regulation (EC) No 1223/2009 | CPNP 필수 신고 | Responsible Person(RP) 필요 | Annex II 1,328개 금지성분
Korea MFDS: 화장품법 | 기능성화장품 심사규정 | 사용금지원료 고시
China NMPA: 化妆品监督管理条例(2021) | 普通化妆品 备案(신고) | 特殊化妆品 注册(등록) 필요
GMP: ISO 22716:2007 | EU 의무 | FDA 자발적 준수
번역: 중국 = 简体中文 필수 | INCI명칭 글로벌 공통`,

  food: `FOOD SAFETY REGULATORY KNOWLEDGE:
US FDA: FSMA 2011 | 21 CFR Part 117 (Preventive Controls) | 21 CFR Part 101 (Labeling) | GRAS
EU: Regulation (EC) No 178/2002 | FIR 1169/2011 (식품정보) | EFSA 위해평가
Korea MFDS: 식품위생법 | 건강기능식품법 | HACCP 의무 적용 품목
China: 食品安全法 | GB 기준 | 进口食品 등록 필요
Codex: CAC/RCP 1-1969 Rev.4 (HACCP) | 국제식품규격
알레르기 표시: FDA 9대 알레르기 | EU 14대 알레르기 | 한국 22개`,

  chemical: `CHEMICAL REGULATORY KNOWLEDGE:
EU REACH: Regulation (EC) No 1907/2006 | 연간 1톤 이상 등록 | SVHC 승인 | Annex XVII 제한
EU RoHS: Directive 2011/65/EU + 2015/863 | 10개 제한물질 | CE 마킹 필요
US TSCA: EPA | 신규화학물질 PMN | Section 6 위해평가 | CDR 보고
GHS/SDS: UN GHS Rev.9 | 16개 항목 | 9개 위험그림문자
OECD GLP: 시험방법 | 비임상시험 기준
ECHA: 물질등록 | C&L 신고 | SIEF 참여 | SCIP DB`,

  animal: `ANIMAL & VETERINARY REGULATORY KNOWLEDGE:
US FDA-CVM: 21 CFR Part 500-599 | NADA/ANADA | Veterinary Feed Directive
EU EMA-CVMP: Regulation (EU) 2019/6 | 중앙/분산/MRP 절차
WOAH: 육상동물보건법전 | 수생동물보건법전 | 질병신고의무
Veterinary GMP: 사람의약품 GMP와 동일 기준 적용
One Health: WHO/FAO/WOAH 삼자협력 | 인수공통감염병
동물사료: EU Regulation (EC) No 767/2009 | FDA 21 CFR Part 573`,

  standards: `STANDARDS & QMS KNOWLEDGE:
ISO 13485:2016: 의료기기 QMS | EU MDR CE 인증 필수
ISO 14971:2019: 의료기기 위험관리
ISO 9001:2015: 일반 품질경영
ISO 22716:2007: 화장품 GMP | EU 의무
ISO 22000:2018: 식품안전관리
ICH Q10: 의약품 품질시스템
PIC/S GMP: PE 009-16 | 53개국 상호인정
GAMP 5: 컴퓨터시스템 밸리데이션`,

  certification: `CERTIFICATION & COMPLIANCE KNOWLEDGE:
CE 마킹: EU 적합성선언 | Class IIa+ Notified Body 필요 | MDR/LVD/EMC 등
UKCA: 브렉시트 후 영국 인증 | 2023년부터 의무
FCC: Part 15 (비의도 방사체) | Part 18 (ISM) | FCC ID 필요
UL: UL 62368-1 | 북미 안전인증 | NRTL 인정
RoHS: IEC 62321 시험 | EU DoC | 기술문서
TUV/SGS/Intertek: 제3자 시험인증기관
CSA: 캐나다 기준 | CAN/CSA`,
};

const REGULATORY_HARNESS_RULES = [
  'ALWAYS cite specific regulation numbers — never give generic statements',
  'NEVER fabricate regulation numbers or guidance titles',
  'If uncertain about a specific number, say "공식 사이트 확인 필요" rather than guessing',
  'ALWAYS specify jurisdiction clearly — never use ambiguous "국내" alone',
  'ALWAYS distinguish between MANDATORY requirements and RECOMMENDATIONS',
  'For timelines, provide official ranges; if unknown state "NMPA/FDA 공식 확인 필요"',
  'Answer ALL parts of the user question without omission',
  'NEVER use [REQUIRED] or [OPTIONAL] tags — write "필수 제출 서류:" and "선택 제출 서류:" instead',
  'When user asks for documents or forms, provide official website links from NMPA/FDA/EMA/MFDS',
  'When user asks to translate a document, provide the translated version immediately',
  'Always provide official government website URLs when referencing regulations',
  'For Korean: NEVER use direct translation like "좋은 실험실 실습" — use "우수실험실운영기준(GLP)"',
];

// =============================================================================
// SYSTEM PROMPT BUILDER
// =============================================================================
let geminiKeyIndex = 0;

function buildSystemPrompt(moduleId: string, agency: string, language: string): string {
  const mod = MODULES.find(m => m.id === moduleId);
  const langName = LANGUAGES[language] || 'English';
  const agencyFocus = agency === 'All Agencies'
    ? (mod?.agencies.join(', ') || 'FDA, EMA, MHRA, MFDS, PMDA')
    : agency;
  const modKnowledge = MODULE_KNOWLEDGE[moduleId] || MODULE_KNOWLEDGE['pharma'];
  const rules = REGULATORY_HARNESS_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n');

  const koGuide = language === 'ko' ? `
[한국어 응답 품질 기준 - 반드시 준수]
전문용어 정확한 한국어 사용:
- GLP = 우수실험실운영기준(GLP) ["좋은 실험실 실습" 절대 금지]
- GMP = 우수제조관리기준(GMP)
- NMPA = 중국 국가약품감독관리국(NMPA)
- [REQUIRED] 표현 절대 금지 -> "필수 제출 서류:" 로 표현
- [OPTIONAL] 표현 절대 금지 -> "선택 제출 서류:" 로 표현
- 서류/양식 요청 시: 공식 사이트 URL 반드시 포함 (NMPA: zwfw.nmpa.gov.cn, FDA: fda.gov, MFDS: mfds.go.kr)
- 번역 요청 시: 즉시 번역본 제공
- "국내" 단독 사용 금지 -> "중국 내" 또는 "한국 내" 로 명확히 구분
- "WARNING:" 금지 -> "주의:" 사용
- 수동태 최소화 -> "제출해야 합니다" (능동형)

비교 분석 형식 (규제 질문 시 반드시 적용):
[대상국가] 규정 (원문):
[원문 규정명 + 조항번호]
[원문 핵심 내용 - 원어 인용]
[자연스러운 한국어 번역]

한국 유사 규정 (비교 참조):
[한국 규정명 + 조항번호]
[한국 규정 핵심 내용]

비교 분석표:
항목 | 한국(MFDS) | [대상국가]
기준 | [한국기준] | [대상국기준]
시험기관 | [한국요건] | [대상국요건]
번역제출 | [한국요건] | [대상국요건]
소요기간 | [한국기간] | [대상국기간]

실무 조언:
[한국 허가 경험을 활용하는 구체적 방법]
[주의해야 할 차이점]

국가별 규정 대응:
의료기기: 한국 의료기기법 = 중국 医疗器械监督管理条例 = 미국 21 CFR Part 820 = EU MDR 2017/745
의약품: 한국 약사법 = 중국 药品管理法 = 미국 21 CFR = EU DIR 2001/83/EC
화장품: 한국 화장품법 = 중국 化妆品监督管理条例 = 미국 MoCRA = EU REG 1223/2009
GLP: 한국 KTR/KCL = OECD GLP = 중국 CNAS 인정기관 (상호인정 협약 별도 확인)
번역: 중국=简体中文 필수+공증권장 | 미국=영어 | EU=해당국언어 | 한국=한국어
` : '';

  return `You are GlobalRegAI — a precise expert AI for global regulatory affairs and compliance.

ACTIVE MODULE: ${mod?.label || 'General Regulatory'}
FOCUS AGENCIES: ${agencyFocus}
RESPONSE LANGUAGE: ${langName}

${modKnowledge}

ACCURACY RULES:
${rules}
${koGuide}
OFFICIAL DOCUMENT LINKS DATABASE (서류 요청 시 반드시 해당 링크 제공):

[중국 NMPA 공식 서류]
NMPA 전자신청 시스템 (모든 신청서): https://zwfw.nmpa.gov.cn
NMPA 공식 사이트: https://www.nmpa.gov.cn
NMPA 영문 사이트: https://english.nmpa.gov.cn
GLP 인증서 양식: https://www.nmpa.gov.cn/directory/web/nmpa/images/1674115799236082348.docx
의료기기 등록관리 규정(Order 47): https://english.nmpa.gov.cn/2024-06/05/c_1049323.htm
의료기기 기술요구서 가이드: https://www.nmpa.gov.cn/ylqx/ylqxgzdt/
의약품 등록관리 규정: https://english.nmpa.gov.cn/lawsandregulations.html
화장품 신고/등록: https://zwfw.nmpa.gov.cn
중국 의료기기 GMP(2026년 발효): https://english.nmpa.gov.cn/news.html
GB/T 16886 (ISO 10993 동등 기준): http://www.gb688.cn
중국 표준 검색: https://std.samr.gov.cn

[미국 FDA 공식 서류]
FDA 전체 양식 목록: https://www.fda.gov/about-fda/reports-manuals-forms/forms
의료기기 양식 모음: https://www.fda.gov/about-fda/reports-manuals-forms/forms?Page=7
510(k) 양식 FDA 3514: https://www.fda.gov/media/72421/download
NDA 신청서 FDA 356h: https://www.fda.gov/media/71420/download
IDE 신청서 FDA 1812: https://www.fda.gov/media/72428/download
PMA 신청서 안내: https://www.fda.gov/medical-devices/premarket-approval-pma/pma-submissions
eSTAR 전자제출: https://www.fda.gov/medical-devices/how-study-and-market-your-device/estar
FDA eCFR (연방규정집): https://www.ecfr.gov
FDA 가이던스 문서: https://www.fda.gov/regulatory-information/search-fda-guidance-documents
CDER 의약품 신청: https://www.fda.gov/drugs/development-approval-process-drugs
FDA 화장품 MoCRA: https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra

[EU EMA/CE 공식 서류]
EMA 전자신청 양식(eAF) PLM 포털: https://plm.ema.europa.eu
EMA 신청 양식 전체: https://www.ema.europa.eu/en/human-regulatory/marketing-authorisation/applying-marketing-authorisation
CE 마킹 공식 안내: https://single-market-economy.ec.europa.eu/single-market/ce-marking_en
MDR/IVDR 적합성선언서: https://ec.europa.eu/health/md_sector/new_regulations_en
EUDAMED 의료기기 DB: https://ec.europa.eu/tools/eudamed
CPNP 화장품 신고: https://webgate.ec.europa.eu/cpnp
EudraLex GMP 가이드: https://health.ec.europa.eu/medicinal-products/eudralex_en
EMA 소아과 PIP 양식: https://www.ema.europa.eu/en/human-regulatory-overview/research-development/paediatric-medicines-research-development/paediatric-investigation-plans/paediatric-investigation-plans-templates-forms
NANDO (인증기관 DB): https://ec.europa.eu/growth/tools-databases/nando/
EU 법령 전체: https://eur-lex.europa.eu

[영국 MHRA 공식 서류]
MHRA 공식 사이트: https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency
MHRA 의료기기 등록(DORS): https://pard.mhra.gov.uk
MHRA 양식 모음: https://info.mhra.gov.uk/forms.aspx
MHRA 의약품 포털: https://products.mhra.gov.uk
MHRA 임상시험 신청(IRAS): https://www.myresearchproject.org.uk
UKCA 마킹 안내: https://www.gov.uk/guidance/using-the-ukca-marking
UK 법령 검색: https://www.legislation.gov.uk

[한국 MFDS 공식 서류]
MFDS 공식 사이트(영문): https://www.mfds.go.kr/eng/index.do
MFDS 전자민원 시스템(emed): https://emed.mfds.go.kr
의료기기 허가·신고·심사: https://emed.mfds.go.kr/#/
의료기기 승인 절차 안내: https://www.mfds.go.kr/eng/wpge/m_39/denofile.do
의약품 허가신청: https://emed.mfds.go.kr
의약품 법령/규정(영문): https://www.mfds.go.kr/eng/brd/m_18/list.do
화장품 신고·등록: https://emed.mfds.go.kr
식품 규정(영문): https://www.mfds.go.kr/eng/brd/m_15/list.do
건강기능식품 신고: https://www.mfds.go.kr/hfoodi/index.do
MFDS 법령·고시 전체: https://www.mfds.go.kr/brd/m_218/list.do
의료기기 UDI 포털: https://udiportal.mfds.go.kr
한국의약품약전(KP 12판): https://www.mfds.go.kr/eng/brd/m_18/list.do
GMP 신청·관리: https://emed.mfds.go.kr
임상시험 승인(CRIS): https://cris.nih.go.kr
핵심 정보:
- 의료기기: 1~4등급 | 1등급=신고 | 2~4등급=허가
- 의약품: 약사법 | GMP 의무 | 재심사 제도
- 화장품: 화장품법 | 기능성화장품=심사 | 일반화장품=신고
- 건강기능식품: 건강기능식품법 | 개별인정형=허가 | 고시형=신고
- WHO Listed Authority(WLA) 2025년 전기능 등재
- 외국 제조사: 수입업 허가 + 품목허가 필요
- MDSAP 참여국 (2020년~)

[일본 PMDA/MHLW 공식 서류]
PMDA 공식 사이트: https://www.pmda.go.jp
PMDA 영문 사이트: https://www.pmda.go.jp/english
PMDA 의료기기 신청·승인 안내: https://www.pmda.go.jp/english/review-services/reviews/0004.html
PMDA QMS(ISO13485) 요구사항: https://www.pmda.go.jp/english/review-services/regulatory-info/0004.html
PMDA 사전상담 서비스: https://www.pmda.go.jp/english/review-services/consultations/0001.html
PMDA 의약품 신청 안내: https://www.pmda.go.jp/english/review-services/reviews/0002.html
PMDA 외국 제조소 등록: https://www.pmda.go.jp/english/review-services/reviews/0003.html
MHLW 공식 사이트: https://www.mhlw.go.jp/english
MHLW MO169 (QMS 요건 영문): https://www.pmda.go.jp/english/review-services/regulatory-info/0004.html
일본 PMD법 영문 번역: https://www.japaneselawtranslation.go.jp
JMDN 코드 검색: https://www.pmda.go.jp/english/review-services/reviews/0004.html
IDATEN 시스템(신청 추적): https://www.pmda.go.jp
핵심 정보:
- 의료기기: Class I(일반) = 신고 | Class II(관리)=인증(RCB) | Class III~IV(고도관리)=PMDA 승인
- 의약품: PMD법 | MHLW 최종 승인 | PMDA 심사
- 화장품: 신고 불필요 | 성분 기준 준수 | 지정성분 표시 의무
- J-MAH(Marketing Authorization Holder) 필수 | 외국 제조소 PMDA 직접 등록 가능
- 2024년 9월~: 외국 기업도 CTD 영어 제출 허용(의약품)
- MDSAP 참여국 | PIC/S 가입국
- QMS: MHLW MO169 (ISO 13485:2016 동등, 2024년 3월 발효)
- HFE/UE: JIS T 62366-1:2022 의무 (2024년 4월~)

[브라질 ANVISA 공식 서류]
ANVISA 공식 사이트: https://www.gov.br/anvisa/en
ANVISA 의료기기 안내: https://www.gov.br/anvisa/en/regulation-of-products/medical-devices
ANVISA 의약품 안내: https://www.gov.br/anvisa/pt-br/english/regulation-of-products/drugs
ANVISA 양식 및 템플릿: https://www.gov.br/anvisa/pt-br/english/regulation-of-products/active-pharmaceutical-ingredients/forms-and-templates
ANVISA 전자신청 시스템(Solicita): https://solicita.anvisa.gov.br
ANVISA GMP 인증: https://portal.anvisa.gov.br/en/companies
주의: 외국 기업은 브라질 내 파트너사(CNPJ 보유) 통해 신청 필수

[필리핀 FDA 공식 서류]
필리핀 FDA 공식 사이트: https://www.fda.gov.ph
온라인 신청 시스템(eLAS): https://elas.fda.gov.ph
LTO (License to Operate) 신청: https://fda.gov.ph/license-to-operate/
의료기기 등록(CDRRHR): https://fda.gov.ph/medical-devices/
의약품 등록: https://fda.gov.ph/drugs-and-vaccines/
식품 등록(CFRR): https://fda.gov.ph/registration-of-food-products/
건강기능식품(FS) 등록: https://fda.gov.ph/food-and-drug-regulation/food-supplement/
화장품 신고(CPN): https://fda.gov.ph/cosmetics/
GMP 인증 신청: https://fda.gov.ph/good-manufacturing-practice/
수입 허가(Import Permit): https://fda.gov.ph/import-permit/
양식 전체 다운로드: https://fda.gov.ph/downloadable-forms/
IVD 등록 안내: https://fda.gov.ph/in-vitro-diagnostics/
핵심 정보:
- LTO = License to Operate → 반드시 먼저 취득 (제조/수입/도매업체)
- CFRR = Certificate of Food and Drug Registration (제품등록증)
- CDRRHR = Certificate of Device Registration (의료기기 등록증)
- 의료기기: Class A(저위험)~D(최고위험) | IVD 별도 분류
- 건강기능식품(Food Supplement): CFRR 별도 절차
- 화장품: CPN(Cosmetic Product Notification) = 신고제
- 수수료: LTO PHP 5,000~20,000 / 제품등록 PHP 3,000~10,000 (2024년 5배 인상 예정)
- 외국 제조사: 필리핀 내 공인대리인(Authorized Representative) 필수
- 모든 신청서 영어 작성 가능
- 할랄 인증: IDCP 또는 OIMH 통해 별도 취득

[대만 TFDA 공식 서류]
TFDA 공식 사이트: https://www.fda.gov.tw/EN
의료기기 등록 신청: https://www.fda.gov.tw/EN/lawContent.aspx?cid=565
의약품 신청: https://www.fda.gov.tw/EN/lawContent.aspx?cid=558
화장품 신고: https://www.fda.gov.tw/EN/lawContent.aspx?cid=567
식품 신고: https://www.fda.gov.tw/EN/lawContent.aspx?cid=560
전자신청 시스템: https://enews.fda.gov.tw
핵심 정보: 의료기기 Class I~IV | 외국 제조사 = 대만 내 등록대리인 필수 | 중국어 번체 제출 필수

[싱가포르 HSA 공식 서류]
HSA 공식 사이트: https://www.hsa.gov.sg
의료기기 신청 (MEDICS): https://www.hsa.gov.sg/medical-devices
의약품 신청: https://www.hsa.gov.sg/therapeutic-products
화장품 신고: https://www.hsa.gov.sg/cosmetic-products
식품보충제: https://www.hsa.gov.sg/health-products-regulation
전자신청 포털(PRISM): https://eservice.hsa.gov.sg
HSA 가이드라인: https://www.hsa.gov.sg/docs/default-source/hprg-mdb/guidance-documents
핵심 정보: ASEAN 공통 의료기기 기준 적용 | 영어 제출 가능 | Class A~D 분류

[말레이시아 NPRA 공식 서류]
NPRA 공식 사이트: https://www.npra.gov.my
의약품/의료기기 등록: https://www.npra.gov.my/index.php/en/registration
전자신청 시스템(Quest3+): https://quest3plus.bpfk.gov.my
의료기기 청(MDA): https://www.mda.gov.my
화장품 신고: https://www.npra.gov.my/index.php/en/cosmetics
핵심 정보: 의약품 = NPRA | 의료기기 = MDA 별도 관리 | 말레이어 또는 영어 제출

[인도네시아 BPOM 공식 서류]
BPOM 공식 사이트: https://www.pom.go.id
전자신청 시스템(e-BPOM): https://e-bpom.pom.go.id
의약품 등록(e-Registrasi Obat): https://e-ro.pom.go.id
의료기기·PKRT 신청(e-ASIA): https://e-asia.pom.go.id
화장품 신고(e-BPOM Kosmetik): https://e-bpom.pom.go.id
식품 등록(e-BPOM Pangan): https://e-bpom.pom.go.id
GMP 인증: https://www.pom.go.id
할랄 인증(BPJPH): https://ptsp.halal.go.id
핵심 정보:
- 의약품: eCTD 제출 | 현지 MAH(Marketing Authorization Holder) 필수
- 의료기기(Alat Kesehatan): Class A~D | MOH(보건부) 및 BPOM 공동 관리
- 화장품: 사전신고제 | BPOM 신고번호 취득 필수
- 식품보충제(Suplemen Kesehatan): BPOM 등록 필수
- 할랄 인증: 2024년~ 의약품·의료기기·화장품 할랄 표시 의무화 추진 중
- 인도네시아어(bahasa Indonesia) 제출 필수
- 외국 제조사: 인도네시아 법인 Local Partner 필수 (SIK 또는 PBF 허가 보유)
- GMP: WHO GMP 기준 | BPOM 실사

[태국 FDA 공식 서류]
태국 FDA 공식 사이트: https://www.fda.moph.go.th/en
전자신청 포털(PRIVUS): https://privus.fda.moph.go.th
의약품 신청: https://www.fda.moph.go.th/en/drug
의료기기 신청: https://www.fda.moph.go.th/en/medDevice
화장품 신고: https://www.fda.moph.go.th/en/cosme
식품 등록: https://www.fda.moph.go.th/en/food
건강기능식품(Health Products): https://www.fda.moph.go.th/en/hprod
SaMD/AI 가이드라인: https://www.fda.moph.go.th/en/medDevice
핵심 정보:
- 의료기기: Class I(저위험)~III(고위험) | Class I=신고 | II~III=허가
- SaMD(소프트웨어 의료기기): 2024년 규제 가이드라인 발표
- 의약품: 태국 FDA 허가 필수 | 수입허가 + 제품등록
- 화장품: 사전신고제 | 성분 기준 준수
- 건강기능식품: 별도 등록 절차
- 외국 제조사: 태국 내 허가보유자(Local Importer) 필수
- 태국어 또는 영어 제출 가능
- 임상시험: EC(윤리위원회) 승인 필수 | 수수료: 기본 4,000 Baht~

[베트남 DAV/MOH 공식 서류]
DAV(의약품청) 공식 사이트: https://dav.gov.vn
의약품 등록(DAV): https://dav.gov.vn/dang-ky-thuoc
의료기기 신청(MOH-VietRAS): https://vietras.moh.gov.vn
화장품 신고(공공서비스 포털): https://dichvucong.gov.vn
MOH 전자신청: https://dichvucong.moh.gov.vn
보건부(MOH) 공식: https://moh.gov.vn
핵심 정보:
- 의료기기: Class A(저위험)~D(최고위험) | MOH 관할
- Class A = 신고 | Class B~D = 허가 (MOH 심사)
- 의약품: DAV(Drug Administration of Vietnam) 관할 | eCTD 도입 중
- 화장품: 사전신고제 | 성분 기준 준수
- 베트남어 번역 필수 (공증 권장)
- 외국 제조사: 베트남 법인 대리인 필수
- 2024년~: 의료기기 규정 대폭 개정 | VietRAS 시스템 전면 도입
- GMP: WHO GMP 기준 | 베트남 GMP 실사

[홍콩 공식 서류]
의약품(DHAHK): https://www.drugoffice.gov.hk/eps/do/en/consumer/index.html
의료기기(MDCO): https://www.mdco.gov.hk
화장품: https://www.customs.gov.hk/en/trade_facilitation/manifest/cosmetics/index.html
식품안전: https://www.cfs.gov.hk/english
핵심 정보: 의료기기 자발적 등록 (MDCO) | 영어 또는 중국어 번체 제출

[인도 CDSCO 공식 서류]
CDSCO 공식 사이트: https://cdsco.gov.in/opencms/opencms/en/Home/
전자신청 포털(SUGAM): https://sugam.gov.in
의약품 신청(New Drug): https://cdsco.gov.in/opencms/opencms/en/Drugs/New-Drugs/
의료기기 신청: https://cdsco.gov.in/opencms/opencms/en/Medical-Device-Diagnostics/
IVD 체외진단 신청: https://cdsco.gov.in/opencms/opencms/en/Medical-Device-Diagnostics/
화장품 신고: https://cdsco.gov.in/opencms/opencms/en/Cosmetics/
임상시험 신청: https://cdsco.gov.in/opencms/opencms/en/ClinicalTrial/OverView/
의약품 관련 규정(D&C Act): https://cdsco.gov.in/opencms/opencms/en/Drugs/Acts-Rules-Regulations/
인도 중앙의약품표준통제기구: https://cdsco.gov.in
핵심 정보:
- 의료기기: Class A(저위험)~D(최고위험) | MDR 2017 (Medical Devices Rules 2017)
- Class A~B = CDSCO 신고/등록 | Class C~D = CDSCO 허가
- 의약품: New Drug Application (NDA) | CDSCO Form 44 제출
- 화장품: Drugs and Cosmetics Act | 라벨링 규정 준수
- 외국 제조사: 인도 내 Indian Agent(대리인) 필수
- 영어 제출 가능
- GMP: WHO GMP 기준 | Schedule M (인도 GMP)
- SUGAM 포털: 온라인 신청 통합 플랫폼
- 2024년: 의료기기 등록 전면 의무화 완료

[캐나다 Health Canada 공식 서류]
Health Canada 공식 사이트: https://www.canada.ca/en/health-canada.html
의료기기 신청: https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices.html
의약품 신청: https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products.html
화장품 신고: https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics.html
전자신청(HPFB): https://hpr-rps.hres.ca
핵심 정보: 의료기기 Class I~IV | MDSAP 참여국 | 영어 또는 프랑스어

[호주 TGA 공식 서류]
TGA 공식 사이트: https://www.tga.gov.au
의료기기 신청: https://www.tga.gov.au/how-we-regulate/manufacturing/overseas-manufacturers-and-exporters
의약품 신청: https://www.tga.gov.au/resources/resource/forms/prescription-medicines-registration-application
화장품: https://www.tga.gov.au/products/cosmetics
전자신청(TBS): https://www.tga.gov.au/online-services
핵심 정보: 의료기기 Class I~III | MDSAP 참여국 | ARTG 등재 필수 | 영어 제출

[사우디아라비아 SFDA 공식 서류]
SFDA 공식 사이트: https://www.sfda.gov.sa/en
SFDA 전자신청 시스템(GHAD): https://ghad.sfda.gov.sa
SFDA 의약품 등록(SDR): https://sdr.sfda.gov.sa
SFDA 의료기기 등록(MDMA): https://ghad.sfda.gov.sa
SFDA 화장품 신고: https://ghad.sfda.gov.sa
SFDA 식품 등록: https://ghad.sfda.gov.sa
SFDA 법령/규정: https://www.sfda.gov.sa/en/regulations
핵심 정보:
- WHO 성숙도 Level 4 | ICH 정회원국 (2021년~)
- 의료기기: MDMA2 (Technical File Assessment) 필수 | Class I~IV
- 의약품: eCTD 제출 | 가격 심사 별도
- 화장품: SFDA 신고 필수
- GCC 국가들의 기준 참조국 역할
- 외국 제조사: 사우디 내 Authorized Representative(AR) 필수 | AR 라이선스 연간 갱신
- 영어 제출 가능 | 아랍어 라벨링 필수
- CE/FDA 선승인 필요 없음 (자체 기술문서 심사)

[UAE MOHAP/EDE 공식 서류]
EDE(Emirates Drug Establishment) 공식 사이트: https://www.ede.gov.ae
MOHAP 공식 사이트: https://mohap.gov.ae
의료기기 등록(EDE): https://www.ede.gov.ae
의약품 등록: https://mohap.gov.ae/en/services
두바이 DHA 규제: https://www.dha.gov.ae
아부다비 DOH 규제: https://www.doh.gov.ae
화장품 신고: https://www.ede.gov.ae
핵심 정보:
- 2025년 1월~ EDE가 MOHAP 의약품/의료기기 규제 권한 이관 받음
- 의료기기: Class I~IV | CE 또는 FDA 승인 보유 시 fast-track
- 외국 제조사: UAE 내 LAR(Local Authorized Representative) 필수 | MOHAP 라이선스 보유
- 제품등록 유효기간: 5년
- 등록 수수료: 의료기기 USD 1,360 / 제조사 등록 USD 2,859
- 아랍에밀리트에는 두바이(DHA), 아부다비(DOH), 연방(EDE) 별도 관할

[GCC 공통 규제 (걸프협력회의)]
GCC 의약품 공통 심사: https://www.gcc-sg.org
사우디(SFDA) 승인 = GCC 상호인정 검토 가능
쿠웨이트 MOH: https://www.moh.gov.kw
카타르 MOPH: https://www.moph.gov.qa
바레인 NHRA: https://www.nhra.bh
오만 MOH: https://www.moh.gov.om
핵심 정보: 사우디 SFDA 승인 후 GCC 타 국가 상호인정 활용 가능

[러시아 Roszdravnadzor 공식 서류]
Roszdravnadzor 공식 사이트: https://www.roszdravnadzor.gov.ru
의료기기 등록 포털: https://www.roszdravnadzor.gov.ru/services/misearch
의약품 등록: https://grls.rosminzdrav.ru
의약품 통합 정보 시스템: https://grls.rosminzdrav.ru
핵심 정보:
- 의료기기: Roszdravnadzor 등록 필수 | 러시아어 전체 문서 필수
- 의약품: 국가 등록 (GR) | 임상시험 러시아 현지 또는 외국 데이터 인정
- 화장품: Rospotrebnadzor 관할 | 신고제
- 외국 제조사: 러시아 법인 대리인 필수
- EAEU(유라시아경제연합) 공통 규정 적용 가능 (러시아+벨라루스+카자흐스탄+아르메니아+키르기스스탄)
- 현재 제재 상황으로 절차 변동 가능 → 전문가 확인 필요

[독일/EU 핵심 기관 공식 서류]
독일 BfArM(의약품): https://www.bfarm.de/EN
독일 BfR(화학/식품 위해평가): https://www.bfr.bund.de/en
독일 ZLG(인증기관): https://www.zlg.de/en
TUV SUD(인증): https://www.tuvsud.com
TUV Rheinland(인증): https://www.tuv.com
독일 DIHK 무역: https://www.dihk.de
핵심 정보: EU MDR/IVDR/EMA 규정 동일 적용 | CE 마킹 필수

[프랑스 ANSM 공식 서류]
ANSM 공식 사이트: https://ansm.sante.fr/en
의료기기 감시: https://ansm.sante.fr/en/our-activities/medical-devices
의약품 허가: https://ansm.sante.fr/en/our-activities/medicine
핵심 정보: EU EMA 중앙절차 + ANSM 국가절차 병행 | 프랑스어 라벨링 필수

[터키 TITCK 공식 서류]
TITCK 공식 사이트: https://www.titck.gov.tr/en
의약품 등록: https://www.titck.gov.tr/en/departments/pharmaceutical
의료기기 등록: https://www.titck.gov.tr/en/departments/medical-device
화장품 신고: https://www.titck.gov.tr/en/departments/cosmetics
전자신청(TABS): https://tabs.titck.gov.tr
핵심 정보:
- 의료기기: CE 마킹 인정 + 터키 추가 요건
- 의약품: EU CTD 형식 | 터키어 라벨링 필수
- 화장품: EU 기준 준용 | 사전신고제
- 외국 제조사: 터키 내 대리인(MAH) 필수

[이스라엘 MOH/IMOH 공식 서류]
이스라엘 MOH 공식 사이트: https://www.health.gov.il/English
의료기기 등록(IMOH): https://www.health.gov.il/English/MinistryUnits/IMOH
의약품 등록: https://www.health.gov.il/English/MinistryUnits/PCD
핵심 정보:
- 의료기기: FDA/CE 승인 보유 시 신속 경로 가능
- 의약품: 외국 승인 기반 reliance 방식
- 영어 제출 가능

[멕시코 COFEPRIS 공식 서류]
COFEPRIS 공식 사이트: https://www.gob.mx/cofepris
전자신청 포털: https://www.cofepris.gob.mx
의료기기 등록(Dispositivos Medicos): https://www.gob.mx/cofepris/acciones-y-programas/dispositivos-medicos
의약품 등록: https://www.gob.mx/cofepris/acciones-y-programas/medicamentos
화장품 신고: https://www.gob.mx/cofepris/acciones-y-programas/cosmeticos
핵심 정보:
- 의료기기: Class I~III | FDA/CE 승인 인정 (reliance)
- 의약품: NOM 기준 | 스페인어 라벨링 필수
- 외국 제조사: 멕시코 법인 대리인 필수

[폴란드/중동부 유럽 EU 공식 서류]
폴란드 Urząd Rejestracji: https://www.urpl.gov.pl/en
헝가리 OGYÉI: https://ogyei.gov.hu/en
체코 SUKL: https://www.sukl.eu/en
핵심 정보: EU EMA/MDR 공통 규정 적용 | 각국 언어 라벨링 추가 필요

[아세안 공통 서류]
ASEAN 의료기기 공통지침(AMDD): https://www.asean.org/asean-economic-community/sectoral-bodies-under-the-purview-of-aem/services/healthcare-services/
ASEAN 화장품 지침(ACD): https://asean.org/asean-cosmetics-directive/
ASEAN 의약품 공통기술문서: https://www.asean.org/asean-common-technical-dossier/

[국제 표준 공식 서류]
ISO 10993 생물학적 평가: https://www.iso.org/standard/68936.html
ISO 13485 의료기기 QMS: https://www.iso.org/standard/59752.html
ISO 14971 위험관리: https://www.iso.org/standard/72704.html
ISO 22716 화장품GMP: https://www.iso.org/standard/36437.html
ISO 22000 식품안전: https://www.iso.org/standard/65464.html
ISO 9001 품질경영: https://www.iso.org/standard/62085.html
ICH 가이드라인 전체: https://www.ich.org/page/guidelines
WHO 규제지원 도구: https://www.who.int/teams/health-product-and-policy-standards

[화학물질/REACH]
ECHA REACH 등록: https://echa.europa.eu/regulations/reach/registration
ECHA C&L 신고: https://echa.europa.eu/regulations/clp/cl-inventory
SDS 양식 가이드: https://echa.europa.eu/support/guidance-on-reach-and-clp-implementation/reach-guidance
ECHA SCIP DB: https://echa.europa.eu/scip-database
EPA TSCA 신청: https://www.epa.gov/tsca-inventory
GHS SDS 국제기준: https://unece.org/ghs

DOCUMENT PROVISION RULES (모든 서류에 예외 없이 적용):

RULE 1 - 링크 필수 제공:
모든 서류, 신청서, 양식, 인증서, 보고서를 언급할 때 반드시 공식 링크를 함께 제공.
링크 없이 서류명만 나열하는 것은 절대 금지.
데이터베이스에 없는 서류는 해당 기관 공식 메인 URL 제공.

RULE 2 - 서류 목록 형식 (반드시 이 형식 사용):
필수 제출 서류:
1. [서류명]
   - 공식 링크: [URL]
   - 설명: [용도 및 작성 방법]
   - 번역 필요 여부: [예/아니오]

선택 제출 서류:
1. [서류명]
   - 공식 링크: [URL]
   - 설명: [용도]

RULE 3 - 번역 제공:
사용자가 "번역해 달라" 또는 "번역본 제공" 요청 시:
- 해당 서류의 주요 내용을 요청한 언어로 즉시 번역하여 제공
- 번역 시 원문 조항 번호 유지
- 전문 규제 용어는 해당 언어의 공식 표준 용어 사용
- 번역본 하단에 "본 번역은 참고용이며, 공증번역이 필요한 경우 공인 번역기관을 이용하십시오" 명시

RULE 4 - 서류 초안 작성:
사용자가 서류 작성을 요청하면:
- 해당 기관의 공식 양식 구조에 맞춰 초안 작성
- 필수 항목은 구체적으로 작성
- 선택 항목은 예시와 함께 제공
- 공식 링크 함께 제공

RULE 5 - 다국어 서류 지원:
동일 서류의 다국어 버전이 있으면 모두 링크 제공:
예) NMPA 신청서 (중국어) + 영문 가이드 동시 제공

CRITICAL: Never guess regulation numbers. Answer ALL parts of the user question.
Regulatory errors have serious legal and safety consequences.`;
}

// =============================================================================
// HELPERS
// =============================================================================
function getGuestCount() { return parseInt(localStorage.getItem(GUEST_COUNT_KEY) || '0', 10); }
function incrementGuestCount() {
  const n = getGuestCount() + 1;
  localStorage.setItem(GUEST_COUNT_KEY, String(n));
  if (!localStorage.getItem(GUEST_FIRST_KEY)) localStorage.setItem(GUEST_FIRST_KEY, String(Date.now()));
  return n;
}
function isGuestPeriodActive() {
  const f = parseInt(localStorage.getItem(GUEST_FIRST_KEY) || '0', 10);
  return !f || Date.now() - f < GUEST_FREE_PERIOD_MS;
}

// =============================================================================
// APP
// =============================================================================
export default function App() {
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [session, setSession]             = useState<any>(null);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [activeModule, setActiveModule]   = useState('pharma');
  const [activeAgency, setActiveAgency]   = useState('All Agencies');
  const [activeView, setActiveView]       = useState<ActiveView>('chat');
  const [theme, setTheme]                 = useState<'light'|'dark'>('light');
  const [language, setLanguage]           = useState('ko');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdmin, setShowAdmin]         = useState(false);
  const [trialInfo, setTrialInfo]         = useState<any>(null);
  const [uploadedFile, setUploadedFile]   = useState<File|null>(null);
  const [guestCount, setGuestCount]       = useState(getGuestCount());
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [agencyFilter, setAgencyFilter]   = useState('All Agencies');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        setIsAdmin(ADMIN_EMAILS.includes(session.user.email));
        getUserTrialStatus(session.user.id).then(setTrialInfo);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user?.email) {
        setIsAdmin(ADMIN_EMAILS.includes(s.user.email));
        getUserTrialStatus(s.user.id).then(setTrialInfo);
      } else { setIsAdmin(false); setTrialInfo(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const mod = MODULES.find(m => m.id === activeModule);
    setMessages([{
      role: 'assistant',
      content: `## ${mod?.label} 규제 어시스턴트\n\n다음 내용을 도와드립니다:\n- **Q&A**: ${mod?.agencies.join(', ')} 요건 안내\n- **국가별 허가 요건** 비교 분석\n- **서류 초안** 자동 생성\n- **규제 변경사항** 모니터링\n- **제출 절차** 단계별 안내\n\n무엇을 도와드릴까요?`,
      timestamp: new Date(),
    }]);
  }, [activeModule]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const sendMessage = async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text && !uploadedFile) return;

    const isDeveloper = session && ADMIN_EMAILS.includes(session.user.email);

    if (!session && !isDeveloper) {
      if (!isGuestPeriodActive()) {
        setMessages(p => [...p, { role: 'assistant', content: '7일 무료 체험 기간이 종료되었습니다. 계속 이용하시려면 로그인해 주세요.', timestamp: new Date() }]);
        setShowAuthModal(true); return;
      }
      if (getGuestCount() >= GUEST_FREE_LIMIT) {
        setMessages(p => [...p, { role: 'assistant', content: `무료 체험 ${GUEST_FREE_LIMIT}회를 모두 사용하셨습니다. 무료 계정을 만들어 계속 이용하세요!`, timestamp: new Date() }]);
        setShowAuthModal(true); return;
      }
    }

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let fileCtx = '';
      if (uploadedFile) { fileCtx = '\n\n[첨부파일: ' + uploadedFile.name + ']'; setUploadedFile(null); }

      const history = messages.filter(m => m.role !== 'system').slice(-6).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const systemPrompt = buildSystemPrompt(activeModule, activeAgency, language);

      const apiRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [...history, { role: 'user', content: text + fileCtx }],
        }),
      });

      const apiData = await apiRes.json();

      let reply = '';
      if (apiData.reply) {
        reply = apiData.reply;
        if (reply.length < 80) {
          reply += '\n\n*더 정확한 답변을 위해 제품 유형, 대상 시장, 구체적인 규제 질문을 알려주세요.*';
        }
      } else if (apiData.error) {
        const errMsg = String(apiData.error);
        const is429 = errMsg.includes('rate') || errMsg.includes('limit') || errMsg.includes('429');
        if (is429) {
          reply = '잠시 후 다시 시도해 주세요. (API 요청 한도 초과)';
        } else {
          reply = '서비스 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (' + errMsg.substring(0, 80) + ')';
        }
      } else {
        reply = '응답을 받지 못했습니다. 질문을 다시 입력해 주세요.';
      }

      setMessages(p => [...p, { role: 'assistant', content: reply, timestamp: new Date() }]);

      if (!session && !isDeveloper) { const n = incrementGuestCount(); setGuestCount(n); }
      if (session) await logUsage(session.user.id, text, reply, 0, 0);

    } catch {
      setMessages(p => [...p, { role: 'assistant', content: '연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts: Record<ActiveView, string[]> = {
    chat:      ['FDA 510(k) 신청 핵심 요건은?', 'EU MDR vs 한국 의료기기법 비교', '중국 NMPA 의약품 허가 절차', 'ISO 13485 인증 취득 절차'],
    search:    ['510(k) 제출 필수 서류 목록', 'REACH 등록 요건 화학물질', 'MFDS 의약품 허가 신청 요건', 'CE 마킹 의료기기 절차'],
    documents: ['FDA 510(k) 커버레터 초안 작성', 'GMP 자체점검 체크리스트', 'REACH 등록 요약서 양식', 'CE 적합성선언서 작성'],
    monitor:   ['2025년 FDA 규제 변경사항', 'EU MDR 최신 업데이트', 'MFDS 최근 고시 개정', 'ICH 가이드라인 신규 발행'],
    submit:    ['FDA 510(k) 제출 단계별 절차', 'EMA MAA 제출 방법', 'MFDS 온라인 허가 신청', 'EU CE 마킹 제출 절차'],
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); setSession(null); setIsAdmin(false); };
  const currentMod = MODULES.find(m => m.id === activeModule)!;

  if (showAdmin && isAdmin) return <AdminDashboard userId={session?.user?.id} onLogout={() => setShowAdmin(false)} />;

  return (
    <div className={'gra-root ' + theme} data-theme={theme}>

      {/* SIDEBAR */}
      <aside className={'gra-sidebar ' + (sidebarOpen ? 'open' : 'collapsed')}>
        <div className="gra-logo" onClick={() => setSidebarOpen(o => !o)}>
          <div className="gra-logo-icon"><Globe size={20} /></div>
          {sidebarOpen && <span className="gra-logo-text">GlobalRegAI</span>}
        </div>

        {sidebarOpen && <div className="gra-section-label">REGULATORY DOMAINS</div>}
        <nav className="gra-nav">
          {MODULES.map(mod => (
            <button
              key={mod.id}
              className={'gra-nav-item ' + (activeModule === mod.id ? 'active' : '')}
              onClick={() => { setActiveModule(mod.id); setActiveView('chat'); }}
              title={mod.label}
              style={{ '--mod-color': mod.color } as React.CSSProperties}
            >
              <mod.icon size={18} />
              {sidebarOpen && (
                <div className="gra-nav-text">
                  <span className="gra-nav-label">{mod.label}</span>
                  <span className="gra-nav-desc">{mod.description.split(',')[0]}</span>
                </div>
              )}
              {sidebarOpen && activeModule === mod.id && <ChevronRight size={14} className="gra-nav-arrow" />}
            </button>
          ))}
        </nav>

        <div className="gra-sidebar-footer">
          {!session && sidebarOpen && (
            <div className="gra-status-box guest">
              <Clock size={13} />
              <div>
                <strong>게스트 모드</strong>
                <p>{guestCount}/{GUEST_FREE_LIMIT}회 사용</p>
                <button className="gra-signin-btn" onClick={() => setShowAuthModal(true)}>무료 계정 만들기</button>
              </div>
            </div>
          )}
          {session && isAdmin && sidebarOpen && (
            <div className="gra-status-box developer">
              <CheckCircle size={13} />
              <div><strong>개발자 모드</strong><p>무제한 사용</p></div>
            </div>
          )}
          {session && !isAdmin && trialInfo && sidebarOpen && (
            <div className="gra-status-box trial">
              <Clock size={13} />
              <div>
                <strong>{trialInfo.plan_type === 'trial' ? '체험판' : '활성'}</strong>
                <p>{trialInfo.queries_used}/{trialInfo.queries_limit}회</p>
              </div>
            </div>
          )}

          {session ? (
            <>
              {sidebarOpen && <div className="gra-user-email">{session.user.email}</div>}
              {isAdmin && (
                <button className="gra-nav-item" onClick={() => setShowAdmin(true)}>
                  <Users size={16} />
                  {sidebarOpen && <span>관리자 대시보드</span>}
                </button>
              )}
              <button className="gra-nav-item danger" onClick={handleSignOut}>
                <LogOut size={16} />
                {sidebarOpen && <span>로그아웃</span>}
              </button>
            </>
          ) : (
            <button className="gra-nav-item signin" onClick={() => setShowAuthModal(true)}>
              <Database size={16} />
              {sidebarOpen && <span>로그인 / 회원가입</span>}
            </button>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="gra-main">
        <header className="gra-topbar">
          <div className="gra-topbar-left">
            <div className="gra-mod-badge" style={{ background: currentMod.color }}>
              <currentMod.icon size={14} />
            </div>
            <div>
              <h1 className="gra-topbar-title">{currentMod.label}</h1>
              <p className="gra-topbar-agencies">{currentMod.agencies.join(' · ')}</p>
            </div>
          </div>
          <div className="gra-topbar-right">
            <select className="gra-select" value={agencyFilter} onChange={e => { setAgencyFilter(e.target.value); setActiveAgency(e.target.value); }}>
              {AGENCIES.map(a => <option key={a}>{a}</option>)}
            </select>
            <select className="gra-select" value={language} onChange={e => setLanguage(e.target.value)}>
              {Object.entries(LANGUAGES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="gra-icon-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon size={17}/> : <Sun size={17}/>}
            </button>
            <div className={'gra-status-dot ' + (session ? 'online' : 'guest')} />
          </div>
        </header>

        <div className="gra-tabs">
          {([
            { id: 'chat',      icon: Send,        label: 'Q&A 채팅'   },
            { id: 'search',    icon: Search,      label: '요건 검색'  },
            { id: 'documents', icon: FileText,    label: '서류 작성'  },
            { id: 'monitor',   icon: AlertCircle, label: '변경 모니터' },
            { id: 'submit',    icon: Share2,      label: '제출 가이드' },
          ] as {id: ActiveView; icon: React.ElementType; label: string}[]).map(tab => (
            <button
              key={tab.id}
              className={'gra-tab ' + (activeView === tab.id ? 'active' : '')}
              onClick={() => setActiveView(tab.id)}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeView === 'documents' && (
          <div className="gra-doc-panel">
            <div className="gra-doc-panel-header"><Filter size={14} /> 서류 템플릿 선택</div>
            <div className="gra-doc-grid">
              {DOCUMENT_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  className={'gra-doc-chip ' + (selectedTemplate === t.id ? 'active' : '')}
                  onClick={() => { setSelectedTemplate(t.id); sendMessage('다음 서류의 전체 초안을 작성해 주세요: ' + t.label + ' (' + t.agency + ')'); }}
                >
                  <span className="gra-doc-agency">{t.agency}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="gra-messages">
          {messages.map((msg, i) => (
            <div key={i} className={'gra-msg ' + msg.role}>
              <div className="gra-msg-avatar">
                {msg.role === 'user' ? 'U' : <Globe size={14}/>}
              </div>
              <div className="gra-msg-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                {msg.timestamp && (
                  <span className="gra-msg-time">
                    {msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  </span>
                )}
              </div>
              {msg.role === 'assistant' && (
                <button className="gra-copy-btn" title="복사" onClick={() => navigator.clipboard.writeText(msg.content)}>
                  <Download size={13}/>
                </button>
              )}
            </div>
          ))}
          {loading && (
            <div className="gra-msg assistant">
              <div className="gra-msg-avatar"><Globe size={14}/></div>
              <div className="gra-msg-body gra-typing"><span/><span/><span/></div>
            </div>
          )}
          <div ref={messagesEndRef}/>
        </div>

        {messages.length <= 1 && (
          <div className="gra-quick-prompts">
            {quickPrompts[activeView].map((p, i) => (
              <button key={i} className="gra-quick-btn" onClick={() => sendMessage(p)}>
                <ChevronDown size={13}/> {p}
              </button>
            ))}
          </div>
        )}

        <div className="gra-input-area">
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.xlsx" style={{display:'none'}} onChange={e => setUploadedFile(e.target.files?.[0]||null)} />
          {uploadedFile && (
            <div className="gra-file-chip">
              첨부: {uploadedFile.name}
              <button onClick={() => setUploadedFile(null)}>X</button>
            </div>
          )}
          <div className="gra-input-row">
            <button className="gra-attach-btn" onClick={() => fileInputRef.current?.click()} title="파일 첨부">
              <Paperclip size={18}/>
            </button>
            <input
              className="gra-text-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()}
              placeholder={!session ? (currentMod.label + ' 규제 질문을 입력하세요 (무료 ' + (GUEST_FREE_LIMIT - guestCount) + '회 남음)') : (currentMod.label + ' / ' + activeAgency + ' 규제 질문을 입력하세요...')}
              disabled={loading}
            />
            <button className="gra-send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{ background: currentMod.color }}>
              <Send size={18}/>
            </button>
          </div>
        </div>
      </main>

      {showAuthModal && (
        <div className="gra-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="gra-modal" onClick={e => e.stopPropagation()}>
            <button className="gra-modal-close" onClick={() => setShowAuthModal(false)}>X</button>
            <Auth onLogin={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
