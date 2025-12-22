import { useState, useEffect } from 'react'
import { FolderOpen, Check, ChevronDown, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useBotStore } from '@/store'

interface CollectionPickerProps {
    selectedId: string | null
    onSelect: (collectionId: string | null) => void
    className?: string
}

export function CollectionPicker({
    selectedId,
    onSelect,
    className
}: CollectionPickerProps) {
    const { collections, fetchCollections, isLoading } = useBotStore()

    useEffect(() => {
        if (collections.length === 0) {
            fetchCollections()
        }
    }, [collections.length, fetchCollections])

    const selectedCollection = collections.find(c => c.id === selectedId)

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2"
                    >
                        <FolderOpen className="h-4 w-4" />
                        <span className="max-w-[150px] truncate">
                            {selectedCollection?.collection_name || 'All Collections'}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-64">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            <DropdownMenuItem
                                onClick={() => onSelect(null)}
                                className="gap-2"
                            >
                                <FolderOpen className="h-4 w-4" />
                                <span className="flex-1">All Collections</span>
                                {!selectedId && <Check className="h-4 w-4 text-primary" />}
                            </DropdownMenuItem>

                            {collections.length > 0 && <DropdownMenuSeparator />}

                            {collections.map((collection) => (
                                <DropdownMenuItem
                                    key={collection.id}
                                    onClick={() => onSelect(collection.id)}
                                    className="gap-2"
                                >
                                    <FolderOpen className="h-4 w-4" />
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate">{collection.collection_name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {collection.file_count} documents
                                        </p>
                                    </div>
                                    {selectedId === collection.id && (
                                        <Check className="h-4 w-4 text-primary shrink-0" />
                                    )}
                                </DropdownMenuItem>
                            ))}

                            {collections.length === 0 && (
                                <div className="py-4 text-center text-sm text-muted-foreground">
                                    No collections found
                                </div>
                            )}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {selectedCollection && (
                <Badge variant="secondary" className="gap-1">
                    <span className="max-w-[100px] truncate">
                        {selectedCollection.collection_name}
                    </span>
                    <button
                        onClick={() => onSelect(null)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            )}
        </div>
    )
}

export default CollectionPicker
