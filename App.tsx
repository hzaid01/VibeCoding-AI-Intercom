
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Peer, MediaConnection, DataConnection } from 'peerjs';
import { AppState, TranscriptionItem } from './types';
import { LandingScreen } from './views/LandingScreen';
import { CallScreen } from './views/CallScreen';
import { SummaryScreen } from './views/SummaryScreen';
import { PermissionService } from './services/permissionService';

// CRITICAL: STUN Servers for Cross-Network Connectivity (4G <-> WiFi)
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  }
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [channelId, setChannelId] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeaf, setIsDeaf] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  // Shared State
  const [transcripts, setTranscripts] = useState<TranscriptionItem[]>([]);
  
  // Refs for WebRTC management
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  
  // Audio element for remote stream
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create hidden audio element for WebRTC stream
    audioRef.current = new Audio();
    return () => {
      cleanupConnection();
    };
  }, []);

  // Update audio element volume based on deafness toggle
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.muted = isDeaf;
    }
  }, [isDeaf]);

  const cleanupConnection = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (activeCallRef.current) {
      activeCallRef.current.close();
    }
    if (dataConnRef.current) {
      dataConnRef.current.close();
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    peerRef.current = null;
    activeCallRef.current = null;
    dataConnRef.current = null;
  };

  const endCall = () => {
    cleanupConnection();
    setAppState(AppState.SUMMARY_VIEW);
  };

  const resetToHub = () => {
      setAppState(AppState.LANDING);
      setChannelId('');
      setStatusText('');
      setTranscripts([]);
      setIsMicMuted(false);
      setIsDeaf(false);
  };

  // Helper to send data safely
  const sendData = (data: any) => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send(data);
      } catch (err) {
        console.error("Data send failed:", err);
      }
    }
  };

  const initializePeer = async (id: string | null = null): Promise<Peer> => {
    // 1. Get Mic Access
    const permission = await PermissionService.requestMicrophoneAccess();
    if (!permission.stream) {
      alert("Microphone access is required.");
      throw new Error("No Mic");
    }
    localStreamRef.current = permission.stream;

    // 2. Initialize Peer with STUN Config
    const peer = new Peer(id ? id : undefined, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('error', (err) => {
      console.error('Peer Error:', err);
      setStatusText(`Connection Error: ${err.type}`);
      if (err.type === 'peer-unavailable') {
         alert("Channel ID not found. The Host might be offline.");
         resetToHub();
      }
    });

    return peer;
  };

  // Setup listeners for incoming data (Chat/Transcripts)
  const setupDataConnectionListeners = (conn: DataConnection) => {
    dataConnRef.current = conn;
    
    conn.on('open', () => {
        console.log("Data connection established with:", conn.peer);
        // Optional: Send a handshake or sync message
    });

    conn.on('data', (data: any) => {
        console.log("Received data:", data);
        if (data && data.type === 'TRANSCRIPT') {
            const remoteItem = data.payload as TranscriptionItem;
            // Force sender to be 'remote' for incoming data
            const incomingItem = { ...remoteItem, sender: 'remote' as const };
            
            setTranscripts(prev => {
                // Check if we are updating an interim result
                const existingIndex = prev.findIndex(t => t.id === incomingItem.id);
                if (existingIndex !== -1) {
                    const updated = [...prev];
                    updated[existingIndex] = incomingItem;
                    return updated;
                } else {
                    return [...prev, incomingItem];
                }
            });
        }
    });

    conn.on('close', () => {
        console.log("Data connection closed");
    });
  };

  // --- HOST LOGIC ---
  const handleCreateHost = async () => {
    setAppState(AppState.INITIALIZING);
    setStatusText("Initializing Host...");
    
    // Generate Random 4 digit ID
    const newId = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
      const peer = await initializePeer(newId);
      
      peer.on('open', (id) => {
        setChannelId(id);
        setAppState(AppState.WAITING_FOR_PEER);
        setStatusText("Waiting for Guest...");
      });

      // 1. Handle Incoming Audio Call
      peer.on('call', (call) => {
        setStatusText("Incoming Call...");
        call.answer(localStreamRef.current!);
        handleMediaStream(call);
      });

      // 2. Handle Incoming Data Connection (Text Sync)
      peer.on('connection', (conn) => {
        console.log("Guest connected to data channel");
        setupDataConnectionListeners(conn);
      });

    } catch (e) {
      console.error(e);
      setAppState(AppState.LANDING);
    }
  };

  // --- GUEST LOGIC ---
  const handleJoinGuest = async (targetId: string) => {
    setAppState(AppState.CONNECTING);
    setStatusText(`Connecting to ${targetId}...`);
    setChannelId(targetId);

    try {
      const peer = await initializePeer(); 

      peer.on('open', () => {
        setStatusText("Handshaking...");
        
        // 1. Start Data Connection First
        const conn = peer.connect(targetId, { reliable: true });
        setupDataConnectionListeners(conn);

        // 2. Start Audio Call
        const call = peer.call(targetId, localStreamRef.current!);
        handleMediaStream(call);
      });

    } catch (e) {
      console.error(e);
      setAppState(AppState.LANDING);
    }
  };

  // Common Media Handler
  const handleMediaStream = (call: MediaConnection) => {
    activeCallRef.current = call;
    
    call.on('stream', (remoteStream) => {
      if (audioRef.current) {
        audioRef.current.srcObject = remoteStream;
        audioRef.current.play().catch(e => console.error("Audio autoplay block:", e));
      }
      setAppState(AppState.ACTIVE_CALL);
      setStatusText("SECURE LINK ACTIVE");
    });

    call.on('close', () => {
      endCall();
    });
  };

  // Called by CallScreen when local user speaks
  const handleLocalTranscript = useCallback((text: string, isFinal: boolean) => {
    // Generate ID: Use a timestamp-based ID. 
    // If it's an interim result updating the previous one, we might want to reuse ID?
    // Simplified strategy: 
    // If the last item in state is 'local' and !isFinal, update it.
    // Otherwise create new.
    
    setTranscripts(prev => {
       const lastItem = prev[prev.length - 1];
       let itemToProcess: TranscriptionItem;

       if (lastItem && lastItem.sender === 'local' && !lastItem.isFinal) {
          // Update existing
          itemToProcess = { ...lastItem, text, isFinal, timestamp: Date.now() };
          
          // Optimistic UI Update
          const newList = [...prev];
          newList[newList.length - 1] = itemToProcess;
          
          // Send to Peer
          sendData({ type: 'TRANSCRIPT', payload: itemToProcess });
          
          return newList;
       } else {
          // Create New
          itemToProcess = { 
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            sender: 'local', 
            text, 
            isFinal, 
            timestamp: Date.now() 
          };
          
          // Send to Peer
          sendData({ type: 'TRANSCRIPT', payload: itemToProcess });
          
          return [...prev, itemToProcess];
       }
    });
  }, []);

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="bg-black text-white min-h-screen font-sans">
      {appState === AppState.LANDING && (
        <LandingScreen 
          onCreate={handleCreateHost}
          onJoin={handleJoinGuest}
        />
      )}

      {(appState === AppState.INITIALIZING || appState === AppState.WAITING_FOR_PEER || appState === AppState.CONNECTING) && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8 text-center bg-black relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 animate-pulse-slow"></div>
            
            <div className="relative">
                <div className="w-24 h-24 border-4 border-t-primary border-r-secondary border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                {channelId && (
                   <div className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold text-white animate-pulse">
                       {channelId}
                   </div>
                )}
            </div>
            
            <div className="relative z-10 space-y-4">
              <h2 className="text-2xl font-bold text-white tracking-wide">{statusText}</h2>
              {appState === AppState.WAITING_FOR_PEER && (
                <div className="p-4 bg-surface/80 border border-primary/30 rounded-xl backdrop-blur-md">
                  <p className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-widest">Share Channel ID</p>
                  <p className="text-5xl font-mono font-bold text-primary tracking-widest">{channelId}</p>
                </div>
              )}
            </div>
            
            <button onClick={() => { cleanupConnection(); resetToHub(); }} className="text-gray-500 hover:text-white underline text-xs font-mono mt-8 z-10 uppercase tracking-widest">
                Cancel Connection
            </button>
        </div>
      )}

      {appState === AppState.ACTIVE_CALL && (
        <CallScreen 
          channelId={channelId}
          onHangup={endCall}
          toggleMic={toggleMic}
          isMicMuted={isMicMuted}
          statusText={statusText}
          toggleDeafMode={() => setIsDeaf(!isDeaf)}
          isDeaf={isDeaf}
          transcripts={transcripts}
          onLocalSpeech={handleLocalTranscript}
        />
      )}

      {appState === AppState.SUMMARY_VIEW && (
          <SummaryScreen onBack={resetToHub} />
      )}
    </div>
  );
};

export default App;
