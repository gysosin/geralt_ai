import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shimmer rounded-md", className)}
      {...props}
    />
  )
}

// Message skeleton for chat loading
function MessageSkeleton() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full max-w-md" />
      </div>
    </div>
  )
}

// Card skeleton for lists
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

// Profile skeleton
function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <Skeleton className="h-24 w-24 rounded-full" />
      <div className="space-y-2 text-center">
        <Skeleton className="h-6 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  )
}

export { Skeleton, MessageSkeleton, CardSkeleton, ProfileSkeleton }
