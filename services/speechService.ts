export class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  
  constructor(
    private onResult: (text: string, isFinal: boolean) => void,
    private onError: (error: string) => void
  ) {
    if ('webkitSpeechRecognition' in window) {
      // @ts-ignore
      this.recognition = new window.webkitSpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
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
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          this.onError('Microphone access denied for speech recognition.');
        }
      };

      this.recognition.onend = () => {
        // Auto-restart if we are still supposed to be listening
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch (e) {
            // Ignore already started errors
          }
        }
      };
    } else {
      this.onError('Browser does not support Speech Recognition.');
    }
  }

  start() {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
      } catch (e) {
        console.error("Failed to start speech recognition", e);
      }
    }
  }

  stop() {
    if (this.recognition) {
      this.isListening = false;
      this.recognition.stop();
    }
  }
}
