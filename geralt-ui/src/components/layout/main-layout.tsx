import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { PageTransition } from './page-transition'
import { ToastProvider, ToastViewport } from '@/components/ui/toast'
import { Toaster } from './toaster'

interface MainLayoutProps {
  title?: string
  showSearch?: boolean
}

export function MainLayout({ title, showSearch }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  return (
    <ToastProvider>
      <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-background overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onCollapsedChange={setSidebarCollapsed} 
          />
        </div>
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title={title} showSearch={showSearch} />
          
          <div className="flex-1 overflow-auto">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
      
      <Toaster />
      <ToastViewport />
    </ToastProvider>
  )
}

export default MainLayout