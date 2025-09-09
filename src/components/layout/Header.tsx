
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/optimized/AuthContextRefactored';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, Bell, User, LogOut, Settings, Moon, Sun, Shield, Loader2, MessageCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getBadgeImageForLevel } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useSanctuaryManager } from '@/hooks/useSanctuaryManager';

const Header = () => {
  const { user, logout, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { getSanctuaryList } = useSanctuaryManager();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  
  // Get active sanctuaries count
  const activeSanctuaries = getSanctuaryList().filter(s => new Date(s.expiresAt) > new Date());
  const hasActiveSanctuaries = activeSanctuaries.length > 0;
  
  // Determine if user is authenticated based on user object existence
  const isAuthenticated = !!user;

  // Toggle sidebar function
  const toggleSidebar = () => {
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = () => {
    logout();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  const handleGoToAuth = () => {
    navigate('/auth');
  };

  // Use a default level (1) if user doesn't have a level property
  const userLevel = 1; // Default to level 1 as level doesn't exist on User type
  const userBadge = getBadgeImageForLevel(userLevel);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "sticky top-0 z-30 w-full backdrop-blur-sm transition-all duration-300",
        isScrolled ? 
          "bg-white/80 dark:bg-gray-900/80 shadow-sm border-b border-gray-200 dark:border-gray-800" : 
          "bg-white dark:bg-gray-900"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Veilo</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* My Sanctuaries Quick Access - shown to all users */}
          <Button
            variant={hasActiveSanctuaries ? "default" : "ghost"}
            size="sm"
            onClick={() => navigate('/my-sanctuaries')}
            className={cn(
              "relative",
              hasActiveSanctuaries && "bg-primary/10 text-primary hover:bg-primary/20"
            )}
            aria-label="My Sanctuaries"
          >
            <Shield className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">My Sanctuaries</span>
            {hasActiveSanctuaries && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-bold">
                {activeSanctuaries.length}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleTheme()}
            className="rounded-full"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
          </Button>

          {isLoading ? (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </Button>
          ) : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full overflow-hidden"
                >
                  <Avatar className="h-9 w-9 border border-gray-200 dark:border-gray-700">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.alias} />
                    ) : (
                      <AvatarImage src={`/avatars/avatar-${user.avatarIndex || 1}.svg`} alt={user.alias} />
                    )}
                    <AvatarFallback>{user.alias?.charAt(0) || 'A'}</AvatarFallback>
                  </Avatar>
                  {userBadge && (
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white dark:border-gray-900 bg-white dark:bg-gray-900">
                      <img src={userBadge} alt="Level badge" className="h-full w-full" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user.alias}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.isAnonymous ? 'Anonymous User' : 'Registered User'}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-sanctuaries" className="flex items-center cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" />
                    My Sanctuaries
                    {hasActiveSanctuaries && (
                      <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        {activeSanctuaries.length}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {user.role === 'beacon' && (
                  <DropdownMenuItem asChild>
                    <Link to="/expert-dashboard" className="flex items-center cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Expert Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleGoToAuth}
                variant="default"
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
