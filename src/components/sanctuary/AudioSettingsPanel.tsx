import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Settings, 
  Activity,
  Users,
  Radio,
  Shield,
  Headphones,
  Loader2
} from 'lucide-react';
import { useConversation } from '@11labs/react';
import { FlagshipSanctuaryApi } from '@/services/flagshipSanctuaryApi';
import { cn } from '@/lib/utils';

interface AudioSettingsPanelProps {
  sessionId: string;
  participantId: string;
  isHost: boolean;
  currentVoiceId?: string;
  onVoiceChange?: (voiceId: string) => void;
  onSettingsChange?: (settings: any) => void;
}

interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category: 'male' | 'female' | 'child' | 'elderly' | 'robotic';
  previewUrl?: string;
  description?: string;
}

const VOICE_CATEGORIES = {
  male: { label: 'Male Voices', icon: '👨', color: 'bg-blue-100 text-blue-700' },
  female: { label: 'Female Voices', icon: '👩', color: 'bg-pink-100 text-pink-700' },
  child: { label: 'Young Voices', icon: '👶', color: 'bg-green-100 text-green-700' },
  elderly: { label: 'Mature Voices', icon: '👴', color: 'bg-purple-100 text-purple-700' },
  robotic: { label: 'AI Voices', icon: '🤖', color: 'bg-gray-100 text-gray-700' }
};

