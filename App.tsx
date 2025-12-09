
import React, { useState, useEffect, useRef } from 'react';
import { Peer, MediaConnection, DataConnection } from 'peerjs';
import { AppState, TranscriptionItem } from './types';
import { LandingScreen } from './views/LandingScreen';
import { CallScreen } from './views/CallScreen';
import { SummaryScreen } from './views/SummaryScreen';
import { PermissionService } from './services/permissionService';

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
    // Create hidden audio element
    audioRef.current = new Audio();
    return () => {
      cleanupConnection();
    };
  }, []);

  // Update audio element volume based on deafness
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
  };

  const initializePeer = async (id: string | null = null): Promise<Peer> => {
    // Get Mic Access First
    const permission = await PermissionService.requestMicrophoneAccess();
    if (!permission.stream) {
      alert("Microphone access is required to use EchoLink.");
      throw new Error("No Mic");
    }
    localStreamRef.current = permission.stream;

    // Initialize PeerJS
    const peer = new Peer(id ? id : undefined, { debug: 2 });
    peerRef.current = peer;

    peer.on('error', (err) => {
      console.error(err);
      setStatusText(`Connection Error: ${err.type}`);
      if (err.type === 'peer-unavailable') {
         alert("Channel ID not found or peer is offline.");
         endCall();
      }
    });

    return peer;
  };

  // Handle incoming data (transcripts) from the peer
  const setupDataConnection = (conn: DataConnection) => {
    dataConnRef.current = conn;
    
    conn.on('open', () => {
        console.log("Data connection established");
    });

    conn.on('data', (data: any) => {
        if (data && data.type === 'TRANSCRIPT') {
            const remoteItem = data.payload;
            setTranscripts(prev => {
                // Check if we need to update an existing non-final item or add new
                const lastItem = prev[prev.length - 1];
                // Note: Logic here is simplified. In a real app we might match IDs.
                // Assuming simple append for now or checking if the last item was also remote and non-final
                
                // If the incoming data has the same ID as the last remote message, update it
                const existingIndex = prev.findIndex(t => t.id === remoteItem.id);
                
                if (existingIndex !== -1) {
                    const updated = [...prev];
                    updated[existingIndex] = { ...remoteItem, sender: 'remote' };
                    return updated;
                } else {
                    return [...prev, { ...remoteItem, sender: 'remote' }];
                }
            });
        }
    });
  };

  const handleCreateHost = async () => {
    setAppState(AppState.INITIALIZING);
    setStatusText("Initializing Secure Channel...");
    
    // Generate Random 4 digit ID
    const newId = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
      const peer = await initializePeer(newId);
      
      peer.on('open', (id) => {
        setChannelId(id);
        setAppState(AppState.WAITING_FOR_PEER);
        setStatusText("Waiting for Guest...");
      });

      // Handle Incoming Audio Call
      peer.on('call', (call) => {
        setStatusText("Establishing Link...");
        call.answer(localStreamRef.current!);
        handleCallStream(call);
      });

      // Handle Incoming Data Connection (for Chat/Transcript)
      peer.on('connection', (conn) => {
        setupDataConnection(conn);
      });

    } catch (e) {
      setAppState(AppState.LANDING);
    }
  };

  const handleJoinGuest = async (targetId: string) => {
    setAppState(AppState.CONNECTING);
    setStatusText(`Locating Channel ${targetId}...`);
    setChannelId(targetId);

    try {
      const peer = await initializePeer(); // Let server assign our ID

      peer.on('open', () => {
        setStatusText("Handshaking...");
        
        // Initiate Audio Call
        const call = peer.call(targetId, localStreamRef.current!);
        handleCallStream(call);

        // Initiate Data Connection
        const conn = peer.connect(targetId);
        setupDataConnection(conn);
      });

    } catch (e) {
      setAppState(AppState.LANDING);
    }
  };

  const handleCallStream = (call: MediaConnection) => {
    activeCallRef.current = call;
    
    call.on('stream', (remoteStream) => {
      if (audioRef.current) {
        audioRef.current.srcObject = remoteStream;
        audioRef.current.play().catch(e => console.error("Audio play failed", e));
      }
      setAppState(AppState.ACTIVE_CALL);
      setStatusText("SECURE CONNECTION ACTIVE");
    });

    call.on('close', () => {
      endCall();
    });
  };

  const handleLocalTranscript = (text: string, isFinal: boolean) => {
    const id = Date.now().toString(); // Simple ID generation
    
    // Update Local State
    setTranscripts(prev => {
       const lastItem = prev[prev.length - 1];
       
       if (lastItem && lastItem.sender === 'local' && !lastItem.isFinal) {
          // Update existing pending transcript
          const updatedItem = { ...lastItem, text, isFinal, timestamp: Date.now() };
          
          // Send to Peer
          if (dataConnRef.current && dataConnRef.current.open) {
             dataConnRef.current.send({ type: 'TRANSCRIPT', payload: updatedItem });
          }

          const newList = [...prev];
          newList[newList.length - 1] = updatedItem;
          return newList;
       } else {
          // New transcript item
          const newItem: TranscriptionItem = { 
            id, 
            sender: 'local', 
            text, 
            isFinal, 
            timestamp: Date.now() 
          };

          // Send to Peer
          if (dataConnRef.current && dataConnRef.current.open) {
             dataConnRef.current.send({ type: 'TRANSCRIPT', payload: newItem });
          }

          return [...prev, newItem];
       }
    });
  };

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
    <div className="bg-black text-white min-h-screen">
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
                <div className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold text-white">
                    {channelId ? channelId : "..."}
                </div>
            </div>
            
            <div className="relative z-10 space-y-4">
              <h2 className="text-2xl font-sans font-bold text-white tracking-wide">{statusText}</h2>
              {channelId && appState === AppState.WAITING_FOR_PEER && (
                <div className="p-6 bg-surface/80 border border-primary/30 rounded-xl backdrop-blur-md shadow-[0_0_30px_rgba(0,229,255,0.15)]">
                  <p className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-widest">Share Channel ID</p>
                  <p className="text-6xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary tracking-widest drop-shadow-sm">{channelId}</p>
                </div>
              )}
            </div>
            
            <button onClick={() => { cleanupConnection(); resetToHub(); }} className="text-gray-500 hover:text-white underline text-xs font-mono mt-8 z-10 uppercase tracking-widest">
                Abort Connection
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
