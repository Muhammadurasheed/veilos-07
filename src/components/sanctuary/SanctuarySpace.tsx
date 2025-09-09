import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { SanctuaryApi } from '@/services/api';
import { SanctuaryMessage } from '@/types';
import { Shield, Send, Clock, Users, MoreHorizontal, Flag, Mic, MicOff, Volume2, Settings } from 'lucide-react';
import LiveAudioRoom from '@/components/sanctuary/LiveAudioRoom';
import { WorkingBreakoutRoomManager } from '@/components/sanctuary/WorkingBreakoutRoomManager';
import SessionRecorder from '@/components/sanctuary/SessionRecorder';
import AIModerationDashboard from '@/components/sanctuary/AIModerationDashboard';
import { RealTimeChat } from '@/components/sanctuary/RealTimeChat';
import { ResizableChatPanel } from './ResizableChatPanel';
import ComprehensiveAudioSettings from './ComprehensiveAudioSettings';
import { EnhancedAnimatedReactionSystem } from './EnhancedAnimatedReactionSystem';
// removed duplicate import
import { ModernScrollbar } from '../ui/modern-scrollbar';

// Enhanced auto-resizing textarea component
const AutoResizeTextarea = ({ value, onChange, placeholder, disabled, onKeyDown, className, ...props }: any) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to fit content
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`; // Max 120px height
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={`${className} resize-none overflow-hidden`}
      style={{
        minHeight: '40px',
        maxHeight: '120px',
        lineHeight: '1.5'
      }}
      rows={1}
      {...props}
    />
  );
};

// Create a mock function for generating a random avatar color
const getAvatarColor = (alias: string): string => {
  const colors = [
    'bg-red-200', 'bg-blue-200', 'bg-green-200', 'bg-yellow-200', 
    'bg-purple-200', 'bg-pink-200', 'bg-indigo-200', 'bg-teal-200'
  ];
  
  // Use the string to generate a consistent index
  const charSum = alias.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[charSum % colors.length];
};

// Get initials from an alias
const getInitials = (alias: string): string => {
  return alias
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

interface SanctuarySpaceProps {
  isHost?: boolean;
}

const SanctuarySpace: React.FC<SanctuarySpaceProps> = ({ isHost = false }) => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  const [session, setSession] = useState<{
    id: string;
    topic: string;
    description?: string;
    emoji?: string;
    expiresAt: string;
    audioOnly?: boolean;
    agoraChannelName?: string;
    agoraToken?: string;
  } | null>(null);
  
  const [participant, setParticipant] = useState<{
    id: string;
    alias: string;
  } | null>(null);
  
  const [participants, setParticipants] = useState<{
    id: string;
    alias: string;
  }[]>([]);
  
  const [messages, setMessages] = useState<SanctuaryMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [percentTimeLeft, setPercentTimeLeft] = useState(100);
  const [loading, setLoading] = useState(true);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [tempAlias, setTempAlias] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<'text' | 'audio'>('text');
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [showRecording, setShowRecording] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  
  // Fetch session details
  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) return;
      
      try {
        const response = await SanctuaryApi.getSession(sessionId);
        
        if (response.success && response.data) {
          setSession(response.data);
          
          // Set session mode based on audioOnly flag (default to text if not specified)
          setSessionMode((response.data as any)?.audioOnly ? 'audio' : 'text');
          
          // Calculate time left
          const expiresAt = new Date(response.data.expiresAt).getTime();
          const now = new Date().getTime();
          const timeLeftMs = Math.max(0, expiresAt - now);
          setTimeLeft(Math.floor(timeLeftMs / 1000));
          
          // Check if host
          if (isHost) {
            const token = localStorage.getItem(`sanctuary-host-${sessionId}`);
            if (token) {
              setHostToken(token);
            }
          }
          
          // Check if we already joined
          const savedParticipant = localStorage.getItem(`sanctuary-participant-${sessionId}`);
          if (savedParticipant) {
            try {
              setParticipant(JSON.parse(savedParticipant));
            } catch (e) {
              console.error("Failed to parse saved participant data");
            }
          } else if (!isHost) {
            // Show join dialog if we're not host and haven't joined
            setJoinDialogOpen(true);
          }
          
          // For demo purposes, simulate some participants
          simulateParticipants();
          
          // For demo purposes, simulate some initial messages
          simulateInitialMessages();
        } else {
          // Session not found or expired
          toast({
            title: "Session unavailable",
            description: response.error || "This sanctuary space doesn't exist or has expired",
            variant: "destructive"
          });
          navigate('/');
        }
      } catch (error) {
        toast({
          title: "Error loading session",
          description: "Failed to load the sanctuary space",
          variant: "destructive"
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSession();
  }, [sessionId, isHost, navigate, toast]);
  
  // Timer for countdown
  useEffect(() => {
    if (!session) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timer);
          toast({
            title: "Session expired",
            description: "This sanctuary space has reached its time limit",
          });
          navigate('/');
          return 0;
        }
        return prevTime - 1;
      });
      
      // Update percentage for progress bar
      if (session) {
        const totalDuration = new Date(session.expiresAt).getTime() - new Date().getTime() + timeLeft * 1000;
        const percentLeft = (timeLeft * 1000 / totalDuration) * 100;
        setPercentTimeLeft(Math.max(0, Math.min(100, percentLeft)));
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [session, timeLeft, navigate, toast]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Helper for formatting time
  const formatTimeLeft = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s remaining`;
    } else {
      return `${secs}s remaining`;
    }
  };
  
  // Join the session
  const handleJoin = async () => {
    if (!sessionId) return;
    
    try {
      const response = await SanctuaryApi.joinSession(sessionId, {
        alias: tempAlias || undefined
      });
      
      if (response.success && response.data) {
        setParticipant({
          id: response.data.participantId,
          alias: response.data.participantAlias,
        });
        
        // Save to localStorage
        localStorage.setItem(
          `sanctuary-participant-${sessionId}`,
          JSON.stringify({
            id: response.data.participantId,
            alias: response.data.participantAlias,
          })
        );
        
        // Add system message
        addSystemMessage(`${response.data.participantAlias} joined the sanctuary`);
        
        // Update participants list
        setParticipants(prev => [
          ...prev,
          {
            id: response.data.participantId,
            alias: response.data.participantAlias,
          }
        ]);
        
        setJoinDialogOpen(false);
      } else {
        throw new Error(response.error || "Failed to join session");
      }
    } catch (error: any) {
      toast({
        title: "Error joining session",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };
  
  // End session (host only)
  const handleEndSession = async () => {
    if (!sessionId || !isHost) return;
    
    try {
      const response = await SanctuaryApi.endSession(sessionId, hostToken || undefined);
      
      if (response.success) {
        toast({
          title: "Session ended",
          description: "The sanctuary space has been closed"
        });
        navigate('/');
      } else {
        throw new Error(response.error || "Failed to end session");
      }
    } catch (error: any) {
      toast({
        title: "Error ending session",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
    
    setEndSessionDialogOpen(false);
  };
  
  // Report the session
  const handleReport = async () => {
    if (!sessionId) return;
    
    try {
      const response = await SanctuaryApi.flagSession(sessionId, "Reported by user");
      
      if (response.success) {
        toast({
          title: "Session reported",
          description: "Thank you for helping keep Veilo safe"
        });
      } else {
        throw new Error(response.error || "Failed to report session");
      }
    } catch (error: any) {
      toast({
        title: "Error reporting session",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
    
    setReportDialogOpen(false);
  };
  
  // Send message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !participant) return;
    
    // In a real app, this would use WebSockets or similar
    const message: SanctuaryMessage = {
      id: `msg-${Date.now()}`,
      participantId: participant.id,
      participantAlias: participant.alias,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      type: "text"
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };
  
  // Add system message
  const addSystemMessage = (content: string) => {
    const message: SanctuaryMessage = {
      id: `system-${Date.now()}`,
      participantId: "system",
      participantAlias: "System",
      content,
      timestamp: new Date().toISOString(),
      type: "system"
    };
    
    setMessages(prev => [...prev, message]);
  };

  // Reaction handler
  const handleSendReaction = (emoji: string) => {
    // TODO: Implement socket emission for reactions
    console.log('Sending reaction:', emoji);
  };

  // Breakout room handler
  const handleJoinBreakoutRoom = (roomId: string) => {
    // TODO: Implement breakout room joining logic
    console.log('Joining breakout room:', roomId);
  };
  
  // Toggle audio (mock functionality)
  const toggleAudio = () => {
    setAudioEnabled(prev => !prev);
    toast({
      title: audioEnabled ? "Audio disabled" : "Audio enabled",
      description: audioEnabled ? "Your microphone is now muted" : "Your microphone is now active",
    });
  };
  
  // Remove a participant (host only)
  const removeParticipant = async (participantId: string) => {
    if (!isHost || !sessionId || !hostToken) return;
    
    try {
      const response = await SanctuaryApi.removeParticipant(
        sessionId,
        participantId,
        hostToken
      );
      
      if (response.success) {
        // Update UI
        const removedParticipant = participants.find(p => p.id === participantId);
        setParticipants(prev => prev.filter(p => p.id !== participantId));
        
        if (removedParticipant) {
          addSystemMessage(`${removedParticipant.alias} was removed from the sanctuary`);
        }
        
        toast({
          title: "Participant removed",
          description: "The participant has been removed from this session"
        });
      } else {
        throw new Error(response.error || "Failed to remove participant");
      }
    } catch (error: any) {
      toast({
        title: "Error removing participant",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };
  
  // Simulation helpers for demo purposes (would be replaced by WebSockets)
  const simulateParticipants = () => {
    const mockParticipants = [
      { id: "p-1", alias: "Healing Journey" },
      { id: "p-2", alias: "Inner Peace" },
      { id: "p-3", alias: "Mindful Moment" },
    ];
    setParticipants(mockParticipants);
  };
  
  const simulateInitialMessages = () => {
    const initialMessages: SanctuaryMessage[] = [
      {
        id: "system-1",
        participantId: "system",
        participantAlias: "System",
        content: "Welcome to this sanctuary space. This is a safe place for support and connection.",
        timestamp: new Date(Date.now() - 600000).toISOString(),
        type: "system"
      },
      {
        id: "msg-1",
        participantId: "p-1",
        participantAlias: "Healing Journey",
        content: "Hello everyone. I've been feeling a bit overwhelmed lately with everything going on.",
        timestamp: new Date(Date.now() - 500000).toISOString(),
        type: "text"
      },
      {
        id: "msg-2",
        participantId: "p-2",
        participantAlias: "Inner Peace",
        content: "I understand that feeling. It can be really tough when everything piles up.",
        timestamp: new Date(Date.now() - 400000).toISOString(),
        type: "text"
      },
      {
        id: "msg-3",
        participantId: "p-3",
        participantAlias: "Mindful Moment",
        content: "What helps me is taking a few minutes each day to breathe and center myself. Have you tried any mindfulness practices?",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: "text"
      },
    ];
    setMessages(initialMessages);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-veilo-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-veilo-blue">Loading sanctuary space...</p>
        </div>
      </div>
    );
  }
  
  // If audio mode, show audio room interface
  if (sessionMode === 'audio' && session && participant) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10">
        <LiveAudioRoom 
          session={{
            id: session.id,
            topic: session.topic,
            description: session.description,
            emoji: session.emoji,
            hostId: 'host-id', // Temporary for now
            hostAlias: 'Host',
            hostToken: undefined,
            agoraChannelName: session.agoraChannelName || `sanctuary-${session.id}`,
            agoraToken: session.agoraToken || 'temp-token',
            expiresAt: session.expiresAt,
            isActive: true,
            mode: 'public',
            participants: [],
            maxParticipants: 50,
            currentParticipants: 0,
            allowAnonymous: true,
            audioOnly: true,
            moderationEnabled: true,
            emergencyContactEnabled: true,
            createdAt: new Date().toISOString(),
            startTime: new Date().toISOString(),
            isRecorded: false,
            recordingConsent: false,
            breakoutRooms: [],
            moderationLevel: 'medium',
            emergencyProtocols: true,
            aiMonitoring: true,
            estimatedDuration: undefined,
            tags: [],
            language: 'en',
            status: 'active'
          }}
          participant={{
            id: participant.id,
            alias: participant.alias,
            isHost: isHost,
            isModerator: isHost
          }}
        />
        
        {/* Host Controls Overlay */}
        {isHost && (
          <div className="fixed bottom-4 right-4 space-y-2">
            <Button
              onClick={() => setShowBreakoutRooms(true)}
              className="bg-primary/90 hover:bg-primary"
            >
              <Users className="h-4 w-4 mr-2" />
              Breakout Rooms
            </Button>
            <Button
              onClick={() => setShowRecording(true)}
              className="bg-secondary/90 hover:bg-secondary"
            >
              <Volume2 className="h-4 w-4 mr-2" />
              Recording
            </Button>
            <Button
              onClick={() => setShowModeration(true)}
              className="bg-accent/90 hover:bg-accent"
            >
              <Shield className="h-4 w-4 mr-2" />
              Moderation
            </Button>
          </div>
        )}
        
        {/* Breakout Rooms Dialog */}
        <Dialog open={showBreakoutRooms} onOpenChange={setShowBreakoutRooms}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Breakout Rooms Management</DialogTitle>
              <DialogDescription>
                Create and manage breakout rooms for smaller group discussions
              </DialogDescription>
            </DialogHeader>
            <WorkingBreakoutRoomManager 
              sessionId={session.id}
              isHost={isHost}
              authToken={localStorage.getItem('veilo-auth-token') || localStorage.getItem('token') || localStorage.getItem('auth_token') || ''}
              onJoinRoom={(roomId) => {
                console.log('Joining room:', roomId);
                setShowBreakoutRooms(false);
                toast({
                  title: "Breakout Room",
                  description: "Joining breakout room..."
                });
              }}
            />
          </DialogContent>
        </Dialog>
        
        {/* Recording Dialog */}
        <Dialog open={showRecording} onOpenChange={setShowRecording}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Session Recording</DialogTitle>
              <DialogDescription>
                Manage session recording and AI moderation
              </DialogDescription>
            </DialogHeader>
            <SessionRecorder 
              sessionId={session.id}
              sessionType="live-sanctuary"
              isHost={isHost}
            />
          </DialogContent>
        </Dialog>
        
        {/* AI Moderation Dashboard */}
        <Dialog open={showModeration} onOpenChange={setShowModeration}>
          <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>AI Moderation Dashboard</DialogTitle>
              <DialogDescription>
                Real-time content moderation and safety monitoring
              </DialogDescription>
            </DialogHeader>
            <AIModerationDashboard 
              sessionId={session.id}
              sessionType="live-sanctuary"
              isHost={isHost}
              isModerator={isHost}
              realTimeEnabled={true}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto shadow-lg">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {session?.emoji && (
                <span className="text-2xl" role="img" aria-label="Topic emoji">{session.emoji}</span>
              )}
              <CardTitle className="tracking-tight">{session?.topic}</CardTitle>
              <Badge variant="secondary" className="ml-2">
                {sessionMode === 'audio' ? (
                  <>
                    <Mic className="h-3 w-3 mr-1" />
                    Audio
                  </>
                ) : (
                  'Text Chat'
                )}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="px-3 py-1 flex items-center gap-1">
                      <Users size={14} />
                      <span>{participants.length + (participant ? 1 : 0)}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Active participants</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="px-3 py-1 flex items-center gap-1">
                      <Clock size={14} />
                      <span>{formatTimeLeft(timeLeft)}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Time remaining until session expires</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Host Controls */}
              {isHost && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Host Controls
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setShowBreakoutRooms(true)}>
                      <Users className="h-4 w-4 mr-2" />
                      Breakout Rooms
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowRecording(true)}>
                      <Volume2 className="h-4 w-4 mr-2" />
                      Recording
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowModeration(true)}>
                      <Shield className="h-4 w-4 mr-2" />
                      AI Moderation
                    </DropdownMenuItem>
                    <Separator className="my-1" />
                    <DropdownMenuItem onClick={() => setSessionMode(sessionMode === 'text' ? 'audio' : 'text')}>
                      {sessionMode === 'text' ? <Mic className="h-4 w-4 mr-2" /> : <MicOff className="h-4 w-4 mr-2" />}
                      Switch to {sessionMode === 'text' ? 'Audio' : 'Text'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isHost ? (
                    <DropdownMenuItem 
                      onClick={() => setEndSessionDialogOpen(true)}
                      className="text-red-500 cursor-pointer"
                    >
                      End Session
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem 
                      onClick={() => setReportDialogOpen(true)}
                      className="text-red-500 cursor-pointer"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report Session
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {session?.description && (
            <CardDescription>{session.description}</CardDescription>
          )}
          
          <Progress value={percentTimeLeft} className="h-1 mt-2" />
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="flex h-[60vh] md:h-[70vh]">
            {/* Participants sidebar */}
            <ModernScrollbar>
              <div className="w-16 md:w-48 border-r bg-gray-50 dark:bg-gray-900 p-2">
              <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 py-2 mb-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:block">Participants</h3>
              </div>
               <div className="space-y-2">
                {/* Host if applicable */}
                {isHost && participant && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-veilo-purple/10">
                    <Avatar className={`h-8 w-8 ${getAvatarColor(participant.alias)}`}>
                      <AvatarFallback>{getInitials(participant.alias)}</AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block overflow-hidden">
                      <p className="text-sm font-medium truncate">{participant.alias}</p>
                      <Badge variant="outline" className="text-xs bg-veilo-purple text-white">Host</Badge>
                    </div>
                    <Badge variant="outline" className="md:hidden bg-veilo-purple text-white p-1">H</Badge>
                  </div>
                )}
                
                {/* Current participant if not host */}
                {!isHost && participant && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-veilo-blue/10">
                    <Avatar className={`h-8 w-8 ${getAvatarColor(participant.alias)}`}>
                      <AvatarFallback>{getInitials(participant.alias)}</AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block overflow-hidden">
                      <p className="text-sm font-medium truncate">{participant.alias}</p>
                      <p className="text-xs text-gray-500">(You)</p>
                    </div>
                    <Badge variant="outline" className="md:hidden bg-veilo-blue text-white p-1">Y</Badge>
                  </div>
                )}
                
                {/* Other participants */}
                {participants.map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                    <Avatar className={`h-8 w-8 ${getAvatarColor(p.alias)}`}>
                      <AvatarFallback>{getInitials(p.alias)}</AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block overflow-hidden">
                      <p className="text-sm font-medium truncate">{p.alias}</p>
                    </div>
                    
                    {/* Host controls */}
                    {isHost && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-6 w-6 text-gray-400 hover:text-red-500"
                        onClick={() => removeParticipant(p.id)}
                      >
                        <span className="sr-only">Remove participant</span>
                        ×
                      </Button>
                    )}
                  </div>
                ))}
               </div>
              </div>
            </ModernScrollbar>

            {/* Messages area */}
            <div className="flex-1 flex flex-col max-h-full">
            {/* Messages container */}
            <ModernScrollbar>
              <div className="flex-1 p-4 space-y-4">
                {messages.map(message => (
                  <div 
                    key={message.id}
                    className={`flex items-start gap-2 ${
                      message.type === "system" ? "justify-center" : ""
                    }`}
                  >
                    {message.type === "system" ? (
                      <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs py-1 px-3 rounded-full">
                        {message.content}
                      </div>
                    ) : (
                      <>
                        <Avatar className={`h-8 w-8 ${getAvatarColor(message.participantAlias)}`}>
                          <AvatarFallback>{getInitials(message.participantAlias)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-baseline">
                            <span className="font-medium text-sm">{message.participantAlias}</span>
                            <span className="ml-2 text-xs text-gray-500">
                              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="mt-1 text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                            {message.content}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ModernScrollbar>
              
              {/* Input area */}
              {participant ? (
                <div className="border-t p-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={audioEnabled ? "text-green-500" : "text-gray-500"}
                      onClick={toggleAudio}
                    >
                      {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                    </Button>
                    <AutoResizeTextarea
                      value={newMessage}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
                      placeholder="Type your message... (Shift + Enter for new line)"
                      className="flex-1 min-h-10 p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      size="icon"
                    >
                      <Send size={18} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-t p-4 text-center">
                  <p className="text-gray-500">Join the sanctuary to participate in the discussion</p>
                  <Button 
                    onClick={() => setJoinDialogOpen(true)}
                    className="mt-2"
                  >
                    Join Now
                  </Button>
                </div>
               )}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="border-t p-3 text-xs text-gray-500 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield size={14} />
            <span>Veilo Sanctuary Space</span>
          </div>
          <div>Messages are temporary and will expire with the session</div>
        </CardFooter>
      </Card>
      
      {/* Join Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {session?.topic}</DialogTitle>
            <DialogDescription>
              Enter as an anonymous guest or choose your display name for this session
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={tempAlias}
              onChange={e => setTempAlias(e.target.value)}
              placeholder="Leave blank for random alias"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate('/')}>Cancel</Button>
            <Button onClick={handleJoin}>Join Sanctuary</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* End Session Dialog */}
      <AlertDialog open={endSessionDialogOpen} onOpenChange={setEndSessionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this sanctuary session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the space for all participants. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndSession} className="bg-red-500 hover:bg-red-600">
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Report Dialog */}
      <AlertDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report this sanctuary session?</AlertDialogTitle>
            <AlertDialogDescription>
              If you believe this session violates our community guidelines or contains harmful content, please report it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReport} className="bg-red-500 hover:bg-red-600">
              Report Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enhanced Reaction System */}
      {participant && (
        <EnhancedAnimatedReactionSystem
          sessionId={session?.id || ''}
          participantId={participant.id}
          onReactionSent={(reaction) => {
            console.log('Reaction sent:', reaction);
            // Could emit via socket for real-time reactions
          }}
        />
      )}
    </>
  );
};

export default SanctuarySpace;
