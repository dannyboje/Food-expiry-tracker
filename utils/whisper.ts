const API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

/**
 * Sends a recorded audio file to Groq Whisper (free tier) and returns the transcribed text.
 * Expects a local file URI from expo-av Recording.getURI().
 * Sign up free at https://console.groq.com — no credit card required.
 */
export async function transcribeAudio(fileUri: string): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      'Add EXPO_PUBLIC_GROQ_API_KEY to your .env file. Get a free key at console.groq.com'
    );
  }

  const body = new FormData();
  body.append('file', { uri: fileUri, type: 'audio/m4a', name: 'voice.m4a' } as any);
  body.append('model', 'whisper-large-v3');
  body.append('language', 'en');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error?.message ?? `Whisper error ${res.status}`);
  }

  const json = await res.json();
  return (json.text ?? '').trim();
}
