
export enum AppState {
  LANDING = 'LANDING',
  INITIALIZING = 'INITIALIZING',
  WAITING_FOR_PEER = 'WAITING_FOR_PEER', // Host waiting
  CONNECTING = 'CONNECTING', // Guest connecting
  ACTIVE_CALL = 'ACTIVE_CALL',
  SUMMARY_VIEW = 'SUMMARY_VIEW',
}

export interface CallMetrics {
  duration: number; // in seconds
  status: 'secure' | 'connecting' | 'failed';
}

export enum PermissionStatus {
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  PROMPT = 'PROMPT',
  UNKNOWN = 'UNKNOWN',
}

export interface TranscriptionItem {
  id: string;
  sender: 'local' | 'remote'; // New field to identify speaker
  text: string;
  translatedText?: string;
  isFinal: boolean;
  timestamp: number;
}
