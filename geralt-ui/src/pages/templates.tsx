import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Layout, Copy, Plus, Loader2, Bot } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { templateService, botService } from '@/services'
import { CreateBotDialog } from '@/components/bots/create-bot-dialog'
import { useBotStore, useAuthStore } from '@/store'
import type { BotTemplate, CreateBotCommand } from '@/types'

export default function TemplatesPage() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { collections, fetchCollections, createBot } = useBotStore()
    const [templates, setTemplates] = useState<BotTemplate[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<BotTemplate | null>(null)

    const tenantId = user?.tenant_id || 'default'

    const fetchTemplates = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await templateService.getAllTemplates()
            setTemplates(data)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load templates',
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTemplates()
        fetchCollections()
    }, [fetchTemplates, fetchCollections])

    const handleCopyTemplate = (template: BotTemplate) => {
        const config = {
            name: template.name,
            prompt: template.prompt,
            welcome_message: template.welcome_message,
            welcome_buttons: template.welcome_buttons,
        }
        navigator.clipboard.writeText(JSON.stringify(config, null, 2))
        toast({
            title: 'Template Copied',
            description: 'Template configuration copied to clipboard',
        })
    }

    const handleCreateFromTemplate = (template: BotTemplate) => {
        setSelectedTemplate(template)
        setCreateDialogOpen(true)
    }

    const handleCreateBot = async (data: CreateBotCommand) => {
        try {
            // createBot expects (data, iconFile?) - iconFile is optional
            await createBot(data)
            toast({
                title: 'Success',
                description: 'Bot created from template successfully',
            })
            setCreateDialogOpen(false)
            setSelectedTemplate(null)
            navigate('/bots')
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to create bot',
                variant: 'destructive',
            })
            throw error
        }
    }

    // Convert template to bot-like object for the dialog
    const templateAsBot = selectedTemplate ? {
        id: '',
        owner_id: '',
        bot_token: '',
        bot_name: selectedTemplate.name,
        icon_url: selectedTemplate.icon_url || '',
        welcome_message: selectedTemplate.welcome_message || '',
        welcome_buttons: (selectedTemplate.welcome_buttons || []).map((btn, i) => ({
            id: `temp-${i}`,
            label: btn.label,
            action: btn.action,
        })),
        collection_ids: [],
        created_at: '',
        updated_at: '',
    } : undefined

    return (
        <PageTransition>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
                        <p className="text-muted-foreground">
                            Pre-built bot configurations to get started quickly
                        </p>
                    </div>
                </div>

                {/* Templates Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : templates.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20"
                    >
                        <Layout className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">No templates available</h3>
                        <p className="text-muted-foreground">
                            Templates will appear here when created
                        </p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map((template, index) => (
                            <motion.div
                                key={template.template_id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="p-6 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-start gap-4 mb-4">
                                        {template.icon_url ? (
                                            <img
                                                src={template.icon_url}
                                                alt={template.name}
                                                className="h-12 w-12 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Layout className="h-6 w-6 text-primary" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate">{template.name}</h3>
                                            {template.category && (
                                                <Badge variant="secondary" className="mt-1">
                                                    {template.category}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                        {template.description}
                                    </p>

                                    {template.welcome_buttons && template.welcome_buttons.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-4">
                                            {template.welcome_buttons.slice(0, 3).map((btn, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    {btn.label}
                                                </Badge>
                                            ))}
                                            {template.welcome_buttons.length > 3 && (
                                                <Badge variant="outline" className="text-xs">
                                                    +{template.welcome_buttons.length - 3} more
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1"
                                            onClick={() => handleCreateFromTemplate(template)}
                                        >
                                            <Bot className="h-4 w-4 mr-2" />
                                            Create Bot
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleCopyTemplate(template)}
                                            title="Copy configuration"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Bot Dialog */}
            <CreateBotDialog
                open={createDialogOpen}
                onClose={() => {
                    setCreateDialogOpen(false)
                    setSelectedTemplate(null)
                }}
                onSubmit={handleCreateBot}
                bot={templateAsBot}
                collections={collections}
            />
        </PageTransition>
    )
}
