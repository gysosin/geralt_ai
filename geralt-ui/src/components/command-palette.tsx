import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
    MessageSquare,
    Bot,
    FolderOpen,
    History,
    BarChart3,
    Settings,
    User,
    HelpCircle,
    Layout,
    Search,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useChatStore, useBotStore } from '@/store'

interface CommandPaletteProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const actions = [
    { id: 'new-chat', label: 'New Chat', icon: MessageSquare, path: '/chat' },
    { id: 'history', label: 'Conversation History', icon: History, path: '/history' },
    { id: 'bots', label: 'AI Bots', icon: Bot, path: '/bots' },
    { id: 'collections', label: 'Collections', icon: FolderOpen, path: '/collections' },
    { id: 'templates', label: 'Templates', icon: Layout, path: '/templates' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
    { id: 'quizzes', label: 'Quizzes', icon: HelpCircle, path: '/quizzes' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const navigate = useNavigate()
    const { conversations } = useChatStore()
    const { bots, collections } = useBotStore()
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (!open) setSearch('')
    }, [open])

    const handleSelect = (path: string) => {
        navigate(path)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 overflow-hidden max-w-lg">
                <Command className="border-none shadow-none" shouldFilter={true}>
                    <div className="flex items-center border-b border-border px-3">
                        <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                        <Command.Input
                            placeholder="Type a command or search..."
                            className="flex-1 h-12 bg-transparent outline-none text-sm"
                            value={search}
                            onValueChange={setSearch}
                        />
                        <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
                    </div>

                    <Command.List className="max-h-[400px] overflow-y-auto p-2">
                        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                            No results found.
                        </Command.Empty>

                        {/* Quick Actions */}
                        <Command.Group heading="Quick Actions" className="mb-2">
                            {actions.map((action) => (
                                <Command.Item
                                    key={action.id}
                                    value={action.label}
                                    onSelect={() => handleSelect(action.path)}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm aria-selected:bg-accent"
                                >
                                    <action.icon className="h-4 w-4 text-muted-foreground" />
                                    <span>{action.label}</span>
                                </Command.Item>
                            ))}
                        </Command.Group>

                        {/* Recent Conversations */}
                        {conversations.length > 0 && (
                            <Command.Group heading="Recent Conversations" className="mb-2">
                                {conversations.slice(0, 5).map((conv) => (
                                    <Command.Item
                                        key={conv.id}
                                        value={conv.title}
                                        onSelect={() => handleSelect(`/chat/${conv.id}`)}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm aria-selected:bg-accent"
                                    >
                                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{conv.title}</span>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        {/* Bots */}
                        {bots.length > 0 && (
                            <Command.Group heading="Your Bots" className="mb-2">
                                {bots.slice(0, 5).map((bot) => (
                                    <Command.Item
                                        key={bot.bot_token}
                                        value={bot.bot_name}
                                        onSelect={() => handleSelect(`/chat?bot=${bot.bot_token}`)}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm aria-selected:bg-accent"
                                    >
                                        <Bot className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{bot.bot_name}</span>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        {/* Collections */}
                        {collections.length > 0 && (
                            <Command.Group heading="Collections">
                                {collections.slice(0, 5).map((col) => (
                                    <Command.Item
                                        key={col.id}
                                        value={col.collection_name}
                                        onSelect={() => handleSelect(`/collections/${col.id}`)}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm aria-selected:bg-accent"
                                    >
                                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{col.collection_name}</span>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}
                    </Command.List>
                </Command>
            </DialogContent>
        </Dialog>
    )
}

export default CommandPalette
