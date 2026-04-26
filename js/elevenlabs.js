/**
 * ElevenLabs TTS Client
 * Wraps the ElevenLabs REST API for voice listing and text-to-speech synthesis
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export class ElevenLabsClient {
	/**
	 * Fetch available voices for the given API key
	 * @param {string} apiKey
	 * @returns {Promise<Array<{id: string, name: string}>>}
	 */
	async fetchVoices(apiKey) {
		const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
			headers: { "xi-api-key": apiKey },
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`ElevenLabs voices error ${response.status}: ${text}`);
		}

		const data = await response.json();
		return (data.voices || [])
			.map((v) => ({ id: v.voice_id, name: v.name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Synthesize speech and return raw MP3 bytes
	 * @param {string} apiKey
	 * @param {string} voiceId
	 * @param {string} modelId
	 * @param {string} text
	 * @returns {Promise<Uint8Array>}
	 */
	async synthesize(apiKey, voiceId, modelId, text) {
		const response = await fetch(
			`${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`,
			{
				method: "POST",
				headers: {
					"xi-api-key": apiKey,
					"Content-Type": "application/json",
					Accept: "audio/mpeg",
				},
				body: JSON.stringify({ text, model_id: modelId }),
			},
		);

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`ElevenLabs TTS error ${response.status}: ${text}`);
		}

		const buffer = await response.arrayBuffer();
		return new Uint8Array(buffer);
	}
}
