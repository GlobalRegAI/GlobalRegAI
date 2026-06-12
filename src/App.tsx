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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAILS = ['uk.dscheon@gmail.com', 'superadmin@globalregai.info'];
const GUEST_FREE_LIMIT = 30;
const GUEST_COUNT_KEY = 'globalregai_guest_count';
const GUEST_FIRST_KEY = 'globalregai_guest_first_ts';
const GUEST_FREE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Module = {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  agencies: string[];
  color: string;
};

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
};

type ActiveView = 'chat' | 'search' | 'documents' | 'monitor' | 'submit';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE DEFINITIONS — 전체 규제 산업 범위
// ─────────────────────────────────────────────────────────────────────────────
const MODULES: Module[] = [
  {
    id: 'pharma',
    icon: ShieldAlert,
    label: 'Pharmaceuticals',
    description: 'Drug approvals, NDA/BLA/MAA, GMP, pharmacovigilance',
    agencies: ['FDA', 'EMA', 'MFDS', 'PMDA', 'NMPA'],
    color: '#2563EB',
  },
  {
    id: 'medical_device',
    icon: Activity,
    label: 'Medical Devices',
    description: '510(k), PMA, CE Mark, MDR/IVDR, MDSAP, ISO 13485',
    agencies: ['FDA', 'EMA', 'MHRA', 'MFDS', 'IMDRF'],
    color: '#7C3AED',
  },
  {
    id: 'cosmetics',
    icon: Layers,
    label: 'Cosmetics',
    description: 'CPNP, FDA cosmetic, MFDS, ISO 22716 GMP',
    agencies: ['FDA', 'EMA', 'MFDS', 'MHRA'],
    color: '#DB2777',
  },
  {
    id: 'food',
    icon: FileCheck,
    label: 'Food Safety',
    description: 'HACCP, FDA food, EFSA, Codex Alimentarius, labeling',
    agencies: ['FDA', 'EFSA', 'MFDS', 'FAO', 'Codex'],
    color: '#059669',
  },
  {
    id: 'chemical',
    icon: Box,
    label: 'Chemicals',
    description: 'REACH, RoHS, TSCA, GHS/SDS, hazardous substances',
    agencies: ['ECHA', 'EPA', 'OECD', 'UNEP'],
    color: '#D97706',
  },
  {
    id: 'animal',
    icon: Globe,
    label: 'Animal & Veterinary',
    description: 'Veterinary drugs, animal feed, WOAH, zoonotic diseases',
    agencies: ['FDA-CVM', 'EMA-CVMP', 'WOAH', 'MFDS'],
    color: '#0891B2',
  },
  {
    id: 'standards',
    icon: FileText,
    label: 'Standards & QMS',
    description: 'ISO, IEC, GMP/GLP/GCP, PIC/S, ICH guidelines',
    agencies: ['ISO', 'IEC', 'ICH', 'PIC/S', 'WHO'],
    color: '#4F46E5',
  },
  {
    id: 'certification',
    icon: CheckCircle,
    label: 'Certification',
    description: 'CE, UKCA, FCC, UL, RoHS, TÜV, CSA compliance',
    agencies: ['CE', 'UKCA', 'FCC', 'UL', 'TÜV'],
    color: '#0F766E',
  },
];

const AGENCIES = [
  'All Agencies','FDA','EMA','MHRA','MFDS','PMDA','NMPA',
  'ANVISA','EFSA','ECHA','WHO','ICH','IMDRF','ISO','PIC/S',
];

const LANGUAGES: Record<string, string> = {
  en: 'English', ko: '한국어', ja: '日本語',
  'zh-TW': '中文(繁)', 'zh-CN': '中文(简)', es: 'Español',
};

