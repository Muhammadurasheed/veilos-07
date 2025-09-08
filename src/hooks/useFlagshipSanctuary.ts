import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FlagshipSanctuaryApi } from '@/services/flagshipSanctuaryApi';
import type {
  FlagshipSanctuarySession,
  FlagshipParticipant,
  CreateFlagshipSanctuaryRequest,
  JoinFlagshipSanctuaryRequest,
  ElevenLabsVoice,
  ModerationActionRequest,
  EmergencyAlertRequest
} from '@/types/flagship-sanctuary';
import { io, Socket } from 'socket.io-client';

interface UseFlagshipSanctuaryOptions {
  sessionId?: string;
  autoJoin?: boolean;
  voiceModulation?: boolean;
  moderationEnabled?: boolean;
}

interface UseFlagshipSanctuaryReturn {
  // Session State
  session: FlagshipSanctuarySession | null;
  participants: FlagshipParticipant[];
  currentParticipant: FlagshipParticipant | null;
  isLoading: boolean;
  error: string | null;
  joinStatus: 'idle' | 'joining' | 'starting' | 'joined';
  
  // Connection State
  isConnected: boolean;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  
  // Audio State
  isMuted: boolean;
  isDeafened: boolean;
  audioLevel: number;
  isSpeaking: boolean;
  handRaised: boolean;
  
  // Voice Modulation
  availableVoices: ElevenLabsVoice[];
  selectedVoice: ElevenLabsVoice | null;
  voiceProcessingEnabled: boolean;
  
  // Session Management
  createSession: (data: CreateFlagshipSanctuaryRequest) => Promise<FlagshipSanctuarySession | null>;
  joinSession: (sessionId: string, data?: JoinFlagshipSanctuaryRequest) => Promise<boolean>;
  leaveSession: () => Promise<void>;
  
  // Audio Controls
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleHandRaise: () => void;
  startSpeaking: () => void;
  stopSpeaking: () => void;
  
  // Voice Modulation
  changeVoice: (voiceId: string, settings?: any) => Promise<void>;
  toggleVoiceModulation: () => void;
  
  // Interactions
  sendReaction: (emoji: string) => void;
  sendMessage: (content: string) => void;
  
  // Moderation (Host/Moderator only)
  muteParticipant: (participantId: string, reason?: string) => Promise<void>;
  kickParticipant: (participantId: string, reason: string) => Promise<void>;
  promoteToModerator: (participantId: string) => Promise<void>;
  sendEmergencyAlert: (data: EmergencyAlertRequest) => Promise<void>;
  
  // Analytics
  getSessionMetrics: () => Promise<any>;
  
  // Utilities
  refreshSession: () => Promise<void>;
  cleanup: () => void;
}

