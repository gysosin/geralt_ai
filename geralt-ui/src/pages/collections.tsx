import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Database, Trash2, FileText, FolderOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '@/components/layout/page-transition'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBotStore, useAuthStore } from '@/store'
import { toast } from '@/hooks/use-toast'
import { botService } from '@/services'

export default function CollectionsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { collections, fetchCollections, isLoading } = useBotStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [collectionDescription, setCollectionDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tenantId = user?.tenant_id || 'default'

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  const handleCreate = async () => {
    if (!collectionName.trim()) {
      toast({
        title: 'Error',
        description: 'Collection name is required',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await botService.createCollection(collectionName, tenantId, collectionDescription)
      toast({
        title: 'Success',
        description: 'Collection created successfully',
      })
      setCollectionName('')
      setCollectionDescription('')
      setCreateDialogOpen(false)
      fetchCollections()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create collection',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (collectionId: string, collectionName: string) => {
    if (confirm(`Are you sure you want to delete "${collectionName}"?`)) {
      try {
        await botService.deleteCollection(collectionId)
        toast({
          title: 'Success',
          description: 'Collection deleted successfully',
        })
        fetchCollections()
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete collection',
          variant: 'destructive',
        })
      }
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Collections</h1>
            <p className="text-muted-foreground">
              Manage your document collections and knowledge bases
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Collection
          </Button>
        </div>

        {/* Collections Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Database className="h-12 w-12 mx-auto mb-4 animate-pulse text-muted-foreground" />
              <p className="text-muted-foreground">Loading collections...</p>
            </div>
          </div>
        ) : collections.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No collections yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first knowledge collection to get started
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Collection
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection, index) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm p-6 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/collections/${collection.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Database className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {collection.collection_name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {collection.file_count} files
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(collection.id, collection.collection_name)
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {collection.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {collection.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Created {new Date(collection.created_at).toLocaleDateString()}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Collection Name *</Label>
                <Input
                  id="name"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="My Knowledge Base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  placeholder="Describe what this collection contains..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Collection'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}