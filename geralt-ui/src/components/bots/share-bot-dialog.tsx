import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Bot, ShareBotCommand } from '@/types'

interface ShareBotDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: ShareBotCommand) => Promise<void>
  bot: Bot
}

export function ShareBotDialog({ open, onClose, onSubmit, bot }: ShareBotDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Omit<ShareBotCommand, 'bot_token'>>()

  const handleFormSubmit = async (data: Omit<ShareBotCommand, 'bot_token'>) => {
    setIsSubmitting(true)
    try {
      await onSubmit({
        ...data,
        bot_token: bot.bot_token,
      })
      reset()
      onClose()
    } catch (error) {
      console.error('Failed to share bot:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share {bot.bot_name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user_email">User Email *</Label>
            <Input
              id="user_email"
              type="email"
              {...register('user_email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
              placeholder="user@example.com"
            />
            {errors.user_email && (
              <p className="text-sm text-destructive">{errors.user_email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <select
              id="role"
              {...register('role', { required: 'Role is required' })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select role</option>
              <option value="viewer">Viewer</option>
              <option value="contributor">Contributor</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sharing...' : 'Share Bot'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
