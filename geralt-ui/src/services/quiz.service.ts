import api from './api'
import type {
    Quiz,
    QuizQuestion,
    QuizAttempt,
    QuizResult,
    QuizDashboardSummary,
    QuizPerformance,
    QuizRecommendation,
    StartQuizCommand,
    SaveQuizProgressCommand,
    SubmitQuizCommand,
} from '@/types'

const BASE_PATH = '/api/v1/bots'

export const quizService = {
    /**
     * Get all quizzes for the current user
     */
    async getAllQuizzes(): Promise<Quiz[]> {
        const response = await api.get<{ quizzes: Quiz[] }>(`${BASE_PATH}/quizzes`)
        return response.data.quizzes || []
    },

    /**
     * Get quiz details by ID
     */
    async getQuizDetails(quizId: string): Promise<Quiz & { questions: QuizQuestion[] }> {
        const response = await api.get<Quiz & { questions: QuizQuestion[] }>(
            `${BASE_PATH}/quizzes/${quizId}`
        )
        return response.data
    },

    /**
     * Start or resume a quiz attempt
     */
    async startQuiz(data: StartQuizCommand): Promise<{
        quiz_id: string
        attempt_id: string
        questions: QuizQuestion[]
        progress: { answered: number; total: number }
    }> {
        const response = await api.post(`${BASE_PATH}/quizzes/start`, data)
        return response.data
    },

    /**
     * Save progress for a single question
     */
    async saveProgress(
        quizId: string,
        data: SaveQuizProgressCommand
    ): Promise<{ message: string }> {
        const response = await api.post<{ message: string }>(
            `${BASE_PATH}/quizzes/progress`,
            { quiz_id: quizId, ...data }
        )
        return response.data
    },

    /**
     * Submit a completed quiz
     */
    async submitQuiz(
        quizId: string,
        data: SubmitQuizCommand
    ): Promise<QuizResult> {
        const response = await api.post<QuizResult>(
            `${BASE_PATH}/quizzes/submit`,
            { quiz_id: quizId, ...data }
        )
        return response.data
    },

    /**
     * Get quiz results for the current user
     */
    async getQuizResults(): Promise<QuizResult[]> {
        const response = await api.get<{ results: QuizResult[] }>(`${BASE_PATH}/quizzes/results`)
        return response.data.results || []
    },

    /**
     * Get quiz attempts for a specific quiz
     */
    async getQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
        const response = await api.get<{ attempts: QuizAttempt[] }>(
            `${BASE_PATH}/quizzes/${quizId}/attempts`
        )
        return response.data.attempts || []
    },

    /**
     * Analyze performance by category
     */
    async analyzePerformance(): Promise<QuizPerformance[]> {
        const response = await api.get<any>(
            `${BASE_PATH}/quizzes/performance`
        )
        // Backend returns { average_score, total_quizzes, performance } where performance is a string
        // Return empty array for now since backend doesn't return category breakdown
        if (Array.isArray(response.data.performance)) {
            return response.data.performance
        }
        return []
    },

    /**
     * Get dashboard summary
     */
    async getDashboardSummary(): Promise<QuizDashboardSummary> {
        const response = await api.get<any>(`${BASE_PATH}/dashboard`)
        // Normalize the response to match expected format
        return {
            total_quizzes: response.data.total_quizzes || 0,
            completed_quizzes: response.data.completed_quizzes || 0,
            average_score: response.data.average_score || 0,
            total_questions_answered: response.data.total_questions_answered || 0,
            categories: response.data.categories || {},
            recent_quizzes: response.data.recent_quizzes || [],
        }
    },

    /**
     * Get quiz progress
     */
    async getProgress(): Promise<{ completed: number; total: number; percentage: number }> {
        const response = await api.get(`${BASE_PATH}/quizzes/progress`)
        return response.data
    },

    /**
     * Get recommendations
     */
    async getRecommendations(): Promise<QuizRecommendation[]> {
        const response = await api.get<{ recommendations: QuizRecommendation[] }>(
            `${BASE_PATH}/quizzes/recommendations`
        )
        return response.data.recommendations || []
    },

    /**
     * Get quizzes grouped by category
     */
    async getQuizzesByCategory(): Promise<{ [category: string]: Quiz[] }> {
        const response = await api.get<{ categories: { [category: string]: Quiz[] } }>(
            `${BASE_PATH}/quizzes/grouped`
        )
        return response.data.categories || {}
    },

    /**
     * Get all quiz categories
     */
    async getQuizCategories(): Promise<string[]> {
        const response = await api.get<{ categories: string[] }>(`${BASE_PATH}/quizzes/categories`)
        return response.data.categories || []
    },

    /**
     * Delete a quiz
     */
    async deleteQuiz(quizId: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(
            `${BASE_PATH}/quizzes/${quizId}`
        )
        return response.data
    },

    /**
     * Delete a quiz attempt
     */
    async deleteQuizAttempt(
        quizId: string,
        attemptId: string
    ): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(
            `${BASE_PATH}/quizzes/${quizId}/attempts/${attemptId}`
        )
        return response.data
    },

    /**
     * Update a quiz
     */
    async updateQuiz(
        quizId: string,
        data: Partial<Quiz>
    ): Promise<{ message: string }> {
        const response = await api.put<{ message: string }>(
            `${BASE_PATH}/quizzes/${quizId}`,
            data
        )
        return response.data
    },
}

export default quizService