export const useFlagshipSanctuary = (options: UseFlagshipSanctuaryOptions = {}): UseFlagshipSanctuaryReturn => {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const joinRetryRef = useRef<number>(0);
  
  // Session State
  const [session, setSession] = useState<FlagshipSanctuarySession | null>(null);
  const [participants, setParticipants] = useState<FlagshipParticipant[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<FlagshipParticipant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  
  // Audio State
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  
  // Voice Modulation State
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoice | null>(null);
  const [voiceProcessingEnabled, setVoiceProcessingEnabled] = useState(false);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'starting' | 'joined'>('idle');
  
  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    if (socketRef.current) return;

    const token = localStorage.getItem('auth_token');
    const socket = io(import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? '' : 'http://localhost:3000'), {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('🔌 Flagship Sanctuary socket connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.log('🔌 Flagship Sanctuary socket disconnected');
    });

    socket.on('reconnect', () => {
      setConnectionStatus('connected');
      toast({
        title: 'Reconnected',
        description: 'Connection to sanctuary restored',
      });
    });

    socket.on('reconnecting', () => {
      setConnectionStatus('reconnecting');
    });

    // Sanctuary events
    socket.on('sanctuary:participant_joined', (data) => {
      setParticipants(prev => [...prev, data.participant]);
      toast({
        title: 'Participant Joined',
        description: `${data.participant.alias} joined the sanctuary`,
      });
    });

    socket.on('sanctuary:participant_left', (data) => {
      setParticipants(prev => prev.filter(p => p.id !== data.participantId));
      toast({
        title: 'Participant Left',
        description: `${data.alias} left the sanctuary`,
      });
    });

    socket.on('sanctuary:audio_state_changed', (data) => {
      setParticipants(prev => prev.map(p => 
        p.id === data.participantId 
          ? { ...p, isMuted: data.isMuted, audioLevel: data.audioLevel }
          : p
      ));
    });

    socket.on('sanctuary:hand_raised', (data) => {
      setParticipants(prev => prev.map(p => 
        p.id === data.participantId 
          ? { ...p, handRaised: data.isRaised }
          : p
      ));
      
      if (data.isRaised) {
        toast({
          title: 'Hand Raised',
          description: `${participants.find(p => p.id === data.participantId)?.alias} raised their hand`,
        });
      }
    });

    socket.on('sanctuary:voice_changed', (data) => {
      setParticipants(prev => prev.map(p => 
        p.id === data.participantId 
          ? { ...p, selectedVoiceId: data.voiceId }
          : p
      ));
    });

    socket.on('sanctuary:reaction_sent', (data) => {
      toast({
        title: `${data.emoji} Reaction`,
        description: `From ${participants.find(p => p.id === data.participantId)?.alias}`,
      });
    });

    socket.on('sanctuary:emergency_alert', (data) => {
      toast({
        title: '🚨 Emergency Alert',
        description: data.alert.message,
        variant: 'destructive',
      });
    });

    socket.on('sanctuary:moderation_flag', (data) => {
      if (currentParticipant?.isHost || currentParticipant?.isModerator) {
        toast({
          title: 'Moderation Alert',
          description: `${data.flag.type} detected - ${data.flag.severity} severity`,
          variant: 'destructive',
        });
      }
    });

    socket.on('sanctuary:session_ending', (data) => {
      toast({
        title: 'Session Ending',
        description: `This sanctuary will end in ${Math.floor(data.timeRemaining / 60)} minutes`,
        variant: 'destructive',
      });
    });
  }, [toast, participants, currentParticipant]);

  // Initialize audio context and monitoring
  const initializeAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      streamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      source.connect(analyserRef.current);
      
      // Start audio level monitoring
      monitorAudioLevel();
      
      console.log('🎤 Audio initialized successfully');
    } catch (error) {
      console.error('❌ Audio initialization failed:', error);
      setError('Microphone access is required for voice participation');
    }
  }, []);

  // Monitor audio levels for speaking detection
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkLevel = () => {
      if (analyserRef.current && !isMuted) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const level = Math.floor((average / 255) * 100);
        
        setAudioLevel(level);
        
        // Speaking detection threshold
        const wasSpeaking = isSpeaking;
        const isCurrentlySpeaking = level > 15; // Adjustable threshold
        
        if (isCurrentlySpeaking !== wasSpeaking) {
          setIsSpeaking(isCurrentlySpeaking);
          
          // Emit speaking events
          if (socketRef.current && session) {
            socketRef.current.emit('sanctuary:speaking_' + (isCurrentlySpeaking ? 'started' : 'ended'), {
              sessionId: session.id,
              participantId: currentParticipant?.id
            });
          }
        }
      }
      requestAnimationFrame(checkLevel);
    };
    
    checkLevel();
  }, [isMuted, isSpeaking, session, currentParticipant]);

  // Load available voices - memoized to prevent infinite loops
  const loadVoices = useCallback(async () => {
    if (!options.voiceModulation) return;
    
    try {
      const response = await FlagshipSanctuaryApi.getAvailableVoices();
      if (response.success && response.data) {
        // Handle response format - can be {voices: [...]} or direct array
        let voicesArray: ElevenLabsVoice[] = [];
        
        // Type-safe way to handle different response formats
        const data = response.data as any;
        if (Array.isArray(data)) {
          voicesArray = data;
        } else if (data && Array.isArray(data.voices)) {
          voicesArray = data.voices;
        }
        
        setAvailableVoices(voicesArray);
        if (voicesArray.length > 0) {
          setSelectedVoice(voicesArray[0]);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load voices:', error);
      // Set default voices to prevent infinite retries
      setAvailableVoices([]);
    }
  }, [options.voiceModulation]);

  // Initialize on mount - only run once
  useEffect(() => {
    initializeSocket();
    initializeAudio();
    // Don't load voices on mount to prevent the infinite loop
    
    return () => cleanup();
  }, []); // Empty dependency array to run only once

  // Load voices separately when voice modulation is enabled and we have a session
  useEffect(() => {
    if (options.voiceModulation && session?.id) {
      loadVoices();
    }
  }, [options.voiceModulation, session?.id, loadVoices]);

  // This will be moved after function declarations

  // Session Management Functions
  const loadSessionData = useCallback(async (sessionId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const sessionResponse = await FlagshipSanctuaryApi.getSession(sessionId);
      if (!sessionResponse.success || !sessionResponse.data) {
        throw new Error('Session not found');
      }
      
      setSession(sessionResponse.data);
      console.log('📋 Session data loaded successfully:', sessionResponse.data.status);
      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to load session';
      setError(errorMsg);
      console.error('❌ Failed to load session:', errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSession = useCallback(async (data: CreateFlagshipSanctuaryRequest): Promise<FlagshipSanctuarySession | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await FlagshipSanctuaryApi.createSession(data);
      if (response.success && response.data) {
        setSession(response.data);
        toast({
          title: 'Sanctuary Created',
          description: `"${response.data.topic}" is ready for participants`,
        });
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create session');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to create sanctuary';
      setError(errorMsg);
      toast({
        title: 'Creation Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Load session data when sessionId is provided
  useEffect(() => {
    if (options.sessionId && !session && !isLoading) {
      console.log('🔄 Loading session data for:', options.sessionId);
      loadSessionData(options.sessionId);
    }
  }, [options.sessionId, session, isLoading, loadSessionData]);

  const joinSession = useCallback(async (sessionId: string, data?: JoinFlagshipSanctuaryRequest): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setJoinStatus('joining');

    try {
      // Always refresh latest session state
      const sessionResponse = await FlagshipSanctuaryApi.getSession(sessionId);
      if (!sessionResponse.success || !sessionResponse.data) {
        throw new Error('Session not found');
      }
      setSession(sessionResponse.data);

      // Attempt to join
      const joinResponse = await FlagshipSanctuaryApi.joinSession(sessionId, data || {});

      // Pending/startup state from backend (e.g., 202) often returns success=false with a message
      const pendingMsg = (joinResponse.message || joinResponse.error || '').toLowerCase();
      const isPending = joinResponse.success === false && (pendingMsg.includes('starting') || pendingMsg.includes('please wait'));
      if (isPending) {
        // Do NOT surface as an error – keep user in waiting state and retry
        setJoinStatus('starting');
        if (joinRetryRef.current === 0) {
          toast({
            title: 'Session is starting',
            description: 'Please wait a moment, auto-joining shortly…',
          });
        }
        joinRetryRef.current += 1;
        const delay = Math.min(5000, 1000 + joinRetryRef.current * 500);
        setTimeout(() => {
          // Fire and forget; state updates handled in subsequent success
          joinSession(sessionId, data);
        }, delay);
        return false;
      }

      if (!joinResponse.success || !joinResponse.data) {
        throw new Error(joinResponse.error || joinResponse.message || 'Failed to join session');
      }

      // Success
      joinRetryRef.current = 0;
      setJoinStatus('joined');
      setCurrentParticipant(joinResponse.data.participant);
      const baseParticipants = sessionResponse.data.participants || [];
      const alreadyIncluded = baseParticipants.some((p: any) => p.id === joinResponse.data.participant.id);
      setParticipants(alreadyIncluded ? baseParticipants : [...baseParticipants, joinResponse.data.participant]);

      if (socketRef.current) {
        socketRef.current.emit('sanctuary:join', {
          sessionId,
          participant: joinResponse.data.participant
        });
      }

      toast({
        title: 'Joined Successfully',
        description: `Welcome to "${sessionResponse.data.topic}"`,
      });

      return true;
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to join sanctuary';
      setJoinStatus('idle');
      setError(errorMsg);
      toast({
        title: 'Join Failed',
        description: errorMsg,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast, joinRetryRef]);

  const leaveSession = useCallback(async (): Promise<void> => {
    if (!session || !currentParticipant) {
      console.log('❌ Cannot leave: No session or participant data');
      // Still clear local state and redirect
      setSession(null);
      setCurrentParticipant(null);
      setJoinStatus('idle');
      setParticipants([]);
      return;
    }

    console.log('🚪 Leaving session:', session.id);
    setIsLoading(true);

    try {
      // Clear local state immediately to prevent stuck loading
      const sessionId = session.id;
      setSession(null);
      setCurrentParticipant(null);
      setJoinStatus('idle');
      setParticipants([]);
      
      // Leave socket room
      if (socketRef.current) {
        socketRef.current.emit('sanctuary:leave', {
          sessionId,
          participantId: currentParticipant.id
        });
      }
      
      // Make API call in background
      await FlagshipSanctuaryApi.leaveSession(sessionId);
      
      console.log('✅ Successfully left session');
      
      toast({
        title: 'Left Successfully',
        description: 'You have left the sanctuary session',
      });
    } catch (error: any) {
      console.error('❌ Failed to leave session:', error);
      // Don't show error toast for leave failures - user is already gone
    } finally {
      setIsLoading(false);
    }
  }, [session, currentParticipant, toast]);

  // Audio Control Functions
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        
        // Emit to socket
        if (socketRef.current && session && currentParticipant) {
          socketRef.current.emit('sanctuary:audio_state_changed', {
            sessionId: session.id,
            participantId: currentParticipant.id,
            isMuted: !isMuted,
            audioLevel: isMuted ? 0 : audioLevel
          });
        }
        
        toast({
          title: isMuted ? 'Unmuted' : 'Muted',
          description: isMuted ? 'You can now speak' : 'Your microphone is muted',
        });
      }
    }
  }, [isMuted, audioLevel, session, currentParticipant, toast]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened(!isDeafened);
    // TODO: Implement actual audio output control
    toast({
      title: isDeafened ? 'Audio Enabled' : 'Audio Disabled',
      description: isDeafened ? 'You can now hear others' : 'Audio from others is disabled',
    });
  }, [isDeafened, toast]);

  const toggleHandRaise = useCallback(() => {
    if (!session || !currentParticipant) return;
    
    const newState = !handRaised;
    setHandRaised(newState);
    
    if (socketRef.current) {
      socketRef.current.emit('sanctuary:hand_raised', {
        sessionId: session.id,
        participantId: currentParticipant.id,
        isRaised: newState
      });
    }
    
    toast({
      title: newState ? 'Hand Raised' : 'Hand Lowered',
      description: newState ? 'The host will be notified' : 'Your hand has been lowered',
    });
  }, [handRaised, session, currentParticipant, toast]);

  const startSpeaking = useCallback(() => {
    if (isMuted) return;
    setIsSpeaking(true);
    
    if (socketRef.current && session && currentParticipant) {
      socketRef.current.emit('sanctuary:speaking_started', {
        sessionId: session.id,
        participantId: currentParticipant.id
      });
    }
  }, [isMuted, session, currentParticipant]);

  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
    
    if (socketRef.current && session && currentParticipant) {
      socketRef.current.emit('sanctuary:speaking_ended', {
        sessionId: session.id,
        participantId: currentParticipant.id
      });
    }
  }, [session, currentParticipant]);

  // Voice Modulation Functions
  const changeVoice = useCallback(async (voiceId: string, settings?: any): Promise<void> => {
    if (!session || !currentParticipant) return;
    
    try {
      await FlagshipSanctuaryApi.updateVoice(session.id, { voiceId, settings });
      
      const newVoice = availableVoices.find(v => v.voiceId === voiceId);
      setSelectedVoice(newVoice || null);
      
      if (socketRef.current) {
        socketRef.current.emit('sanctuary:voice_changed', {
          sessionId: session.id,
          participantId: currentParticipant.id,
          voiceId
        });
      }
      
      toast({
        title: 'Voice Changed',
        description: `Now using ${newVoice?.name || 'new voice'}`,
      });
    } catch (error: any) {
      toast({
        title: 'Voice Change Failed',
        description: error.message || 'Failed to change voice',
        variant: 'destructive',
      });
    }
  }, [session, currentParticipant, availableVoices, toast]);

  const toggleVoiceModulation = useCallback(() => {
    setVoiceProcessingEnabled(!voiceProcessingEnabled);
    toast({
      title: voiceProcessingEnabled ? 'Voice Modulation Disabled' : 'Voice Modulation Enabled',
      description: voiceProcessingEnabled ? 'Using original voice' : 'Voice will be processed',
    });
  }, [voiceProcessingEnabled, toast]);

  // Interaction Functions
  const sendReaction = useCallback((emoji: string) => {
    if (!session || !currentParticipant) return;
    
    FlagshipSanctuaryApi.sendReaction(session.id, { emoji });
    
    if (socketRef.current) {
      socketRef.current.emit('sanctuary:reaction_sent', {
        sessionId: session.id,
        participantId: currentParticipant.id,
        emoji,
        timestamp: new Date().toISOString()
      });
    }
  }, [session, currentParticipant]);

  const sendMessage = useCallback((content: string) => {
    if (!session || !currentParticipant) return;
    
    FlagshipSanctuaryApi.sendMessage(session.id, content);
    
    if (socketRef.current) {
      socketRef.current.emit('sanctuary:message_sent', {
        sessionId: session.id,
        participantId: currentParticipant.id,
        content,
        timestamp: new Date().toISOString()
      });
    }
  }, [session, currentParticipant]);

  // Moderation Functions
  const muteParticipant = useCallback(async (participantId: string, reason?: string): Promise<void> => {
    if (!session || !currentParticipant?.isHost) return;
    
    try {
      await FlagshipSanctuaryApi.performModerationAction(session.id, {
        targetParticipantId: participantId,
        action: 'mute',
        reason: reason || 'Muted by host'
      });
      
      toast({
        title: 'Participant Muted',
        description: 'Participant has been muted',
      });
    } catch (error: any) {
      toast({
        title: 'Moderation Failed',
        description: error.message || 'Failed to mute participant',
        variant: 'destructive',
      });
    }
  }, [session, currentParticipant, toast]);

  const kickParticipant = useCallback(async (participantId: string, reason: string): Promise<void> => {
    if (!session || !currentParticipant?.isHost) return;
    
    try {
      await FlagshipSanctuaryApi.performModerationAction(session.id, {
        targetParticipantId: participantId,
        action: 'kick',
        reason
      });
      
      toast({
        title: 'Participant Removed',
        description: 'Participant has been removed from the sanctuary',
      });
    } catch (error: any) {
      toast({
        title: 'Moderation Failed',
        description: error.message || 'Failed to remove participant',
        variant: 'destructive',
      });
    }
  }, [session, currentParticipant, toast]);

  const promoteToModerator = useCallback(async (participantId: string): Promise<void> => {
    if (!session || !currentParticipant?.isHost) return;
    
    try {
      // Implementation would depend on backend API
      toast({
        title: 'Participant Promoted',
        description: 'Participant has been promoted to moderator',
      });
    } catch (error: any) {
      toast({
        title: 'Promotion Failed',
        description: error.message || 'Failed to promote participant',
        variant: 'destructive',
      });
    }
  }, [session, currentParticipant, toast]);

  const sendEmergencyAlert = useCallback(async (data: EmergencyAlertRequest): Promise<void> => {
    if (!session) return;
    
    try {
      await FlagshipSanctuaryApi.sendEmergencyAlert(session.id, data);
      
      toast({
        title: 'Emergency Alert Sent',
        description: 'Emergency services have been notified',
        variant: 'destructive',
      });
    } catch (error: any) {
      toast({
        title: 'Emergency Alert Failed',
        description: error.message || 'Failed to send emergency alert',
        variant: 'destructive',
      });
    }
  }, [session, toast]);

  // Analytics Functions
  const getSessionMetrics = useCallback(async () => {
    if (!session) return null;
    
    try {
      const response = await FlagshipSanctuaryApi.getSessionAnalytics(session.id);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get session metrics:', error);
      return null;
    }
  }, [session]);

  // Utility Functions
  const refreshSession = useCallback(async (): Promise<void> => {
    if (!session) return;
    
    try {
      const response = await FlagshipSanctuaryApi.getSession(session.id);
      if (response.success && response.data) {
        setSession(response.data);
        setParticipants(response.data.participants || []);
      }
    } catch (error) {
      console.error('❌ Failed to refresh session:', error);
    }
  }, [session]);

  const cleanup = useCallback(() => {
    // Close socket connection
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Stop audio streams
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Reset state
    setSession(null);
    setParticipants([]);
    setCurrentParticipant(null);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setJoinStatus('idle');
  }, []);

  return {
    // Session State
    session,
    participants,
    currentParticipant,
    isLoading,
    error,
    joinStatus,
    
    // Connection State
    isConnected,
    networkQuality,
    connectionStatus,
    
    // Audio State
    isMuted,
    isDeafened,
    audioLevel,
    isSpeaking,
    handRaised,
    
    // Voice Modulation
    availableVoices,
    selectedVoice,
    voiceProcessingEnabled,
    
    // Session Management
    createSession,
    joinSession,
    leaveSession,
    
    // Audio Controls
    toggleMute,
    toggleDeafen,
    toggleHandRaise,
    startSpeaking,
    stopSpeaking,
    
    // Voice Modulation
    changeVoice,
    toggleVoiceModulation,
    
    // Interactions
    sendReaction,
    sendMessage,
    
    // Moderation
    muteParticipant,
    kickParticipant,
    promoteToModerator,
    sendEmergencyAlert,
    
    // Analytics
    getSessionMetrics,
    
    // Utilities
    refreshSession,
    cleanup
  };
};