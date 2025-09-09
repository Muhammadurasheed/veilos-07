import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ResizableSidebar } from '@/components/ui/resizable-sidebar';
import { EnhancedSidebar } from './EnhancedSidebar';
import Header from './Header';
import { cn } from '@/lib/utils';

export const EnhancedLayoutWithSidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header with highest z-index */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-md border-b border-border z-[9998] flex items-center px-4">
        <SidebarTrigger className="mr-4" />
        <Header />
      </header>

      {/* Main layout container */}
      <div className="flex w-full pt-16">
        {/* Resizable Sidebar */}
        <ResizableSidebar
          defaultWidth={280}
          minWidth={200}
          maxWidth={500}
          className="fixed left-0 top-16 bottom-0 z-[9999]"
          collapsible
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        >
          <EnhancedSidebar />
        </ResizableSidebar>

        {/* Main content area */}
        <main 
          className={cn(
            "flex-1 transition-all duration-200 ease-in-out",
            "relative z-[1]" // Lower z-index than sidebar
          )}
          style={{ 
            marginLeft: collapsed ? 60 : sidebarWidth,
            minHeight: 'calc(100vh - 4rem)'
          }}
        >
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default EnhancedLayoutWithSidebar;