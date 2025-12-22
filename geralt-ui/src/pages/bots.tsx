import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Bot as BotIcon } from 'lucide-react'
import { PageTransition } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { useBotStore } from '@/store'
import { BotCard } from '@/components/bots/bot-card'
import { CreateBotDialog } from '@/components/bots/create-bot-dialog'
import { ShareBotDialog } from '@/components/bots/share-bot-dialog'
import { EmbedCodeDialog } from '@/components/bots/embed-code-dialog'
import { toast } from '@/hooks/use-toast'
import type { Bot, CreateBotCommand, ShareBotCommand } from '@/types'

export default function BotsPage() {
  const navigate = useNavigate()
  const {
    bots,
    collections,
    isLoading,
    fetchBots,
    fetchCollections,
    createBot,
    updateBot,
    deleteBot,
    shareBot,
    generateEmbedCode,
  } = useBotStore()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [selectedBot, setSelectedBot] = useState<Bot | undefined>()
  const [embedCode, setEmbedCode] = useState('')

  useEffect(() => {
    fetchBots()
    fetchCollections()
  }, [fetchBots, fetchCollections])

  const handleCreate = () => {
    setSelectedBot(undefined)
    setCreateDialogOpen(true)
  }

  const handleEdit = (bot: Bot) => {
    setSelectedBot(bot)
    setCreateDialogOpen(true)
  }

  const handleDelete = async (bot: Bot) => {
    if (confirm(`Are you sure you want to delete "${bot.bot_name}"?`)) {
      try {
        await deleteBot(bot.bot_token)
        toast({
          title: 'Success',
          description: 'Bot deleted successfully',
        })
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete bot',
          variant: 'destructive',
        })
      }
    }
  }

  const handleShare = (bot: Bot) => {
    setSelectedBot(bot)
    setShareDialogOpen(true)
  }

  const handleEmbed = async (bot: Bot) => {
    try {
      const code = await generateEmbedCode(bot.bot_token)
      setEmbedCode(code)
      setSelectedBot(bot)
      setEmbedDialogOpen(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate embed code',
        variant: 'destructive',
      })
    }
  }

  const handleChat = (bot: Bot) => {
    navigate(`/chat?bot=${bot.bot_token}`)
  }

  const handleSubmitBot = async (data: CreateBotCommand) => {
    try {
      if (selectedBot) {
        await updateBot({ ...data, bot_token: selectedBot.bot_token })
        toast({
          title: 'Success',
          description: 'Bot updated successfully',
        })
      } else {
        await createBot(data)
        toast({
          title: 'Success',
          description: 'Bot created successfully',
        })
      }
      fetchBots()
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${selectedBot ? 'update' : 'create'} bot`,
        variant: 'destructive',
      })
    }
  }

  const handleShareBot = async (data: ShareBotCommand) => {
    try {
      await shareBot(data)
      toast({
        title: 'Success',
        description: 'Bot shared successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to share bot',
        variant: 'destructive',
      })
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Bots</h1>
            <p className="text-muted-foreground">
              Create and manage your custom AI assistants
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Bot
          </Button>
        </div>

        {/* Bots Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <BotIcon className="h-12 w-12 mx-auto mb-4 animate-pulse text-muted-foreground" />
              <p className="text-muted-foreground">Loading bots...</p>
            </div>
          </div>
        ) : bots.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <BotIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No bots yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first AI bot to get started
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Bot
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot, index) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <BotCard
                  bot={bot}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onShare={handleShare}
                  onEmbed={handleEmbed}
                  onChat={handleChat}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Dialogs */}
        <CreateBotDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSubmit={handleSubmitBot}
          bot={selectedBot}
          collections={collections}
        />

        {selectedBot && (
          <>
            <ShareBotDialog
              open={shareDialogOpen}
              onClose={() => setShareDialogOpen(false)}
              onSubmit={handleShareBot}
              bot={selectedBot}
            />
            <EmbedCodeDialog
              open={embedDialogOpen}
              onClose={() => setEmbedDialogOpen(false)}
              bot={selectedBot}
              embedCode={embedCode}
            />
          </>
        )}
      </div>
    </PageTransition>
  )
}