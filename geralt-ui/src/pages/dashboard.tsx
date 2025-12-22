import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  MessageSquare, 
  FileText, 
  Clock, 
  TrendingUp,
  ArrowRight,
  Bot,
  Sparkles,
  Users,
  FolderOpen
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StaggerContainer, StaggerItem, SlideIn } from '@/components/layout/page-transition'
import { useAuthStore, useChatStore, useBotStore } from '@/store'

const quickActions = [
  { 
    title: 'New Conversation', 
    description: 'Start a new AI-powered conversation',
    icon: MessageSquare,
    path: '/chat',
    gradient: 'from-primary to-purple-500',
  },
  { 
    title: 'Manage Bots', 
    description: 'Create and configure AI bots',
    icon: Bot,
    path: '/bots',
    gradient: 'from-blue-500 to-cyan-500',
  },
  { 
    title: 'Browse Collections', 
    description: 'View and manage document collections',
    icon: FolderOpen,
    path: '/collections',
    gradient: 'from-success to-emerald-500',
  },
  { 
    title: 'View History', 
    description: 'See your conversation history',
    icon: Clock,
    path: '/history',
    gradient: 'from-warning to-orange-500',
  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { fetchConversations, conversations } = useChatStore()
  const { fetchBots, bots, fetchCollections, collections } = useBotStore()
  
  useEffect(() => {
    fetchConversations()
    fetchBots()
    fetchCollections()
  }, [fetchConversations, fetchBots, fetchCollections])
  
  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const stats = [
    {
      title: 'Conversations',
      value: String(conversations.length),
      icon: MessageSquare,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'AI Bots',
      value: String(bots.length),
      icon: Bot,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Collections',
      value: String(collections.length),
      icon: FolderOpen,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Documents',
      value: String(collections.reduce((acc, c) => acc + (c.file_count || 0), 0)),
      icon: FileText,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ]
  
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      {/* Welcome Section */}
      <SlideIn direction="down">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {greeting()}, {user?.firstname || 'User'}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your AI assistant today.
            </p>
          </div>
          <Button 
            variant="gradient" 
            size="lg"
            onClick={() => navigate('/chat')}
            className="shrink-0"
          >
            <MessageSquare className="h-5 w-5 mr-2" />
            Start New Chat
          </Button>
        </div>
      </SlideIn>
      
      {/* Stats Grid */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StaggerItem key={stat.title}>
            <Card hover className="h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>
      
      {/* Quick Actions */}
      <SlideIn delay={0.2}>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card 
                hover 
                className="cursor-pointer overflow-hidden group"
                onClick={(e) => {
                  e.preventDefault()
                  navigate(action.path)
                }}
              >
                <CardContent className="p-6 relative">
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r ${action.gradient}`} />
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-r ${action.gradient} flex items-center justify-center mb-4`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  <ArrowRight className="h-5 w-5 mt-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </SlideIn>
      
      {/* Recent Conversations & AI Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <SlideIn delay={0.4}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Recent Conversations</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No conversations yet. Start chatting!
                  </p>
                ) : (
                  conversations.slice(0, 4).map((chat, i) => (
                    <motion.div
                      key={chat.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault()
                        navigate(`/chat/${chat.id}`)
                      }}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{chat.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {chat.updatedAt}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </SlideIn>
        
        {/* AI Tips */}
        <SlideIn delay={0.5}>
          <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Tips & Tricks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-background/50">
                <Bot className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="font-medium">Be Specific in Your Questions</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The more context you provide, the better and more accurate responses you'll receive.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-lg bg-background/50">
                <Users className="h-8 w-8 text-success shrink-0" />
                <div>
                  <p className="font-medium">Use Conversation Context</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Follow-up questions in the same conversation will use previous context for better answers.
                  </p>
                </div>
              </div>
              
              <Button variant="outline" className="w-full" onClick={() => navigate('/chat')}>
                Try It Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </SlideIn>
      </div>
    </div>
  )
}

export default DashboardPage
