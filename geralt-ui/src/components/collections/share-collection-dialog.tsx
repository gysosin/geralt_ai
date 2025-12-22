import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { UserPlus, Trash2, Loader2, Users } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { documentService } from '@/services'
import type { CollectionShare, ShareCollectionCommand } from '@/types'

interface ShareCollectionDialogProps {
    open: boolean
    onClose: () => void
    collectionId: string
    collectionName: string
}

export function ShareCollectionDialog({
    open,
    onClose,
    collectionId,
    collectionName,
}: ShareCollectionDialogProps) {
    const [sharedUsers, setSharedUsers] = useState<CollectionShare[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [removingUser, setRemovingUser] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<Omit<ShareCollectionCommand, 'collection_id'>>()

    const fetchSharedUsers = async () => {
        setIsLoading(true)
        try {
            const users = await documentService.getSharedUsers(collectionId)
            setSharedUsers(users)
        } catch (error) {
            console.error('Failed to fetch shared users:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            fetchSharedUsers()
        }
    }, [open, collectionId])

    const handleFormSubmit = async (data: Omit<ShareCollectionCommand, 'collection_id'>) => {
        setIsSubmitting(true)
        try {
            await documentService.shareCollection({
                collection_id: collectionId,
                user: data.user,
                role: data.role,
            })
            toast({
                title: 'Success',
                description: `Collection shared with ${data.user}`,
            })
            reset()
            fetchSharedUsers()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to share collection',
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRemoveUser = async (username: string) => {
        setRemovingUser(username)
        try {
            await documentService.removeSharedUser(collectionId, username)
            toast({
                title: 'Success',
                description: `Removed ${username} from collection`,
            })
            fetchSharedUsers()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to remove user',
                variant: 'destructive',
            })
        } finally {
            setRemovingUser(null)
        }
    }

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case 'admin':
                return 'default'
            case 'contributor':
                return 'secondary'
            default:
                return 'outline'
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Share "{collectionName}"</DialogTitle>
                </DialogHeader>

                {/* Add User Form */}
                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="user" className="sr-only">
                                Email
                            </Label>
                            <Input
                                id="user"
                                {...register('user', {
                                    required: 'Email is required',
                                    pattern: {
                                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                        message: 'Invalid email',
                                    },
                                })}
                                placeholder="user@example.com"
                            />
                        </div>
                        <div className="w-32">
                            <Label htmlFor="role" className="sr-only">
                                Role
                            </Label>
                            <select
                                id="role"
                                {...register('role', { required: true })}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                                defaultValue="viewer"
                            >
                                <option value="viewer">Viewer</option>
                                <option value="contributor">Contributor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    {errors.user && (
                        <p className="text-sm text-destructive">{errors.user.message}</p>
                    )}
                </form>

                {/* Shared Users List */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Shared with {sharedUsers.length} user(s)</span>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : sharedUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            This collection isn't shared with anyone yet
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {sharedUsers.map((user) => (
                                <div
                                    key={user.username}
                                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{user.username}</p>
                                            {user.email && (
                                                <p className="text-xs text-muted-foreground">
                                                    {user.email}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={getRoleBadgeVariant(user.role)}>
                                            {user.role}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => handleRemoveUser(user.username)}
                                            disabled={removingUser === user.username}
                                        >
                                            {removingUser === user.username ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
