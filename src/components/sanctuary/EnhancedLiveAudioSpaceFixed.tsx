import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { ModernScrollbar } from '@/components/ui/modern-scrollbar';
import { useToast } from '@/hooks/use-toast';
import { useSanctuarySocket } from '@/hooks/useSanctuarySocket';
import { ReactionOverlay } from './AnimatedReaction';
import { ResizableChatPanel } from './ResizableChatPanel';
import ComprehensiveAudioSettings from './ComprehensiveAudioSettings';
import { FloatingEmojiReactions, useFloatingEmojiReactions } from './FloatingEmojiReactions';
import { FloatingReactionOverlay } from './FloatingReactionOverlay';
import { EnhancedBreakoutRoomManager } from './EnhancedBreakoutRoomManager';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Hand, 
  Users, 
  PhoneOff,
  Settings,
  AlertTriangle,
  Shield,
  Share2,
  Copy,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Grid3X3
} from 'lucide-react';
import type { LiveSanctuarySession, LiveParticipant } from '@/types/sanctuary';

interface EnhancedLiveAudioSpaceProps {
  session: LiveSanctuarySession;
  currentUser: {
    id: string;
    alias: string;
    avatarIndex?: number;
    isHost?: boolean;
    isModerator?: boolean;
  };
  onLeave: () => void;
}

interface ChatMessage {
  id: string;
  senderAlias: string;
  senderAvatarIndex: number;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'emoji-reaction' | 'media';
  attachment?: any;
  replyTo?: string;
}

