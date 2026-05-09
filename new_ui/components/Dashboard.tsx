import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import {
  MessageSquare, Bot, Files, ArrowUpRight, ArrowRight, Zap,
  MoreHorizontal, Calendar, Activity, Cpu, Sparkles, TrendingUp,
  Loader2, RefreshCw, Boxes
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/src/store/auth.store';
import { useDashboardStore } from '@/src/store/dashboard.store';
import { healthService, type WorkspaceHealthSnapshot } from '@/src/services';
import { WorkspaceHealthSummary } from '@/src/components/WorkspaceHealthSummary';
import { UsageAnalyticsCards } from '@/src/components/UsageAnalyticsCards';
import { buildRecentActivityItems } from '@/src/utils/activity-feed';
import { OnboardingChecklist } from '@/src/components/OnboardingChecklist';
import { DashboardLayoutControls } from '@/src/components/DashboardLayoutControls';
import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  createDefaultDashboardLayoutPreferences,
  parseDashboardLayoutPreferences,
  type DashboardLayoutPreferences,
} from '@/src/utils/dashboard-layout-preferences';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

const StatCard = ({ title, value, sub, icon: Icon, color, trend, isLoading }: any) => (
  <motion.div
    variants={itemVariants}
    className="bg-surface/30 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300"
  >
    <div className={`absolute top-0 right-0 p-32 ${color} opacity-[0.03] blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-[0.08] transition-opacity`} />

    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-gray-300 group-hover:text-white group-hover:bg-white/10 transition-colors">
        <Icon size={20} />
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/10">
          <TrendingUp size={12} />
          {trend}
        </div>
      )}
    </div>

    <div className="relative z-10">
      <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        {isLoading ? (
          <div className="h-9 w-20 bg-white/5 rounded-lg animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2 font-medium">{sub}</p>
    </div>
  </motion.div>
);

const QuickAction = ({ title, desc, icon: Icon, color, onClick }: any) => (
  <motion.button
    variants={itemVariants}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="group relative flex flex-col items-start p-6 rounded-3xl bg-surface/30 border border-white/5 hover:bg-surface/50 hover:border-violet-500/30 transition-all overflow-hidden text-left w-full h-full"
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

    <div className="mb-4 p-3 rounded-2xl bg-white/5 text-gray-300 group-hover:text-white group-hover:scale-110 transition-all duration-300">
      <Icon size={24} />
    </div>
    <h4 className="text-lg font-semibold text-white mb-1 group-hover:text-violet-300 transition-colors">{title}</h4>
    <p className="text-sm text-gray-400 leading-relaxed max-w-[90%]">{desc}</p>

    <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-violet-400">
      <ArrowRight size={20} />
    </div>
  </motion.button>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    stats,
    analytics,
    recentConversations,
    bots,
    collections,
    isLoading,
    isStatsLoading,
    isAnalyticsLoading,
    isConversationsLoading,
    fetchDashboardData
  } = useDashboardStore();

  const tenantId = user?.tenant_id || 'default';
  const [workspaceHealth, setWorkspaceHealth] = useState<WorkspaceHealthSnapshot | null>(null);
  const [isWorkspaceHealthLoading, setIsWorkspaceHealthLoading] = useState(true);
  const [workspaceHealthError, setWorkspaceHealthError] = useState<string | null>(null);
  const [dashboardLayoutSaveError, setDashboardLayoutSaveError] = useState<string | null>(null);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayoutPreferences>(() => {
    if (typeof window === 'undefined') return createDefaultDashboardLayoutPreferences();

    try {
      return parseDashboardLayoutPreferences(window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY));
    } catch {
      return createDefaultDashboardLayoutPreferences();
    }
  });

  const fetchWorkspaceHealth = useCallback(async () => {
    setIsWorkspaceHealthLoading(true);
    setWorkspaceHealthError(null);
    try {
      const snapshot = await healthService.getWorkspaceHealth();
      setWorkspaceHealth(snapshot);
      if (snapshot.status !== 'ready') {
        setWorkspaceHealthError('One or more workspace dependencies need attention.');
      }
    } catch (error) {
      setWorkspaceHealthError('Unable to load workspace health right now.');
    } finally {
      setIsWorkspaceHealthLoading(false);
    }
  }, []);

  const saveDashboardLayout = useCallback((preferences: DashboardLayoutPreferences) => {
    setDashboardLayout(preferences);
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(preferences));
      setDashboardLayoutSaveError(null);
    } catch {
      setDashboardLayoutSaveError('Layout preference could not be saved in this browser.');
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(tenantId);
    fetchWorkspaceHealth();
  }, [tenantId, fetchDashboardData, fetchWorkspaceHealth]);

  // Get greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Format chart data from analytics
  const chartData = useMemo(() => {
    if (!analytics?.daily_usage || analytics.daily_usage.length === 0) {
      // Default mock data if no analytics
      return [
        { name: 'Mon', tokens: 4000, cost: 2.4 },
        { name: 'Tue', tokens: 3000, cost: 1.8 },
        { name: 'Wed', tokens: 2000, cost: 1.2 },
        { name: 'Thu', tokens: 2780, cost: 1.6 },
        { name: 'Fri', tokens: 1890, cost: 1.1 },
        { name: 'Sat', tokens: 2390, cost: 1.4 },
        { name: 'Sun', tokens: 3490, cost: 2.1 },
      ];
    }

    // Use last 7 days
    return analytics.daily_usage.slice(-7).map((d) => {
      const date = new Date(d.date);
      return {
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        tokens: d.tokens,
        cost: d.cost || d.tokens * 0.000003,
      };
    });
  }, [analytics]);

  const recentActivity = useMemo(() => buildRecentActivityItems({
    conversations: recentConversations,
    bots,
    collections,
  }), [recentConversations, bots, collections]);

  const isActivityLoading = isConversationsLoading || isStatsLoading;
  const visibleSections = dashboardLayout.visibleSections;
  const isCompactDashboard = dashboardLayout.density === 'compact';
  const pageSpacingClass = isCompactDashboard ? 'space-y-5' : 'space-y-8';
  const panelPaddingClass = isCompactDashboard ? 'p-6' : 'p-8';

  const activityIcon = (type: string) => {
    if (type === 'agent') return Bot;
    if (type === 'collection') return Boxes;
    return MessageSquare;
  };

  // Format numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Format time ago
  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`max-w-[1600px] mx-auto pb-10 ${pageSpacingClass}`}
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-violet-400 mb-2 font-medium text-sm tracking-wide uppercase"
          >
            <Sparkles size={14} />
            <span>Enterprise Workspace</span>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
            {greeting}, {user?.firstname || (user as any)?.name?.split(' ')[0] || 'User'}! 👋
          </h1>
          <p className="text-gray-400 text-lg">Here's what's happening with your AI assistant today.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-xs text-gray-500 font-mono">SERVER STATUS</span>
            <span className={`text-sm flex items-center gap-1.5 ${workspaceHealth?.status === 'ready' ? 'text-emerald-400' : 'text-amber-300'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${workspaceHealth?.status === 'ready' ? 'bg-emerald-400' : 'bg-amber-300'} ${isWorkspaceHealthLoading ? 'animate-pulse' : ''}`}></span>
              {workspaceHealth?.status === 'ready' ? 'Operational' : 'Checking'}
            </span>
          </div>
          <button
            onClick={() => {
              fetchDashboardData(tenantId);
              fetchWorkspaceHealth();
            }}
            className="h-10 px-4 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl border border-white/10 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} className={isLoading || isWorkspaceHealthLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/bots')}
            className="h-10 px-4 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all flex items-center gap-2"
          >
            <Bot size={18} />
            Deploy Agent
          </button>
        </div>
      </div>

      <DashboardLayoutControls
        preferences={dashboardLayout}
        saveError={dashboardLayoutSaveError}
        onChange={saveDashboardLayout}
      />

      {visibleSections.health && (
        <WorkspaceHealthSummary
          snapshot={workspaceHealth}
          isLoading={isWorkspaceHealthLoading}
          error={workspaceHealthError}
          onRefresh={fetchWorkspaceHealth}
        />
      )}

      {visibleSections.analytics && (
        <UsageAnalyticsCards
          analytics={analytics}
          isLoading={isAnalyticsLoading}
        />
      )}

      {visibleSections.onboarding && <OnboardingChecklist onNavigate={navigate} />}

      {/* KPI Grid */}
      {visibleSections.kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Conversations"
            value={formatNumber(stats.conversations)}
            sub="Total chat sessions"
            icon={MessageSquare}
            color="bg-violet-500"
            trend={stats.conversations > 0 ? '+12%' : undefined}
            isLoading={isStatsLoading}
          />
          <StatCard
            title="AI Bots"
            value={formatNumber(stats.bots)}
            sub="Active agents"
            icon={Bot}
            color="bg-emerald-500"
            trend={stats.bots > 0 ? `${stats.bots} active` : undefined}
            isLoading={isStatsLoading}
          />
          <StatCard
            title="Collections"
            value={formatNumber(stats.collections)}
            sub="Knowledge bases"
            icon={Files}
            color="bg-orange-500"
            isLoading={isStatsLoading}
          />
          <StatCard
            title="Documents"
            value={formatNumber(stats.documents)}
            sub="Indexed files"
            icon={Zap}
            color="bg-blue-500"
            isLoading={isStatsLoading}
          />
        </div>
      )}

      {/* Main Content Split */}
      {(visibleSections.usageChart || visibleSections.activity) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[400px]">

        {/* Analytics Chart */}
        {visibleSections.usageChart && (
        <motion.div
          variants={itemVariants}
          className={`${visibleSections.activity ? 'lg:col-span-2' : 'lg:col-span-3'} bg-surface/30 backdrop-blur-xl border border-white/5 rounded-3xl ${panelPaddingClass} flex flex-col relative overflow-hidden`}
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold text-white">Token Usage</h3>
              <p className="text-sm text-gray-500">
                {analytics?.summary ?
                  `${formatNumber(analytics.summary.total_tokens)} total tokens used` :
                  'Token consumption across all agents'
                }
              </p>
            </div>
            <div className="flex gap-2">
              {['1H', '24H', '7D', '30D'].map((t, i) => (
                <button key={t} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${i === 2 ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] w-full min-w-0">
            {isAnalyticsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={300}
                initialDimension={{ width: 800, height: 300 }}
              >
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    dx={-10}
                  />
                  <Tooltip
                    cursor={{ stroke: '#ffffff10', strokeWidth: 1 }}
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#27272a',
                      borderRadius: '12px',
                      color: '#fff',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: '#a78bfa' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTokens)"
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
        )}

        {/* Live Feed / Recent Activity */}
        {visibleSections.activity && (
        <motion.div
          variants={itemVariants}
          className={`${visibleSections.usageChart ? '' : 'lg:col-span-3'} bg-surface/30 backdrop-blur-xl border border-white/5 rounded-3xl ${panelPaddingClass} flex flex-col relative overflow-hidden`}
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Recent Activity</h3>
              <p className="text-sm text-gray-500">Chats, agents, and knowledge changes</p>
            </div>
            <button className="text-gray-500 hover:text-white transition-colors">
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2 scrollbar-thin">
            {isActivityLoading ? (
              // Loading skeletons
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/5 animate-pulse">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-700" />
                      <div className="w-20 h-3 bg-gray-700 rounded" />
                    </div>
                  </div>
                  <div className="w-full h-4 bg-gray-700 rounded mb-2" />
                  <div className="w-2/3 h-3 bg-gray-700 rounded" />
                </div>
              ))
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Activity size={48} className="text-gray-600 mb-4" />
                <p className="text-gray-400 font-medium">No activity yet</p>
                <p className="text-gray-500 text-sm mt-1">Create an agent, upload knowledge, or start a chat</p>
                <button
                  onClick={() => navigate('/chat')}
                  className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Start Chat
                </button>
              </div>
            ) : (
              recentActivity.map((activity) => {
                const Icon = activityIcon(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.07] hover:border-violet-500/20 transition-all cursor-pointer"
                    onClick={() => navigate(activity.path)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-800 overflow-hidden flex items-center justify-center">
                          <Icon size={16} className="text-gray-400" />
                        </div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          {activity.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium bg-black/20 px-2 py-1 rounded-md">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-gray-200 mb-1 line-clamp-1 group-hover:text-violet-300 transition-colors">
                      {activity.title}
                    </h4>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {activity.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => navigate('/history')}
            className="w-full mt-6 py-3 text-xs font-medium text-gray-400 hover:text-white border border-dashed border-white/10 rounded-xl hover:bg-white/5 transition-all"
          >
            View Chat History
          </button>
        </motion.div>
        )}
      </div>
      )}

      {/* Quick Actions */}
      {visibleSections.quickActions && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickAction
            title="Create New Agent"
            desc="Deploy a specialized GPT with custom instructions and tools."
            icon={Bot}
            color="from-violet-600 to-indigo-600"
            onClick={() => navigate('/bots')}
          />
          <QuickAction
            title="Upload Knowledge"
            desc="Ingest PDF, DOCX, or CSV files for semantic search."
            icon={Files}
            color="from-emerald-600 to-teal-600"
            onClick={() => navigate('/collections')}
          />
          <QuickAction
            title="API Configuration"
            desc="Manage API keys, rate limits, and webhook endpoints."
            icon={Cpu}
            color="from-orange-600 to-red-600"
            onClick={() => navigate('/settings?tab=api')}
          />
        </div>
      )}

      {/* AI Tips Section */}
      {visibleSections.tips && (
      <motion.div
        variants={itemVariants}
        className={`bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border border-violet-500/20 rounded-3xl ${panelPaddingClass}`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-violet-500/20 text-violet-400">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">AI Tips & Tricks</h3>
            <p className="text-sm text-gray-400">Get the most out of your AI assistant</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <h4 className="font-semibold text-white mb-2">Be Specific</h4>
            <p className="text-sm text-gray-400">The more context you provide, the better and more accurate responses you'll receive.</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <h4 className="font-semibold text-white mb-2">Use Context</h4>
            <p className="text-sm text-gray-400">Follow-up questions in the same conversation will use previous context for better answers.</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <h4 className="font-semibold text-white mb-2">Upload Documents</h4>
            <p className="text-sm text-gray-400">Add your own documents to collections for personalized, knowledge-grounded responses.</p>
          </div>
        </div>
      </motion.div>
      )}
    </motion.div>
  );
};

export default Dashboard;
