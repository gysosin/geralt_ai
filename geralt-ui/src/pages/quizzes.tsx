import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    Brain,
    Trophy,
    Target,
    TrendingUp,
    Clock,
    ChevronRight,
    Loader2,
    BarChart3,
    Filter,
    Check,
} from 'lucide-react'
import { PageTransition } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { quizService } from '@/services'
import type { Quiz, QuizDashboardSummary, QuizPerformance } from '@/types'

export default function QuizzesPage() {
    const navigate = useNavigate()
    const [dashboard, setDashboard] = useState<QuizDashboardSummary | null>(null)
    const [quizzes, setQuizzes] = useState<Quiz[]>([])
    const [performance, setPerformance] = useState<QuizPerformance[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState<string>('all')

    // Get unique categories from quizzes
    const categories = ['all', ...new Set(quizzes.map(q => q.category).filter(Boolean))] as string[]

    // Filter quizzes by category
    const filteredQuizzes = selectedCategory === 'all'
        ? quizzes
        : quizzes.filter(q => q.category === selectedCategory)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [dashboardData, quizzesData, performanceData] = await Promise.all([
                quizService.getDashboardSummary().catch(() => null),
                quizService.getAllQuizzes().catch(() => []),
                quizService.analyzePerformance().catch(() => []),
            ])
            setDashboard(dashboardData)
            setQuizzes(Array.isArray(quizzesData) ? quizzesData : [])
            setPerformance(Array.isArray(performanceData) ? performanceData : [])
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load quiz data',
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleStartQuiz = async (quizId: string) => {
        try {
            const result = await quizService.startQuiz({ quiz_id: quizId })
            navigate(`/quizzes/${quizId}/take?attempt=${result.attempt_id}`)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to start quiz',
                variant: 'destructive',
            })
        }
    }

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'completed':
                return <Badge variant="default" className="bg-green-600">Completed</Badge>
            case 'in_progress':
                return <Badge variant="secondary">In Progress</Badge>
            default:
                return <Badge variant="outline">New</Badge>
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

    return (
        <PageTransition>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
                    <p className="text-muted-foreground">
                        Test your knowledge and track your progress
                    </p>
                </div>

                {/* Category Filter */}
                {categories.length > 1 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Filter className="h-4 w-4" />
                                {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {categories.map((cat) => (
                                <DropdownMenuItem
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                >
                                    {selectedCategory === cat && <Check className="h-4 w-4 mr-2" />}
                                    {cat === 'all' ? 'All Categories' : cat}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Stats Cards */}
                {dashboard && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Brain className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{dashboard.total_quizzes}</p>
                                        <p className="text-sm text-muted-foreground">Total Quizzes</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <Trophy className="h-5 w-5 text-green-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{dashboard.completed_quizzes}</p>
                                        <p className="text-sm text-muted-foreground">Completed</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Target className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{Math.round(dashboard.average_score)}%</p>
                                        <p className="text-sm text-muted-foreground">Avg Score</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            <Card className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <TrendingUp className="h-5 w-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{dashboard.total_questions_answered}</p>
                                        <p className="text-sm text-muted-foreground">Questions Answered</p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                )}

                {/* Performance by Category */}
                {performance.length > 0 && (
                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            <h2 className="font-semibold">Performance by Category</h2>
                        </div>
                        <div className="space-y-3">
                            {performance.map((perf) => (
                                <div key={perf.category} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span>{perf.category}</span>
                                        <span className="text-muted-foreground">
                                            {perf.correct}/{perf.total} ({perf.percentage}%)
                                        </span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all"
                                            style={{ width: `${perf.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Quizzes List */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Available Quizzes</h2>

                    {quizzes.length === 0 ? (
                        <Card className="p-8 text-center">
                            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="font-semibold mb-2">No quizzes available</h3>
                            <p className="text-muted-foreground">
                                Quizzes will be generated from your knowledge base content
                            </p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredQuizzes.map((quiz, index) => (
                                <motion.div
                                    key={quiz.quiz_id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card className="p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Brain className="h-5 w-5 text-primary" />
                                            </div>
                                            {getStatusBadge(quiz.status)}
                                        </div>

                                        <h3 className="font-semibold mb-1 line-clamp-1">
                                            {quiz.category || 'General'}
                                        </h3>

                                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                                            <span>{quiz.question_count} questions</span>
                                            {quiz.score !== undefined && (
                                                <span className="text-green-600 font-medium">
                                                    Score: {quiz.score}%
                                                </span>
                                            )}
                                        </div>

                                        <Button
                                            className="w-full group-hover:bg-primary"
                                            variant="outline"
                                            onClick={() => handleStartQuiz(quiz.quiz_id)}
                                        >
                                            {quiz.status === 'in_progress' ? 'Continue' : quiz.status === 'completed' ? 'Retake' : 'Start Quiz'}
                                            <ChevronRight className="h-4 w-4 ml-2" />
                                        </Button>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    )
}
