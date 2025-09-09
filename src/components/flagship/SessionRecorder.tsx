import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Download, 
  Shield, 
  Clock,
  Users,
  AlertTriangle
} from 'lucide-react';

interface SessionRecorderProps {
  sessionId: string;
  isHost: boolean;
  isEnabled: boolean;
  participants: Array<{
    id: string;
    alias: string;
    hasConsented?: boolean;
  }>;
  onToggleRecording?: (enabled: boolean) => void;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  recordingId?: string;
  status: 'idle' | 'recording' | 'paused' | 'processing' | 'completed' | 'error';
  startTime?: Date;
  size?: number;
}

export const SessionRecorder: React.FC<SessionRecorderProps> = ({
  sessionId,
  isHost,
  isEnabled,
  participants,
  onToggleRecording
}) => {
  const { toast } = useToast();
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    status: 'idle'
  });
  const [consentMode, setConsentMode] = useState<'automatic' | 'explicit'>('explicit');
  const [retentionPolicy, setRetentionPolicy] = useState<'delete_after_session' | '7_days' | '30_days'>('delete_after_session');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  // Update duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (recordingState.isRecording && !recordingState.isPaused) {
      interval = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: prev.startTime ? Date.now() - prev.startTime.getTime() : 0
        }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState.isRecording, recordingState.isPaused, recordingState.startTime]);

  // Load existing recordings
  useEffect(() => {
    if (sessionId) {
      loadRecordings();
    }
  }, [sessionId]);

  const loadRecordings = async () => {
    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/recordings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecordings(data.data || data.recordings || []);
      }
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  const requestConsent = async () => {
    try {
      // Request recording consent from all participants
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/recording/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          consentGiven: true,
          alias: 'Host'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to request consent');
      }

      toast({
        title: "Consent Requested",
        description: "Participants will be asked for recording consent"
      });

      return true;
    } catch (error) {
      console.error('Consent request failed:', error);
      toast({
        title: "Consent Request Failed",
        description: "Could not request recording consent",
        variant: "destructive"
      });
      return false;
    }
  };

  const setupMediaRecorder = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = async () => {
        await stopRecording();
      };

      setMediaRecorder(recorder);
      return recorder;
    } catch (error) {
      console.error('Failed to setup media recorder:', error);
      toast({
        title: "Recording Setup Failed",
        description: "Could not access microphone",
        variant: "destructive"
      });
      return null;
    }
  };

  const startRecording = async () => {
    if (!isHost) {
      toast({
        title: "Permission Denied",
        description: "Only the host can control recording",
        variant: "destructive"
      });
      return;
    }

    // Check consent requirements
    if (consentMode === 'explicit') {
      const consentGranted = await requestConsent();
      if (!consentGranted) return;
    }

    try {
      // Start backend recording
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionType: 'flagship_audio',
          recordingType: 'audio_only',
          retentionPolicy
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start recording');
      }

      const data = await response.json();
      
      // Setup local recording
      const recorder = await setupMediaRecorder();
      if (!recorder) return;

      recorder.start(1000); // Collect data every second

      setRecordingState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        status: 'recording',
        recordingId: data.data?.recordingId,
        startTime: new Date()
      });

      setAudioChunks([]);

      toast({
        title: "Recording Started",
        description: "Session recording is now active"
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Recording Failed",
        description: "Could not start recording",
        variant: "destructive"
      });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setRecordingState(prev => ({
        ...prev,
        isPaused: true,
        status: 'paused'
      }));

      toast({
        title: "Recording Paused",
        description: "Recording has been paused"
      });
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setRecordingState(prev => ({
        ...prev,
        isPaused: false,
        status: 'recording'
      }));

      toast({
        title: "Recording Resumed",
        description: "Recording has been resumed"
      });
    }
  };

  const stopRecording = async () => {
    try {
      setRecordingState(prev => ({
        ...prev,
        status: 'processing'
      }));

      // Stop backend recording
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Process local recording
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          
          // Upload to backend for processing
          const uploadData = new FormData();
          uploadData.append('audio', audioBlob, 'session-recording.webm');
          uploadData.append('recordingId', recordingState.recordingId || '');
          uploadData.append('duration', recordingState.duration.toString());

          const uploadResponse = await fetch(`/api/flagship-sanctuary/${sessionId}/recording/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
            },
            body: uploadData
          });

          if (uploadResponse.ok) {
            toast({
              title: "Recording Completed",
              description: `Recording saved successfully (${formatDuration(recordingState.duration)})`
            });
          }
        }
      }

      // Stop media recorder
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }

      setRecordingState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        status: 'completed'
      });

      setAudioChunks([]);
      setMediaRecorder(null);
      
      // Reload recordings list
      await loadRecordings();

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setRecordingState(prev => ({
        ...prev,
        status: 'error'
      }));
      
      toast({
        title: "Recording Error",
        description: "Failed to complete recording",
        variant: "destructive"
      });
    }
  };

  const downloadRecording = async (recording: any) => {
    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/recording/${recording.id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${recording.id}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download recording",
        variant: "destructive"
      });
    }
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getConsentStatus = () => {
    const total = participants.length;
    const consented = participants.filter(p => p.hasConsented).length;
    return { total, consented };
  };

  const consentStatus = getConsentStatus();

  if (!isEnabled && !isHost) {
    return (
      <Card className="opacity-60">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Recording not available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mic className="h-5 w-5" />
            <span>Session Recording</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={recordingState.isRecording ? "destructive" : "secondary"}>
              {recordingState.status}
            </Badge>
            {isHost && (
              <Switch
                checked={isEnabled}
                onCheckedChange={onToggleRecording}
                disabled={recordingState.isRecording}
              />
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recording Controls */}
        {isHost && (
          <div className="space-y-4">
            {/* Consent Status */}
            {consentMode === 'explicit' && (
              <div className="flex items-center justify-between p-3 bg-muted rounded">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">Participant Consent</span>
                </div>
                <Badge variant={consentStatus.consented === consentStatus.total ? "default" : "secondary"}>
                  {consentStatus.consented}/{consentStatus.total}
                </Badge>
              </div>
            )}

            {/* Recording Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Consent Mode</label>
                <Select value={consentMode} onValueChange={(value: any) => setConsentMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="explicit">Explicit Consent Required</SelectItem>
                    <SelectItem value="automatic">Automatic (Informed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Retention</label>
                <Select value={retentionPolicy} onValueChange={(value: any) => setRetentionPolicy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delete_after_session">Delete After Session</SelectItem>
                    <SelectItem value="7_days">Keep 7 Days</SelectItem>
                    <SelectItem value="30_days">Keep 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-center space-x-3">
              {!recordingState.isRecording ? (
                <Button
                  onClick={startRecording}
                  disabled={!isEnabled || recordingState.status === 'processing'}
                  className="flex items-center space-x-2"
                >
                  <Mic className="h-4 w-4" />
                  <span>Start Recording</span>
                </Button>
              ) : (
                <>
                  {recordingState.isPaused ? (
                    <Button onClick={resumeRecording} variant="outline">
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={pauseRecording} variant="outline">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  
                  <Button onClick={stopRecording} variant="destructive">
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>

            {/* Recording Status */}
            {recordingState.isRecording && (
              <div className="text-center p-4 bg-destructive/10 rounded">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="font-medium">
                    {recordingState.isPaused ? 'PAUSED' : 'RECORDING'}
                  </span>
                </div>
                <div className="text-2xl font-mono">
                  {formatDuration(recordingState.duration)}
                </div>
                {recordingState.size && (
                  <div className="text-sm text-muted-foreground">
                    {formatFileSize(recordingState.size)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recordings List */}
        {recordings.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Previous Recordings</span>
            </h4>
            
            {recordings.map((recording) => (
              <div key={recording.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">
                    {new Date(recording.startTime).toLocaleDateString()} - {formatDuration(recording.duration * 1000)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {recording.participantCount} participants • {recording.retentionPolicy.replace('_', ' ')}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant={recording.status === 'completed' ? 'default' : 'secondary'}>
                    {recording.status}
                  </Badge>
                  
                  {recording.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadRecording(recording)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Privacy Notice */}
        <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-yellow-800 dark:text-yellow-200">Privacy Notice</div>
            <div className="text-yellow-700 dark:text-yellow-300">
              Recordings are encrypted and stored securely. Participants can request deletion at any time.
              {retentionPolicy !== 'delete_after_session' && ` Data will be automatically deleted after ${retentionPolicy.replace('_', ' ')}.`}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};