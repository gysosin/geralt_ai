import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Trophy,
    Target,
    Clock,
    Loader2,
    RotateCcw,
} from 'lucide-react'
import { PageTransition } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { quizService } from '@/services'
import type { QuizQuestion } from '@/types'

interface QuizResultData {
    score: number
    total_questions: number
    correct_answers: number
    wrong_answers: number
    time_taken?: string
    questions: QuizQuestion[]
}

export default function QuizResultsPage() {
    const { quizId } = useParams<{ quizId: string }>()
    const navigate = useNavigate()
    const [result, setResult] = useState<QuizResultData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchResults = useCallback(async () => {
        if (!quizId) return
        setIsLoading(true)
        try {
            const details = await quizService.getQuizDetails(quizId)
            setResult({
                score: details.score || 0,
                total_questions: details.questions.length,
                correct_answers: details.questions.filter((q) => q.user_answer === q.correct_option).length,
                wrong_answers: details.questions.filter((q) => q.user_answer && q.user_answer !== q.correct_option).length,
                questions: details.questions,
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load results',
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }, [quizId])

    useEffect(() => {
        fetchResults()
    }, [fetchResults])

    const handleRetake = async () => {
        if (!quizId) return
        try {
            const startResult = await quizService.startQuiz({ quiz_id: quizId })
            navigate(`/quizzes/${quizId}/take?attempt=${startResult.attempt_id}`)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to start quiz',
                variant: 'destructive',
            })
        }
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

    if (!result) {
        return (
            <PageTransition>
                <div className="text-center py-20">
                    <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Results not found</h3>
                    <Button onClick={() => navigate('/quizzes')}>Back to Quizzes</Button>
                </div>
            </PageTransition>
        )
    }

    const scorePercentage = Math.round((result.correct_answers / result.total_questions) * 100)
    const scoreColor = scorePercentage >= 80 ? 'text-green-500' : scorePercentage >= 60 ? 'text-yellow-500' : 'text-red-500'

    return (
        <PageTransition>
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <Button variant="ghost" onClick={() => navigate('/quizzes')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Quizzes
                </Button>

                {/* Score Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Card className="p-8 text-center bg-gradient-to-br from-primary/10 to-transparent">
                        <Trophy className={`h-16 w-16 mx-auto mb-4 ${scoreColor}`} />
                        <h1 className={`text-5xl font-bold mb-2 ${scoreColor}`}>
                            {scorePercentage}%
                        </h1>
                        <p className="text-muted-foreground mb-6">
                            You answered {result.correct_answers} out of {result.total_questions} correctly
                        </p>

                        <div className="flex justify-center gap-8 mb-6">
                            <div className="text-center">
                                <div className="flex items-center gap-2 text-green-500">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span className="text-2xl font-bold">{result.correct_answers}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">Correct</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center gap-2 text-red-500">
                                    <XCircle className="h-5 w-5" />
                                    <span className="text-2xl font-bold">{result.wrong_answers}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">Wrong</p>
                            </div>
                        </div>

                        <Button onClick={handleRetake}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Retake Quiz
                        </Button>
                    </Card>
                </motion.div>

                {/* Questions Review */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Question Review</h2>

                    {result.questions.map((question, index) => {
                        const isCorrect = question.user_answer === question.correct_option
                        const wasAnswered = !!question.user_answer

                        return (
                            <motion.div
                                key={question.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className={`p-4 ${isCorrect ? 'border-green-500/50' : wasAnswered ? 'border-red-500/50' : 'border-yellow-500/50'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isCorrect ? 'bg-green-500/10 text-green-500' : wasAnswered ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                                            }`}>
                                            {isCorrect ? (
                                                <CheckCircle2 className="h-5 w-5" />
                                            ) : (
                                                <XCircle className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-medium mb-2">
                                                {index + 1}. {question.question}
                                            </h3>

                                            <div className="space-y-1 text-sm">
                                                {wasAnswered && !isCorrect && (
                                                    <p className="text-red-500">
                                                        Your answer: {question.user_answer}
                                                    </p>
                                                )}
                                                <p className="text-green-500">
                                                    Correct: {question.correct_option}
                                                </p>
                                                {question.explanation && (
                                                    <p className="text-muted-foreground mt-2">
                                                        {question.explanation}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </PageTransition>
    )
}
