import React, { useState, useEffect } from 'react';
import { FileText, ArrowLeft, Loader2, Languages } from 'lucide-react';
import { ChatMessage } from '../types';
import { TranslationService, LANGUAGES, LanguageCode } from '../services/translationService';

interface SummaryScreenProps {
    onBack: () => void;
    messages: ChatMessage[];
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({ onBack, messages }) => {
    const [loading, setLoading] = useState(true);
    const [translatedMessages, setTranslatedMessages] = useState<ChatMessage[]>([]);
    const [targetLang, setTargetLang] = useState<LanguageCode>('ur');
    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        // Simulate AI Processing time
        const timer = setTimeout(() => {
            setLoading(false);
            setTranslatedMessages(messages);
        }, 1500);
        return () => clearTimeout(timer);
    }, [messages]);

    const translateAll = async () => {
        setIsTranslating(true);
        const translated = await Promise.all(
            messages.map(async (msg) => {
                const result = await TranslationService.translate(msg.text, 'en', targetLang);
                return { ...msg, translatedText: result.success ? result.translatedText : msg.text };
            })
        );
        setTranslatedMessages(translated);
        setIsTranslating(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 space-y-6">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold text-white">Processing Session Data...</h2>
                    <p className="text-gray-500 font-mono text-sm">Generating conversation summary</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black p-6 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-surface border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 border-b border-gray-800 text-center">
                    <div className="inline-flex p-3 bg-gray-900 rounded-full mb-4 border border-gray-700">
                        <FileText className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Conversation Summary</h1>
                    <p className="text-gray-400 font-mono text-sm">{messages.length} messages exchanged</p>
                </div>

                {/* Translation Controls */}
                <div className="p-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-black/30">
                    <div className="flex items-center gap-3">
                        <select
                            value={targetLang}
                            onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
                            className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 text-sm"
                        >
                            {Object.entries(LANGUAGES).map(([code, name]) => (
                                <option key={code} value={code}>{name}</option>
                            ))}
                        </select>
                        <button
                            onClick={translateAll}
                            disabled={isTranslating}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
                        >
                            <Languages className="w-4 h-4" />
                            {isTranslating ? 'Translating...' : 'Translate All'}
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                    {translatedMessages.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No messages to display</p>
                    ) : (
                        translatedMessages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.sender === 'me'
                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                            : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                                        }`}
                                >
                                    <div className="text-[10px] font-mono opacity-60 mb-1">
                                        {msg.sender === 'me' ? 'YOU' : 'PEER'}
                                    </div>
                                    <p className="text-sm">{msg.text}</p>
                                    {msg.translatedText && msg.translatedText !== msg.text && (
                                        <div className="mt-2 pt-2 border-t border-white/20">
                                            <p className="text-xs opacity-70">🌐 {LANGUAGES[targetLang]}:</p>
                                            <p className="text-sm" dir={targetLang === 'ur' || targetLang === 'ar' ? 'rtl' : 'ltr'}>
                                                {msg.translatedText}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-800 bg-black/20 flex justify-center">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-mono"
                    >
                        <ArrowLeft className="w-4 h-4" /> Return to Hub
                    </button>
                </div>
            </div>
        </div>
    );
};
