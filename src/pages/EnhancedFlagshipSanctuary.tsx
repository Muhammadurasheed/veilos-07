import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/optimized/AuthContextRefactored';
import { EnhancedLiveAudioSpace } from '@/components/sanctuary/EnhancedLiveAudioSpace';
import { WorkingBreakoutManager } from '@/components/sanctuary/WorkingBreakoutManager';
import { FullscreenChatPanel } from '@/components/sanctuary/FullscreenChatPanel';
import { SessionRecorder } from '@/components/flagship/SessionRecorder';
import { AnimatedReactionSystem } from '@/components/flagship/AnimatedReactionSystem';
import { EnhancedRealTimeChat } from '@/components/sanctuary/EnhancedRealTimeChat';
import { 
  Users, 
  Shield, 
  Settings,
  MessageSquare,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  MoreHorizontal,
  Circle,
  Heart,
  ThumbsUp,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';

interface Participant {
  id: string;
  alias: string;
  avatarIndex: number;
  isHost: boolean;
  isModerator: boolean;
  isMuted: boolean;
  isConnected: boolean;
  joinedAt: string;
}

interface SanctuaryMessage {
  id: string;
  participantId: string;
  participantAlias: string;
  content: string;
  timestamp: string;
  type: 'text' | 'emoji-reaction' | 'system';
  attachment?: any;
  replyTo?: string;
}

export const EnhancedFlagshipSanctuary: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { socket, isConnected } = useSocket();
  
  const [sessionData, setSessionData] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<SanctuaryMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [currentBreakoutRoom, setCurrentBreakoutRoom] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);

  // Current user data
  const currentUser = user ? {
    id: user.id,
    alias: user.alias,
    isHost: sessionData?.hostId === user.id,
    isModerator: participants.find(p => p.id === user.id)?.isModerator || false
  } : null;

  useEffect(() => {
    if (!sessionId || !user) {
      navigate('/');
      return;
    }
    
    fetchSessionData();
  }, [sessionId, user, navigate]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !sessionId || !isJoined) return;

    const handleNewMessage = (message: SanctuaryMessage) => {
      setMessages(prev => [...prev, message]);
    };

    const handleParticipantJoined = (participant: Participant) => {
      setParticipants(prev => {
        const existing = prev.find(p => p.id === participant.id);
        if (existing) return prev;
        return [...prev, participant];
      });
    };

    const handleParticipantLeft = (data: { participantId: string }) => {
      setParticipants(prev => prev.filter(p => p.id !== data.participantId));
    };

    const handleBreakoutRoomJoined = (data: any) => {
      setCurrentBreakoutRoom(data.roomId);
    };

    const handleBreakoutRoomLeft = () => {
      setCurrentBreakoutRoom(null);
    };

    socket.on('flagship_new_message', handleNewMessage);
    socket.on('participant_joined', handleParticipantJoined);
    socket.on('participant_left', handleParticipantLeft);
    socket.on('breakout_room_joined', handleBreakoutRoomJoined);
    socket.on('breakout_room_left', handleBreakoutRoomLeft);

    return () => {
      socket.off('flagship_new_message', handleNewMessage);
      socket.off('participant_joined', handleParticipantJoined);
      socket.off('participant_left', handleParticipantLeft);
      socket.off('breakout_room_joined', handleBreakoutRoomJoined);
      socket.off('breakout_room_left', handleBreakoutRoomLeft);
    };
  }, [socket, sessionId, isJoined]);

  const fetchSessionData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSessionData(data.data || data);
        setParticipants(data.data?.participants || data.participants || []);
        setMessages(data.data?.messages || data.messages || []);
      } else {
        throw new Error('Session not found');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load session",
        variant: "destructive"
      });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const joinSession = async () => {
    if (!sessionId || !user || !socket) return;

    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsJoined(true);
        
        // Join socket room
        socket.emit('join_flagship_sanctuary', {
          sessionId,
          participant: {
            id: user.id,
            alias: user.alias,
            avatarIndex: user.avatarIndex || 1
          }
        });

        toast({
          title: "Joined Session",
          description: "Welcome to the sanctuary"
        });
      }
    } catch (error) {
      toast({
        title: "Join Failed",
        description: "Could not join the session",
        variant: "destructive"
      });
    }
  };

  const leaveSession = async () => {
    if (!sessionId || !user) return;

    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setIsJoined(false);
        navigate('/my-sanctuaries');
      }
    } catch (error) {
      toast({
        title: "Leave Failed",
        description: "Could not leave the session",
        variant: "destructive"
      });
    }
  };

  const handleSendMessage = (content: string, type?: string, attachment?: any, replyTo?: string) => {
    if (!socket || !sessionId) return;

    socket.emit('flagship_send_message', {
      sessionId,
      content,
      type: type || 'text',
      attachment,
      replyTo
    });
  };

  const handleJoinBreakoutRoom = (roomData: any) => {
    setCurrentBreakoutRoom(roomData.id);
    toast({
      title: "Joined Breakout Room",
      description: `You're now in "${roomData.name}"`
    });
  };

  const handleLeaveBreakoutRoom = (roomId: string) => {
    setCurrentBreakoutRoom(null);
    toast({
      title: "Left Breakout Room",
      description: "You've returned to the main session"
    });
  };

  const handleReaction = (emoji: string) => {
    if (!socket || !sessionId) return;

    socket.emit('flagship_send_message', {
      sessionId,
      content: emoji,
      type: 'emoji-reaction'
    });
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (socket && sessionId) {
      socket.emit('update_audio_status', {
        sessionId,
        isMuted: !isMuted
      });
    }
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    if (socket && sessionId) {
      socket.emit('update_video_status', {
        sessionId,
        isVideoEnabled: !isVideoEnabled
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading sanctuary...</p>
        </div>
      </div>
    );
  }

  if (!sessionData || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This sanctuary session could not be found or you don't have access to it.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-bold">{sessionData.title}</h1>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{participants.length} participants</span>
                  {currentBreakoutRoom && (
                    <>
                      <span>•</span>
                      <Badge variant="outline">In Breakout Room</Badge>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Audio Controls */}
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="sm"
                onClick={toggleMute}
                disabled={!isJoined}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              <Button
                variant={isVideoEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleVideo}
                disabled={!isJoined}
              >
                {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>

              {/* Reactions */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReactions(!showReactions)}
                disabled={!isJoined}
              >
                <Heart className="h-4 w-4" />
              </Button>

              {/* Chat Toggle */}
              <Button
                variant={isChatVisible ? "default" : "outline"}
                size="sm"
                onClick={() => setIsChatVisible(!isChatVisible)}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>

              {/* Recording */}
              {(currentUser.isHost || currentUser.isModerator) && (
                <SessionRecorder 
                  sessionId={sessionId!}
                  isHost={currentUser.isHost}
                  isEnabled={true}
                  participants={participants}
                />
              )}

              {/* Leave Session */}
              <Button
                variant="destructive"
                size="sm"
                onClick={leaveSession}
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Audio Space */}
          <div className="lg:col-span-2">
            {!isJoined ? (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Ready to Join?</h3>
                  <p className="text-muted-foreground mb-4">
                    Join this sanctuary to connect with others in a safe space
                  </p>
                  <Button onClick={joinSession} size="lg">
                    Join Sanctuary
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                <EnhancedLiveAudioSpace
                  session={sessionData}
                  currentUser={currentUser}
                  onLeave={leaveSession}
                />

                {/* Breakout Rooms */}
                <WorkingBreakoutManager
                  sessionId={sessionId!}
                  currentUser={currentUser}
                  participants={participants}
                  onJoinRoom={handleJoinBreakoutRoom}
                  onLeaveRoom={handleLeaveBreakoutRoom}
                />
              </div>
            )}
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-1">
            {isJoined && (
              <EnhancedRealTimeChat
                sessionId={sessionId!}
                participant={currentUser}
                participants={participants}
                isHost={currentUser.isHost}
                isVisible={isChatVisible}
                onToggle={() => setIsChatVisible(!isChatVisible)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Floating Reactions */}
      {showReactions && isJoined && (
        <div className="fixed bottom-20 right-4 z-50">
          <AnimatedReactionSystem 
            sessionId={sessionId!}
            currentUserAlias={currentUser.alias}
          />
        </div>
      )}

      {/* Fullscreen Chat */}
      {isChatVisible && isJoined && (
        <FullscreenChatPanel
          isVisible={false} // Controlled separately for fullscreen mode
          messages={messages}
          participants={participants}
          currentUserAlias={currentUser.alias}
          sessionId={sessionId!}
          onSendMessage={handleSendMessage}
        />
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <Badge variant="destructive" className="animate-pulse">
            <Circle className="h-3 w-3 mr-1" />
            Recording
          </Badge>
        </div>
      )}
    </div>
  );
};