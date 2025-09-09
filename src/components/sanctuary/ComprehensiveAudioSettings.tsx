import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Settings, 
  Mic, 
  Volume2, 
  Headphones,
  Users,
  Video,
  Play,
  Square,
  Shield,
  Waves,
  User,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Voice {
  id: string;
  name: string;
  gender: string;
  description: string;
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

interface ComprehensiveAudioSettingsProps {
  sessionId: string;
  currentUser: {
    id: string;
    alias: string;
    isHost?: boolean;
  };
  onVoiceChange?: (voiceId: string) => void;
  onRecordingToggle?: (enabled: boolean) => void;
  onBreakoutRoomCreate?: (name: string) => void;
}

const ComprehensiveAudioSettings = ({
  sessionId,
  currentUser,
  onVoiceChange,
  onRecordingToggle,
  onBreakoutRoomCreate
}: ComprehensiveAudioSettingsProps) => {
  const { toast } = useToast();
  
  // Audio settings states
  const [volume, setVolume] = useState(80);
  const [micSensitivity, setMicSensitivity] = useState(70);
  const [noiseSupression, setNoiseSupression] = useState(true);
  const [echoCancel, setEchoCancel] = useState(true);
  const [autoGain, setAutoGain] = useState(true);
  
  // Device states
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState('');
  const [selectedOutput, setSelectedOutput] = useState('');
  
  // Voice modulation states
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voiceStability, setVoiceStability] = useState([0.7]);
  const [voiceClarity, setVoiceClarity] = useState([0.8]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  
  // Recording states
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [recordingQuality, setRecordingQuality] = useState('high');
  
  // Breakout room states
  const [breakoutRooms, setBreakoutRooms] = useState<Array<{id: string, name: string, participants: number}>>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  // Load audio devices
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDeviceList: AudioDevice[] = devices
          .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `${device.kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${device.deviceId.slice(0, 4)}`,
            kind: device.kind as 'audioinput' | 'audiooutput'
          }));

        setAudioDevices(audioDeviceList);
        
        const defaultInput = audioDeviceList.find(d => d.kind === 'audioinput');
        const defaultOutput = audioDeviceList.find(d => d.kind === 'audiooutput');
        
        if (defaultInput) setSelectedInput(defaultInput.deviceId);
        if (defaultOutput) setSelectedOutput(defaultOutput.deviceId);

      } catch (error) {
        console.error('Failed to load audio devices:', error);
        toast({
          title: "Audio Device Error",
          description: "Unable to access audio devices. Please check permissions.",
          variant: "destructive"
        });
      }
    };

    loadAudioDevices();
  }, [toast]);

  // Load available voices
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await fetch(`/api/flagship-sanctuary/voices`, {
          headers: {
            'x-auth-token': localStorage.getItem('veilo-auth-token') || ''
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setAvailableVoices(data.data);
          }
        }
      } catch (error) {
        console.error('Failed to load voices:', error);
      }
    };

    loadVoices();
  }, []);

  const handleVoicePreview = async (voiceId: string) => {
    if (previewPlaying) return;
    
    setPreviewPlaying(true);
    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/voice-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': localStorage.getItem('veilo-auth-token') || ''
        },
        body: JSON.stringify({ 
          voiceId, 
          text: "Hello, this is how your voice will sound in the sanctuary."
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.audioPreview) {
          const audio = new Audio(`data:audio/mpeg;base64,${data.data.audioPreview}`);
          audio.play();
          
          audio.onended = () => setPreviewPlaying(false);
          audio.onerror = () => setPreviewPlaying(false);
        }
      }
    } catch (error) {
      console.error('Voice preview failed:', error);
      setPreviewPlaying(false);
      toast({
        title: "Preview Failed",
        description: "Could not play voice preview",
        variant: "destructive"
      });
    }
  };

  const handleVoiceToggle = async (enabled: boolean) => {
    setVoiceEnabled(enabled);
    
    if (enabled && selectedVoice) {
      try {
        const response = await fetch(`/api/flagship-sanctuary/${sessionId}/voice-modulation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': localStorage.getItem('veilo-auth-token') || ''
          },
          body: JSON.stringify({
            voiceId: selectedVoice,
            settings: {
              stability: voiceStability[0],
              similarityBoost: voiceClarity[0]
            }
          })
        });

        if (response.ok) {
          onVoiceChange?.(selectedVoice);
          toast({
            title: "Voice Modulation Enabled",
            description: "Your voice will now be modulated in real-time"
          });
        }
      } catch (error) {
        console.error('Voice modulation failed:', error);
        setVoiceEnabled(false);
        toast({
          title: "Voice Modulation Failed",
          description: "Could not enable voice modulation",
          variant: "destructive"
        });
      }
    } else {
      onVoiceChange?.('');
      toast({
        title: "Voice Modulation Disabled",
        description: "Using your natural voice"
      });
    }
  };

  const handleRecordingToggle = (enabled: boolean) => {
    setRecordingEnabled(enabled);
    onRecordingToggle?.(enabled);
    
    toast({
      title: enabled ? "Recording Started" : "Recording Stopped",
      description: enabled ? "Session is now being recorded" : "Recording has been stopped"
    });
  };

  const createBreakoutRoom = () => {
    if (!newRoomName.trim()) {
      toast({
        title: "Room Name Required",
        description: "Please enter a name for the breakout room",
        variant: "destructive"
      });
      return;
    }

    const roomId = `room_${Date.now()}`;
    const newRoom = {
      id: roomId,
      name: newRoomName.trim(),
      participants: 0
    };

    setBreakoutRooms(prev => [...prev, newRoom]);
    setNewRoomName('');
    onBreakoutRoomCreate?.(newRoom.name);

    toast({
      title: "Breakout Room Created",
      description: `Room "${newRoom.name}" is now available`
    });
  };

  const inputDevices = audioDevices.filter(d => d.kind === 'audioinput');
  const outputDevices = audioDevices.filter(d => d.kind === 'audiooutput');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Advanced Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Comprehensive Audio Settings
          </DialogTitle>
          <DialogDescription>
            Configure your complete sanctuary experience - audio, voice, recording, and collaboration
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="audio" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="voice">Voice Mod</TabsTrigger>
            <TabsTrigger value="recording">Recording</TabsTrigger>
            <TabsTrigger value="breakout">Breakouts</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Audio Settings Tab */}
          <TabsContent value="audio" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Volume Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <Volume2 className="h-4 w-4 mr-2" />
                    Volume Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Master Volume</Label>
                      <Badge variant="outline">{volume}%</Badge>
                    </div>
                    <Slider
                      value={[volume]}
                      onValueChange={(value) => setVolume(value[0])}
                      max={100}
                      min={0}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Microphone Sensitivity</Label>
                      <Badge variant="outline">{micSensitivity}%</Badge>
                    </div>
                    <Slider
                      value={[micSensitivity]}
                      onValueChange={(value) => setMicSensitivity(value[0])}
                      max={100}
                      min={0}
                      step={5}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Audio Devices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <Headphones className="h-4 w-4 mr-2" />
                    Audio Devices
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center">
                      <Mic className="h-3 w-3 mr-1" />
                      Microphone
                    </Label>
                    <Select value={selectedInput} onValueChange={setSelectedInput}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select microphone" />
                      </SelectTrigger>
                      <SelectContent>
                        {inputDevices.map(device => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center">
                      <Headphones className="h-3 w-3 mr-1" />
                      Speaker/Headphones
                    </Label>
                    <Select value={selectedOutput} onValueChange={setSelectedOutput}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select output device" />
                      </SelectTrigger>
                      <SelectContent>
                        {outputDevices.map(device => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Audio Enhancement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  Audio Enhancement
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="noise-suppression">Noise Suppression</Label>
                  <Switch
                    id="noise-suppression"
                    checked={noiseSupression}
                    onCheckedChange={setNoiseSupression}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="echo-cancel">Echo Cancellation</Label>
                  <Switch
                    id="echo-cancel"
                    checked={echoCancel}
                    onCheckedChange={setEchoCancel}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-gain">Auto Gain Control</Label>
                  <Switch
                    id="auto-gain"
                    checked={autoGain}
                    onCheckedChange={setAutoGain}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice Modulation Tab */}
          <TabsContent value="voice" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Voice Modulation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="voice-enabled">Enable Voice Modulation</Label>
                  <Switch
                    id="voice-enabled"
                    checked={voiceEnabled}
                    onCheckedChange={handleVoiceToggle}
                  />
                </div>

                {voiceEnabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Select Voice</Label>
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVoices.map(voice => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <div className="flex items-center space-x-2">
                                <span>{voice.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {voice.gender}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedVoice && (
                      <Button 
                        variant="outline" 
                        onClick={() => handleVoicePreview(selectedVoice)}
                        disabled={previewPlaying}
                        className="w-full"
                      >
                        {previewPlaying ? (
                          <>
                            <Square className="h-4 w-4 mr-2" />
                            Playing Preview...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Preview Voice
                          </>
                        )}
                      </Button>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Voice Stability</Label>
                          <Badge variant="outline">{voiceStability[0]}</Badge>
                        </div>
                        <Slider
                          value={voiceStability}
                          onValueChange={setVoiceStability}
                          max={1}
                          min={0}
                          step={0.1}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Voice Clarity</Label>
                          <Badge variant="outline">{voiceClarity[0]}</Badge>
                        </div>
                        <Slider
                          value={voiceClarity}
                          onValueChange={setVoiceClarity}
                          max={1}
                          min={0}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recording Tab */}
          <TabsContent value="recording" className="space-y-4">
            {currentUser.isHost && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <Video className="h-4 w-4 mr-2" />
                    Session Recording
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="recording-enabled">Record This Session</Label>
                    <Switch
                      id="recording-enabled"
                      checked={recordingEnabled}
                      onCheckedChange={handleRecordingToggle}
                    />
                  </div>

                  {recordingEnabled && (
                    <div className="space-y-2">
                      <Label>Recording Quality</Label>
                      <Select value={recordingQuality} onValueChange={setRecordingQuality}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High Quality (48kHz)</SelectItem>
                          <SelectItem value="medium">Medium Quality (44.1kHz)</SelectItem>
                          <SelectItem value="low">Low Quality (22kHz)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-700">
                      <strong>Notice:</strong> Recording will capture all audio and chat messages. 
                      Participants will be notified when recording starts.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Breakout Rooms Tab */}
          <TabsContent value="breakout" className="space-y-4">
            {currentUser.isHost && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Create Breakout Room
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Room name"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md"
                      />
                      <Button onClick={createBreakoutRoom}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {breakoutRooms.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Active Breakout Rooms</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {breakoutRooms.map(room => (
                        <div key={room.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <div>
                            <span className="font-medium">{room.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {room.participants} participants
                            </span>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedRoom(room)}
                          >
                            Manage
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Advanced Settings Tab */}
          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Waves className="h-4 w-4 mr-2" />
                  Advanced Audio Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Performance Tips</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Use wired headphones for best audio quality</li>
                    <li>• Close other applications to reduce CPU load</li>
                    <li>• Enable noise suppression in noisy environments</li>
                    <li>• Test your voice modulation before the session</li>
                    <li>• Record only when necessary to preserve bandwidth</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ComprehensiveAudioSettings;