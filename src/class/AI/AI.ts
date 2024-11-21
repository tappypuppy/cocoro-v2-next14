import OpenAI from "openai";
import { put } from "@vercel/blob";

export default class AI {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private getFormattedDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
    return `${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds}`;
  }

  async speechToText(audioBlob: Blob): Promise<string> {
    // const srcURL = `/audio/input/speech_${this.getFormattedDateTime()}.mp3`;

    // Code to convert audioBlob to speech
    // blob to file
    const audioFile = new File([audioBlob], "audio.wav", {
      type: audioBlob.type,
      lastModified: Date.now(),
    });
    const transcription = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });
    console.log("Transcription:", transcription.text);
    // const { url } = await put(srcURL, audioFile, { access: "public" });
    // console.log("Audio URL:", url);

    return transcription.text;
  }

  async textToSpeech(text: string) {
    const response = await this.openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const srcURL = `/audio/output/speech_${this.getFormattedDateTime()}.mp3`;
    const { url } = await put(srcURL, buffer, { access: "public" });
    console.log(`Audio saved to ${url}`);

    return url;
  }
}
