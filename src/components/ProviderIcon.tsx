import type { ProviderId } from "@/lib/providers";

export function ProviderIcon({ provider, className = "size-4" }: { provider: ProviderId; className?: string }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="Google">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.2-5.5 4.2-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5L18.4 5C16.9 3.6 14.7 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c6.9 0 9.3-4.9 9.3-9 0-.6-.1-1.1-.2-1.6H12z"/>
      </svg>
    );
  }
  if (provider === "openai") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="OpenAI" fill="currentColor">
        <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.92 6.05 6.05 0 0 0-6.52-2.9A6.05 6.05 0 0 0 4.98 4.2a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.09 5.98 5.98 0 0 0 .52 4.92 6.05 6.05 0 0 0 6.52 2.9 5.98 5.98 0 0 0 4.51 2.01 6.05 6.05 0 0 0 5.77-4.2 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.76-7.1Zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.78.78 0 0 0 .39-.68v-6.74l2.02 1.17c.02.01.04.03.04.06v5.58a4.5 4.5 0 0 1-4.49 4.49ZM3.6 18.5a4.48 4.48 0 0 1-.54-3.03l.14.08 4.78 2.76c.24.14.54.14.78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 20.13a4.5 4.5 0 0 1-6.14-1.63ZM2.34 8.09a4.48 4.48 0 0 1 2.35-1.97v5.68c0 .28.15.54.39.68l5.82 3.36-2.02 1.17a.08.08 0 0 1-.07 0L3.98 14.22a4.5 4.5 0 0 1-1.64-6.14Zm16.6 3.86-5.83-3.38 2.02-1.16a.08.08 0 0 1 .07 0l4.83 2.79a4.5 4.5 0 0 1-.68 8.11v-5.68a.78.78 0 0 0-.4-.68Zm2.01-3.02-.14-.08-4.77-2.77a.78.78 0 0 0-.79 0L9.42 9.44V7.11a.08.08 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66Zm-12.65 4.15L6.28 11.9a.08.08 0 0 1-.04-.06V6.28a4.5 4.5 0 0 1 7.37-3.46l-.14.08L8.7 5.66a.78.78 0 0 0-.39.68v6.74Zm1.1-2.37 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5v-3Z"/>
      </svg>
    );
  }
  if (provider === "openrouter") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="OpenRouter" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 12h6l3-4h6M3 12l3 3M3 12l3-3M21 12h-6l-3 4H3M21 12l-3 3M21 12l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (provider === "groq") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="Groq" fill="#F55036">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 15.5A5.5 5.5 0 1 1 17.5 12 5.51 5.51 0 0 1 12 17.5Zm0-8.5A3 3 0 1 0 15 12a3 3 0 0 0-3-3Z"/>
      </svg>
    );
  }
  if (provider === "gemini") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="Gemini">
        <path fill="#4285F4" d="M12 2 14 10l8 2-8 2-2 8-2-8-8-2 8-2z"/>
      </svg>
    );
  }
  if (provider === "chatgpt") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="ChatGPT" fill="#10A37F">
        <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.92 6.05 6.05 0 0 0-6.52-2.9A6.05 6.05 0 0 0 4.98 4.2a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.09 5.98 5.98 0 0 0 .52 4.92 6.05 6.05 0 0 0 6.52 2.9 5.98 5.98 0 0 0 4.51 2.01 6.05 6.05 0 0 0 5.77-4.2 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.76-7.1Z"/>
      </svg>
    );
  }
  return null;
}
