import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Clock,
    Loader2,
    AlertCircle,
    Send,
} from 'lucide-react'
import { PageTransition } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { quizService } from '@/services'
import type { QuizQuestion } from '@/types'

export default function QuizTakePage() {
    const { quizId } = useParams<{ quizId: string }>()
    const [searchParams] = useSearchParams()
    const attemptId = searchParams.get('attempt')
    const navigate = useNavigate()

    const [questions, setQuestions] = useState<QuizQuestion[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answers, setAnswers] = useState<{ [questionId: string]: string }>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const fetchQuiz = useCallback(async () => {
        if (!quizId) return
        setIsLoading(true)
        try {
            const result = await quizService.startQuiz({ quiz_id: quizId })
            setQuestions(result.questions)
            // Restore previous answers if any
            const savedAnswers: { [key: string]: string } = {}
            result.questions.forEach((q) => {
                if (q.user_answer) {
                    savedAnswers[q.id] = q.user_answer
                }
            })
            setAnswers(savedAnswers)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load quiz',
                variant: 'destructive',
            })
            navigate('/quizzes')
        } finally {
            setIsLoading(false)
        }
    }, [quizId, navigate])

    useEffect(() => {
        fetchQuiz()
    }, [fetchQuiz])

    const currentQuestion = questions[currentIndex]
    const answeredCount = Object.keys(answers).length
    const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0

    const handleSelectAnswer = async (option: string) => {
        if (!currentQuestion || !quizId) return

        const newAnswers = { ...answers, [currentQuestion.id]: option }
        setAnswers(newAnswers)

        // Save progress
        setIsSaving(true)
        try {
            await quizService.saveProgress(quizId, {
                question_id: currentQuestion.id,
                user_answer: option,
            })
        } catch (error) {
            console.error('Failed to save progress:', error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1)
        }
    }

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1)
        }
    }

    const handleSubmit = async () => {
        if (!quizId) return

        const unanswered = questions.filter((q) => !answers[q.id])
        if (unanswered.length > 0) {
            if (!confirm(`You have ${unanswered.length} unanswered question(s). Submit anyway?`)) {
                return
            }
        }

        setIsSubmitting(true)
        try {
            const formattedAnswers = Object.entries(answers).map(([question_id, answer]) => ({
                question_id,
                answer,
            }))
            const result = await quizService.submitQuiz(quizId, { answers: formattedAnswers })
            toast({
                title: 'Quiz Submitted!',
                description: `You scored ${result.score}% (${result.correct_answers}/${result.total_questions})`,
            })
            navigate(`/quizzes/${quizId}/results`)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to submit quiz',
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
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

    if (!currentQuestion) {
        return (
            <PageTransition>
                <div className="text-center py-20">
                    <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No questions found</h3>
                    <Button onClick={() => navigate('/quizzes')}>Back to Quizzes</Button>
                </div>
            </PageTransition>
        )
    }

    return (
        <PageTransition>
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate('/quizzes')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Exit Quiz
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Clock className="h-4 w-4" />
                        <span>Auto-saving</span>
                    </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Question {currentIndex + 1} of {questions.length}</span>
                        <span>{answeredCount} answered</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>

                {/* Question Card */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Card className="p-6">
                            <div className="mb-6">
                                {currentQuestion.category && (
                                    <Badge variant="secondary" className="mb-3">
                                        {currentQuestion.category}
                                    </Badge>
                                )}
                                <h2 className="text-xl font-semibold">
                                    {currentQuestion.question}
                                </h2>
                            </div>

                            <div className="space-y-3">
                                {currentQuestion.options.map((option, index) => {
                                    const isSelected = answers[currentQuestion.id] === option
                                    const optionLabel = String.fromCharCode(65 + index) // A, B, C, D

                                    return (
                                        <motion.button
                                            key={index}
                                            onClick={() => handleSelectAnswer(option)}
                                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${isSelected
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                                }`}
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${isSelected
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-muted'
                                                        }`}
                                                >
                                                    {isSelected ? <Check className="h-4 w-4" /> : optionLabel}
                                                </div>
                                                <span>{option}</span>
                                            </div>
                                        </motion.button>
                                    )
                                })}
                            </div>
                        </Card>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Previous
                    </Button>

                    <div className="flex gap-2">
                        {/* Question dots */}
                        {questions.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className={`h-3 w-3 rounded-full transition-all ${i === currentIndex
                                        ? 'bg-primary scale-125'
                                        : answers[q.id]
                                            ? 'bg-primary/50'
                                            : 'bg-muted'
                                    }`}
                            />
                        ))}
                    </div>

                    {currentIndex < questions.length - 1 ? (
                        <Button onClick={handleNext}>
                            Next
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            Submit Quiz
                        </Button>
                    )}
                </div>
            </div>
        </PageTransition>
    )
}
