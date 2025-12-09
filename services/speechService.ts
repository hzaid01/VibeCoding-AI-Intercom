
export class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private shouldRestart: boolean = false;
  
  constructor(
    private onResult: (text: string, isFinal: boolean) => void,
    private onError: (error: string) => void
  ) {
    if ('webkitSpeechRecognition' in window) {
      // @ts-ignore
      this.recognition = new window.webkitSpeechRecognition();
      this.recognition.continuous = true; // Keep listening
      this.recognition.interimResults = true; // Show words as they are spoken
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
            this.onResult(finalTranscript, true);
          } else {
            interimTranscript += event.results[i][0].transcript;
            this.onResult(interimTranscript, false);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          this.onError('Microphone blocked.');
          this.shouldRestart = false;
        }
      };

      // Critical: Infinite Loop for Continuous Listening
      this.recognition.onend = () => {
        if (this.shouldRestart) {
          try {
            console.log("Restarting speech recognition...");
            this.recognition.start();
          } catch (e) {
            console.error("Restart failed", e);
          }
        }
      };
    } else {
      this.onError('Browser not supported (Use Chrome).');
    }
  }

  start() {
    if (this.recognition && !this.isListening) {
      try {
        this.shouldRestart = true;
        this.recognition.start();
        this.isListening = true;
      } catch (e) {
        console.error("Failed to start speech recognition", e);
      }
    }
  }

  stop() {
    if (this.recognition) {
      this.shouldRestart = false;
      this.isListening = false;
      this.recognition.stop();
    }
  }
}
