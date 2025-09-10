import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useSanctuarySocket } from '@/hooks/useSanctuarySocket';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Hand, 
  Users, 
  PhoneOff,
  ArrowLeft,
  MessageCircle
} from 'lucide-react';

interface BreakoutParticipant {
  id: string;
  alias: string;
  avatarIndex: number;
  isMuted: boolean;
  isConnected: boolean;
  handRaised?: boolean;
}

interface BreakoutRoomSpaceProps {
  roomId: string;
  sessionId: string;
  currentUser: {
    id: string;
    alias: string;
    avatarIndex?: number;
  };
}

export const BreakoutRoomSpace: React.FC<BreakoutRoomSpaceProps> = ({
  roomId,
  sessionId,
  currentUser
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [participants, setParticipants] = useState<BreakoutParticipant[]>([]);
  const [roomInfo, setRoomInfo] = useState<{
    name: string;
    topic?: string;
    facilitatorAlias: string;
    maxParticipants: number;
  } | null>(null);
  
  const agoraChannelName = searchParams.get('channel');
  const agoraToken = searchParams.get('token');

  // Initialize socket for breakout room
  const socket = useSanctuarySocket({
    sessionId: `breakout_${roomId}`, // Use breakout room as session ID
    participant: {
      id: currentUser.id,
      alias: currentUser.alias,
      isHost: false,
      isModerator: false
    }
  });

  // Fetch room info and participants
  useEffect(() => {
    fetchRoomInfo();
  }, [roomId]);

  const fetchRoomInfo = async () => {
    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/breakout-rooms`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const room = data.data?.rooms?.find((r: any) => r.id === roomId);
        
        if (room) {
          setRoomInfo({
            name: room.name,
            topic: room.topic,
            facilitatorAlias: room.creatorAlias,
            maxParticipants: room.maxParticipants
          });
          setParticipants(room.participants || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch room info:', error);
    }
  };

  // Socket event handlers
  useEffect(() => {
    const cleanup1 = socket.onEvent('participant_joined', (data) => {
      setParticipants(prev => [...prev, data.participant]);
      toast({
        title: "Participant Joined",
        description: `${data.participant.alias} joined the breakout room`
      });
    });

    const cleanup2 = socket.onEvent('participant_left', (data) => {
      setParticipants(prev => prev.filter(p => p.id !== data.participantId));
    });

    const cleanup3 = socket.onEvent('hand_raised', (data) => {
      setParticipants(prev => prev.map(p => 
        p.id === data.participantId 
          ? { ...p, handRaised: data.isRaised }
          : p
      ));
    });

    return () => {
      cleanup1?.();
      cleanup2?.();
      cleanup3?.();
    };
  }, [socket, toast]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Implement Agora mute/unmute logic here
  };

  const toggleDeafened = () => {
    setIsDeafened(!isDeafened);
    // Implement Agora deafen logic here
  };

  const toggleHandRaise = () => {
    const newHandRaised = !handRaised;
    setHandRaised(newHandRaised);
    socket.toggleHand(newHandRaised);
  };

  const leaveBreakoutRoom = async () => {
    try {
      await fetch(`/api/flagship-sanctuary/${sessionId}/breakout-rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        }
      });

      // Return to main session
      window.close(); // Close breakout room window
    } catch (error) {
      console.error('Failed to leave breakout room:', error);
      toast({
        title: "Leave Failed",
        description: "Could not leave breakout room",
        variant: "destructive"
      });
    }
  };

  if (!roomInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading breakout room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.close()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Main
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{roomInfo.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Facilitated by {roomInfo.facilitatorAlias}
                  {roomInfo.topic && ` • ${roomInfo.topic}`}
                </p>
              </div>
            </div>
            <Badge variant="secondary">
              {participants.length}/{roomInfo.maxParticipants} participants
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Audio Area */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Breakout Room Participants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        participant.isConnected 
                          ? 'border-green-200 bg-green-50/50' 
                          : 'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback>
                              {participant.alias.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {participant.handRaised && (
                            <div className="absolute -top-1 -right-1 text-yellow-500">
                              <Hand className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">{participant.alias}</p>
                          <div className="flex items-center justify-center space-x-1 mt-1">
                            {participant.isMuted ? (
                              <MicOff className="h-3 w-3 text-red-500" />
                            ) : (
                              <Mic className="h-3 w-3 text-green-500" />
                            )}
                            <div className={`w-2 h-2 rounded-full ${
                              participant.isConnected ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Audio Controls */}
            <Card className="mt-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center space-x-4">
                  <Button
                    variant={isMuted ? "destructive" : "default"}
                    size="lg"
                    onClick={toggleMute}
                    className="rounded-full w-14 h-14"
                  >
                    {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                  
                  <Button
                    variant={isDeafened ? "destructive" : "outline"}
                    size="lg"
                    onClick={toggleDeafened}
                    className="rounded-full w-14 h-14"
                  >
                    {isDeafened ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                  </Button>
                  
                  <Button
                    variant={handRaised ? "default" : "outline"}
                    size="lg"
                    onClick={toggleHandRaise}
                    className="rounded-full w-14 h-14"
                  >
                    <Hand className="h-6 w-6" />
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={leaveBreakoutRoom}
                    className="rounded-full w-14 h-14"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar with Room Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Room Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium">Topic</h4>
                  <p className="text-sm text-muted-foreground">
                    {roomInfo.topic || 'General Discussion'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Facilitator</h4>
                  <p className="text-sm text-muted-foreground">
                    {roomInfo.facilitatorAlias}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Capacity</h4>
                  <p className="text-sm text-muted-foreground">
                    {participants.length} of {roomInfo.maxParticipants} participants
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};