import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Plus, 
  Settings, 
  Lock, 
  MessageSquare, 
  Volume2, 
  Clock,
  X,
  ArrowRight,
  Loader2
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
}

interface FunctionalBreakoutManagerProps {
  sessionId: string;
  isHost: boolean;
  onJoinRoom: (roomId: string) => void;
}

interface CreateRoomData {
  name: string;
  topic: string;
  description: string;
  maxParticipants: number;
  isPrivate: boolean;
  requiresApproval: boolean;
}

export const FunctionalBreakoutManager = ({ sessionId, isHost, onJoinRoom }: FunctionalBreakoutManagerProps) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<BreakoutRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createData, setCreateData] = useState<CreateRoomData>({
    name: '',
    topic: '',
    description: '',
    maxParticipants: 8,
    isPrivate: false,
    requiresApproval: false
  });

  const authToken = localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token');

  const fetchRooms = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/live-sanctuary/${sessionId}/breakouts`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setRooms(result.data);
        }
      } else {
        console.error('Failed to fetch rooms:', response.status);
      }
    } catch (error) {
      console.error('Fetch rooms error:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, authToken]);

  const createRoom = useCallback(async () => {
    if (!createData.name.trim()) {
      toast({
        title: "Room name required",
        description: "Please enter a name for the breakout room",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(`/api/live-sanctuary/${sessionId}/breakout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(createData)
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Breakout room created",
          description: `${createData.name} is ready for participants`,
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
        
        // Refresh rooms list
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
      setIsCreating(false);
    }
  }, [createData, sessionId, authToken, toast, fetchRooms]);

  const joinRoom = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/live-sanctuary/breakout/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ alias: 'Current User' })
      });

      const result = await response.json();
      
      if (result.success) {
        onJoinRoom(roomId);
        toast({
          title: "Joined breakout room",
          description: "Welcome to the smaller group discussion",
        });
        // Refresh rooms to update participant count
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
  }, [authToken, onJoinRoom, toast, fetchRooms]);

  const closeRoom = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/live-sanctuary/breakout/${roomId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Breakout room closed",
          description: "Participants have been returned to the main room",
        });
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
  }, [authToken, toast, fetchRooms]);

  // Load rooms on mount and refresh periodically
  useEffect(() => {
    fetchRooms();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  return (
    <Card className="glass shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Breakout Rooms ({rooms.length})
          </CardTitle>
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
              <Button
                onClick={() => setShowCreateDialog(true)}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Room
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading && rooms.length === 0 ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
            <p className="text-gray-500">Loading breakout rooms...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-2">No breakout rooms yet</p>
            <p className="text-sm text-gray-400">
              {isHost 
                ? "Create smaller group discussions for focused conversations" 
                : "Wait for the host to create breakout rooms"
              }
            </p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              <AnimatePresence>
                {rooms.map((room) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="p-4 rounded-lg border bg-white/50 hover:bg-white/70 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-gray-800">{room.name}</h3>
                          {room.isPrivate && (
                            <Lock className="h-4 w-4 text-gray-500" />
                          )}
                          <Badge variant="outline" className="text-xs">
                            {room.currentParticipants}/{room.maxParticipants}
                          </Badge>
                        </div>
                        
                        {room.topic && (
                          <p className="text-sm text-gray-600 mb-2">{room.topic}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Text Chat
                          </div>
                          <div className="flex items-center">
                            <Volume2 className="h-3 w-3 mr-1" />
                            Voice Chat
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(room.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {room.currentParticipants < room.maxParticipants ? (
                          <Button
                            onClick={() => joinRoom(room.id)}
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Join
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Full
                          </Badge>
                        )}
                        
                        {isHost && (
                          <Button
                            onClick={() => closeRoom(room.id)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Create Room Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Create Breakout Room
            </DialogTitle>
            <DialogDescription>
              Set up a smaller group discussion space for focused conversations.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Room Name</label>
              <Input
                value={createData.name}
                onChange={(e) => setCreateData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Anxiety Support Circle"
                maxLength={50}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Topic (Optional)</label>
              <Input
                value={createData.topic}
                onChange={(e) => setCreateData(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="e.g., Coping Strategies"
                maxLength={100}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
              <Textarea
                value={createData.description}
                onChange={(e) => setCreateData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of what this room is for..."
                maxLength={200}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Max Participants</label>
                <Input
                  type="number"
                  value={createData.maxParticipants}
                  onChange={(e) => setCreateData(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) || 8 }))}
                  min="2"
                  max="20"
                />
              </div>
              
              <div className="space-y-3 pt-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={createData.isPrivate}
                    onChange={(e) => setCreateData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Private Room</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={createData.requiresApproval}
                    onChange={(e) => setCreateData(prev => ({ ...prev, requiresApproval: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Require Approval</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={createRoom}
              disabled={isCreating || !createData.name.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Room'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FunctionalBreakoutManager;