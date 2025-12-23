import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from 'recharts';
import {
  Calendar, Download, TrendingUp, AlertCircle, CheckCircle,
  ChevronDown, Check, Loader2, RefreshCw, BarChart3, Coins, Cpu, Users, Activity,
  Zap, Clock, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsService } from '@/src/services';
import type { AnalyticsDashboard, DailyUsage, TopModel, TokenUsageLog } from '@/types';

// Enhanced color palette with gradients
const CHART_COLORS = {
  primary: '#8b5cf6',
  secondary: '#06b6d4',
  tertiary: '#10b981',
  quaternary: '#f59e0b',
  danger: '#ef4444',
  blue: '#3b82f6',
};

const PIE_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

// Custom tooltip component for consistent styling
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl"
    >
      <p className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-white font-semibold text-lg">
            {formatter ? formatter(entry.value, entry.name) : entry.value.toLocaleString()}
          </span>
          <span className="text-gray-500 text-sm">{entry.name}</span>
        </div>
      ))}
    </motion.div>
  );
};

// Enhanced analytics card with better styling
const AnalyticsCard = ({ title, subtitle, children, isLoading, action, className = '' }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className={`relative bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f23]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 flex flex-col overflow-hidden ${className}`}
  >
    {/* Subtle gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] via-transparent to-cyan-500/[0.03] pointer-events-none" />

    <div className="relative flex justify-between items-start mb-6">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action || (
        <button className="text-gray-500 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all duration-300 group">
          <Download size={16} className="group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
    <div className="relative flex-1 w-full min-h-0">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="relative">
            <div className="absolute inset-0 animate-ping">
              <Loader2 className="h-8 w-8 text-violet-500/20" />
            </div>
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  </motion.div>
);

// Premium stat card with animated gradient border
const StatCard = ({ title, value, change, icon: Icon, gradient, isLoading }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.02, y: -2 }}
    transition={{ duration: 0.3 }}
    className="relative group"
  >
    {/* Animated gradient border */}
    <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500`} />

    <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#0f0f23] border border-white/[0.08] rounded-2xl p-5 h-full">
      {/* Top gradient line */}
      <div className={`absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r ${gradient} opacity-60`} />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          {isLoading ? (
            <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              {value}
            </p>
          )}
          {change && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <TrendingUp size={12} className={change < 0 ? 'rotate-180' : ''} />
              <span>{Math.abs(change)}% vs last period</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  </motion.div>
);

// Radial progress component
const RadialProgress = ({ value, label, color, size = 120 }: any) => {
  const data = [{ value, fill: color }];

  return (
    <div className="relative flex flex-col items-center">
      <ResponsiveContainer width={size} height={size}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="75%"
          outerRadius="100%"
          barSize={10}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            background={{ fill: 'rgba(255,255,255,0.05)' }}
            dataKey="value"
            cornerRadius={10}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{value}%</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </div>
  );
};

const Analytics: React.FC = () => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('All Models');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState('This Month');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [logs, setLogs] = useState<TokenUsageLog[]>([]);

  const models = ['All Models', 'GPT-4 Turbo', 'Claude 3 Opus', 'Gemini 1.5 Pro'];
  const dateRanges = ['Today', 'Yesterday', 'Last 7 Days', 'This Month', 'Last Month'];

  useEffect(() => {
    fetchAnalytics();
  }, [selectedDateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const [data, logsData] = await Promise.all([
        analyticsService.getDashboard(),
        analyticsService.getTokenLogs(1, 20).catch(() => ({ logs: [], total: 0, pages: 1 }))
      ]);
      setDashboard(data);
      setLogs(logsData.logs || []);
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

  // Prepare chart data with enhanced styling
  const chartData = useMemo(() => {
    if (!dashboard?.daily_usage || dashboard.daily_usage.length === 0) {
      return [
        { name: 'Mon', tokens: 4000, cost: 2.4, requests: 120 },
        { name: 'Tue', tokens: 3000, cost: 1.8, requests: 98 },
        { name: 'Wed', tokens: 5200, cost: 3.1, requests: 156 },
        { name: 'Thu', tokens: 2780, cost: 1.6, requests: 87 },
        { name: 'Fri', tokens: 1890, cost: 1.1, requests: 62 },
        { name: 'Sat', tokens: 2390, cost: 1.4, requests: 75 },
        { name: 'Sun', tokens: 3490, cost: 2.1, requests: 110 },
      ];
    }

    return dashboard.daily_usage.slice(-14).map((d) => {
      const date = new Date(d.date);
      return {
        name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tokens: d.tokens,
        cost: d.cost || d.tokens * 0.000003,
        requests: d.requests || 0,
      };
    });
  }, [dashboard]);

  // Prepare cost breakdown data
  const costData = useMemo(() => {
    if (!dashboard?.top_models || dashboard.top_models.length === 0) {
      return [
        { name: 'GPT-4', value: 450, fill: PIE_COLORS[0] },
        { name: 'Claude 3', value: 300, fill: PIE_COLORS[1] },
        { name: 'Gemini', value: 220, fill: PIE_COLORS[2] },
        { name: 'Embeddings', value: 120, fill: PIE_COLORS[3] },
        { name: 'Audio', value: 80, fill: PIE_COLORS[4] },
      ];
    }

    return dashboard.top_models.slice(0, 5).map((m, i) => ({
      name: m.model.length > 12 ? m.model.substring(0, 12) + '...' : m.model,
      value: m.total_tokens,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [dashboard]);

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
    <div className="max-w-[1600px] mx-auto space-y-8 pb-8" onClick={() => {
      if (modelDropdownOpen) setModelDropdownOpen(false);
      if (datePickerOpen) setDatePickerOpen(false);
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-violet-200 bg-clip-text text-transparent mb-2">
            Performance Analytics
          </h1>
          <p className="text-gray-400">Deep dive into usage patterns, costs, and system health.</p>
        </div>
        <div className="flex items-center gap-3 relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchAnalytics}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-colors"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </motion.button>

          {/* Model Select */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setModelDropdownOpen(!modelDropdownOpen); setDatePickerOpen(false); }}
              className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none hover:bg-white/10 transition-colors w-44 justify-between"
            >
              {selectedModel}
              <ChevronDown size={14} className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {modelDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-52 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  {models.map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center justify-between transition-colors"
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
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl border border-white/10 transition-colors"
            >
              <Calendar size={16} /> {selectedDateRange}
            </button>
            <AnimatePresence>
              {datePickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-48 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    {dateRanges.map(range => (
                      <button
                        key={range}
                        onClick={() => { setSelectedDateRange(range); setDatePickerOpen(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${selectedDateRange === range
                            ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-500/20'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
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
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20"
            >
              <Download size={16} /> Export
            </motion.button>
            <div className="absolute top-full right-0 mt-2 w-44 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden hidden group-hover:block">
              <button
                onClick={() => exportData('json')}
                className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Export as JSON
              </button>
              <button
                onClick={() => exportData('csv')}
                className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Export as CSV
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Tokens"
          value={formatNumber(dashboard?.summary.total_tokens || 0)}
          change={12.5}
          icon={Zap}
          gradient="from-violet-600 to-purple-600"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Cost"
          value={formatCost(dashboard?.summary.total_cost || 0)}
          change={-8.3}
          icon={Coins}
          gradient="from-emerald-600 to-teal-600"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Requests"
          value={formatNumber(dashboard?.summary.total_requests || 0)}
          change={23.1}
          icon={Database}
          gradient="from-cyan-600 to-blue-600"
          isLoading={isLoading}
        />
        <StatCard
          title="Avg Response Time"
          value={dashboard?.summary.period || '~450ms'}
          change={-5.2}
          icon={Clock}
          gradient="from-orange-600 to-amber-600"
          isLoading={isLoading}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Token Usage - Larger chart */}
        <AnalyticsCard
          title="Token Usage Trend"
          subtitle="Daily token consumption over time"
          isLoading={isLoading}
          className="lg:col-span-2 h-[420px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(value) => formatNumber(value)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="tokens"
                stroke="#8b5cf6"
                strokeWidth={3}
                fill="url(#tokenGradient)"
                filter="url(#glow)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cost"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        {/* Model Distribution - Donut */}
        <AnalyticsCard
          title="Model Distribution"
          subtitle="Token usage by model"
          isLoading={isLoading}
          className="h-[420px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {PIE_COLORS.map((color, index) => (
                  <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={costData}
                cx="50%"
                cy="45%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {costData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#pieGradient${index})`}
                    className="transition-all duration-300 hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip
                content={<CustomTooltip formatter={(val: number) => formatNumber(val)} />}
              />
              <Legend
                verticalAlign="bottom"
                height={50}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-gray-400 text-xs ml-1">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </AnalyticsCard>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Requests Bar Chart */}
        <AnalyticsCard
          title="Daily Requests"
          subtitle="Request volume breakdown"
          isLoading={isLoading}
          className="h-[360px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
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
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.02)', radius: 8 }}
                content={<CustomTooltip />}
              />
              <Bar
                dataKey="requests"
                fill="url(#barGradient)"
                radius={[8, 8, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        {/* System Health */}
        <AnalyticsCard
          title="System Health"
          subtitle="Performance metrics"
          isLoading={isLoading}
          className="h-[360px]"
        >
          <div className="flex items-center justify-around h-full">
            <RadialProgress value={successRate} label="Success Rate" color="#10b981" size={140} />
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <CheckCircle className="text-emerald-400" size={24} />
                <div>
                  <p className="text-2xl font-bold text-white">{successRate}%</p>
                  <p className="text-xs text-gray-400">Success Rate</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <AlertCircle className="text-red-400" size={24} />
                <div>
                  <p className="text-2xl font-bold text-white">{errorRate}%</p>
                  <p className="text-xs text-gray-400">Error Rate</p>
                </div>
              </div>
            </div>
          </div>
        </AnalyticsCard>
      </div>

      {/* Optimization Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-r from-violet-600/20 via-indigo-600/20 to-purple-600/20 border border-violet-500/20 rounded-3xl p-6"
      >
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-violet-500/20 to-transparent rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-500/20 rounded-2xl">
              <TrendingUp className="text-violet-400" size={28} />
            </div>
            <div>
              <h4 className="text-white font-semibold text-lg mb-1">Optimize your usage</h4>
              <p className="text-sm text-gray-400">Switching to 'Flash' models could save up to 30% on costs while maintaining quality.</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
          >
            Apply Settings
          </motion.button>
        </div>
      </motion.div>

      {/* Top Users & Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users */}
        <AnalyticsCard
          title="Top Users"
          subtitle="Highest token consumers"
          isLoading={isLoading}
          action={<Users className="h-5 w-5 text-blue-400" />}
          className="h-auto"
        >
          {dashboard?.top_users && dashboard.top_users.length > 0 ? (
            <div className="space-y-3">
              {dashboard.top_users.slice(0, 5).map((user, i) => (
                <motion.div
                  key={user.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-white/[0.03] to-transparent border border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' :
                        i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                          i === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white' :
                            'bg-violet-600/20 text-violet-400'
                      }`}>
                      {i + 1}
                    </div>
                    <span className="font-medium text-white group-hover:text-violet-300 transition-colors">
                      {user.username}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">{formatNumber(user.total_tokens)}</p>
                    <p className="text-xs text-gray-500">{user.total_requests} requests</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <p>No user data available</p>
            </div>
          )}
        </AnalyticsCard>

        {/* Recent Activity */}
        <AnalyticsCard
          title="Recent Activity"
          subtitle="Latest API calls"
          isLoading={isLoading}
          action={<Activity className="h-5 w-5 text-emerald-400" />}
          className="h-auto"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {logs.map((log, i) => (
                <motion.div
                  key={log.log_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="font-medium text-white truncate">{log.username}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {log.model} • {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-3 py-1.5 bg-gradient-to-r from-violet-600/20 to-purple-600/20 text-violet-400 rounded-lg text-xs font-semibold border border-violet-500/20 ml-3">
                    {formatNumber(log.total_tokens)}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </AnalyticsCard>
      </div>

      {/* Top Models */}
      {dashboard?.top_models && dashboard.top_models.length > 0 && (
        <AnalyticsCard
          title="Top Models"
          subtitle="Token distribution across AI models"
          isLoading={isLoading}
          action={<Cpu className="h-5 w-5 text-violet-400" />}
          className="h-auto"
        >
          <div className="space-y-4">
            {dashboard.top_models.map((model, i) => (
              <motion.div
                key={model.model}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-white">{model.model}</span>
                  <span className="text-gray-400">
                    {formatNumber(model.total_tokens)} tokens
                    <span className="ml-2 text-violet-400">({model.percentage}%)</span>
                  </span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${model.percentage}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className={`h-full rounded-full bg-gradient-to-r ${i === 0 ? 'from-violet-600 to-purple-500' :
                        i === 1 ? 'from-cyan-600 to-blue-500' :
                          i === 2 ? 'from-emerald-600 to-teal-500' :
                            'from-orange-600 to-amber-500'
                      }`}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </AnalyticsCard>
      )}
    </div>
  );
};

export default Analytics;