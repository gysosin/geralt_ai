// Template Types

export interface BotTemplate {
    template_id: string
    name: string
    description: string
    icon_url?: string
    prompt: string
    welcome_message?: string
    welcome_buttons?: { label: string; action: string }[]
    category?: string
    created_by: string
    created_at: string
    is_public: boolean
}

export interface CreateTemplateCommand {
    name: string
    description: string
    prompt: string
    icon_url?: string
    welcome_message?: string
    welcome_buttons?: { label: string; action: string }[]
    category?: string
    is_public?: boolean
}

// Analytics Types

export interface TokenUsageLog {
    log_id: string
    user_id: string
    username: string
    model: string
    input_tokens: number
    output_tokens: number
    total_tokens: number
    cost?: number
    timestamp: string
    bot_token?: string
    bot_name?: string
}

export interface UsageSummary {
    total_tokens: number
    total_input_tokens: number
    total_output_tokens: number
    total_cost: number
    total_requests: number
    period: string
}

export interface DailyUsage {
    date: string
    tokens: number
    requests: number
    cost?: number
}

export interface TopUser {
    user_id: string
    username: string
    total_tokens: number
    total_requests: number
}

export interface TopModel {
    model: string
    total_tokens: number
    total_requests: number
    percentage: number
}

export interface AnalyticsDashboard {
    summary: UsageSummary
    daily_usage: DailyUsage[]
    top_users: TopUser[]
    top_models: TopModel[]
}