const DOCUMENT_TEMPLATES = [
  { id: 'nda',    label: 'NDA Submission Cover Letter',       agency: 'FDA'  },
  { id: '510k',   label: '510(k) Premarket Notification',     agency: 'FDA'  },
  { id: 'maa',    label: 'Marketing Authorisation Application',agency: 'EMA'  },
  { id: 'ce',     label: 'CE Declaration of Conformity',      agency: 'CE'   },
  { id: 'cpnp',   label: 'CPNP Cosmetic Product Notification', agency: 'EMA'  },
  { id: 'gmp',    label: 'GMP Self-Inspection Checklist',     agency: 'WHO'  },
  { id: 'reach',  label: 'REACH Registration Summary',        agency: 'ECHA' },
  { id: 'haccp',  label: 'HACCP Plan Template',               agency: 'Codex'},
  { id: 'sds',    label: 'Safety Data Sheet (GHS)',           agency: 'OECD' },
  { id: 'mfds_k', label: 'MFDS 품목허가 신청서',               agency: 'MFDS' },
];

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI KEY ROTATION
// ─────────────────────────────────────────────────────────────────────────────
let geminiKeyIndex = 0;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// REGULATORY KNOWLEDGE HARNESS — Gemini 정확성 강화
// ─────────────────────────────────────────────────────────────────────────────
const REGULATORY_HARNESS_RULES = [
  'ALWAYS cite specific regulation numbers — never give generic statements without references',
  'NEVER fabricate regulation numbers or guidance titles that do not exist',
  'If uncertain about a specific number, say "verify with official source" rather than guessing',
  'ALWAYS specify jurisdiction (US/EU/Korea/Japan/etc.) for every requirement stated',
  'ALWAYS distinguish between MANDATORY requirements and RECOMMENDATIONS',
  'For timelines, provide official ranges — do not invent specific durations',
  'Flag with WARNING symbol when requirements may have changed recently',
  'Use checkmark for confirmed requirements, clipboard for documentation items',
  'Grammar: use active voice for requirements, passive voice for processes',
  'Numbers: use official formats (dates as YYYY-MM-DD, currencies as ISO 4217)',
  'Acronyms: define on first use then use acronym consistently throughout',
  'Structure every response with clear headers, jurisdiction labels, and document lists',
];

