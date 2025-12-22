import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  MessageSquare,
  Trash2,
  Clock,
  Filter,
  Calendar,
  MoreHorizontal,
  ArrowRight,
  ArrowUpDown,
  Check,
  Square,
  CheckSquare
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StaggerContainer, StaggerItem, SlideIn } from '@/components/layout/page-transition'
import { useChatStore } from '@/store'
import { useToast } from '@/hooks/use-toast'
import { cn, formatDate, formatRelativeTime, truncate } from '@/lib/utils'

export function HistoryPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    conversations,
    isLoading,
    fetchConversations,
    deleteConversation
  } = useChatStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'messages'>('newest')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const filterConversations = () => {
    let filtered = conversations

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(conv =>
        conv.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Date filter
    const now = new Date()
    if (selectedFilter === 'today') {
      filtered = filtered.filter(conv => {
        const dateStr = conv.updatedAt || conv.createdAt
        if (!dateStr) return false
        const date = new Date(dateStr)
        return date.toDateString() === now.toDateString()
      })
    } else if (selectedFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter(conv => {
        const dateStr = conv.updatedAt || conv.createdAt
        return dateStr ? new Date(dateStr) >= weekAgo : false
      })
    } else if (selectedFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter(conv => {
        const dateStr = conv.updatedAt || conv.createdAt
        return dateStr ? new Date(dateStr) >= monthAgo : false
      })
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return dateB - dateA
      } else if (sortBy === 'oldest') {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return dateA - dateB
      } else if (sortBy === 'messages') {
        return (b.messageCount || 0) - (a.messageCount || 0)
      }
      return 0
    })

    return filtered
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredConversations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredConversations.map(c => c.id)))
    }
  }

  const handleDeleteConfirm = async () => {
    if (!conversationToDelete) return

    try {
      await deleteConversation(conversationToDelete)
      toast({
        title: 'Conversation deleted',
        description: 'The conversation has been permanently deleted.',
        variant: 'success',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete conversation. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setDeleteDialogOpen(false)
      setConversationToDelete(null)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteConversation(id)))
      toast({
        title: 'Conversations deleted',
        description: `${selectedIds.size} conversations have been permanently deleted.`,
        variant: 'success',
      })
      setSelectedIds(new Set())
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete some conversations. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setBulkDeleteDialogOpen(false)
    }
  }

  const filteredConversations = filterConversations()

  return (
    <div className="p-6 lg:p-8">
      <SlideIn direction="down">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Conversation History</h1>
            <p className="text-muted-foreground mt-1">
              Browse and manage your past conversations
            </p>
          </div>

          <Button
            variant="gradient"
            onClick={() => navigate('/chat')}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </SlideIn>

      {/* Filters */}
      <SlideIn delay={0.1}>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['all', 'today', 'week', 'month'] as const).map((filter) => (
              <Button
                key={filter}
                variant={selectedFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter(filter)}
                className="capitalize"
              >
                {filter === 'all' ? 'All Time' : filter === 'week' ? 'This Week' : filter === 'month' ? 'This Month' : 'Today'}
              </Button>
            ))}

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('newest')}>
                  {sortBy === 'newest' && <Check className="h-4 w-4 mr-2" />}
                  Newest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                  {sortBy === 'oldest' && <Check className="h-4 w-4 mr-2" />}
                  Oldest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('messages')}>
                  {sortBy === 'messages' && <Check className="h-4 w-4 mr-2" />}
                  Most Messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SlideIn>

      {/* Results count and bulk actions */}
      <SlideIn delay={0.2}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                `${filteredConversations.length} conversation${filteredConversations.length !== 1 ? 's' : ''} found`
              )}
            </div>
            {selectedIds.size > 0 && (
              <Badge variant="secondary">
                {selectedIds.size} selected
              </Badge>
            )}
          </div>

          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          )}
        </div>
      </SlideIn>

      {/* Conversations List */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filteredConversations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No conversations found</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            {searchQuery
              ? "No conversations match your search. Try different keywords."
              : "Start a new conversation to see it appear here."}
          </p>
          <Button variant="gradient" onClick={() => navigate('/chat')}>
            Start New Chat
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </motion.div>
      ) : (
        <StaggerContainer className="grid gap-4">
          {filteredConversations.map((conv) => (
            <StaggerItem key={conv.id}>
              <Card
                hover
                className="cursor-pointer group"
                onClick={(e) => {
                  e.preventDefault()
                  navigate(`/chat/${conv.id}`)
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Checkbox for selection */}
                    <button
                      className="h-5 w-5 rounded border border-border flex items-center justify-center shrink-0 hover:border-primary transition-colors mt-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelection(conv.id)
                      }}
                    >
                      {selectedIds.has(conv.id) && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </button>

                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                            {conv.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {conv.lastMessage ? truncate(conv.lastMessage, 100) : 'No messages'}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                setConversationToDelete(conv.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(conv.updatedAt || conv.createdAt || new Date().toISOString())}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(conv.createdAt || new Date().toISOString())}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {conv.messageCount || 0} messages
                        </Badge>
                      </div>
                    </div>

                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Conversations</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} conversation{selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDeleteConfirm}>
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default HistoryPage
