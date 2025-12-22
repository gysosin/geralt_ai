import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
    BarChart3,
    Coins,
    TrendingUp,
    Users,
    Cpu,
    Loader2,
    Calendar,
    Download,
    Check,
} from 'lucide-react'
import { PageTransition } from '@/components/layout/page-transition'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { analyticsService } from '@/services'
import type { AnalyticsDashboard, TokenUsageLog } from '@/types'

export default function AnalyticsPage() {
    const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null)
    const [logs, setLogs] = useState<TokenUsageLog[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365
            const [dashboardData, logsData] = await Promise.all([
                analyticsService.getDashboard().catch(() => ({
                    summary: { total_tokens: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost: 0, total_requests: 0, period: 'All Time' },
                    daily_usage: [],
                    top_users: [],
                    top_models: [],
                })),
                analyticsService.getTokenLogs(1, 20).catch(() => ({ logs: [], total: 0, pages: 1 })),
            ])
            setDashboard(dashboardData)
            setLogs(logsData.logs || [])
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load analytics',
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }, [dateRange])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
        return num.toString()
    }

    const formatCost = (cost?: number) => {
        return `$${(cost ?? 0).toFixed(4)}`
    }

    const exportData = (format: 'json' | 'csv') => {
        if (!dashboard) return

        if (format === 'json') {
            const data = JSON.stringify({
                summary: dashboard.summary,
                daily_usage: dashboard.daily_usage,
                top_models: dashboard.top_models,
                logs: logs,
            }, null, 2)
            const blob = new Blob([data], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`
            a.click()
            URL.revokeObjectURL(url)
        } else {
            // CSV export for daily usage
            const headers = ['Date', 'Tokens', 'Requests', 'Cost']
            const rows = dashboard.daily_usage.map(d => [d.date, d.tokens, d.requests, d.cost])
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)
        }

        toast({
            title: 'Export Complete',
            description: `Analytics data exported as ${format.toUpperCase()}`,
        })
    }

    if (isLoading) {
        return (
            <PageTransition>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </PageTransition>
        )
    }

    return (
        <PageTransition>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                        <p className="text-muted-foreground">
                            Monitor your AI usage and token consumption
                        </p>
                    </div>

                    <div className="flex gap-2">
                        {/* Date Range Picker */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {dateRange === '7d' ? 'Last 7 days' :
                                        dateRange === '30d' ? 'Last 30 days' :
                                            dateRange === '90d' ? 'Last 90 days' : 'All Time'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDateRange('7d')}>
                                    {dateRange === '7d' && <Check className="h-4 w-4 mr-2" />}
                                    Last 7 days
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDateRange('30d')}>
                                    {dateRange === '30d' && <Check className="h-4 w-4 mr-2" />}
                                    Last 30 days
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDateRange('90d')}>
                                    {dateRange === '90d' && <Check className="h-4 w-4 mr-2" />}
                                    Last 90 days
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDateRange('all')}>
                                    {dateRange === 'all' && <Check className="h-4 w-4 mr-2" />}
                                    All Time
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Export Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Download className="h-4 w-4" />
                                    Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => exportData('json')}>
                                    Export as JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportData('csv')}>
                                    Export as CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Stats Cards */}
                {dashboard && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <BarChart3 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">
                                            {formatNumber(dashboard.summary.total_tokens)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">Total Tokens</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <Coins className="h-5 w-5 text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">
                                            {formatCost(dashboard.summary.total_cost)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">Total Cost</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <TrendingUp className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">
                                            {formatNumber(dashboard.summary.total_requests)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">Total Requests</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <Calendar className="h-5 w-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{dashboard.summary.period}</p>
                                        <p className="text-sm text-muted-foreground">Period</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                )}

                {/* Charts Row */}
                {dashboard && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Daily Usage Chart */}
                        <Card className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                <h2 className="font-semibold">Daily Usage</h2>
                            </div>
                            <div className="h-48 flex items-end gap-1">
                                {dashboard.daily_usage.slice(-14).map((day, i) => {
                                    const maxTokens = Math.max(...dashboard.daily_usage.map((d) => d.tokens))
                                    const height = maxTokens > 0 ? (day.tokens / maxTokens) * 100 : 0
                                    return (
                                        <div
                                            key={i}
                                            className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t relative group"
                                            style={{ height: `${Math.max(height, 5)}%` }}
                                        >
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
                                                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                                    {formatNumber(day.tokens)}
                                                </Badge>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                <span>14 days ago</span>
                                <span>Today</span>
                            </div>
                        </Card>

                        {/* Top Models */}
                        <Card className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Cpu className="h-5 w-5 text-primary" />
                                <h2 className="font-semibold">Top Models</h2>
                            </div>
                            <div className="space-y-3">
                                {dashboard.top_models.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No model usage data yet
                                    </p>
                                ) : (
                                    dashboard.top_models.map((model) => (
                                        <div key={model.model} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium">{model.model}</span>
                                                <span className="text-muted-foreground">
                                                    {formatNumber(model.total_tokens)} tokens ({model.percentage}%)
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all"
                                                    style={{ width: `${model.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Top Users & Recent Logs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Users */}
                    {dashboard && (
                        <Card className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="h-5 w-5 text-primary" />
                                <h2 className="font-semibold">Top Users</h2>
                            </div>
                            {dashboard.top_users.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No user data yet
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {dashboard.top_users.slice(0, 5).map((user, i) => (
                                        <div
                                            key={user.user_id}
                                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                                    {i + 1}
                                                </div>
                                                <span className="font-medium">{user.username}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium">{formatNumber(user.total_tokens)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {user.total_requests} requests
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Recent Logs */}
                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            <h2 className="font-semibold">Recent Activity</h2>
                        </div>
                        {logs.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No activity yet
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {logs.map((log) => (
                                    <div
                                        key={log.log_id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{log.username}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {log.model} • {new Date(log.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                        <Badge variant="secondary">
                                            {formatNumber(log.total_tokens)}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </PageTransition>
    )
}