const MODULE_KNOWLEDGE: Record<string, string> = {
  pharma: `PHARMACEUTICAL REGULATORY KNOWLEDGE:
US FDA: 21 CFR Part 210/211 (cGMP Manufacturing) | 21 CFR Part 314 (NDA Applications) | 21 CFR Part 312 (IND) | 21 CFR Part 600-680 (Biologics)
EU EMA: Directive 2001/83/EC | Regulation (EC) No 726/2004 (centralised procedure) | EudraLex Volume 4 (GMP)
Korea MFDS: Pharmaceutical Affairs Act (약사법) | MFDS GMP Notification | Drug Approval Review Standards
Japan PMDA: Pharmaceuticals and Medical Devices Act (PMDA) | J-GMP
ICH Guidelines: Q1-Q14 Quality | S1-S12 Safety | E1-E19 Efficacy | M1-M16 Multidisciplinary
Pharmacovigilance: FDA FAERS | EMA EudraVigilance | ICH E2A/E2B/E2C/E2D/E2E/E2F`,

  medical_device: `MEDICAL DEVICE REGULATORY KNOWLEDGE:
US FDA: 21 CFR Part 820 (Quality System Regulation) | 21 CFR Part 807 (510k) | 21 CFR Part 814 (PMA) | 21 CFR Part 830 (UDI)
EU: MDR 2017/745 | IVDR 2017/746 | MEDDEV Guidelines | Notified Body (NB) assessment required Class IIa+
Korea MFDS: Medical Devices Act (의료기기법) | KGMP | Class I-IV classification
Standards: ISO 13485:2016 (QMS) | ISO 14971:2019 (Risk Management) | IEC 62304 (Software) | ISO 14155:2020 (Clinical)
MDSAP: Single audit programme covering FDA/Health Canada/ANVISA/TGA/PMDA
UDI: FDA UDI Final Rule | EU MDR Article 27 | IMDRF UDI Guidance`,

  cosmetics: `COSMETICS REGULATORY KNOWLEDGE:
US FDA: MoCRA 2022 (Modernization of Cosmetics Regulation Act) | 21 CFR Part 700-740 | No pre-market approval — post-market responsibility
EU: Regulation (EC) No 1223/2009 | CPNP mandatory notification | Responsible Person (RP) required | EU Annex II (1,377 prohibited substances)
Korea MFDS: Cosmetics Act (화장품법) | Functional Cosmetics Review | Prohibited/Restricted Ingredients List
GMP: ISO 22716:2007 (EU mandatory for distributors) | FDA Cosmetic GMP Guidance (voluntary)
Labeling: INCI nomenclature globally | FDA ingredient list rules | EU full ingredient list mandatory`,

  food: `FOOD SAFETY REGULATORY KNOWLEDGE:
US FDA: FSMA 2011 | 21 CFR Part 117 (Preventive Controls for Human Food) | 21 CFR Part 101 (Labeling) | GRAS Notification
US USDA/FSIS: meat, poultry, processed egg products oversight
EU: Regulation (EC) No 178/2002 (General Food Law) | Regulation (EU) 1169/2011 (Food Information) | EFSA risk assessment
Korea MFDS: Food Sanitation Act (식품위생법) | Health Functional Food Act (건강기능식품법) | HACCP mandatory for certain categories
Codex Alimentarius: International food standards, CAC/RCP 1-1969 Rev.4 (HACCP)
Allergens: FDA 9 major allergens | EU 14 allergens | mandatory declaration globally`,

  chemical: `CHEMICAL REGULATORY KNOWLEDGE:
EU REACH: Regulation (EC) No 1907/2006 | Registration >1 tonne/year | SVHC Authorisation | Restriction (Annex XVII)
EU RoHS: Directive 2011/65/EU amended by 2015/863 | 10 restricted substances | CE marking required
US TSCA: EPA Toxic Substances Control Act | PMN for new chemicals | Section 6 risk evaluation | CDR reporting
GHS/SDS: UN GHS Revision 9 | 16-section Safety Data Sheet | 9 hazard pictograms | signal words Danger/Warning
OECD Test Guidelines: chemical safety assessment methods | Good Laboratory Practice (GLP)
ECHA: Substance registration | C&L Notification | SIEF participation | SCIP database`,

  animal: `ANIMAL AND VETERINARY REGULATORY KNOWLEDGE:
US FDA-CVM: 21 CFR Parts 500-599 | NADA (New Animal Drug Application) | ANADA (Abbreviated) | Veterinary Feed Directive
EU EMA-CVMP: Regulation (EU) 2019/6 (Veterinary Medicinal Products) | centralised/decentralised/MRP procedures
WOAH (formerly OIE): Terrestrial Animal Health Code | Aquatic Animal Health Code | disease notification obligations
Veterinary GMP: same framework as human pharma with species-specific validation requirements
Zoonotic diseases: One Health approach | WHO/FAO/WOAH tripartite coordination
Animal feed: EU Regulation (EC) No 767/2009 | FDA 21 CFR Part 573 (feed additives)`,

  standards: `STANDARDS AND QMS KNOWLEDGE:
ISO 13485:2016: Medical device QMS | mandatory for EU MDR CE marking | covers design, production, post-market
ISO 14971:2019: Risk management for medical devices | hazard identification | risk evaluation | risk control
ISO 9001:2015: General QMS | process approach | risk-based thinking | PDCA cycle
ISO 22716:2007: Cosmetics GMP | EU mandatory for responsible person | covers production, control, storage
ISO 22000:2018: Food safety management | HACCP integration | prerequisite programs
ICH Q10: Pharmaceutical Quality System | lifecycle approach | continual improvement
PIC/S GMP: PE 009-16 | mutual recognition among 53 participating authorities
GAMP 5: Computer system validation for regulated industries`,

  certification: `CERTIFICATION AND COMPLIANCE KNOWLEDGE:
CE Marking: EU Declaration of Conformity | essential requirements compliance | Notified Body for Class IIa+ devices, Class II cosmetics (claims)
UKCA: Post-Brexit UK conformity assessment | valid from Jan 2023 | UKCA marking for Great Britain market
FCC: Part 15 (unintentional radiators) | Part 18 (ISM equipment) | FCC ID required for intentional radiators
UL: UL 62368-1 (audio/video IT) | UL 60950 (legacy) | NRTL recognition | North American safety
RoHS: Substance testing per IEC 62321 | technical documentation | EU Declaration of Conformity
TUV/SGS/Intertek/Bureau Veritas: third-party testing and certification bodies
CSA: Canadian standards | CAN/CSA harmonisation with UL | CSA Group certification`,
};

