import { useState, useEffect } from 'react';
import { BarChart3, Users, MessageSquare, Activity, LogOut, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDashboardStats, getAllUsers, getAllFeedback, logAdminAction } from '../lib/db';

interface AdminDashboardProps {
  userId: string;
  onLogout: () => void;
}

export default function AdminDashboard({ userId, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'feedback' | 'settings'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSensitive, setShowSensitive] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [activeTab]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const dashStats = await getDashboardStats();
        setStats(dashStats);
      } else if (activeTab === 'users') {
        const allUsers = await getAllUsers();
        setUsers(allUsers || []);
      } else if (activeTab === 'feedback') {
        const allFeedback = await getAllFeedback();
        setFeedback(allFeedback || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await logAdminAction(userId, 'admin_logout');
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-color)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '250px',
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border-color)',
          padding: '2rem 1.5rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '2rem', fontSize: '1.25rem', fontWeight: 700 }}>
          🎛️ 관리자 대시보드
        </h2>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
          {[
            { id: 'overview' as const, label: '📊 개요', icon: BarChart3 },
            { id: 'users' as const, label: '👥 사용자', icon: Users },
            { id: 'feedback' as const, label: '💬 피드백', icon: MessageSquare },
            { id: 'settings' as const, label: '⚙️ 설정', icon: Activity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: activeTab === tab.id ? '2px solid var(--accent-color)' : '1px solid transparent',
                background: activeTab === tab.id ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#ef4444',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'center',
            width: '100%'
          }}
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '2rem' }}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <h1 style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>📊 개요</h1>
              {loading ? (
                <p>로딩 중...</p>
              ) : stats ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  {[
                    { label: '총 사용자', value: stats.totalUsers, icon: '👥' },
                    { label: '활성 사용자 (7일)', value: stats.activeUsers, icon: '⚡' },
                    { label: '총 질문', value: stats.totalQuestions, icon: '❓' },
                    { label: '평균 만족도', value: `${stats.averageRating}/5`, icon: '⭐' },
                    { label: '피드백 건수', value: stats.feedbackCount, icon: '💬' }
                  ].map((stat, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>데이터를 로드할 수 없습니다.</p>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <h1 style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>👥 사용자 관리</h1>
              {loading ? (
                <p>로딩 중...</p>
              ) : (
                <div style={{ overflowX: 'auto', background: 'var(--bg-elevated)', borderRadius: '0.75rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>이메일</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>플랜</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>토큰 사용</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>가입일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            {showSensitive ? user.email : user.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3')}
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '0.375rem',
                              background: user.plan === 'trial' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: user.plan === 'trial' ? '#3b82f6' : '#10b981',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {user.plan}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            {user.tokens_used}
                          </td>
                          <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {new Date(user.created_at).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div>
              <h1 style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>💬 사용자 피드백</h1>
              {loading ? (
                <p>로딩 중...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {feedback.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.75rem',
                        padding: '1.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                        <div>
                          <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>
                            {item.users?.email || 'Unknown User'}
                          </p>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                            {new Date(item.created_at).toLocaleString('ko-KR')}
                          </p>
                        </div>
                        <div style={{ fontSize: '1.5rem' }}>
                          {'⭐'.repeat(item.rating)}
                        </div>
                      </div>
                      {item.comment && (
                        <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                          {item.comment}
                        </p>
                      )}
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        분류: <span style={{ color: 'var(--accent-color)' }}>{item.category}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div>
              <h1 style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>⚙️ 설정</h1>
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.75rem',
                padding: '2rem'
              }}>
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>데이터 보안</h3>
                  <button
                    onClick={() => setShowSensitive(!showSensitive)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-color)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}
                  >
                    {showSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showSensitive ? '이메일 숨기기' : '전체 이메일 보기'}
                  </button>
                </div>

                <div>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>시스템 정보</h3>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>버전</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>1.0.0</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>마지막 업데이트</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{new Date().toLocaleDateString('ko-KR')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>상태</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>정상 작동 중</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
