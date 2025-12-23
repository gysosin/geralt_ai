import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Loader2, Plus, Trash2, MoreHorizontal, History, Edit } from 'lucide-react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { MarkdownRenderer, SourcesList, SuggestionChips, CollectionPicker } from '@/components/chat'
import { ConversationSidebar } from '@/components/chat/conversation-sidebar'
import { useChatStore, useAuthStore, useBotStore } from '@/store'
import { CreateBotDialog } from '@/components/bots/create-bot-dialog'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Message, ConversationListItem } from '@/types'

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center p-4">
      <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
        <Bot className="h-5 w-5 text-white" />
      </div>
      <div className="ml-3 flex gap-1">
        <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
        <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
        <span className="typing-dot h-2 w-2 rounded-full bg-primary" />
      </div>
    </div>
  )
}

// Message bubble component with markdown, sources, and suggestions
function MessageBubble({
  message,
  user,
  onSuggestionClick,
  isSending
}: {
  message: Message
  user: typeof useAuthStore.prototype.user
  onSuggestionClick?: (suggestion: string) => void
  isSending?: boolean
}) {
  const isUser = message.role === 'user'

  if (message.isLoading) {
    return <TypingIndicator />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 p-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {isUser ? (
        <UserAvatar user={user} className="shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-white" />
        </div>
      )}

      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-3",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-md"
          : "bg-muted rounded-tl-md"
      )}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} className="text-sm" />
        )}

        <p className={cn(
          "text-xs mt-2",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {formatRelativeTime(message.timestamp)}
        </p>

        {/* Sources for AI responses */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}

        {/* Suggestion chips for AI responses */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && onSuggestionClick && (
          <SuggestionChips
            suggestions={message.suggestions}
            onSelect={onSuggestionClick}
            disabled={isSending}
          />
        )}
      </div>
    </motion.div>
  )
}

// Empty state component
function EmptyChat({ onStartChat }: { onStartChat: () => void }) {
  const suggestions = [
    "Tell me about yourself and what you can help with",
    "Help me write a professional email",
    "Explain a complex topic in simple terms",
    "Search through my uploaded documents",
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center p-8"
    >
      <div className="h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center mb-6">
        <Bot className="h-10 w-10 text-white" />
      </div>

      <h2 className="text-2xl font-bold text-center mb-2">
        How can I help you today?
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Ask me anything! I can chat with you directly or search through your document collections for specific information.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map((suggestion, i) => (
          <motion.button
            key={suggestion}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            onClick={onStartChat}
            className="p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/20 transition-all text-left group"
          >
            <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {suggestion}
            </p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}



export function ChatPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const {
    conversations,
    messages,
    isLoading,
    isSending,
    fetchConversations,
    fetchConversation,
    sendMessage,
    deleteConversation,
    startNewConversation,
    setBotToken,
  } = useChatStore()
  
  const { 
    currentBot, 
    fetchBotByToken, 
    updateBot, 
    fetchCollections, 
    collections 
  } = useBotStore()

  const [input, setInput] = useState('')
  const [isEditBotOpen, setIsEditBotOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Get collection state from store
  const { currentCollectionId, setCollectionId } = useChatStore()

  const searchParams = new URLSearchParams(location.search)
  const botToken = searchParams.get('bot')

  // Fetch bot info if token is present
  useEffect(() => {
    if (botToken) {
      fetchBotByToken(botToken)
      fetchCollections()
    }
  }, [botToken, fetchBotByToken, fetchCollections])

  // Update chat store with bot token
  useEffect(() => {
    setBotToken(botToken)
  }, [botToken, setBotToken])

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Fetch specific conversation if ID provided
  useEffect(() => {
    if (conversationId) {
      fetchConversation(conversationId)
    } else {
      const stateCollectionId = location.state?.collectionId
      startNewConversation(stateCollectionId || null, botToken || null)
    }
  }, [conversationId, fetchConversation, startNewConversation, location.state, botToken])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!input.trim() || isSending) return

    const query = input.trim()
    setInput('')

    await sendMessage(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`)
  }

  const handleNewChat = () => {
    startNewConversation(null, botToken || null)
    navigate(botToken ? `/chat?bot=${botToken}` : '/chat')
  }

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id)
    if (conversationId === id) {
      navigate('/chat')
    }
  }

  // Handle suggestion chip click
  const handleSuggestionClick = async (suggestion: string) => {
    if (isSending) return
    setInput('')
    await sendMessage(suggestion)
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Desktop Conversations Sidebar */}
      <div className="hidden lg:block w-72 border-r border-border bg-sidebar h-full">
        <ConversationSidebar
          conversations={conversations}
          currentId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onDelete={handleDeleteConversation}
          isLoading={isLoading}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Mobile Menu and Collection Picker */}
        <div className="border-b border-border px-4 py-2 bg-background/80 backdrop-blur-sm flex items-center gap-2">
          {/* Mobile Sidebar Trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
                <History className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <ConversationSidebar
                conversations={conversations}
                currentId={conversationId}
                onSelect={(id) => {
                  handleSelectConversation(id)
                }}
                onNew={handleNewChat}
                onDelete={handleDeleteConversation}
                isLoading={isLoading}
              />
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0">
            <CollectionPicker
              selectedId={currentCollectionId}
              onSelect={setCollectionId}
            />
          </div>

          {/* Edit Bot Button */}
          {currentBot && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditBotOpen(true)}
              className="gap-2 ml-2"
            >
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit Bot</span>
            </Button>
          )}
        </div>

        {messages.length === 0 ? (
          <EmptyChat onStartChat={() => textareaRef.current?.focus()} />
        ) : (
          <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto">
              <AnimatePresence>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    user={user}
                    onSuggestionClick={handleSuggestionClick}
                    isSending={isSending}
                  />
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        {/* Input Area */}
        <div className="border-t border-border p-4 bg-background/80 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <Card className="p-2">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className="min-h-[60px] max-h-[200px] border-0 focus:ring-0 resize-none"
                  disabled={isSending}
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="gradient"
                  disabled={!input.trim() || isSending}
                  className="shrink-0 h-10 w-10"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </Card>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </div>
      </div>

      {currentBot && (
        <CreateBotDialog
          open={isEditBotOpen}
          onClose={() => setIsEditBotOpen(false)}
          onSubmit={async (data) => {
             await updateBot({ ...data, bot_token: currentBot.bot_token })
             setIsEditBotOpen(false)
          }}
          bot={currentBot}
          collections={collections}
        />
      )}
    </div>
  )
}

export default ChatPage