function buildSystemPrompt(moduleId: string, agency: string, language: string): string {
  const mod = MODULES.find(m => m.id === moduleId);
  const langName = LANGUAGES[language] || 'English';
  const agencyFocus = agency === 'All Agencies'
    ? (mod?.agencies.join(', ') || 'FDA, EMA, MHRA, MFDS, PMDA')
    : agency;
  const modKnowledge = MODULE_KNOWLEDGE[moduleId] || MODULE_KNOWLEDGE['pharma'];
  const rules = REGULATORY_HARNESS_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n');

  return `You are GlobalRegAI — a precise expert AI for global regulatory affairs, compliance, and market authorization.

ACTIVE MODULE: ${mod?.label || 'General Regulatory'}
FOCUS AGENCIES: ${agencyFocus}
RESPONSE LANGUAGE: ${langName}

${modKnowledge}

STRICT ACCURACY HARNESS (MUST FOLLOW):
${rules}

MANDATORY RESPONSE STRUCTURE:
- For Q&A: ## Topic | Jurisdiction | Regulation Number | Requirements | Timeline | Documents | Risks
- For Documents: Use official regulatory language | Mark [REQUIRED] and [OPTIONAL] fields
- For Comparisons: Use tables with jurisdiction rows and checkmark/cross indicators
- For Monitoring: State effective dates | Impact assessment | Action required by when

GRAMMAR STANDARDS:
- Regulatory terminology only — no colloquial language
- Active voice: "The applicant must submit..." 
- Passive voice for processes: "Applications are reviewed within..."
- Define all acronyms on first use
- ISO date format: YYYY-MM-DD

CRITICAL RULE: If uncertain about any specific regulation number, date, or requirement,
explicitly state "Please verify with [agency name] official website" rather than guessing.
Accuracy is paramount — regulatory errors have serious legal and safety consequences.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // ── State ──
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [session, setSession]             = useState<any>(null);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [activeModule, setActiveModule]   = useState('pharma');
  const [activeAgency, setActiveAgency]   = useState('All Agencies');
  const [activeView, setActiveView]       = useState<ActiveView>('chat');
  const [theme, setTheme]                 = useState<'light'|'dark'>('light');
  const [language, setLanguage]           = useState('en');
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

  // ── Auth ──
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

  // ── Welcome message on module change ──
  useEffect(() => {
    const mod = MODULES.find(m => m.id === activeModule);
    setMessages([{
      role: 'assistant',
      content: `## ${mod?.label} Regulatory Assistant\n\nI can help you with:\n- **Q&A** on ${mod?.agencies.join(', ')} requirements\n- **Permit & authorization** requirements by country\n- **Document drafting** for submissions\n- **Regulatory changes** monitoring\n- **Submission guidance** step-by-step\n\nWhat would you like to know?`,
      timestamp: new Date(),
    }]);
  }, [activeModule]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Send Message ──
  const sendMessage = async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text && !uploadedFile) return;

    const isDeveloper = session && ADMIN_EMAILS.includes(session.user.email);

    if (!session && !isDeveloper) {
      if (!isGuestPeriodActive()) {
        setMessages(p => [...p, { role: 'assistant', content: '⏰ Your 7-day free trial has ended. Please sign in to continue.', timestamp: new Date() }]);
        setShowAuthModal(true); return;
      }
      if (getGuestCount() >= GUEST_FREE_LIMIT) {
        setMessages(p => [...p, { role: 'assistant', content: `🔒 You have used all ${GUEST_FREE_LIMIT} free queries. Create a free account to continue!`, timestamp: new Date() }]);
        setShowAuthModal(true); return;
      }
    }

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let fileCtx = '';
      if (uploadedFile) { fileCtx = `\n\n[Attached: ${uploadedFile.name}]`; setUploadedFile(null); }

      const history = messages
        .filter(m => m.role !== 'system')
        .slice(-8)
        .map(m => ({ role: m.role as 'user'|'assistant', content: m.content }));

      // ── Gemini 1.5 Flash API 호출 (무료 tier) ──
      const systemPrompt = buildSystemPrompt(activeModule, activeAgency, language);

      const geminiContents = [
        { role: 'user',  parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I am GlobalRegAI. I will provide precise, well-structured regulatory guidance following all accuracy rules and citation requirements.' }] },
        ...history.slice(-6).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: text + fileCtx }] },
      ];

      // ── Gemini API — 3키 자동 로테이션 + 429시 다음 키로 재시도 ──
      const GEMINI_BODY = {
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.2, topP: 0.8, topK: 40 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      };

      // 사용 가능한 키 목록 수집
      const availableKeys = [
        import.meta.env.VITE_GEMINI_API_KEY_1,
        import.meta.env.VITE_GEMINI_API_KEY_2,
        import.meta.env.VITE_GEMINI_API_KEY_3,
        import.meta.env.VITE_GEMINI_API_KEY_4,
        import.meta.env.VITE_GEMINI_API_KEY_5,
        import.meta.env.VITE_GEMINI_API_KEY,
      ].filter((k): k is string => Boolean(k) && k.startsWith('AIza'));

      let geminiData: any = null;
      let lastError = '';

      // 각 키로 순서대로 시도 — 429면 다음 키로 넘어감
      for (let i = 0; i < availableKeys.length; i++) {
        const keyToUse = availableKeys[(geminiKeyIndex + i) % availableKeys.length];
        const res = await fetch(
          `/api/gemini`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(GEMINI_BODY) }
        );
        geminiData = await res.json();
        if (!geminiData.error) { geminiKeyIndex = (geminiKeyIndex + i + 1) % availableKeys.length; break; }
        lastError = geminiData.error.message || '';
        const is429 = lastError.includes('429') || lastError.includes('RESOURCE_EXHAUSTED') || lastError.includes('TooManyRequests') || lastError.includes('quota');
        if (!is429) break; // 429가 아닌 오류면 재시도 불필요
        // 429면 다음 키로 계속
      }

      // ── 응답 처리 ──
      let reply = '';
      if (geminiData?.candidates?.[0]?.content?.parts?.[0]?.text) {
        reply = geminiData.candidates[0].content.parts[0].text;
        if (reply.length < 80) {
          reply += '\n\n*For more detailed guidance, please specify your product type, target market, and regulatory pathway.*';
        }
      } else if (geminiData?.error) {
        const errMsg = geminiData.error.message || '';
        const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('TooManyRequests') || errMsg.includes('quota');
        if (is429) {
          reply = '⚠️ **All API keys are temporarily rate-limited.** Please wait a few minutes and try again.';
        } else if (errMsg.includes('API_KEY') || errMsg.includes('invalid')) {
          reply = '⚠️ **Configuration error.** Please contact: uk.dscheon@gmail.com';
        } else if (errMsg.includes('not found') || errMsg.includes('404')) {
          reply = '⚠️ **Model not available.** Please contact: uk.dscheon@gmail.com';
        } else {
          reply = `⚠️ **Service issue.** Please try again. (${errMsg.substring(0, 100)})`;
        }
      } else {
        reply = '⚠️ No response received. Please rephrase your question.';
      }

      setMessages(p => [...p, { role: 'assistant', content: reply, timestamp: new Date() }]);

      if (!session && !isDeveloper) { const n = incrementGuestCount(); setGuestCount(n); }
      if (session) await logUsage(session.user.id, text, reply, 0, 0);

    } catch {
      setMessages(p => [...p, { role: 'assistant', content: '⚠️ Connection error. Please try again.', timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Quick Prompts by view ──
  const quickPrompts: Record<ActiveView, string[]> = {
    chat: [
      `What are the key requirements for ${MODULES.find(m=>m.id===activeModule)?.label} approval in the US?`,
      `Compare FDA vs EMA requirements for ${MODULES.find(m=>m.id===activeModule)?.label}`,
      `What is the typical timeline for ${MODULES.find(m=>m.id===activeModule)?.label} authorization in Korea?`,
      `What GMP standards apply to ${MODULES.find(m=>m.id===activeModule)?.label}?`,
    ],
    search: [
      `List all required documents for 510(k) submission`,
      `REACH registration requirements for chemical substances`,
      `ISO 13485 certification process step by step`,
      `MFDS 의약품 허가 신청 요건`,
    ],
    documents: [
      `Draft a 510(k) cover letter for a Class II device`,
      `Generate GMP self-inspection checklist`,
      `Create REACH registration summary template`,
      `Write CE Declaration of Conformity`,
    ],
    monitor: [
      `Latest FDA regulatory changes in 2025`,
      `EMA MDR implementation updates`,
      `Recent MFDS regulation amendments`,
      `ICH guidelines new releases`,
    ],
    submit: [
      `Step-by-step FDA 510(k) submission process`,
      `How to submit MAA to EMA`,
      `MFDS online submission portal guide`,
      `CE marking submission process for EU`,
    ],
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); setSession(null); setIsAdmin(false); };
  const currentMod = MODULES.find(m => m.id === activeModule)!;

  if (showAdmin && isAdmin) return <AdminDashboard userId={session?.user?.id} onLogout={() => { setShowAdmin(false); }} />;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`gra-root ${theme}`} data-theme={theme}>

      {/* ── SIDEBAR ── */}
      <aside className={`gra-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        {/* Logo */}
        <div className="gra-logo" onClick={() => setSidebarOpen(o => !o)}>
          <div className="gra-logo-icon"><Globe size={20} /></div>
          {sidebarOpen && <span className="gra-logo-text">GlobalRegAI</span>}
        </div>

        {/* Modules */}
        {sidebarOpen && <div className="gra-section-label">REGULATORY DOMAINS</div>}
        <nav className="gra-nav">
          {MODULES.map(mod => (
            <button
              key={mod.id}
              className={`gra-nav-item ${activeModule === mod.id ? 'active' : ''}`}
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

        {/* Footer */}
        <div className="gra-sidebar-footer">
          {/* Guest / Developer status */}
          {!session && sidebarOpen && (
            <div className="gra-status-box guest">
              <Clock size={13} />
              <div>
                <strong>Guest Mode</strong>
                <p>{guestCount}/{GUEST_FREE_LIMIT} queries used</p>
                <button className="gra-signin-btn" onClick={() => setShowAuthModal(true)}>
                  Create Free Account →
                </button>
              </div>
            </div>
          )}
          {session && isAdmin && sidebarOpen && (
            <div className="gra-status-box developer">
              <CheckCircle size={13} />
              <div>
                <strong>🛠 Developer</strong>
                <p>Unlimited access</p>
              </div>
            </div>
          )}
          {session && !isAdmin && trialInfo && sidebarOpen && (
            <div className="gra-status-box trial">
              <Clock size={13} />
              <div>
                <strong>{trialInfo.plan_type === 'trial' ? 'Trial' : 'Active'}</strong>
                <p>{trialInfo.queries_used}/{trialInfo.queries_limit} queries</p>
              </div>
            </div>
          )}

          {/* Auth */}
          {session ? (
            <>
              {sidebarOpen && <div className="gra-user-email">{session.user.email}</div>}
              {isAdmin && (
                <button className="gra-nav-item" onClick={() => setShowAdmin(true)}>
                  <Users size={16} />
                  {sidebarOpen && <span>Admin Dashboard</span>}
                </button>
              )}
              <button className="gra-nav-item danger" onClick={handleSignOut}>
                <LogOut size={16} />
                {sidebarOpen && <span>Sign Out</span>}
              </button>
            </>
          ) : (
            <button className="gra-nav-item signin" onClick={() => setShowAuthModal(true)}>
              <Database size={16} />
              {sidebarOpen && <span>Sign In / Register</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="gra-main">

        {/* Top bar */}
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
            <select
              className="gra-select"
              value={agencyFilter}
              onChange={e => { setAgencyFilter(e.target.value); setActiveAgency(e.target.value); }}
            >
              {AGENCIES.map(a => <option key={a}>{a}</option>)}
            </select>
            <select
              className="gra-select"
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              {Object.entries(LANGUAGES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="gra-icon-btn" onClick={() => setTheme(t => t==='light'?'dark':'light')}>
              {theme==='light' ? <Moon size={17}/> : <Sun size={17}/>}
            </button>
            <div className={`gra-status-dot ${session ? 'online' : 'guest'}`} />
          </div>
        </header>

        {/* View Tabs */}
        <div className="gra-tabs">
          {([
            { id:'chat',      icon: Send,       label:'Q&A Chat'     },
            { id:'search',    icon: Search,     label:'Requirements' },
            { id:'documents', icon: FileText,   label:'Documents'    },
            { id:'monitor',   icon: AlertCircle,label:'Monitor'      },
            { id:'submit',    icon: Share2,     label:'Submit'       },
          ] as {id:ActiveView; icon:React.ElementType; label:string}[]).map(tab => (
            <button
              key={tab.id}
              className={`gra-tab ${activeView===tab.id?'active':''}`}
              onClick={() => setActiveView(tab.id)}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── DOCUMENT TEMPLATES panel (only on documents view) ── */}
        {activeView === 'documents' && (
          <div className="gra-doc-panel">
            <div className="gra-doc-panel-header">
              <Filter size={14} /> Select Template
            </div>
            <div className="gra-doc-grid">
              {DOCUMENT_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  className={`gra-doc-chip ${selectedTemplate===t.id?'active':''}`}
                  onClick={() => {
                    setSelectedTemplate(t.id);
                    sendMessage(`Draft a complete ${t.label} (${t.agency})`);
                  }}
                >
                  <span className="gra-doc-agency">{t.agency}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="gra-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`gra-msg ${msg.role}`}>
              <div className="gra-msg-avatar">
                {msg.role==='user' ? 'U' : <Globe size={14}/>}
              </div>
              <div className="gra-msg-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                {msg.timestamp && (
                  <span className="gra-msg-time">
                    {msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  </span>
                )}
              </div>
              {msg.role==='assistant' && (
                <button
                  className="gra-copy-btn"
                  title="Copy"
                  onClick={() => navigator.clipboard.writeText(msg.content)}
                >
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

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="gra-quick-prompts">
            {quickPrompts[activeView].map((p, i) => (
              <button key={i} className="gra-quick-btn" onClick={() => sendMessage(p)}>
                <ChevronDown size={13}/> {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="gra-input-area">
          <input
            ref={fileInputRef} type="file"
            accept=".pdf,.doc,.docx,.txt,.xlsx"
            style={{display:'none'}}
            onChange={e => setUploadedFile(e.target.files?.[0]||null)}
          />
          {uploadedFile && (
            <div className="gra-file-chip">
              📎 {uploadedFile.name}
              <button onClick={() => setUploadedFile(null)}>✕</button>
            </div>
          )}
          <div className="gra-input-row">
            <button className="gra-attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach document">
              <Paperclip size={18}/>
            </button>
            <input
              className="gra-text-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && !loading && sendMessage()}
              placeholder={
                !session
                  ? `Ask about ${currentMod.label} regulations... (${GUEST_FREE_LIMIT - guestCount} free queries left)`
                  : `Ask about ${currentMod.label}, ${activeAgency} requirements...`
              }
              disabled={loading}
            />
            <button
              className="gra-send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{ background: currentMod.color }}
            >
              <Send size={18}/>
            </button>
          </div>
        </div>
      </main>

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <div className="gra-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="gra-modal" onClick={e => e.stopPropagation()}>
            <button className="gra-modal-close" onClick={() => setShowAuthModal(false)}>✕</button>
            <Auth onLogin={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
