import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Calendar, Download, TrendingUp, AlertCircle, CheckCircle,
  ChevronDown, Check, Loader2, RefreshCw, BarChart3, Coins, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsService } from '@/src/services';
import type { AnalyticsDashboard, DailyUsage, TopModel } from '@/types';

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

const AnalyticsCard = ({ title, children, isLoading }: any) => (
  <div className="bg-surface/30 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col h-[400px]">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <button className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
        <Download size={16} />
      </button>
    </div>
    <div className="flex-1 w-full min-h-0">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

const StatCard = ({ title, value, icon: Icon, color, isLoading }: any) => (
  <div className="bg-surface/30 backdrop-blur-sm border border-white/5 rounded-2xl p-5">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        {isLoading ? (
          <div className="h-7 w-20 bg-white/5 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-white">{value}</p>
        )}
        <p className="text-sm text-gray-400">{title}</p>
      </div>
    </div>
  </div>
);

const Analytics: React.FC = () => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('All Models');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState('This Month');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);

  const models = ['All Models', 'GPT-4 Turbo', 'Claude 3 Opus', 'Gemini 1.5 Pro'];
  const dateRanges = ['Today', 'Yesterday', 'Last 7 Days', 'This Month', 'Last Month'];

  useEffect(() => {
    fetchAnalytics();
  }, [selectedDateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await analyticsService.getDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!dashboard?.daily_usage || dashboard.daily_usage.length === 0) {
      // Default data if empty
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

    return dashboard.daily_usage.slice(-14).map((d) => {
      const date = new Date(d.date);
      return {
        name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tokens: d.tokens,
        cost: d.cost || d.tokens * 0.000003,
      };
    });
  }, [dashboard]);

  // Prepare cost breakdown data
  const costData = useMemo(() => {
    if (!dashboard?.top_models || dashboard.top_models.length === 0) {
      return [
        { name: 'GPT-4', value: 450 },
        { name: 'Claude 3', value: 300 },
        { name: 'Embeddings', value: 120 },
        { name: 'Audio', value: 80 },
      ];
    }

    return dashboard.top_models.slice(0, 5).map((m) => ({
      name: m.model,
      value: m.total_tokens,
    }));
  }, [dashboard]);

  // Calculate success/error rates (mock for now)
  const successRate = 99.9;
  const errorRate = 0.1;

  const exportData = (format: 'json' | 'csv') => {
    if (!dashboard) return;

    if (format === 'json') {
      const data = JSON.stringify(dashboard, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Date', 'Tokens', 'Requests', 'Cost'];
      const rows = dashboard.daily_usage.map(d => [d.date, d.tokens, d.requests, d.cost || 0]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8" onClick={() => {
      if (modelDropdownOpen) setModelDropdownOpen(false);
      if (datePickerOpen) setDatePickerOpen(false);
    }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Performance Analytics</h1>
          <p className="text-gray-400">Deep dive into usage patterns, costs, and system health.</p>
        </div>
        <div className="flex items-center gap-3 relative">
          <button
            onClick={fetchAnalytics}
            className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-colors"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Model Select */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setModelDropdownOpen(!modelDropdownOpen); setDatePickerOpen(false); }}
              className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none hover:bg-white/10 transition-colors w-40 justify-between"
            >
              {selectedModel}
              <ChevronDown size={14} className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {modelDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full right-0 mt-2 w-48 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  {models.map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center justify-between"
                    >
                      {m}
                      {selectedModel === m && <Check size={14} className="text-violet-500" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setDatePickerOpen(!datePickerOpen); setModelDropdownOpen(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl border border-white/10 transition-colors"
            >
              <Calendar size={16} /> {selectedDateRange}
            </button>
            <AnimatePresence>
              {datePickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full right-0 mt-2 w-48 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    {dateRanges.map(range => (
                      <button
                        key={range}
                        onClick={() => { setSelectedDateRange(range); setDatePickerOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedDateRange === range ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Export Button */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors">
              <Download size={16} /> Export
            </button>
            <div className="absolute top-full right-0 mt-2 w-40 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden hidden group-hover:block">
              <button
                onClick={() => exportData('json')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5"
              >
                Export as JSON
              </button>
              <button
                onClick={() => exportData('csv')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5"
              >
                Export as CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tokens"
          value={formatNumber(dashboard?.summary.total_tokens || 0)}
          icon={BarChart3}
          color="bg-violet-600"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Cost"
          value={formatCost(dashboard?.summary.total_cost || 0)}
          icon={Coins}
          color="bg-emerald-600"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Requests"
          value={formatNumber(dashboard?.summary.total_requests || 0)}
          icon={TrendingUp}
          color="bg-blue-600"
          isLoading={isLoading}
        />
        <StatCard
          title="Period"
          value={dashboard?.summary.period || 'All Time'}
          icon={Calendar}
          color="bg-purple-600"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Token Usage */}
        <AnalyticsCard title="Token Usage Trend" isLoading={isLoading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#a78bfa' }}
              />
              <Area type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorTokens)" />
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        {/* Cost Distribution */}
        <AnalyticsCard title="Cost Breakdown by Model" isLoading={isLoading}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={costData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {costData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        {/* Latency / Bar Chart */}
        <AnalyticsCard title="Daily Requests" isLoading={isLoading}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: '#ffffff05' }}
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }}
              />
              <Bar dataKey="tokens" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface/30 border border-white/5 rounded-3xl p-6 flex flex-col justify-center items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-4xl font-bold text-white mb-2">{successRate}%</h3>
            <p className="text-gray-400">Success Rate</p>
          </div>
          <div className="bg-surface/30 border border-white/5 rounded-3xl p-6 flex flex-col justify-center items-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-4xl font-bold text-white mb-2">{errorRate}%</h3>
            <p className="text-gray-400">Error Rate</p>
          </div>
          <div className="col-span-2 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/20 rounded-3xl p-6 flex items-center justify-between">
            <div>
              <h4 className="text-white font-semibold mb-1">Optimize your usage</h4>
              <p className="text-sm text-gray-400">Switching to 'Flash' models could save up to 30% on costs.</p>
            </div>
            <button className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
              Apply Settings
            </button>
          </div>
        </div>
      </div>

      {/* Top Models */}
      {dashboard?.top_models && dashboard.top_models.length > 0 && (
        <div className="bg-surface/30 backdrop-blur-sm border border-white/5 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">Top Models</h2>
          </div>
          <div className="space-y-3">
            {dashboard.top_models.map((model) => (
              <div key={model.model} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-white">{model.model}</span>
                  <span className="text-gray-400">
                    {formatNumber(model.total_tokens)} tokens ({model.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-600 transition-all"
                    style={{ width: `${model.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;