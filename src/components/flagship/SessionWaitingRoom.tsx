import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Calendar, 
  Users, 
  Mic, 
  Settings,
  Bell,
  Share2,
  Copy,
  CheckCircle
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { FlagshipSanctuarySession } from '@/types/flagship-sanctuary';

interface SessionWaitingRoomProps {
  session: FlagshipSanctuarySession;
  onLeave: () => void;
  onTestAudio?: () => void;
  onCountdownComplete?: () => void;
}

export const SessionWaitingRoom: React.FC<SessionWaitingRoomProps> = ({
  session,
  onLeave,
  onTestAudio,
  onCountdownComplete
}) => {
  const { toast } = useToast();
  const [timeRemaining, setTimeRemaining] = useState<{
    display: string;
    seconds: number;
    progress: number;
  }>({ display: '', seconds: 0, progress: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session.scheduledDateTime) return;

    const updateCountdown = () => {
      const scheduled = new Date(session.scheduledDateTime!);
      const now = new Date();
      const remainingSeconds = differenceInSeconds(scheduled, now);
      
      if (remainingSeconds <= 0) {
        setTimeRemaining({
          display: 'Session is starting now!',
          seconds: 0,
          progress: 100
        });
        // Auto-redirect to session after countdown
        setTimeout(() => {
          console.log('✅ Countdown complete, redirecting to live session...');
          // Force page refresh to trigger session conversion
          window.location.reload();
        }, 1000);
        return;
      }

      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;

      let display = '';
      if (hours > 0) {
        display = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        display = `${minutes}m ${seconds}s`;
      } else {
        display = `${seconds}s`;
      }

      // Calculate progress (assuming 1 hour total waiting time for progress bar)
      const totalWaitTime = 3600; // 1 hour in seconds
      const progress = Math.max(0, Math.min(100, ((totalWaitTime - remainingSeconds) / totalWaitTime) * 100));

      setTimeRemaining({
        display,
        seconds: remainingSeconds,
        progress
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [session.scheduledDateTime]);

  const copyInviteLink = async () => {
    if (session.invitationLink) {
      try {
        await navigator.clipboard.writeText(session.invitationLink);
        setCopied(true);
        toast({
          title: "Link Copied",
          description: "Invitation link copied to clipboard",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Could not copy link to clipboard",
          variant: "destructive"
        });
      }
    }
  };

  const scheduledTime = session.scheduledDateTime ? new Date(session.scheduledDateTime) : null;
  const isStartingSoon = timeRemaining.seconds > 0 && timeRemaining.seconds <= 300; // 5 minutes
  const isStartingNow = timeRemaining.seconds <= 0;
  const showAutoJoinMessage = timeRemaining.seconds <= 10 && timeRemaining.seconds > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          
          <div>
            <CardTitle className="text-3xl mb-2">
              {session.emoji} {session.topic}
            </CardTitle>
            {session.description && (
              <p className="text-muted-foreground text-lg">{session.description}</p>
            )}
          </div>

          <Badge 
            variant={isStartingNow ? "default" : isStartingSoon ? "secondary" : "outline"} 
            className={`px-4 py-2 text-lg ${
              isStartingNow ? "bg-green-500 text-white animate-pulse" :
              isStartingSoon ? "bg-yellow-500 text-white" : ""
            }`}
          >
            {isStartingNow ? "🎉 Starting Now!" : isStartingSoon ? "🔔 Starting Soon" : "⏰ Scheduled Session"}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Countdown Timer */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold">Session starts in</h3>
                <div className={`text-4xl font-bold ${isStartingNow ? 'text-green-500 animate-bounce' : 'text-primary'}`}>
                  {timeRemaining.display}
                </div>
                
                {scheduledTime && (
                  <div className="text-muted-foreground">
                    <p className="flex items-center justify-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>{format(scheduledTime, 'EEEE, MMMM dd, yyyy')}</span>
                    </p>
                    <p className="flex items-center justify-center space-x-2 mt-1">
                      <Clock className="h-4 w-4" />
                      <span>{format(scheduledTime, 'HH:mm')} {session.timezone && `(${session.timezone})`}</span>
                    </p>
                  </div>
                )}

                {timeRemaining.progress > 0 && (
                  <Progress value={timeRemaining.progress} className="w-full" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Session Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Host</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src="/avatars/avatar-1.svg" />
                    <AvatarFallback>
                      {session.hostAlias.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{session.hostAlias}</p>
                    <p className="text-sm text-muted-foreground">Session Host</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {session.participantCount || 0} waiting • {session.maxParticipants} max
                  </span>
                </div>
                {session.duration && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{session.duration} minutes duration</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Mic className="h-4 w-4" />
                  <span className="text-sm">
                    {session.audioOnly ? 'Audio only' : 'Video & audio'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pre-session Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prepare for Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {onTestAudio && (
                  <Button variant="outline" onClick={onTestAudio} className="flex items-center space-x-2">
                    <Mic className="h-4 w-4" />
                    <span>Test Audio</span>
                  </Button>
                )}
                
                <Button variant="outline" className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Button>

                {session.invitationLink && (
                  <Button 
                    variant="outline" 
                    onClick={copyInviteLink}
                    className="flex items-center space-x-2"
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                    <span>{copied ? 'Copied!' : 'Share'}</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Waiting Participants */}
          {session.preRegisteredParticipants && session.preRegisteredParticipants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Waiting Participants ({session.preRegisteredParticipants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {session.preRegisteredParticipants.slice(0, 10).map((participant, index) => (
                    <div key={participant.id} className="flex items-center space-x-2 bg-muted rounded-full px-3 py-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={`/avatars/avatar-${(index % 7) + 1}.svg`} />
                        <AvatarFallback className="text-xs">
                          {participant.alias.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{participant.alias}</span>
                    </div>
                  ))}
                  {session.preRegisteredParticipants.length > 10 && (
                    <div className="bg-muted rounded-full px-3 py-1 text-sm text-muted-foreground">
                      +{session.preRegisteredParticipants.length - 10} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auto-join Notice */}
          {showAutoJoinMessage && !isStartingNow && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2 text-green-700">
                  <CheckCircle className="h-5 w-5 animate-pulse" />
                  <p className="font-medium">Auto-joining in {timeRemaining.seconds} seconds...</p>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Get ready! The session will start automatically.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Session starting now notice */}
          {isStartingNow && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center space-x-2 text-green-700">
                  <CheckCircle className="h-6 w-6 animate-spin" />
                  <p className="font-bold text-lg">Session is starting now!</p>
                </div>
                <p className="text-sm text-green-600 mt-2">
                  Refreshing page to join the live session...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Reminder Settings */}
          {isStartingSoon && !showAutoJoinMessage && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2 text-yellow-700">
                  <Bell className="h-5 w-5" />
                  <p className="font-medium">Session starting soon!</p>
                </div>
                <p className="text-sm text-yellow-600 mt-1">
                  Get ready to join. The session will begin automatically when the countdown reaches zero.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex space-x-4">
            <Button onClick={onLeave} variant="outline" size="lg" className="flex-1" disabled={showAutoJoinMessage}>
              {showAutoJoinMessage ? `Auto-joining in ${timeRemaining.seconds}s...` : 'Leave Waiting Room'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};