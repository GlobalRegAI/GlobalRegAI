import { supabase } from './supabase';

// ============================================
// Users & Trial Management
// ============================================

export async function getUserTrialStatus(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('plan, trial_started_at, trial_days, tokens_used')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching trial status:', error);
    return null;
  }

  if (data.plan !== 'trial') {
    return null;
  }

  const startDate = new Date(data.trial_started_at);
  const today = new Date();
  const daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = data.trial_days - daysElapsed;

  return {
    daysRemaining: Math.max(0, daysRemaining),
    daysElapsed,
    totalDays: data.trial_days,
    tokensUsed: data.tokens_used,
    isExpired: daysRemaining <= 0
  };
}

export async function createUserProfile(userId: string, email: string) {
  const { error } = await supabase
    .from('users')
    .insert({
      id: userId,
      email,
      plan: 'trial',
      trial_started_at: new Date().toISOString(),
      trial_days: 90,
      tokens_used: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user profile:', error);
    return false;
  }
  return true;
}

// ============================================
// Feedback Management
// ============================================

export async function submitFeedback(
  userId: string,
  rating: number,
  comment: string,
  category: string,
  questionId?: string
) {
  const { error } = await supabase
    .from('feedback')
    .insert({
      user_id: userId,
      rating,
      comment,
      category,
      question_id: questionId
    });

  if (error) {
    console.error('Error submitting feedback:', error);
    return false;
  }
  return true;
}

export async function getFeedbackStats() {
  const { data, error } = await supabase
    .from('feedback')
    .select('rating, category, created_at');

  if (error) {
    console.error('Error fetching feedback:', error);
    return null;
  }

  const avgRating = data.length > 0
    ? (data.reduce((sum: number, f: any) => sum + f.rating, 0) / data.length).toFixed(1)
    : 0;

  const categoryCount = data.reduce((acc: any, f: any) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {});

  return {
    totalFeedback: data.length,
    averageRating: parseFloat(avgRating as string),
    byCategory: categoryCount,
    recentFeedback: data.slice(0, 10)
  };
}

// ============================================
// Usage Logs
// ============================================

export async function logUsage(
  userId: string,
  question: string,
  answer: string,
  tokensUsed: number,
  responseTimeMs: number
) {
  const { error } = await supabase
    .from('usage_logs')
    .insert({
      user_id: userId,
      question,
      answer: answer.substring(0, 1000),
      tokens_used: tokensUsed,
      response_time_ms: responseTimeMs
    });

  if (error) {
    console.error('Error logging usage:', error);
    return false;
  }

  const { data: user } = await supabase
    .from('users')
    .select('tokens_used')
    .eq('id', userId)
    .single();

  if (user) {
    await supabase
      .from('users')
      .update({ tokens_used: user.tokens_used + tokensUsed })
      .eq('id', userId);
  }

  return true;
}

export async function getUserUsageStats(userId: string) {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('tokens_used, response_time_ms, created_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching usage stats:', error);
    return null;
  }

  const avgResponseTime = data.length > 0
    ? (data.reduce((sum: number, log: any) => sum + log.response_time_ms, 0) / data.length).toFixed(0)
    : 0;

  const totalTokens = data.reduce((sum: number, log: any) => sum + log.tokens_used, 0);

  return {
    totalQuestions: data.length,
    totalTokensUsed: totalTokens,
    averageResponseTime: parseInt(avgResponseTime as string),
    recentQuestions: data.slice(-5)
  };
}

// ============================================
// Admin Functions
// ============================================

export async function getDashboardStats() {
  try {
    const { count: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: activeUsers } = await supabase
      .from('usage_logs')
      .select('user_id', { count: 'exact', head: true })
      .gt('created_at', sevenDaysAgo.toISOString());

    const { count: totalQuestions } = await supabase
      .from('usage_logs')
      .select('id', { count: 'exact', head: true });

    const feedbackStats = await getFeedbackStats();

    return {
      totalUsers: totalUsers || 0,
      activeUsers: new Set(
        (await supabase
          .from('usage_logs')
          .select('user_id')
          .gt('created_at', sevenDaysAgo.toISOString())).data?.map((log: any) => log.user_id) || []
      ).size,
      totalQuestions: totalQuestions || 0,
      averageRating: feedbackStats?.averageRating || 0,
      feedbackCount: feedbackStats?.totalFeedback || 0
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return null;
  }
}

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, plan, trial_days, tokens_used, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return null;
  }

  return data;
}

export async function getAllFeedback() {
  const { data, error } = await supabase
    .from('feedback')
    .select('*, users(email)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching feedback:', error);
    return null;
  }

  return data;
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetUserId?: string,
  details?: Record<string, any>
) {
  const { error } = await supabase
    .from('admin_logs')
    .insert({
      admin_id: adminId,
      action,
      target_user_id: targetUserId,
      details: details || {}
    });

  if (error) {
    console.error('Error logging admin action:', error);
    return false;
  }
  return true;
}
