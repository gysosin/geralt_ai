import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CreateBotCommand, Bot, Collection } from '@/types'

interface CreateBotDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateBotCommand) => Promise<void>
  bot?: Bot
  collections: Collection[]
}

interface FormData extends CreateBotCommand {
  welcome_buttons: Array<{ label: string; action: string }>
}

export function CreateBotDialog({
  open,
  onClose,
  onSubmit,
  bot,
  collections,
}: CreateBotDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [buttons, setButtons] = useState<Array<{ label: string; action: string }>>(
    bot?.welcome_buttons || []
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: bot
      ? {
          bot_name: bot.bot_name,
          icon_url: bot.icon_url,
          welcome_message: bot.welcome_message,
          collection_ids: bot.collection_ids,
        }
      : {},
  })

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit({
        ...data,
        welcome_buttons: buttons.filter((b) => b.label && b.action),
      })
      reset()
      setButtons([])
      onClose()
    } catch (error) {
      console.error('Failed to save bot:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addButton = () => {
    setButtons([...buttons, { label: '', action: '' }])
  }

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index))
  }

  const updateButton = (index: number, field: 'label' | 'action', value: string) => {
    const updated = [...buttons]
    updated[index][field] = value
    setButtons(updated)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bot ? 'Edit Bot' : 'Create New Bot'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Bot Name */}
          <div className="space-y-2">
            <Label htmlFor="bot_name">Bot Name *</Label>
            <Input
              id="bot_name"
              {...register('bot_name', { required: 'Bot name is required' })}
              placeholder="My AI Assistant"
            />
            {errors.bot_name && (
              <p className="text-sm text-destructive">{errors.bot_name.message}</p>
            )}
          </div>

          {/* Icon URL */}
          <div className="space-y-2">
            <Label htmlFor="icon_url">Icon URL</Label>
            <Input
              id="icon_url"
              {...register('icon_url')}
              placeholder="https://example.com/bot-icon.png"
            />
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <Label htmlFor="welcome_message">Welcome Message</Label>
            <Textarea
              id="welcome_message"
              {...register('welcome_message')}
              placeholder="Hi! I'm here to help you with..."
              rows={3}
            />
          </div>

          {/* Collections */}
          <div className="space-y-2">
            <Label htmlFor="collection_ids">Knowledge Collections</Label>
            <select
              id="collection_ids"
              {...register('collection_ids')}
              multiple
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              size={4}
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.collection_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Hold Ctrl/Cmd to select multiple collections
            </p>
          </div>

          {/* Welcome Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Welcome Buttons</Label>
              <Button type="button" size="sm" variant="outline" onClick={addButton}>
                <Plus className="h-4 w-4 mr-2" />
                Add Button
              </Button>
            </div>

            <AnimatePresence>
              {buttons.map((button, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2 items-start"
                >
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Button label"
                      value={button.label}
                      onChange={(e) => updateButton(index, 'label', e.target.value)}
                    />
                    <Input
                      placeholder="Button action/query"
                      value={button.action}
                      onChange={(e) => updateButton(index, 'action', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeButton(index)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : bot ? 'Update Bot' : 'Create Bot'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
