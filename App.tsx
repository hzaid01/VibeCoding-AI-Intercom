import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Peer, MediaConnection, DataConnection } from 'peerjs';
import { Mic, MicOff, PhoneOff, Volume2, AlertTriangle } from 'lucide-react';
import { AppState } from './types';
import { LandingScreen } from './views/LandingScreen';
import { SummaryScreen } from './views/SummaryScreen';
import { PermissionService } from './services/permissionService';

// Connection Status Type
type ConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected';

// CRITICAL: Multiple TURN + STUN Servers for Maximum Compatibility
const PEER_CONFIG = {
  config: {
    iceServers: [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },

      // DEDICATED TURN servers (User's Personal Metered.ca Account - 20GB/month)
      {
        urls: 'turn:hzaid01.metered.live:80',
        username: 'gtRr_dLWdnqDx0pj0lNjhC-kofxQ-CbXJ1-YukNqhajQnuK5',
        credential: 'gtRr_dLWdnqDx0pj0lNjhC-kofxQ-CbXJ1-YukNqhajQnuK5'
      },
      {
        urls: 'turn:hzaid01.metered.live:443',
        username: 'gtRr_dLWdnqDx0pj0lNjhC-kofxQ-CbXJ1-YukNqhajQnuK5',
        credential: 'gtRr_dLWdnqDx0pj0lNjhC-kofxQ-CbXJ1-YukNqhajQnuK5'
      },
      {
        urls: 'turn:hzaid01.metered.live:443?transport=tcp',
        username: 'gtRr_dLWdnqDx0pj0lNjhC-kofxQ-CbXJ1-YukNqhajQnuK5',
        credential: 'gtRr_dLWdnqDx0pj0lNjhC-kofxQ-CbXJ1-YukNqhajQnuK5'
      },

      // Free TURN servers - Option 2: Twilio STUN/TURN
      { urls: 'stun:global.stun.twilio.com:3478' },

      // Free TURN servers - Option 3: Additional fallbacks
      {
        urls: 'turn:relay.metered.ca:80',
        username: 'e46a88927fb974bd3633df64',
        credential: 'MYDQbvLnDu7TD1P7'
      },
      {
        urls: 'turn:relay.metered.ca:443',
        username: 'e46a88927fb974bd3633df64',
        credential: 'MYDQbvLnDu7TD1P7'
      },
      {
        urls: 'turn:relay.metered.ca:443?transport=tcp',
        username: 'e46a88927fb974bd3633df64',
        credential: 'MYDQbvLnDu7TD1P7'
      }
    ],
    iceTransportPolicy: 'all', // Try all methods (direct + TURN)
    iceCandidatePoolSize: 10 // Pre-gather more candidates for faster connection
  },
  debug: 3 // Enable maximum debug logging
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [channelId, setChannelId] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Disconnected');

  // Audio join state (for autoplay policy compliance)
  const [audioJoined, setAudioJoined] = useState(false);

  // Visual feedback states
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Live caption (unified for simplicity)
  const [liveCaption, setLiveCaption] = useState<string>('Waiting to connect...');

  // AI Captioning toggle
  const [isCaptioning, setIsCaptioning] = useState(false);

  // Speech recognition availability
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(true);

  // Connection quality info
  const [connectionInfo, setConnectionInfo] = useState<string>('');

  // Refs for WebRTC management
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);

  // Remote stream ref (stored before user clicks Join Audio)
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Speech recognition ref
  const recognitionRef = useRef<any>(null);

  // Audio element ref for remote audio
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
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

  // Log ICE candidates for debugging
  const logIceCandidate = (candidate: any) => {
    if (candidate?.candidate) {
      const candidateStr = candidate.candidate;
      if (candidateStr.includes('typ relay')) {
        console.log('✅ TURN relay candidate:', candidateStr);
        setConnectionInfo('Using TURN relay (slower but works across networks)');
      } else if (candidateStr.includes('typ srflx')) {
        console.log('📡 STUN reflexive candidate:', candidateStr);
        setConnectionInfo('Using STUN (medium speed)');
      } else if (candidateStr.includes('typ host')) {
        console.log('🏠 Host candidate:', candidateStr);
        setConnectionInfo('Direct connection (fastest)');
      }
    }
  };

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
            // Update live caption
            setLiveCaption(`Me: ${transcript}`);

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
        setLiveCaption('No speech detected...');
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsSpeaking(false);
    };

    // Visual feedback for speaking
    recognition.onspeechstart = () => {
      setIsSpeaking(true);
    };

    recognition.onspeechend = () => {
      setIsSpeaking(false);
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
        setLiveCaption('Listening...');
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
      }
    }
  }, [isCaptioning, initSpeechRecognition]);

  const stopCaptioning = useCallback(() => {
    if (recognitionRef.current && isCaptioning) {
      recognitionRef.current.stop();
      setIsCaptioning(false);
      setLiveCaption('Captioning stopped');
    }
  }, [isCaptioning]);

  // Join Audio - User must click to bypass autoplay policy
  const joinAudio = () => {
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      remoteAudioRef.current.volume = 1.0; // Ensure full volume
      remoteAudioRef.current.play()
        .then(() => {
          setAudioJoined(true);
          console.log('✅ Audio playback started successfully');
        })
        .catch(e => {
          console.error('❌ Audio play failed:', e);
          alert('Failed to play audio. Please check browser permissions.');
        });
    }
  };

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
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    peerRef.current = null;
    activeCallRef.current = null;
    dataConnRef.current = null;
    remoteStreamRef.current = null;
    setConnectionStatus('Disconnected');
    setAudioJoined(false);
    setConnectionInfo('');
  };

  const endCall = () => {
    cleanupConnection();
    setAppState(AppState.SUMMARY_VIEW);
  };

  const resetToHub = () => {
    setAppState(AppState.LANDING);
    setChannelId('');
    setStatusText('');
    setLiveCaption('Waiting to connect...');
    setIsMicMuted(false);
    setIsCaptioning(false);
    setIsSpeaking(false);
    setConnectionStatus('Disconnected');
    setAudioJoined(false);
    setConnectionInfo('');
  };

  // Setup DataConnection for text sync between peers
  const setupDataConnection = (conn: DataConnection) => {
    dataConnRef.current = conn;

    conn.on('open', () => {
      console.log('✅ Data connection established with:', conn.peer);
      setConnectionStatus('Connected');
    });

    conn.on('data', (data: any) => {
      console.log('📨 Received data:', data);
      // Received text from peer
      if (data && data.text) {
        setLiveCaption(`Peer: ${data.text}`);
      }
    });

    conn.on('close', () => {
      console.log('❌ Data connection closed');
      setConnectionStatus('Disconnected');
    });

    conn.on('error', (err) => {
      console.error('❌ Data connection error:', err);
    });
  };

  const initializePeer = async (id: string | null = null): Promise<Peer> => {
    const permission = await PermissionService.requestMicrophoneAccess();
    if (!permission.stream) {
      alert("Microphone access is required.");
      throw new Error("No Mic");
    }
    localStreamRef.current = permission.stream;

    console.log('🎤 Local stream obtained:', localStreamRef.current.getTracks());

    // Initialize Peer with enhanced TURN + STUN Config
    const peer = new Peer(id ? id : undefined, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('error', (err) => {
      console.error('❌ Peer Error:', err);
      setStatusText(`Connection Error: ${err.type}`);
      setConnectionStatus('Disconnected');
      if (err.type === 'peer-unavailable') {
        alert("Channel ID not found. The Host might be offline.");
        resetToHub();
      }
    });

    // Listen for incoming data connections
    peer.on('connection', (conn) => {
      console.log("📞 Incoming data connection from:", conn.peer);
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
        console.log('✅ Peer opened as HOST with ID:', id);
        setChannelId(id);
        setAppState(AppState.WAITING_FOR_PEER);
        setStatusText("Waiting for Guest...");
      });

      // Handle Incoming Audio Call
      peer.on('call', (call) => {
        console.log('📞 Incoming call from:', call.peer);
        setStatusText("Incoming Call...");
        setConnectionStatus('Connecting');

        // Answer with local stream
        call.answer(localStreamRef.current!);
        console.log('✅ Answered call with local stream');

        handleMediaStream(call);
      });

    } catch (e) {
      console.error('❌ Host creation failed:', e);
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
        console.log('✅ Peer opened as GUEST');
        setStatusText("Handshaking...");

        // 1. Start Data Connection First
        const conn = peer.connect(targetId, { reliable: true });
        console.log('📡 Initiating data connection to:', targetId);
        setupDataConnection(conn);

        // 2. Start Audio Call
        console.log('📞 Calling host with local stream...');
        const call = peer.call(targetId, localStreamRef.current!);
        handleMediaStream(call);
      });

    } catch (e) {
      console.error('❌ Guest join failed:', e);
      setAppState(AppState.LANDING);
      setConnectionStatus('Disconnected');
    }
  };

  // Common Media Handler
  const handleMediaStream = (call: MediaConnection) => {
    activeCallRef.current = call;

    // Log ICE candidates for debugging
    call.peerConnection.addEventListener('icecandidate', (event) => {
      logIceCandidate(event.candidate);
    });

    call.on('stream', (remoteStream) => {
      console.log('✅ Received remote stream:', remoteStream);
      console.log('🔊 Remote audio tracks:', remoteStream.getAudioTracks());

      // Enable all tracks explicitly
      remoteStream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`✅ Enabled track: ${track.kind}, label: ${track.label}, enabled: ${track.enabled}`);
      });

      // Store stream but DON'T play yet (autoplay policy compliance)
      remoteStreamRef.current = remoteStream;

      setAppState(AppState.ACTIVE_CALL);
      setStatusText("Connected - Click Join Audio to hear");
      setConnectionStatus('Connected');

      // Initialize speech recognition when call becomes active
      initSpeechRecognition();
    });

    call.on('close', () => {
      console.log('❌ Call closed');
      endCall();
    });

    call.on('error', (err) => {
      console.error('❌ Call error:', err);
    });
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
        console.log(`🎤 Microphone ${audioTrack.enabled ? 'unmuted' : 'muted'}`);
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
            <span className="text-green-500 font-mono text-sm font-bold">🟢 Live</span>
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
      {/* Hidden Audio Element for Remote Stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

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
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col">
          {/* Top: Status Badge & Channel Info */}
          <div className="p-4 flex flex-col gap-3 border-b border-white/10 bg-black/50 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
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

            {/* Connection Quality Info */}
            {connectionInfo && (
              <div className="text-xs font-mono text-gray-500 bg-gray-900/50 px-3 py-2 rounded border border-gray-700">
                ℹ️ {connectionInfo}
              </div>
            )}
          </div>

          {/* Join Audio Button (Appears before audio is joined) */}
          {!audioJoined && remoteStreamRef.current && (
            <div className="p-6 flex justify-center animate-pulse">
              <button
                onClick={joinAudio}
                className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg flex items-center gap-3 shadow-lg shadow-blue-500/50 transition-all active:scale-95"
              >
                <Volume2 className="w-6 h-6" />
                🔊 JOIN AUDIO (CLICK TO HEAR)
              </button>
            </div>
          )}

          {/* Center: Large Microphone Button (Unified Walkie-Talkie Interface) */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <button
              onClick={toggleMic}
              className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${isMicMuted
                ? 'bg-red-500/20 border-4 border-red-500 text-red-500'
                : isSpeaking
                  ? 'bg-blue-600 border-4 border-blue-400 text-white ring-8 ring-blue-500/50 shadow-2xl shadow-blue-500/50'
                  : 'bg-gray-800 border-4 border-gray-600 text-white hover:border-gray-500'
                }`}
            >
              {isMicMuted ? <MicOff className="w-16 h-16" /> : <Mic className="w-16 h-16" />}
            </button>

            {/* Unmute Warning */}
            {isMicMuted && remoteStreamRef.current && (
              <div className="mt-6 px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500 text-yellow-500 text-sm font-bold">
                ⚠️ Tap Mic to Unmute
              </div>
            )}

            {/* Captioning Control */}
            <div className="mt-8 flex gap-4">
              <button
                onClick={isCaptioning ? stopCaptioning : startCaptioning}
                disabled={!speechRecognitionSupported}
                className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all ${isCaptioning
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                  } ${!speechRecognitionSupported && 'opacity-50 cursor-not-allowed'}`}
              >
                {isCaptioning ? '⏹ Stop Captioning' : '▶ Start Captioning'}
              </button>

              <button
                onClick={endCall}
                className="px-6 py-3 rounded-xl bg-red-600 text-white hover:bg-red-700 font-bold flex items-center gap-2 transition-all active:scale-95"
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </button>
            </div>
          </div>

          {/* Bottom: Live Captions Subtitle Box */}
          <div className="p-6 bg-black/70 border-t border-white/10 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto">
              <p className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-widest text-center">Live Captions</p>
              <div className="bg-gray-900/80 rounded-xl p-6 border border-gray-700 min-h-[80px] flex items-center justify-center">
                <p className="text-lg text-gray-200 leading-relaxed text-center">{liveCaption}</p>
              </div>
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
