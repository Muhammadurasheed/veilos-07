import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Plus, 
  Settings, 
  Lock, 
  Unlock,
  MessageSquare, 
  Volume2, 
  Clock,
  X,
  ArrowRight,
  Loader2,
  UserPlus,
  UserMinus,
  Edit3,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BreakoutRoom {
  id: string;
  name: string;
  topic?: string;
  currentParticipants: number;
  maxParticipants: number;
  isPrivate: boolean;
  createdAt: string;
  creatorAlias: string;
  participants: Array<{
    id: string;
    alias: string;
    avatarIndex: number;
    joinedAt: string;
  }>;
  canJoin: boolean;
}

interface WorkingBreakoutRoomManagerProps {
  sessionId: string;
  isHost: boolean;
  authToken: string;
  onJoinRoom?: (roomId: string) => void;
}

interface CreateRoomData {
  name: string;
  topic: string;
  description: string;
  maxParticipants: number;
  isPrivate: boolean;
  requiresApproval: boolean;
}

export const WorkingBreakoutRoomManager = ({ 
  sessionId, 
  isHost, 
  authToken,
  onJoinRoom 
}: WorkingBreakoutRoomManagerProps) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<BreakoutRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<BreakoutRoom | null>(null);
  
  const [createData, setCreateData] = useState<CreateRoomData>({
    name: '',
    topic: '',
    description: '',
    maxParticipants: 8,
    isPrivate: false,
    requiresApproval: false
  });

  // Fetch breakout rooms
  const fetchRooms = useCallback(async () => {
    if (!sessionId || !authToken) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/breakout-rooms`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setRooms(data.data.rooms || []);
      } else {
        throw new Error(data.error || 'Failed to fetch rooms');
      }
    } catch (error) {
      console.error('Fetch rooms error:', error);
      toast({
        title: "Failed to load breakout rooms",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId, authToken, toast]);

  // Create breakout room
  const createRoom = useCallback(async () => {
    if (!createData.name.trim()) {
      toast({
        title: "Room name required",
        description: "Please enter a name for the breakout room",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/breakout-rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: createData.name.trim(),
          topic: createData.topic.trim() || undefined,
          description: createData.description.trim() || undefined,
          maxParticipants: createData.maxParticipants,
          isPrivate: createData.isPrivate,
          requiresApproval: createData.requiresApproval
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Breakout room created",
          description: `"${createData.name}" is ready for participants`
        });
        
        setShowCreateDialog(false);
        setCreateData({
          name: '',
          topic: '',
          description: '',
          maxParticipants: 8,
          isPrivate: false,
          requiresApproval: false
        });
        
        await fetchRooms();
      } else {
        throw new Error(result.error || 'Failed to create room');
      }
    } catch (error) {
      console.error('Create room error:', error);
      toast({
        title: "Failed to create room",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  }, [sessionId, authToken, createData, toast, fetchRooms]);

  // Join breakout room
  const joinRoom = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/breakout-rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Joined breakout room",
          description: `Welcome to "${result.data.room.name}"`
        });
        
        // Call the parent handler if provided
        if (onJoinRoom) {
          onJoinRoom(roomId);
        }
        
        await fetchRooms();
      } else {
        throw new Error(result.error || 'Failed to join room');
      }
    } catch (error) {
      console.error('Join room error:', error);
      toast({
        title: "Failed to join room",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  }, [sessionId, authToken, toast, fetchRooms, onJoinRoom]);

  // Close breakout room
  const closeRoom = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/flagship-sanctuary/${sessionId}/breakout-rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Breakout room closed",
          description: "Participants have been notified"
        });
        
        setSelectedRoom(null);
        await fetchRooms();
      } else {
        throw new Error(result.error || 'Failed to close room');
      }
    } catch (error) {
      console.error('Close room error:', error);
      toast({
        title: "Failed to close room",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  }, [sessionId, authToken, toast, fetchRooms]);

  // Load rooms on mount and refresh periodically
  useEffect(() => {
    fetchRooms();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Breakout Rooms</h2>
          <Badge variant="outline">{rooms.length} active</Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={fetchRooms}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
          
          {isHost && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Room
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Breakout Room</DialogTitle>
                  <DialogDescription>
                    Set up a focused discussion space for participants
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="room-name">Room Name *</Label>
                    <Input
                      id="room-name"
                      value={createData.name}
                      onChange={(e) => setCreateData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Deep Reflection Circle"
                      maxLength={50}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="room-topic">Topic (Optional)</Label>
                    <Input
                      id="room-topic"
                      value={createData.topic}
                      onChange={(e) => setCreateData(prev => ({ ...prev, topic: e.target.value }))}
                      placeholder="e.g., Self-improvement strategies"
                      maxLength={100}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="room-description">Description (Optional)</Label>
                    <Textarea
                      id="room-description"
                      value={createData.description}
                      onChange={(e) => setCreateData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What will participants discuss?"
                      rows={3}
                      maxLength={200}
                    />
                  </div>
                  
                  <div>
                    <Label>Max Participants: {createData.maxParticipants}</Label>
                    <Slider
                      value={[createData.maxParticipants]}
                      onValueChange={([value]) => setCreateData(prev => ({ ...prev, maxParticipants: value }))}
                      min={2}
                      max={20}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="private-room"
                      checked={createData.isPrivate}
                      onCheckedChange={(checked) => setCreateData(prev => ({ ...prev, isPrivate: checked }))}
                    />
                    <Label htmlFor="private-room">Private room</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="requires-approval"
                      checked={createData.requiresApproval}
                      onCheckedChange={(checked) => setCreateData(prev => ({ ...prev, requiresApproval: checked }))}
                    />
                    <Label htmlFor="requires-approval">Require approval to join</Label>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createRoom} disabled={creating || !createData.name.trim()}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Room
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Rooms List */}
      <Card className="glass">
        <CardContent className="p-0">
          {loading && rooms.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading breakout rooms...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No breakout rooms yet</p>
              <p className="text-sm text-muted-foreground/70">
                {isHost 
                  ? "Create smaller group discussions for focused conversations" 
                  : "Wait for the host to create breakout rooms"
                }
              </p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="p-4 space-y-3">
                <AnimatePresence>
                  {rooms.map((room) => (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="p-4 rounded-lg border bg-card hover:bg-card/80 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold">{room.name}</h3>
                            {room.isPrivate ? (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Unlock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Badge variant="outline" className="text-xs">
                              {room.currentParticipants}/{room.maxParticipants}
                            </Badge>
                          </div>
                          
                          {room.topic && (
                            <p className="text-sm text-muted-foreground mb-2">{room.topic}</p>
                          )}
                          
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(room.createdAt).toLocaleTimeString()}
                            </div>
                            <div>by {room.creatorAlias}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {room.canJoin && (
                            <Button
                              size="sm"
                              onClick={() => joinRoom(room.id)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <ArrowRight className="h-4 w-4 mr-1" />
                              Join
                            </Button>
                          )}
                          
                          {isHost && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedRoom(room)}
                            >
                              <Settings className="h-4 w-4 mr-1" />
                              Manage
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Participants preview */}
                      {room.participants.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center space-x-2">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {room.participants.slice(0, 3).map(p => p.alias).join(', ')}
                              {room.participants.length > 3 && ` +${room.participants.length - 3} more`}
                            </span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Room Management Dialog */}
      <Dialog open={!!selectedRoom} onOpenChange={() => setSelectedRoom(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage "{selectedRoom?.name}"</DialogTitle>
            <DialogDescription>
              Control this breakout room and its participants
            </DialogDescription>
          </DialogHeader>
          
          {selectedRoom && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Room Status</span>
                  <Badge>{selectedRoom.currentParticipants}/{selectedRoom.maxParticipants} participants</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(selectedRoom.createdAt).toLocaleString()}
                </p>
              </div>
              
              {selectedRoom.participants.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Current Participants</h4>
                  <div className="space-y-2">
                    {selectedRoom.participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm">{participant.alias}</span>
                        <span className="text-xs text-muted-foreground">
                          Joined {new Date(participant.joinedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedRoom(null)}
                >
                  Close
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => selectedRoom && closeRoom(selectedRoom.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Close Room
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkingBreakoutRoomManager;