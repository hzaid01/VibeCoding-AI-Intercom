import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Peer, MediaConnection, DataConnection } from 'peerjs';
import { Mic, MicOff, PhoneOff, Ear, EarOff, Languages, MessageSquareText, Activity } from 'lucide-react';
import { AppState } from './types';
import { LandingScreen } from './views/LandingScreen';
import { SummaryScreen } from './views/SummaryScreen';
import { PermissionService } from './services/permissionService';

// Message type for chat bubbles
interface ChatMessage {
  id: string;
  sender: 'Me' | 'Peer';
  text: string;
  timestamp: number;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [channelId, setChannelId] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeaf, setIsDeaf] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isTranslateOn, setIsTranslateOn] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Refs for WebRTC management
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  
  // Speech recognition ref
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  
  // Audio element for remote stream
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ICE servers config for cross-network connectivity
  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      cleanupConnection();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isDeaf;
    }
  }, [isDeaf]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn('Browser does not support Speech Recognition.');
      return;
    }

    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          let transcript = event.results[i][0].transcript.trim();
          if (transcript) {
            // Apply mock translation if enabled
            const finalText = isTranslateOn ? `${transcript} [Urdu->Eng]` : transcript;
            
            const newMessage: ChatMessage = {
              id: Date.now().toString(),
              sender: 'Me',
              text: finalText,
              timestamp: Date.now()
            };
            
            // Add to local state
            setMessages(prev => [...prev, newMessage]);
            
            // Send to peer via DataConnection
            if (dataConnRef.current?.open) {
              dataConnRef.current.send({ text: finalText });
            }
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      // Auto-restart if still in active call
      if (isListeningRef.current && appState === AppState.ACTIVE_CALL) {
        try {
          recognition.start();
        } catch (e) {
          // Ignore already started errors
        }
      }
    };

    recognitionRef.current = recognition;
  }, [isTranslateOn, appState]);

  const startSpeechRecognition = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current) {
      try {
        recognitionRef.current.start();
        isListeningRef.current = true;
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
      }
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const cleanupConnection = () => {
    stopSpeechRecognition();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (dataConnRef.current) {
      dataConnRef.current.close();
    }
    if (activeCallRef.current) {
      activeCallRef.current.close();
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
    setMessages([]);
  };

  const setupDataConnection = (conn: DataConnection) => {
    dataConnRef.current = conn;
    
    conn.on('open', () => {
      console.log('Data connection established');
    });
    
    conn.on('data', (data: any) => {
      // Received message from peer
      const peerMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'Peer',
        text: data.text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, peerMessage]);
    });
    
    conn.on('close', () => {
      console.log('Data connection closed');
    });
  };

  const initializePeer = async (id: string | null = null): Promise<Peer> => {
    const permission = await PermissionService.requestMicrophoneAccess();
    if (!permission.stream) {
      alert("Microphone access is required to use EchoLink.");
      throw new Error("No Mic");
    }
    localStreamRef.current = permission.stream;

    // Initialize PeerJS with STUN servers for cross-network connectivity
    const peer = new Peer(id ? id : undefined, { 
      debug: 2,
      config: iceConfig
    });
    peerRef.current = peer;

    peer.on('error', (err) => {
      console.error(err);
      setStatusText(`Connection Error: ${err.type}`);
      if (err.type === 'peer-unavailable') {
        alert("Channel ID not found or peer is offline.");
        endCall();
      }
    });

    // Listen for incoming data connections
    peer.on('connection', (conn) => {
      setupDataConnection(conn);
    });

    return peer;
  };

  const handleCreateHost = async () => {
    setAppState(AppState.INITIALIZING);
    setStatusText("Initializing Secure Channel...");
    
    const newId = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
      const peer = await initializePeer(newId);
      
      peer.on('open', (id) => {
        setChannelId(id);
        setAppState(AppState.WAITING_FOR_PEER);
        setStatusText("Waiting for Guest...");
      });

      peer.on('call', (call) => {
        setStatusText("Establishing Link...");
        call.answer(localStreamRef.current!);
        handleCallStream(call);
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
      const peer = await initializePeer();

      peer.on('open', () => {
        setStatusText("Handshaking...");
        
        // Establish data connection for text sync
        const dataConn = peer.connect(targetId);
        setupDataConnection(dataConn);
        
        // Establish media connection for audio
        const call = peer.call(targetId, localStreamRef.current!);
        handleCallStream(call);
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
      
      // Initialize and start speech recognition when call becomes active
      initSpeechRecognition();
      setTimeout(() => startSpeechRecognition(), 500);
    });

    call.on('close', () => {
      endCall();
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

  // Render Chat Bubble
  const renderChatBubble = (msg: ChatMessage) => {
    const isMe = msg.sender === 'Me';
    return (
      <div
        key={msg.id}
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
      >
        <div
          className={`max-w-[75%] px-4 py-3 rounded-2xl ${
            isMe
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-700 text-gray-100 rounded-bl-md'
          }`}
        >
          <p className="text-sm font-medium mb-1 opacity-70">
            {isMe ? 'Me' : 'Peer'}
          </p>
          <p className="text-base leading-relaxed">{msg.text}</p>
        </div>
      </div>
    );
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
        <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
          {/* Background Ambience */}
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>

          {/* Header */}
          <div className="relative z-30 p-6 flex justify-between items-center border-b border-white/5 bg-black/40 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <div className="text-sm font-mono text-gray-400">
                LINK: <span className="text-primary font-bold">{channelId}</span>
              </div>
            </div>
            <div className="px-3 py-1 rounded border border-gray-800 bg-surface/50 text-xs font-mono text-gray-400">
              {statusText}
            </div>
          </div>

          {/* Main Visualizer Area */}
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-8">
            {/* Central Audio Waveform */}
            <div className="flex items-center justify-center gap-2 h-24 w-full max-w-md">
              {[...Array(15)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-2 rounded-full transition-all duration-300 ${isMicMuted ? 'bg-gray-800 h-2' : 'bg-primary animate-wave'}`}
                  style={{ 
                    animationDelay: `${i * 0.05}s`,
                    animationDuration: '1s',
                    height: isMicMuted ? '4px' : '40%'
                  }}
                ></div>
              ))}
            </div>
            
            {/* Control Cluster */}
            <div className="flex items-center gap-6 mt-8">
              <button 
                onClick={toggleMic}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  isMicMuted 
                    ? 'bg-red-500/10 border-red-500 text-red-500' 
                    : 'bg-surface border-gray-700 text-white hover:bg-gray-800 hover:border-gray-500'
                }`}
              >
                {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button 
                onClick={endCall}
                className="p-8 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-[0_0_30px_rgba(220,38,38,0.4)] border-4 border-black transition-transform active:scale-95"
              >
                <PhoneOff className="w-8 h-8 fill-current" />
              </button>

              <button 
                onClick={() => setIsDeaf(!isDeaf)}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  isDeaf 
                    ? 'bg-secondary/20 border-secondary text-secondary' 
                    : 'bg-surface border-gray-700 text-white hover:bg-gray-800 hover:border-gray-500'
                }`}
              >
                {isDeaf ? <EarOff className="w-6 h-6" /> : <Ear className="w-6 h-6" />}
              </button>
            </div>
            
            <p className="mt-4 text-xs font-mono text-gray-500 uppercase tracking-widest">
              {isDeaf ? 'Audio Output Disabled' : 'Audio Output Active'}
            </p>
          </div>

          {/* Chat Interface (Bottom) */}
          <div className="relative z-30 h-[45vh] glass-panel border-t border-white/10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            {/* Toolbar */}
            <div className="p-4 flex items-center justify-between border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-white tracking-wide">CONVERSATION</span>
              </div>
              
              <button 
                onClick={() => setIsTranslateOn(!isTranslateOn)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                  isTranslateOn 
                    ? 'bg-secondary/20 border-secondary text-secondary' 
                    : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <Languages className="w-3 h-3" />
                {isTranslateOn ? 'URDU -> ENG' : 'TRANSLATE OFF'}
              </button>
            </div>

            {/* Chat Messages Scroll Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                  <MessageSquareText className="w-8 h-8 opacity-20" />
                  <p className="text-sm font-mono">Listening for speech...</p>
                </div>
              )}
              
              {messages.map(renderChatBubble)}
            </div>
          </div>
        </div>
      )}

      {appState === AppState.SUMMARY_VIEW && (
        <SummaryScreen onBack={resetToHub} />
      )}
    </div>
  );
};

export default App;
