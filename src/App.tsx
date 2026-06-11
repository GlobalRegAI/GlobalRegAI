
import { useState, useEffect, useRef } from 'react';
import {
  Send, Database, Activity, LogOut, Globe, Sun, Moon,
  Search, Layers, ShieldAlert, FileText, Clock, Box,
  Bell, Users, FileCheck, Share2, Paperclip, QrCode
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Auth from './components/Auth';
import Feedback from './components/Feedback';
import AdminDashboard from './components/AdminDashboard';
import { supabase } from './lib/supabase';
import { getUserTrialStatus, logUsage } from './lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAILS = ['uk.dscheon@gmail.com', 'superadmin@globalregai.info'];

/** 비로그인 게스트에게 허용할 무료 메시지 횟수 */
const GUEST_FREE_LIMIT = 30;

/** localStorage 키 */
const GUEST_COUNT_KEY = 'globalregai_guest_count';
const GUEST_FIRST_KEY = 'globalregai_guest_first_ts';

/** 게스트 무료 기간: 밀리초 (7일) */
const GUEST_FREE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

const MODULES = [
  { id: 'Chat Assistant',  icon: Search,      label: 'Chat Assistant' },
  { id: 'FDA Compliance',  icon: ShieldAlert, label: 'FDA Compliance' },
  { id: 'EMA/MDR',         icon: FileText,    label: 'EMA / MDR' },
  { id: 'MFDS Korea',      icon: Globe,       label: 'MFDS Korea' },
  { id: 'Pharmacovigilance', icon: Activity,  label: 'Pharmacovigilance' },
  { id: 'REACH/Chemical',  icon: Box,         label: 'REACH / Chemical' },
  { id: 'Food Safety',     icon: Layers,      label: 'Food Safety' },
  { id: 'Animal Reg',      icon: FileCheck,   label: 'Animal Reg' },
];

const LANGUAGES: Record<string, string> = {
  en: 'English', ko: '한국어', ja: '日本語',
  'zh-TW': '中文(繁)', 'zh-CN': '中文(简)', es: 'Español'
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function getGuestCount(): number {
  return parseInt(localStorage.getItem(GUEST_COUNT_KEY) || '0', 10);
}
function incrementGuestCount(): number {
  const next = getGuestCount() + 1;
  localStorage.setItem(GUEST_COUNT_KEY, String(next));
  if (!localStorage.getItem(GUEST_FIRST_KEY)) {
    localStorage.setItem(GUEST_FIRST_KEY, String(Date.now()));
  }
  return next;
}
function isGuestPeriodActive(): boolean {
  const first = parseInt(localStorage.getItem(GUEST_FIRST_KEY) || '0', 10);
  if (!first) return true; // 아직 첫 사용 전
  return Date.now() - first < GUEST_FREE_PERIOD_MS;
}
function guestRemaining(): number {
  return Math.max(0, GUEST_FREE_LIMIT - getGuestCount());
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    { role: 'system', content: 'Welcome to GlobalRegAI — your AI-powered global regulatory intelligence platform. Ask me anything about FDA, EMA, MFDS, REACH, food safety, and more. **No sign-in required to get started.**' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeModule, setActiveModule] = useState('Chat Assistant');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguage] = useState('en');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [trialInfo, setTrialInfo] = useState<any>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Guest state
  const [guestCount, setGuestCount] = useState(getGuestCount());
  const [guestPeriodActive] = useState(isGuestPeriodActive());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        setIsAdmin(ADMIN_EMAILS.includes(session.user.email));
        getUserTrialStatus(session.user.id).then(setTrialInfo);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        setIsAdmin(ADMIN_EMAILS.includes(session.user.email));
        getUserTrialStatus(session.user.id).then(setTrialInfo);
      } else {
        setIsAdmin(false);
        setTrialInfo(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Send Message ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() && !uploadedFile) return;

    // ── 개발자(Admin) 무제한: ADMIN_EMAILS에 속한 로그인 사용자는 모든 한도 우회 ──
    const isDeveloper = session && ADMIN_EMAILS.includes(session.user.email);

    // ── Guest 한도 체크 (개발자는 건너뜀) ──
    if (!session && !isDeveloper) {
      if (!guestPeriodActive) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⏰ **무료 체험 기간(7일)이 종료**되었습니다. 계속 사용하시려면 로그인 후 이용해 주세요.'
        }]);
        setShowAuthModal(true);
        return;
      }
      if (getGuestCount() >= GUEST_FREE_LIMIT) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `🔒 **무료 체험 ${GUEST_FREE_LIMIT}회를 모두 사용**하셨습니다. 무제한 사용을 위해 무료 계정을 만들어 보세요!`
        }]);
        setShowAuthModal(true);
        return;
      }
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // File context 처리
      let fileContext = '';
      if (uploadedFile) {
        fileContext = `\n\n[Attached file: ${uploadedFile.name}]`;
        setUploadedFile(null);
      }

      const systemPrompt = `You are GlobalRegAI, an expert in global regulatory compliance for pharmaceuticals, medical devices, cosmetics, food, chemicals, and animal products. 
You cover agencies including FDA (USA), EMA (Europe), MFDS (Korea), PMDA (Japan), NMPA (China), ANVISA (Brazil), and others.
Current module focus: ${activeModule}.
Respond in language: ${LANGUAGES[language] || 'English'}.
Be precise, cite specific regulations and guidelines when relevant, and always clarify jurisdiction.`;

      // Anthropic API 호출
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [
            ...messages
              .filter(m => m.role !== 'system')
              .slice(-10)
              .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user', content: userMessage + fileContext }
          ]
        })
      });

      const data = await response.json();
      const aiReply = data.content?.[0]?.text || 'Sorry, I could not generate a response.';

      setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
      setShowFeedback(true);

      // 게스트 카운트 증가 (개발자는 카운트 없음)
      if (!session && !isDeveloper) {
        const newCount = incrementGuestCount();
        setGuestCount(newCount);
      }

      // 로그인 사용자: 사용 로그 기록 (개발자 포함)
      if (session) {
        await logUsage(session.user.id, activeModule, userMessage, aiReply);
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Connection error. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (showAdminDashboard && isAdmin) {
    return <AdminDashboard onBack={() => setShowAdminDashboard(false)} />;
  }

  // ── 게스트 상태 배너 텍스트 ──
  const guestBannerText = !session
    ? guestPeriodActive && guestCount < GUEST_FREE_LIMIT
      ? `🎁 Guest Mode — ${guestRemaining()}회 무료 남음 (7일 체험)`
      : null
    : null;

  return (
    <div className={`app-container ${theme}`}>

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Globe size={24} />
          <span>GlobalRegAI</span>
        </div>

        <nav className="sidebar-nav">
          {MODULES.map(mod => (
            <button
              key={mod.id}
              className={`nav-item ${activeModule === mod.id ? 'active' : ''}`}
              onClick={() => setActiveModule(mod.id)}
            >
              <mod.icon size={16} />
              <span>{mod.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* ── 게스트 / 트라이얼 상태 ── */}
          {!session && (
            <div className="trial-box guest">
              <Clock size={14} />
              <div>
                <strong>Guest Mode</strong>
                <p>{guestCount}/{GUEST_FREE_LIMIT} 무료 사용</p>
                <p>7일 무료 체험 중</p>
                <button className="btn-signin-small" onClick={() => setShowAuthModal(true)}>
                  무료 계정 만들기 →
                </button>
              </div>
            </div>
          )}

          {/* ── 개발자 무제한 배지 ── */}
          {session && isAdmin && (
            <div className="trial-box developer">
              <Activity size={14} />
              <div>
                <strong>🛠 Developer — Unlimited</strong>
                <p>All modules unlocked</p>
                <p>No query limits</p>
              </div>
            </div>
          )}

          {session && !isAdmin && trialInfo && (
            <div className="trial-box">
              <Clock size={14} />
              <div>
                <strong>{trialInfo.plan_type === 'trial' ? 'Trial' : 'Active'}</strong>
                <p>{trialInfo.queries_used}/{trialInfo.queries_limit} queries</p>
                <p>Expires: {new Date(trialInfo.trial_end).toLocaleDateString()}</p>
              </div>
            </div>
          )}

          {/* ── 로그인/로그아웃 ── */}
          {session ? (
            <>
              <div className="user-info">
                <span>{session.user.email}</span>
                {isAdmin && <span className="admin-badge">ADMIN</span>}
              </div>
              {isAdmin && (
                <button className="nav-item" onClick={() => setShowAdminDashboard(true)}>
                  <Users size={16} /> Admin Dashboard
                </button>
              )}
              <button className="nav-item signout" onClick={handleSignOut}>
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <button className="nav-item signin" onClick={() => setShowAuthModal(true)}>
              <Database size={16} /> Sign In / Register
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main-chat">

        {/* Header */}
        <header className="chat-header">
          <div className="header-left">
            <span className="module-title">{activeModule}</span>
            {isAdmin && <span className="admin-badge">ADMIN</span>}
            {/* 게스트 배너 */}
            {guestBannerText && (
              <span className="guest-banner">{guestBannerText}</span>
            )}
          </div>
          <div className="header-controls">
            <button onClick={() => setShowSharePanel(!showSharePanel)} title="Share">
              <Share2 size={18} />
            </button>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              {Object.entries(LANGUAGES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <span className={`status-dot ${session ? 'online' : 'guest'}`} title={session ? 'Connected' : 'Guest Mode'} />
          </div>
        </header>

        {/* Share Panel */}
        {showSharePanel && (
          <div className="share-panel">
            <p>🔗 Share: <strong>https://www.globalregai.info</strong></p>
            <button onClick={() => setShowSharePanel(false)}>Close</button>
          </div>
        )}

        {/* Messages */}
        <div className="messages-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="avatar">{msg.role === 'user' ? 'U' : 'AI'}</div>
              <div className="message-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="avatar">AI</div>
              <div className="message-content typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          {/* Feedback (로그인 사용자 + 마지막 메시지일 때) */}
          {showFeedback && session && messages[messages.length - 1]?.role === 'assistant' && (
            <Feedback
              messageId={String(messages.length)}
              userId={session.user.id}
              onClose={() => setShowFeedback(false)}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            style={{ display: 'none' }}
            onChange={e => setUploadedFile(e.target.files?.[0] || null)}
          />
          {uploadedFile && (
            <div className="file-indicator">
              📎 {uploadedFile.name}
              <button onClick={() => setUploadedFile(null)}>✕</button>
            </div>
          )}
          <button className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Upload PDF/Doc">
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()}
            placeholder={
              !session
                ? `Ask anything (${guestRemaining()} free left) — no sign-in needed...`
                : `Ask ${activeModule} (attach PDF for auto-summary)...`
            }
            disabled={loading}
          />
          <button className="send-btn" onClick={sendMessage} disabled={loading || (!input.trim() && !uploadedFile)}>
            <Send size={20} />
          </button>
        </div>
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal-close-bg" onClick={() => setShowAuthModal(false)} />
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => setShowAuthModal(false)}>✕</button>
            <Auth onLogin={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
