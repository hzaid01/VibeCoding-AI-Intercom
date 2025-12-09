import { PermissionStatus } from '../types';

export class PermissionService {
  static async checkMicrophonePermission(): Promise<PermissionStatus> {
    if (!navigator.permissions || !navigator.permissions.query) {
      // Fallback for browsers not supporting permissions query for mic
      return PermissionStatus.UNKNOWN;
    }

    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      switch (permissionStatus.state) {
        case 'granted':
          return PermissionStatus.GRANTED;
        case 'denied':
          return PermissionStatus.DENIED;
        case 'prompt':
          return PermissionStatus.PROMPT;
        default:
          return PermissionStatus.UNKNOWN;
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
      return PermissionStatus.UNKNOWN;
    }
  }

  static async requestMicrophoneAccess(): Promise<{ status: PermissionStatus; stream: MediaStream | null }> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return { status: PermissionStatus.GRANTED, stream };
    } catch (error) {
      console.error("Permission request failed:", error);
      return { status: PermissionStatus.DENIED, stream: null };
    }
  }
}