import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Peer, MediaConnection, DataConnection } from 'peerjs';
import { Mic, MicOff, PhoneOff, Ear, EarOff, Radio, AlertTriangle } from 'lucide-react';
import { AppState } from './types';
import { LandingScreen } from './views/LandingScreen';
import { SummaryScreen } from './views/SummaryScreen';
import { PermissionService } from './services/permissionService';

// Connection Status Type
type ConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected';

// CRITICAL: Maximum Compatibility STUN Servers for Cross-Network Connectivity
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.global.stun.twilio.com:3478' },
      { urls: 'stun:stun.miwifi.com:3478' }
    ]
  }
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [channelId, setChannelId] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeaf, setIsDeaf] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Disconnected');

  // Walkie-Talkie Model: Simple live captions
  const [myText, setMyText] = useState<string>('Listening...');
  const [peerText, setPeerText] = useState<string>('Waiting for peer...');

  // AI Captioning toggle
  const [isCaptioning, setIsCaptioning] = useState(false);

  // Speech recognition availability
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(true);

  // Refs for WebRTC management
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);

  // Speech recognition ref
  const recognitionRef = useRef<any>(null);

  // Audio element for remote stream
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();

    // Check speech recognition support
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechRecognitionSupported(false);
      console.warn('Speech Recognition not supported in this browser.');
    }

    return () => {
      cleanupConnection();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isDeaf;
    }
  }, [isDeaf]);

  // Initialize Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          let transcript = event.results[i][0].transcript.trim();
          if (transcript) {
            // Update my text (live caption)
            setMyText(transcript);

            // Send to peer via DataConnection
            if (dataConnRef.current?.open) {
              dataConnRef.current.send({ text: transcript });
            }
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        setMyText('No speech detected...');
      }
    };

    recognition.onend = () => {
      // Manual restart only - no auto-restart for stability on mobile
      console.log('Speech recognition ended');
    };

    recognitionRef.current = recognition;
  }, []);

  const startCaptioning = useCallback(() => {
    if (!recognitionRef.current) {
      initSpeechRecognition();
    }

    if (recognitionRef.current && !isCaptioning) {
      try {
        recognitionRef.current.start();
        setIsCaptioning(true);
        setMyText('Listening...');
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
      }
    }
  }, [isCaptioning, initSpeechRecognition]);

  const stopCaptioning = useCallback(() => {
    if (recognitionRef.current && isCaptioning) {
      recognitionRef.current.stop();
      setIsCaptioning(false);
      setMyText('Captioning stopped');
    }
  }, [isCaptioning]);

  const cleanupConnection = () => {
    stopCaptioning();
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
    setConnectionStatus('Disconnected');
  };

  const endCall = () => {
    cleanupConnection();
    setAppState(AppState.SUMMARY_VIEW);
  };

  const resetToHub = () => {
    setAppState(AppState.LANDING);
    setChannelId('');
    setStatusText('');
    setMyText('Listening...');
    setPeerText('Waiting for peer...');
    setIsMicMuted(false);
    setIsDeaf(false);
    setIsCaptioning(false);
    setConnectionStatus('Disconnected');
  };

  // Setup DataConnection for text sync between peers
  const setupDataConnection = (conn: DataConnection) => {
    dataConnRef.current = conn;

    conn.on('open', () => {
      console.log('Data connection established with:', conn.peer);
      setConnectionStatus('Connected');
    });

    conn.on('data', (data: any) => {
      console.log('Received data:', data);
      // Received text from peer - update peer's live caption
      if (data && data.text) {
        setPeerText(data.text);
      }
    });

    conn.on('close', () => {
      console.log('Data connection closed');
      setConnectionStatus('Disconnected');
    });
  };

  const initializePeer = async (id: string | null = null): Promise<Peer> => {
    const permission = await PermissionService.requestMicrophoneAccess();
    if (!permission.stream) {
      alert("Microphone access is required.");
      throw new Error("No Mic");
    }
    localStreamRef.current = permission.stream;

    // Initialize Peer with enhanced STUN Config for maximum cross-network connectivity
    const peer = new Peer(id ? id : undefined, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('error', (err) => {
      console.error('Peer Error:', err);
      setStatusText(`Connection Error: ${err.type}`);
      setConnectionStatus('Disconnected');
      if (err.type === 'peer-unavailable') {
        alert("Channel ID not found. The Host might be offline.");
        resetToHub();
      }
    });

    // Listen for incoming data connections (Host receives this)
    peer.on('connection', (conn) => {
      console.log("Incoming data connection from:", conn.peer);
      setupDataConnection(conn);
    });

    return peer;
  };

  // --- HOST LOGIC ---
  const handleCreateHost = async () => {
    setAppState(AppState.INITIALIZING);
    setStatusText("Initializing Host...");
    setConnectionStatus('Connecting');

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
        setStatusText("Incoming Call...");
        setConnectionStatus('Connecting');
        // CRITICAL: Answer the call with local stream
        call.answer(localStreamRef.current!);
        handleMediaStream(call);
      });

    } catch (e) {
      console.error(e);
      setAppState(AppState.LANDING);
      setConnectionStatus('Disconnected');
    }
  };

  // --- GUEST LOGIC ---
  const handleJoinGuest = async (targetId: string) => {
    setAppState(AppState.CONNECTING);
    setStatusText(`Connecting to ${targetId}...`);
    setChannelId(targetId);
    setConnectionStatus('Connecting');

    try {
      const peer = await initializePeer();

      peer.on('open', () => {
        setStatusText("Handshaking...");

        // 1. Start Data Connection First (for text sync)
        const conn = peer.connect(targetId, { reliable: true });
        setupDataConnection(conn);

        // 2. Start Audio Call
        const call = peer.call(targetId, localStreamRef.current!);
        handleMediaStream(call);
      });

    } catch (e) {
      console.error(e);
      setAppState(AppState.LANDING);
      setConnectionStatus('Disconnected');
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
      setConnectionStatus('Connected');

      // Initialize speech recognition when call becomes active
      initSpeechRecognition();
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

  // Get connection status badge
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'Connected':
        return (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-green-500 font-mono text-sm font-bold">🟢 Connected</span>
          </div>
        );
      case 'Connecting':
        return (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className="text-yellow-500 font-mono text-sm font-bold">🟡 Connecting</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-red-500 font-mono text-sm font-bold">🔴 Disconnected</span>
          </div>
        );
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
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>

          <div className="relative">
            <div className="w-24 h-24 border-4 border-t-blue-500 border-r-cyan-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            {channelId && (
              <div className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold text-white animate-pulse">
                {channelId}
              </div>
            )}
          </div>

          <div className="relative z-10 space-y-4">
            <h2 className="text-2xl font-bold text-white tracking-wide">{statusText}</h2>
            {appState === AppState.WAITING_FOR_PEER && (
              <div className="p-6 bg-gray-900/80 border border-blue-500/30 rounded-xl backdrop-blur-md shadow-lg">
                <p className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-widest">Share Channel ID</p>
                <p className="text-6xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500 tracking-widest">{channelId}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => { cleanupConnection(); resetToHub(); }}
            className="text-gray-500 hover:text-white underline text-xs font-mono mt-8 z-10 uppercase tracking-widest"
          >
            Cancel Connection
          </button>
        </div>
      )}

      {appState === AppState.ACTIVE_CALL && (
        <div className="min-h-screen bg-black flex flex-col">
          {/* Top: Status Badge & Channel ID */}
          <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/10 bg-gray-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              {getStatusBadge()}
              <div className="text-sm font-mono text-gray-400">
                Channel: <span className="text-blue-500 font-bold">{channelId}</span>
              </div>
            </div>

            {/* Speech Recognition Alert */}
            {!speechRecognitionSupported && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-red-500 text-sm font-bold">Speech Recognition Not Supported</span>
              </div>
            )}
          </div>

          {/* Middle: Two Large Cards (PEER & ME) */}
          <div className="flex-1 grid md:grid-cols-2 gap-6 p-6">
            {/* Left Card: PEER (Remote Audio + Peer's Text) */}
            <div className="bg-gray-900/70 border border-gray-700 rounded-2xl p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <Radio className="w-5 h-5 text-cyan-500" />
                <h3 className="text-xl font-bold text-cyan-500 uppercase tracking-wide">Peer</h3>
              </div>

              {/* Remote Audio Visualizer */}
              <div className="flex items-center justify-center gap-1 h-20 mb-6">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full bg-cyan-500 animate-wave"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      height: '30%'
                    }}
                  ></div>
                ))}
              </div>

              {/* Peer's Live Caption */}
              <div className="flex-1 bg-black/50 rounded-xl p-6 border border-gray-800">
                <p className="text-sm font-mono text-gray-500 mb-2">Live Caption:</p>
                <p className="text-lg text-gray-200 leading-relaxed">{peerText}</p>
              </div>
            </div>

            {/* Right Card: ME (Mic Button + My Text) */}
            <div className="bg-gray-900/70 border border-gray-700 rounded-2xl p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <Radio className="w-5 h-5 text-blue-500" />
                <h3 className="text-xl font-bold text-blue-500 uppercase tracking-wide">Me</h3>
              </div>

              {/* Mic Control */}
              <div className="flex items-center justify-center gap-6 h-20 mb-6">
                <button
                  onClick={toggleMic}
                  className={`p-6 rounded-2xl border transition-all duration-200 ${isMicMuted
                      ? 'bg-red-500/10 border-red-500 text-red-500'
                      : 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700'
                    }`}
                >
                  {isMicMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>

                <button
                  onClick={() => setIsDeaf(!isDeaf)}
                  className={`p-6 rounded-2xl border transition-all duration-200 ${isDeaf
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-500'
                      : 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700'
                    }`}
                >
                  {isDeaf ? <EarOff className="w-8 h-8" /> : <Ear className="w-8 h-8" />}
                </button>
              </div>

              {/* My Live Caption */}
              <div className="flex-1 bg-black/50 rounded-xl p-6 border border-gray-800">
                <p className="text-sm font-mono text-gray-500 mb-2">Live Caption:</p>
                <p className="text-lg text-gray-200 leading-relaxed">{myText}</p>
              </div>
            </div>
          </div>

          {/* Bottom: Controls */}
          <div className="p-6 border-t border-white/10 bg-gray-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Manual Captioning Toggle */}
            <button
              onClick={isCaptioning ? stopCaptioning : startCaptioning}
              disabled={!speechRecognitionSupported}
              className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all ${isCaptioning
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                } ${!speechRecognitionSupported && 'opacity-50 cursor-not-allowed'}`}
            >
              {isCaptioning ? '⏹ Stop AI Captioning' : '▶ Start AI Captioning'}
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="px-8 py-4 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg border-4 border-black transition-transform active:scale-95 flex items-center gap-2"
            >
              <PhoneOff className="w-6 h-6" />
              <span className="font-bold">End Call</span>
            </button>

            <div className="text-xs font-mono text-gray-500">
              {isMicMuted && '🎤 Muted'} {isDeaf && '🔇 Deaf Mode'}
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
