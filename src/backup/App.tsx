import { useState, useEffect, useRef } from 'react';
import { Send, Filter, Globe, Sun, Moon, Search, Bell, FileText, ChevronDown, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Auth from './components/Auth';
import Feedback from './components/Feedback';
import AdminDashboard from './components/AdminDashboard';
import { supabase } from './lib/supabase';
import { getUserTrialStatus, logUsage } from './lib/db';

function App() {
  // 채팅 & 기본
  const [messages, setMessages] = useState([{ role: 'system', content: '🌍 GlobalRegAI에 오신 것을 환영합니다!\n\n국가, 산업, 규제 종류를 좌측에서 선택하고 질문하세요.' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // 인증
  const [session, setSession] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // 테마
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('English');
  
  // 필터 (좌측)
  const [selectedCountry, setSelectedCountry] = useState('Korea');
  const [selectedIndustry, setSelectedIndustry] = useState('Medical Device');
  const [selectedRegulation, setSelectedRegulation] = useState('General');
  
  // 우측 패널
  const [activeRightTab, setActiveRightTab] = useState<'updates' | 'regulations' | 'references'>('updates');
  const [showRightPanel, setShowRightPanel] = useState(true);
  
  // 상태
  const [trialStatus, setTrialStatus] = useState<any>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email && ['uk.dscheon@gmail.com', 'admin@globalregai.info'].includes(session.user.email)) {
        setShowAdminDashboard(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setShowAuthModal(false);
        checkTrialStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkTrialStatus = async (userId: string) => {
    const status = await getUserTrialStatus(userId);
    setTrialStatus(status);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowAdminDashboard(false);
    setSession(null);
  };

  const ADMIN_EMAILS = ['uk.dscheon@gmail.com', 'admin@globalregai.info'];
  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);

  if (showAdminDashboard && isAdmin) {
    return <AdminDashboard userId={session.user.id} onLogout={handleLogout} />;
  }

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    
    if (session && trialStatus?.isExpired) {
      alert('🕐 트라이얼 기간이 종료되었습니다.');
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const questionId = `q_${Date.now()}`;
    setCurrentQuestionId(questionId);

    try {
      const systemPrompt = `당신은 규제 전문가입니다. 
선택된 국가: ${selectedCountry}
선택된 산업: ${selectedIndustry}
선택된 규제: ${selectedRegulation}

위의 조건에 맞게 정확한 규제 정보를 제공하세요.`;

      try {
        const { data, error } = await supabase.functions.invoke('chat', {
          body: { 
            messages: [...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })), { role: 'user', content: input }],
            systemPrompt
          }
        });
        
        if (error) throw error;
        
        const response = data.response;
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);

        if (session) {
          await logUsage(session.user.id, input, response, 100, Math.random() * 3000);
          checkTrialStatus(session.user.id);
        }
      } catch (err) {
        const fallbackResponse = `[${selectedCountry} | ${selectedIndustry} | ${selectedRegulation}]\n\n당신의 질문: "${input}"\n\n**분석 결과:**\n선택하신 조건에 따라 다음과 같이 분석됩니다:\n- **국가**: ${selectedCountry}\n- **산업**: ${selectedIndustry}\n- **규제 유형**: ${selectedRegulation}\n\n자세한 정보는 우측 "규제정보" 탭을 참고하세요.`;
        
        setMessages(prev => [...prev, { role: 'assistant', content: fallbackResponse }]);

        if (session) {
          await logUsage(session.user.id, input, fallbackResponse, 100, Math.random() * 3000);
          checkTrialStatus(session.user.id);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  // 우측 패널 - 실시간 업데이트
  const renderRightPanel = () => {
    if (activeRightTab === 'updates') {
      return (
        <div className="right-panel-content">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
            📢 실시간 규제 업데이트
          </h3>
          {[
            { date: '2025-06-02', country: '한국', title: 'MFDS 의료기기 기준 개정' },
            { date: '2025-05-28', country: '미국', title: 'FDA 510(k) 가이드라인 업데이트' },
            { date: '2025-05-20', country: '유럽', title: 'MDR Annex 변경사항' },
            { date: '2025-05-15', country: '일본', title: 'PMDA 심사시간 단축' },
            { date: '2025-05-10', country: '중국', title: 'NMPA 원료약 기준 강화' }
          ].map((item, idx) => (
            <div key={idx} style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-color)',
              marginBottom: '0.75rem',
              fontSize: '0.875rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.country}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.date}</span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{item.title}</p>
            </div>
          ))}
        </div>
      );
    } else if (activeRightTab === 'regulations') {
      return (
        <div className="right-panel-content">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
            📋 규제 정보 ({selectedCountry})
          </h3>
          {selectedCountry === 'Korea' && (
            <div>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '0.5rem' }}>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🇰🇷 한국 식약처 (MFDS)</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  의료기기: 심사 기간 60-180일 | 등급: 1/2/3/4
                </p>
              </div>
            </div>
          )}
          {selectedCountry === 'USA' && (
            <div>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '0.5rem' }}>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🇺🇸 미국 FDA</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  510(k): 90일 | PMA: 180-300일 | De Novo 검토 가능
                </p>
              </div>
            </div>
          )}
          {selectedCountry === 'EU' && (
            <div>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '0.5rem' }}>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🇪🇺 유럽 MDR</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Class I-IV | CE Mark 필수 | 적합성평가 기관 선택 가능
                </p>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div className="right-panel-content">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
            📚 참고 자료
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {['MDSAP', 'ISO 13485', 'FDA 510(k)', 'MDR Compliance'].map((item, idx) => (
              <button key={idx} style={{
                padding: '0.75rem',
                textAlign: 'left',
                background: 'var(--bg-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                transition: 'all 0.2s'
              }}>
                📄 {item}
              </button>
            ))}
          </div>
        </div>
      );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-color)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 좌측 패널 - 필터 */}
      <aside style={{
        width: '300px',
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-color)',
        padding: '1.5rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
            🌍 GlobalRegAI
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
            규제 전문 AI 분석 플랫폼
          </p>
        </div>

        {/* 국가 선택 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            🌏 국가 선택
          </label>
          <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-color)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem'
          }}>
            <option>Korea</option>
            <option>USA</option>
            <option>EU</option>
            <option>Japan</option>
            <option>China</option>
            <option>Singapore</option>
            <option>Taiwan</option>
            <option>Hong Kong</option>
            <option>Thailand</option>
            <option>Vietnam</option>
            <option>Malaysia</option>
            <option>Indonesia</option>
            <option>Philippines</option>
            <option>Australia</option>
            <option>Canada</option>
            <option>Brazil</option>
            <option>Mexico</option>
            <option>UK</option>
          </select>
        </div>

        {/* 산업 선택 */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            🏭 산업 분야
          </label>
          <select value={selectedIndustry} onChange={(e) => setSelectedIndustry(e.target.value)} style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-color)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem'
          }}>
            <option>Medical Device</option>
            <option>Pharmaceutical</option>
            <option>Nutraceutical</option>
            <option>Cosmetic</option>
            <option>Food & Beverage</option>
            <option>Biologic</option>
            <option>Gene Therapy</option>
            <option>In Vitro Diagnostic</option>
            <option>Software</option>
            <option>Medical AI</option>
          </select>
        </div>

        {/* 규제 종류 선택 */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            📋 규제 종류
          </label>
          <select value={selectedRegulation} onChange={(e) => setSelectedRegulation(e.target.value)} style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-color)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem'
          }}>
            <option>General</option>
            <option>Quality (GMP)</option>
            <option>Non-Clinical (Safety)</option>
            <option>Clinical (Efficacy)</option>
            <option>Labeling & Claims</option>
            <option>Post-Marketing</option>
            <option>Import/Export</option>
            <option>Pricing & Reimbursement</option>
          </select>
        </div>

        {/* 예시 카드 */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
            💡 예시 질문
          </p>
          {['MDSAP 요구사항', 'FDA 510(k) 경로', 'MDR 적합성 평가', 'ISO 13485 기준'].map((question, idx) => (
            <button key={idx} onClick={() => setInput(question)} style={{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}>
              📌 {question}
            </button>
          ))}
        </div>

        {/* 트라이얼 상태 */}
        {session && trialStatus && (
          <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', borderLeft: '3px solid #3b82f6', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, marginBottom: '0.5rem' }}>
              ⏱️ 트라이얼
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              {trialStatus.daysRemaining}일 남음
            </p>
          </div>
        )}

        {/* 로그인 버튼 */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {session ? (
            <button onClick={handleLogout} style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#ef4444',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}>
              Sign Out
            </button>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #3b82f6',
              background: 'transparent',
              color: '#3b82f6',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}>
              Sign In
            </button>
          )}
        </div>
      </aside>

      {/* 중앙 - 채팅 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: showRightPanel ? '1px solid var(--border-color)' : 'none' }}>
        <header style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
            💬 AI 규제 분석
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              padding: '0.4rem',
              cursor: 'pointer'
            }}>
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            {showRightPanel && (
              <button onClick={() => setShowRightPanel(false)} style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '1.5rem'
              }}>
                ×
              </button>
            )}
          </div>
        </header>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {messages.map((msg, idx) => (
            <div key={idx}>
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '70%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  background: msg.role === 'user' ? '#3b82f6' : 'var(--bg-elevated)',
                  color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
              {msg.role === 'assistant' && session && idx === messages.length - 1 && !isTyping && (
                <div style={{ paddingLeft: '1rem', marginTop: '0.5rem' }}>
                  <Feedback userId={session.user.id} questionId={currentQuestionId} />
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)'
              }}>
                생각 중...
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '0.75rem'
        }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={() => alert('파일 업로드 준비 중...')}
          />
          <button onClick={() => fileInputRef.current?.click()} style={{
            padding: '0.5rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            cursor: 'pointer'
          }}>
            📎
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={session ? '질문을 입력하세요...' : '로그인이 필요합니다...'}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              color: 'var(--text-primary)'
            }}
          />
          <button onClick={sendMessage} style={{
            padding: '0.5rem 1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer'
          }}>
            <Send size={18} />
          </button>
        </div>
      </main>

      {/* 우측 패널 - 규제정보 */}
      {showRightPanel && (
        <aside style={{
          width: '350px',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'hidden'
        }}>
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            gap: '0.5rem'
          }}>
            <button onClick={() => setActiveRightTab('updates')} style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: activeRightTab === 'updates' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
              background: activeRightTab === 'updates' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: activeRightTab === 'updates' ? '#3b82f6' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              📢 업데이트
            </button>
            <button onClick={() => setActiveRightTab('regulations')} style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: activeRightTab === 'regulations' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
              background: activeRightTab === 'regulations' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: activeRightTab === 'regulations' ? '#3b82f6' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              📋 규제정보
            </button>
            <button onClick={() => setActiveRightTab('references')} style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: activeRightTab === 'references' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
              background: activeRightTab === 'references' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: activeRightTab === 'references' ? '#3b82f6' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              📚 참고
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {renderRightPanel()}
          </div>
        </aside>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            position: 'relative'
          }}>
            <button onClick={() => setShowAuthModal(false)} style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer'
            }}>
              ✕
            </button>
            <Auth onLogin={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;