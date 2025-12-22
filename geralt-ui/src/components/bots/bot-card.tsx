import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Edit, Trash2, Share2, Code, MessageSquare, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Bot as BotType } from '@/types'

interface BotCardProps {
  bot: BotType
  onEdit: (bot: BotType) => void
  onDelete: (bot: BotType) => void
  onShare: (bot: BotType) => void
  onEmbed: (bot: BotType) => void
  onChat: (bot: BotType) => void
}

export function BotCard({ bot, onEdit, onDelete, onShare, onEmbed, onChat }: BotCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      transition={{ duration: 0.2 }}
    >
      <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={bot.icon_url} alt={bot.bot_name} />
                <AvatarFallback>
                  <Bot className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-foreground">{bot.bot_name}</h3>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(bot.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Welcome Message */}
          {bot.welcome_message && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {bot.welcome_message}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-auto pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onChat(bot)}
              className="flex-1"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(bot)}
            >
              <Edit className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onShare(bot)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEmbed(bot)}>
                  <Code className="h-4 w-4 mr-2" />
                  Embed Code
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(bot)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      </Card>
    </motion.div>
  )
}
