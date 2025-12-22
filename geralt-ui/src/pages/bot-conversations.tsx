import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    MessageSquare,
    Trash2,
    Edit2,
    Check,
    X,
    Loader2,
    MoreVertical,
} from 'lucide-react'
import { PageTransition } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { botConversationService, type BotConversation } from '@/services/bot-conversation.service'
import { botService } from '@/services'

export default function BotConversationsPage() {
    const { token: botToken } = useParams<{ token: string }>()
    const navigate = useNavigate()

    const [botName, setBotName] = useState('Bot')
    const [conversations, setConversations] = useState<BotConversation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const fetchConversations = useCallback(async () => {
        if (!botToken) return
        setIsLoading(true)
        try {
            const convos = await botConversationService.getAllBotConversations(botToken)
            setConversations(convos)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load conversations',
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }, [botToken])

    const fetchBotDetails = useCallback(async () => {
        if (!botToken) return
        try {
            // tenantId 'default' as fallback since we don't have user context here
            const bot = await botService.getBotByToken(botToken, 'default')
            setBotName(bot.bot_name)
        } catch (error) {
            console.error('Failed to fetch bot details:', error)
        }
    }, [botToken])

    useEffect(() => {
        fetchConversations()
        fetchBotDetails()
    }, [fetchConversations, fetchBotDetails])

    const handleRename = async (conversationId: string) => {
        if (!botToken || !editName.trim()) return
        setIsSaving(true)
        try {
            await botConversationService.renameConversation(
                botToken,
                conversationId,
                editName
            )
            toast({
                title: 'Success',
                description: 'Conversation renamed',
            })
            setEditingId(null)
            fetchConversations()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to rename conversation',
                variant: 'destructive',
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (conversationId: string) => {
        if (!botToken) return
        if (!confirm('Delete this conversation?')) return

        try {
            await botConversationService.deleteConversation(botToken, conversationId)
            toast({
                title: 'Success',
                description: 'Conversation deleted',
            })
            fetchConversations()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete conversation',
                variant: 'destructive',
            })
        }
    }

    const startEdit = (conv: BotConversation) => {
        setEditingId(conv.conversation_id)
        setEditName(conv.name || conv.first_question?.slice(0, 50) || 'Untitled')
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName('')
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <PageTransition>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/bots')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {botName} Conversations
                        </h1>
                        <p className="text-muted-foreground">
                            {conversations.length} conversation(s)
                        </p>
                    </div>
                </div>

                {/* Conversations List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : conversations.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20"
                    >
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
                        <p className="text-muted-foreground">
                            Conversations will appear here when users interact with this bot
                        </p>
                    </motion.div>
                ) : (
                    <div className="space-y-3">
                        {conversations.map((conv, index) => (
                            <motion.div
                                key={conv.conversation_id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="p-4 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <MessageSquare className="h-5 w-5 text-primary" />
                                            </div>

                                            {editingId === conv.conversation_id ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="max-w-xs"
                                                        autoFocus
                                                    />
                                                    <Button
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleRename(conv.conversation_id)}
                                                        disabled={isSaving}
                                                    >
                                                        {isSaving ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Check className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="h-8 w-8"
                                                        onClick={cancelEdit}
                                                        disabled={isSaving}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">
                                                        {conv.name || conv.first_question || 'Untitled'}
                                                    </p>
                                                    {conv.created_at && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatDate(conv.created_at)}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {editingId !== conv.conversation_id && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => startEdit(conv)}>
                                                        <Edit2 className="h-4 w-4 mr-2" />
                                                        Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleDelete(conv.conversation_id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </PageTransition>
    )
}
