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
