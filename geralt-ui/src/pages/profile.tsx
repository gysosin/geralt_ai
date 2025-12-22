import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, Mail, User, Phone, MapPin, Calendar, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { UserAvatar } from '@/components/ui/avatar'
import { SlideIn } from '@/components/layout/page-transition'
import { useAuthStore, useChatStore } from '@/store'
import { analyticsService } from '@/services'
import { useToast } from '@/hooks/use-toast'

export function ProfilePage() {
  const { user, updateProfile, isLoading } = useAuthStore()
  const { conversations, fetchConversations } = useChatStore()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stats, setStats] = useState({ totalChats: 0, totalRequests: 0, daysActive: 0 })

  const [formData, setFormData] = useState({
    firstname: user?.firstname || '',
    lastname: user?.lastname || '',
    email: user?.email || '',
    phone: '',
    location: '',
    bio: '',
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  // Fetch real statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        // Fetch conversations if not loaded
        if (conversations.length === 0) {
          await fetchConversations()
        }

        // Fetch analytics summary
        const summary = await analyticsService.getUsageSummary().catch(() => ({
          total_requests: 0,
          total_tokens: 0,
          total_cost: 0
        }))

        // Calculate days active based on account creation
        const createdAt = user?.createdAt ? new Date(user.createdAt) : new Date()
        const now = new Date()
        const daysActive = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))

        setStats({
          totalChats: conversations.length,
          totalRequests: summary.total_requests || 0,
          daysActive,
        })
      } catch (error) {
        console.error('Failed to load stats:', error)
      }
    }
    loadStats()
  }, [conversations.length, fetchConversations, user?.createdAt])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const data = new FormData()
    data.append('firstname', formData.firstname)
    data.append('lastname', formData.lastname)
    if (avatarFile) {
      data.append('avatar', avatarFile)
    }

    try {
      await updateProfile(data)
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
        variant: 'success',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <SlideIn direction="down">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your personal information and preferences
          </p>
        </div>
      </SlideIn>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar Section */}
        <SlideIn delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                Upload a new avatar or keep your current one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <UserAvatar
                    user={avatarPreview ? { ...user, avatar: avatarPreview } : user}
                    size="xl"
                    className="h-24 w-24"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <div>
                  <h3 className="font-semibold">
                    {user?.firstname} {user?.lastname}
                  </h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, GIF or PNG. Max size of 2MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        {/* Personal Information */}
        <SlideIn delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details here
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstname">First Name</Label>
                  <Input
                    id="firstname"
                    name="firstname"
                    value={formData.firstname}
                    onChange={handleInputChange}
                    icon={<User className="h-4 w-4" />}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastname">Last Name</Label>
                  <Input
                    id="lastname"
                    name="lastname"
                    value={formData.lastname}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  icon={<Mail className="h-4 w-4" />}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed for security reasons
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    icon={<Phone className="h-4 w-4" />}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    icon={<MapPin className="h-4 w-4" />}
                    placeholder="City, Country"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Tell us a little about yourself..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        {/* Account Info */}
        <SlideIn delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your account details and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-primary">{stats.totalChats}</p>
                  <p className="text-sm text-muted-foreground">Total Chats</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-success">{stats.totalRequests.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Queries Made</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-3xl font-bold text-warning">
                    <Calendar className="h-6 w-6" />
                    <span>{stats.daysActive}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Days Active</p>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-medium">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }) : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        {/* Save Button */}
        <SlideIn delay={0.4}>
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </SlideIn>
      </form>
    </div>
  )
}

export default ProfilePage
