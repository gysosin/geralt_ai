// Quiz Types

export interface Quiz {
    quiz_id: string
    category: string
    collection_id: string
    question_count: number
    created_at: string
    status?: 'completed' | 'in_progress' | 'not_started'
    score?: number
    total_questions?: number
}

export interface QuizQuestion {
    id: string
    question: string
    options: string[]
    correct_option?: string
    user_answer?: string
    explanation?: string
    category?: string
}

export interface QuizAttempt {
    attempt_id: string
    quiz_id: string
    start_time: string
    end_time?: string
    score?: number
    total_questions: number
    answered_questions: number
    status: 'in_progress' | 'completed'
}

export interface QuizResult {
    quiz_id: string
    attempt_id: string
    score: number
    total_questions: number
    correct_answers: number
    wrong_answers: number
    time_taken?: string
    questions: QuizQuestion[]
}

export interface QuizDashboardSummary {
    total_quizzes: number
    completed_quizzes: number
    average_score: number
    total_questions_answered: number
    categories: { [key: string]: number }
    recent_quizzes: Quiz[]
}

export interface QuizPerformance {
    category: string
    correct: number
    total: number
    percentage: number
}

export interface QuizRecommendation {
    quiz_id: string
    category: string
    reason: string
}

export interface StartQuizCommand {
    quiz_id: string
    collection_id?: string
}

export interface SaveQuizProgressCommand {
    question_id: string
    user_answer: string
}

export interface SubmitQuizCommand {
    answers: { question_id: string; answer: string }[]
}

export interface GenerateQuizCommand {
    collection_id: string
    category?: string
    question_count?: number
}