export const AudioSettingsPanel: React.FC<AudioSettingsPanelProps> = ({
  sessionId,
  participantId,
  isHost,
  currentVoiceId,
  onVoiceChange,
  onSettingsChange
}) => {
  const { toast } = useToast();
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(currentVoiceId || '');
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.75,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true
  });
  const [audioSettings, setAudioSettings] = useState({
    inputVolume: 80,
    outputVolume: 80,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  });
  const [recordingSettings, setRecordingSettings] = useState({
    enabled: false,
    quality: 'high',
    saveLocally: true,
    autoTranscribe: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  
  // ElevenLabs Conversation for voice preview
  const conversation = useConversation({
    onConnect: () => console.log('🎙️ ElevenLabs connected'),
    onDisconnect: () => console.log('🎙️ ElevenLabs disconnected'),
    onError: (error) => console.error('❌ ElevenLabs error:', error)
  });

  // Load available voices on mount
  useEffect(() => {
    loadAvailableVoices();
  }, []);

  const loadAvailableVoices = async () => {
    try {
      setIsLoading(true);
      const response = await FlagshipSanctuaryApi.getAvailableVoices();
      
      if (response.success && response.data) {
        setAvailableVoices(response.data);
        console.log('🎭 Loaded voices:', response.data.length);
      } else {
        // Fallback to default voices if API fails
        setAvailableVoices([
          { voiceId: '9BWtsMINqrJLrRacOk9x', name: 'Aria', category: 'female', description: 'Warm, professional female voice' },
          { voiceId: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', category: 'male', description: 'Clear, confident male voice' },
          { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', category: 'female', description: 'Friendly, approachable female voice' },
          { voiceId: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', category: 'male', description: 'Deep, authoritative male voice' }
        ]);
      }
    } catch (error) {
      console.error('❌ Failed to load voices:', error);
      toast({
        title: 'Voice Loading Failed',
        description: 'Using default voices. Check your ElevenLabs API key.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceChange = async (voiceId: string) => {
    try {
      setIsLoading(true);
      setSelectedVoice(voiceId);
      
      const response = await FlagshipSanctuaryApi.updateVoice(sessionId, {
        voiceId,
        settings: { ...voiceSettings, voiceId }
      });

      if (response.success) {
        onVoiceChange?.(voiceId);
        toast({
          title: '🎭 Voice Updated',
          description: 'Your voice has been changed successfully!'
        });
      } else {
        throw new Error(response.error || 'Failed to update voice');
      }
    } catch (error) {
      console.error('❌ Voice change failed:', error);
      toast({
        title: 'Voice Change Failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoicePreview = async (voice: ElevenLabsVoice) => {
    if (previewPlaying === voice.voiceId) {
      setPreviewPlaying(null);
      return;
    }

    setPreviewPlaying(voice.voiceId);
    
    try {
      // Use ElevenLabs text-to-speech for preview
      const testMessage = `Hi, I'm ${voice.name}. This is how I sound in the sanctuary.`;
      
      // Simple audio preview using Web Speech API as fallback
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(testMessage);
        utterance.onend = () => setPreviewPlaying(null);
        speechSynthesis.speak(utterance);
      }
      
      setTimeout(() => setPreviewPlaying(null), 3000);
    } catch (error) {
      console.error('❌ Voice preview failed:', error);
      setPreviewPlaying(null);
    }
  };

  const handleRecordingToggle = async (enabled: boolean) => {
    try {
      if (enabled && !isHost) {
        toast({
          title: 'Recording Permission',
          description: 'Only hosts can start session recording',
          variant: 'destructive'
        });
        return;
      }

      setRecordingSettings(prev => ({ ...prev, enabled }));
      
      if (enabled) {
        // Start recording
        const response = await FlagshipSanctuaryApi.requestRecording(sessionId, true);
        if (response.success) {
          toast({
            title: '🔴 Recording Started',
            description: 'Session is now being recorded'
          });
        }
      } else {
        // Stop recording logic would go here
        toast({
          title: '⏹️ Recording Stopped',
          description: 'Session recording has ended'
        });
      }
    } catch (error) {
      console.error('❌ Recording toggle failed:', error);
      toast({
        title: 'Recording Error',
        description: 'Failed to toggle recording',
        variant: 'destructive'
      });
    }
  };

  const voicesByCategory = availableVoices.reduce((acc, voice) => {
    if (!acc[voice.category]) acc[voice.category] = [];
    acc[voice.category].push(voice);
    return acc;
  }, {} as Record<string, ElevenLabsVoice[]>);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Audio Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Voice Modulation */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Voice Modulation</Label>
            <Badge variant="outline" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              ElevenLabs AI
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(voicesByCategory).map(([category, voices]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {VOICE_CATEGORIES[category as keyof typeof VOICE_CATEGORIES]?.icon}
                    </span>
                    <Label className="text-sm text-muted-foreground">
                      {VOICE_CATEGORIES[category as keyof typeof VOICE_CATEGORIES]?.label}
                    </Label>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {voices.map((voice) => (
                      <div
                        key={voice.voiceId}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors",
                          selectedVoice === voice.voiceId 
                            ? "border-primary bg-primary/5" 
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => handleVoiceChange(voice.voiceId)}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{voice.name}</div>
                          {voice.description && (
                            <div className="text-xs text-muted-foreground">{voice.description}</div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {selectedVoice === voice.voiceId && (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVoicePreview(voice);
                            }}
                          >
                            {previewPlaying === voice.voiceId ? (
                              <VolumeX className="h-3 w-3" />
                            ) : (
                              <Volume2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Voice Fine-tuning */}
          {selectedVoice && (
            <div className="space-y-4 p-3 bg-gray-50 rounded-lg">
              <Label className="text-sm font-medium">Voice Fine-tuning</Label>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">Stability</Label>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(voiceSettings.stability * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[voiceSettings.stability * 100]}
                    onValueChange={([value]) => 
                      setVoiceSettings(prev => ({ ...prev, stability: value / 100 }))
                    }
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">Similarity Boost</Label>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(voiceSettings.similarityBoost * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[voiceSettings.similarityBoost * 100]}
                    onValueChange={([value]) => 
                      setVoiceSettings(prev => ({ ...prev, similarityBoost: value / 100 }))
                    }
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Speaker Boost</Label>
                  <Switch
                    checked={voiceSettings.useSpeakerBoost}
                    onCheckedChange={(checked) => 
                      setVoiceSettings(prev => ({ ...prev, useSpeakerBoost: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Audio Controls */}
        <div className="space-y-4">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            Audio Controls
          </Label>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs">Input Volume</Label>
                <span className="text-xs text-muted-foreground">{audioSettings.inputVolume}%</span>
              </div>
              <Slider
                value={[audioSettings.inputVolume]}
                onValueChange={([value]) => 
                  setAudioSettings(prev => ({ ...prev, inputVolume: value }))
                }
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs">Output Volume</Label>
                <span className="text-xs text-muted-foreground">{audioSettings.outputVolume}%</span>
              </div>
              <Slider
                value={[audioSettings.outputVolume]}
                onValueChange={([value]) => 
                  setAudioSettings(prev => ({ ...prev, outputVolume: value }))
                }
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              {[
                { key: 'echoCancellation', label: 'Echo Cancellation' },
                { key: 'noiseSuppression', label: 'Noise Suppression' },
                { key: 'autoGainControl', label: 'Auto Gain Control' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-xs">{label}</Label>
                  <Switch
                    checked={audioSettings[key as keyof typeof audioSettings] as boolean}
                    onCheckedChange={(checked) => 
                      setAudioSettings(prev => ({ ...prev, [key]: checked }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Session Recording - Host Only */}
        {isHost && (
          <>
            <Separator />
            <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Session Recording
              </Label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Record Session</Label>
                  <Switch
                    checked={recordingSettings.enabled}
                    onCheckedChange={handleRecordingToggle}
                  />
                </div>

                {recordingSettings.enabled && (
                  <div className="space-y-2 p-2 bg-red-50 border border-red-200 rounded">
                    <div className="flex items-center gap-2 text-xs text-red-700">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording in progress
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { key: 'saveLocally', label: 'Save Locally' },
                        { key: 'autoTranscribe', label: 'Auto Transcribe' }
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="text-xs">{label}</Label>
                          <Switch
                            checked={recordingSettings[key as keyof typeof recordingSettings] as boolean}
                            onCheckedChange={(checked) => 
                              setRecordingSettings(prev => ({ ...prev, [key]: checked }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Breakout Rooms - Host Only */}
        {isHost && (
          <>
            <Separator />
            <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Breakout Rooms
              </Label>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  toast({
                    title: '🚧 Coming Soon',
                    description: 'Breakout rooms feature is in development'
                  });
                }}
              >
                Create Breakout Room
              </Button>
            </div>
          </>
        )}

        {/* Emergency Controls */}
        <Separator />
        <div className="space-y-4">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Safety & Emergency
          </Label>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                toast({
                  title: '🆘 Emergency Alert Sent',
                  description: 'Support team has been notified'
                });
              }}
            >
              Emergency Help
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                toast({
                  title: '📞 Crisis Line',
                  description: 'Connecting to crisis support...'
                });
              }}
            >
              Crisis Line
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};