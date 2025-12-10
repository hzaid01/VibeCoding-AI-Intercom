// Translation Service using MyMemory API (free, no API key required)
// Supports 100+ languages, 5000 chars/day free

export interface TranslationResult {
    translatedText: string;
    detectedLanguage?: string;
    success: boolean;
    error?: string;
}

// Common language codes
export const LANGUAGES = {
    'en': 'English',
    'ur': 'Urdu',
    'hi': 'Hindi',
    'ar': 'Arabic',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'it': 'Italian',
    'tr': 'Turkish',
    'nl': 'Dutch',
    'pl': 'Polish',
    'id': 'Indonesian',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'bn': 'Bengali',
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

export class TranslationService {
    private static readonly API_URL = 'https://api.mymemory.translated.net/get';

    /**
     * Translate text from one language to another
     * @param text - Text to translate
     * @param fromLang - Source language code (e.g., 'en')
     * @param toLang - Target language code (e.g., 'ur')
     */
    static async translate(
        text: string,
        fromLang: LanguageCode,
        toLang: LanguageCode
    ): Promise<TranslationResult> {
        if (!text.trim()) {
            return { translatedText: '', success: true };
        }

        // Don't translate if same language
        if (fromLang === toLang) {
            return { translatedText: text, success: true };
        }

        try {
            const langPair = `${fromLang}|${toLang}`;
            const url = `${this.API_URL}?q=${encodeURIComponent(text)}&langpair=${langPair}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.responseStatus === 200 && data.responseData?.translatedText) {
                return {
                    translatedText: data.responseData.translatedText,
                    detectedLanguage: data.responseData.detectedLanguage,
                    success: true,
                };
            } else {
                return {
                    translatedText: text,
                    success: false,
                    error: data.responseDetails || 'Translation failed',
                };
            }
        } catch (error) {
            console.error('Translation error:', error);
            return {
                translatedText: text,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Detect the language of a text
     */
    static async detectLanguage(text: string): Promise<LanguageCode | null> {
        try {
            // Use translate to English and get detected language
            const result = await this.translate(text, 'en' as LanguageCode, 'en');
            if (result.detectedLanguage && result.detectedLanguage in LANGUAGES) {
                return result.detectedLanguage as LanguageCode;
            }
            return null;
        } catch {
            return null;
        }
    }
}
