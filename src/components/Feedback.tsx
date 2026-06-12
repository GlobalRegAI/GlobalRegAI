import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { submitFeedback } from '../lib/db';

interface FeedbackProps {
  userId: string;
  questionId?: string;
  onSubmit?: () => void;
}

export default function Feedback({ userId, questionId, onSubmit }: FeedbackProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === null) {
      alert('별점을 선택해주세요');
      return;
    }

    setIsSubmitting(true);
    const success = await submitFeedback(userId, rating, comment, category, questionId);

    if (success) {
      setSubmitted(true);
      setRating(null);
      setComment('');
      setCategory('general');
      
      setTimeout(() => {
        setShowFeedback(false);
        setSubmitted(false);
        onSubmit?.();
      }, 2000);
    } else {
      alert('피드백 제출에 실패했습니다. 다시 시도해주세요.');
    }
    setIsSubmitting(false);
  };

  if (!showFeedback) {
    return (
      <button
        onClick={() => setShowFeedback(true)}
        className="feedback-trigger-btn"
        title="답변에 피드백 남기기"
        style={{
          background: 'transparent',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          transition: 'all 0.2s'
        }}
      >
        <MessageSquare size={16} />
        피드백
      </button>
    );
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginTop: '1rem',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      {submitted ? (
        <div style={{ textAlign: 'center', color: '#10b981' }}>
          <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>✅ 감사합니다!</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            귀하의 의견이 서비스 개선에 도움이 됩니다.
          </p>
        </div>
      ) : (
        <>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
            이 답변이 도움이 되었나요?
          </h3>

          {/* Rating */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((rate) => (
              <button
                key={rate}
                onClick={() => setRating(rate)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: rating === rate ? '2px solid var(--accent-color)' : '1px solid #e5e7eb',
                  background: rating === rate ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  transition: 'all 0.2s'
                }}
              >
                {['😞', '😐', '😊', '😄', '🤩'][rate - 1]}
              </button>
            ))}
          </div>

          {/* Category */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              피드백 카테고리
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            >
              <option value="general">일반</option>
              <option value="accuracy">정확도</option>
              <option value="clarity">명확성</option>
              <option value="feature">기능 요청</option>
              <option value="bug">버그 보고</option>
              <option value="other">기타</option>
            </select>
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="의견을 남겨주세요 (선택사항)..."
            maxLength={500}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              resize: 'vertical',
              minHeight: '80px',
              marginBottom: '0.5rem'
            }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {comment.length}/500
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowFeedback(false)}
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                opacity: isSubmitting ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || rating === null}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: rating === null ? '#d1d5db' : 'var(--accent-color)',
                color: 'white',
                cursor: rating === null || isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? '제출 중...' : '피드백 제출'}
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