export const EnhancedLiveAudioSpace = ({ session, currentUser, onLeave }: EnhancedLiveAudioSpaceProps) => {
  const { toast } = useToast();
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isHostMuted, setIsHostMuted] = useState(false);
  
  // Filter unique participants to prevent duplicates
  const uniqueParticipants = React.useMemo(() => {
    const seen = new Set();
    return (session.participants || []).filter(p => {
      if (seen.has(p.id)) {
        return false;
      }
      seen.add(p.id);
      return true;
    });
  }, [session.participants]);
  
  const [participants, setParticipants] = useState<LiveParticipant[]>(uniqueParticipants);
  const [audioLevel, setAudioLevel] = useState(0);

  // Update participants when session data changes with proper sync
  useEffect(() => {
    console.log('🔄 Syncing participants:', uniqueParticipants.length);
    setParticipants(prev => {
      // Only update if there's an actual change to prevent unnecessary re-renders
      const prevIds = prev.map(p => p.id).sort();
      const newIds = uniqueParticipants.map(p => p.id).sort();
      
      if (JSON.stringify(prevIds) !== JSON.stringify(newIds)) {
        console.log('✅ Participants updated:', { previous: prevIds.length, new: newIds.length });
        return uniqueParticipants;
      }
      
      return prev;
    });
  }, [uniqueParticipants]);
  
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; timestamp: number }>>([]);
  const [showBreakoutManager, setShowBreakoutManager] = useState(false);
  
  // Floating emoji reactions
  const { reactions: floatingReactions, addReaction } = useFloatingEmojiReactions();
  
  // Initialize socket
  const {
    onEvent,
    sendMessage,
    toggleHand,
    sendEmojiReaction,
    promoteToSpeaker,
    muteParticipant,
    unmuteParticipant,
    unmuteAll,
    kickParticipant,
    sendEmergencyAlert
  } = useSanctuarySocket({
    sessionId: session.id,
    participant: {
      id: currentUser.id,
      alias: currentUser.alias,
      isHost: currentUser.isHost,
      isModerator: currentUser.isModerator
    }
  });

  // Socket event handlers for real-time updates
  useEffect(() => {
    if (!session?.id || !currentUser?.id) return;

    // Participant management events
    const cleanup1 = onEvent('participant_joined', (data) => {
      console.log('🆕 New participant joined:', data.participant.alias);
      
      setParticipants(prev => {
        // Avoid duplicates by checking if participant already exists
        const exists = prev.some(p => p.id === data.participant.id);
        if (exists) {
          console.log('⚠️ Participant already exists, updating instead of adding');
          return prev.map(p => 
            p.id === data.participant.id 
              ? { ...p, ...data.participant, connectionStatus: 'connected' }
              : p
          );
        }
        
        // Add new participant with connected status
        const newParticipant = {
          ...data.participant,
          connectionStatus: 'connected' as const,
          joinedAt: new Date().toISOString()
        };
        
        return [...prev, newParticipant];
      });
      
      toast({
        title: "Participant Joined",
        description: `${data.participant.alias} joined the session`,
      });
    });

    const cleanup2 = onEvent('participant_left', (data) => {
      console.log('👋 Participant left:', data.participantAlias);
      
      setParticipants(prev => prev.filter(p => p.id !== data.participantId));
      
      toast({
        title: "Participant Left",
        description: `${data.participantAlias} left the session`,
      });
    });

    // Emoji reaction events with animation trigger
    const cleanup3 = onEvent('emoji_reaction', (data) => {
      console.log('😀 Emoji reaction:', data.emoji, 'from', data.participantAlias);
      
      // Add reaction to floating animation system
      const newReaction = {
        id: data.id || `reaction-${Date.now()}-${Math.random()}`,
        emoji: data.emoji,
        timestamp: Date.now()
      };
      
      setReactions(prev => [...prev, newReaction]);
      addReaction(data.emoji);
      
      // Auto-remove reaction after 3 seconds
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== newReaction.id));
      }, 3000);
      
      // Show in chat as well
      const reactionMessage: ChatMessage = {
        id: `reaction-${data.timestamp}`,
        senderAlias: data.participantAlias,
        senderAvatarIndex: 1,
        content: data.emoji,
        timestamp: new Date(data.timestamp),
        type: 'emoji-reaction'
      };
      setMessages(prev => [...prev, reactionMessage]);
    });

    return () => {
      cleanup1?.();
      cleanup2?.();
      cleanup3?.();
    };
  }, [session?.id, currentUser?.id, onEvent, toast, addReaction]);

  // Generate invite link
  useEffect(() => {
    if (session?.id) {
      const currentUrl = window.location.origin;
      const link = `${currentUrl}/flagship-sanctuary/${session.id}`;
      setInviteLink(link);
    }
  }, [session?.id]);

  // Handle actions
  const handleToggleMute = () => {
    if (!isHostMuted) {
      setIsMuted(!isMuted);
    }
  };

  const handleToggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  const handleToggleHand = () => {
    const newHandRaised = !handRaised;
    setHandRaised(newHandRaised);
    toggleHand(newHandRaised);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    sendMessage(newMessage.trim());
    setNewMessage('');
  };

  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Link Copied",
        description: "Invite link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleReaction = (emoji: string) => {
    sendEmojiReaction(emoji);
    addReaction(emoji);
  };

  const reactionEmojis = ['👏', '👍', '❤️', '😂', '😮', '😢', '🔥', '💯', '🎉', '🙌'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      {/* Header with Lower Z-Index */}
      <div className="bg-background/95 backdrop-blur border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl">{session.emoji}</div>
              <div>
                <h1 className="text-xl font-semibold">{session.topic}</h1>
                <p className="text-sm text-muted-foreground">
                  Hosted by {session.hostAlias}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                {participants.length} participants
              </Badge>
              <Button variant="outline" size="sm" onClick={onLeave}>
                <PhoneOff className="h-4 w-4 mr-2" />
                Leave
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Audio Controls */}
          <div className="lg:col-span-3">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Audio Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center space-x-6 py-8">
                  <Button
                    size="lg" 
                    variant={isMuted ? "destructive" : "default"}
                    onClick={handleToggleMute}
                    disabled={isHostMuted}
                    className="rounded-full w-16 h-16"
                  >
                    {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                  
                  <Button
                    size="lg" 
                    variant={isDeafened ? "destructive" : "outline"}
                    onClick={handleToggleDeafen}
                    className="rounded-full w-16 h-16"
                  >
                    {isDeafened ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                  </Button>
                  
                  <Button
                    size="lg"
                    variant={handRaised ? "default" : "outline"}
                    onClick={handleToggleHand}
                    className="rounded-full w-16 h-16"
                  >
                    <Hand className="h-6 w-6" />
                  </Button>
                </div>

                {/* Reaction Buttons */}
                <div className="flex items-center justify-center space-x-2 mt-4">
                  {reactionEmojis.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReaction(emoji)}
                      className="text-2xl p-2 h-auto hover:scale-110 transition-transform"
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>

                {/* Host/Moderator Actions */}
                {(currentUser.isHost || currentUser.isModerator) && (
                  <div className="flex items-center justify-center space-x-4 mt-6 pt-6 border-t">
                    <Button
                      onClick={() => setShowBreakoutManager(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      Manage Breakouts
                    </Button>
                    <Button
                      onClick={() => unmuteAll()}
                      variant="outline"
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      Unmute All
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat Panel Toggle */}
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => setIsChatVisible(!isChatVisible)}
                variant="outline"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {isChatVisible ? 'Hide Chat' : 'Show Chat'}
              </Button>
            </div>

            {/* Chat Panel */}
            {isChatVisible && (
              <Card>
                <CardHeader>
                  <CardTitle>Chat</CardTitle>
                </CardHeader>
                <CardContent>
                  <ModernScrollbar maxHeight="300px" className="mb-4">
                    <div className="space-y-2">
                      {messages.map((message) => (
                        <div key={message.id} className="p-2 rounded bg-muted/50">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm">{message.senderAlias}</span>
                            <span className="text-xs text-muted-foreground">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{message.content}</p>
                        </div>
                      ))}
                    </div>
                  </ModernScrollbar>
                  
                  <div className="flex space-x-2">
                    <AutoResizeTextarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      maxRows={4}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button onClick={handleSendMessage}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Participants */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Participants ({participants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ModernScrollbar maxHeight="400px">
                  <div className="space-y-3">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`/avatars/avatar-${participant.avatarIndex || 1}.svg`} />
                            <AvatarFallback>
                              {participant.alias.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium text-sm">{participant.alias}</p>
                              {participant.id === currentUser.id && (
                                <Badge variant="default" className="text-xs">You</Badge>
                              )}
                              {participant.isHost && (
                                <Badge className="text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Host
                                </Badge>
                              )}
                              {participant.handRaised && (
                                <Hand className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <div className={`w-2 h-2 rounded-full ${
                                participant.connectionStatus === 'connected' ? 'bg-green-500' : 'bg-gray-400'
                              }`} />
                              {participant.isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                            </div>
                          </div>
                        </div>

                        {/* Host Controls */}
                        {(currentUser.isHost || currentUser.isModerator) && participant.id !== currentUser.id && (
                          <div className="flex space-x-1">
                            {participant.handRaised && (
                              <Button
                                size="sm"
                                onClick={() => promoteToSpeaker(participant.id)}
                                className="h-6 px-2 text-xs"
                              >
                                Allow
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ModernScrollbar>
              </CardContent>
            </Card>

            {/* Share Link */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Share2 className="h-5 w-5 mr-2" />
                  Invite Link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="text-xs"
                  />
                  <Button size="sm" onClick={handleCopyInviteLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Breakout Room Manager Dialog */}
      {showBreakoutManager && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center">
                  <Grid3X3 className="h-5 w-5 mr-2" />
                  Breakout Rooms Management
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBreakoutManager(false)}
                >
                  ×
                </Button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <EnhancedBreakoutRoomManager
                sessionId={session.id}
                currentUser={{
                  ...currentUser,
                  isHost: currentUser.isHost || false,
                  isModerator: currentUser.isModerator || false
                }}
                participants={participants.map(p => ({
                  ...p,
                  avatarIndex: p.avatarIndex || 1,
                  isHost: p.isHost || false,
                  isModerator: p.isModerator || false
                }))}
                onJoinRoom={async (roomId) => {
                  try {
                    const response = await fetch(`/api/flagship-sanctuary/${session.id}/breakout-rooms/${roomId}/join`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
                      }
                    });

                    if (response.ok) {
                      const data = await response.json();
                      
                      // Navigate to breakout room (same window for better UX)
                      const breakoutUrl = `/flagship-sanctuary/${session.id}/breakout/${roomId}?channel=${data.data.room.agoraChannelName}&token=${data.data.room.agoraToken}`;
                      window.location.href = breakoutUrl;
                      
                      toast({
                        title: "Joining Breakout Room",
                        description: `Connecting to ${data.data.room.name}...`,
                      });
                    } else {
                      const errorData = await response.json();
                      toast({
                        title: "Join Failed",
                        description: errorData.message || "Could not join breakout room",
                        variant: "destructive"
                      });
                    }
                  } catch (error) {
                    toast({
                      title: "Connection Error",
                      description: "Failed to connect to breakout room",
                      variant: "destructive"
                    });
                  }
                }}
                onLeaveRoom={(roomId) => {
                  console.log('Leaving breakout room:', roomId);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Emoji Reactions */}
      <FloatingEmojiReactions reactions={floatingReactions} />
      
      {/* Enhanced Floating Reactions Overlay */}
      <FloatingReactionOverlay reactions={reactions} />
      
      {/* Animated Reactions Overlay */}
      <ReactionOverlay reactions={reactions} />
    </div>
  );
};