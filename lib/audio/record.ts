const TARGET_RATE = 16000;

/** Record mic input until stopped; returns 16 kHz mono Float32Array for Whisper. */
export async function recordUntilStop(
  onLevel?: (level: number) => void,
): Promise<{ stop: () => void; done: Promise<Float32Array> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const chunks: Float32Array[] = [];
  let stopped = false;

  const processor = ctx.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(ctx.destination);

  processor.onaudioprocess = (e) => {
    if (stopped) return;
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    if (onLevel) {
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
      onLevel(Math.sqrt(sum / input.length));
    }
  };

  const done = new Promise<Float32Array>((resolve, reject) => {
    const finish = async () => {
      try {
        stopped = true;
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        const length = chunks.reduce((n, c) => n + c.length, 0);
        const merged = new Float32Array(length);
        let off = 0;
        for (const c of chunks) {
          merged.set(c, off);
          off += c.length;
        }
        const resampled = await resampleTo16k(merged, ctx.sampleRate);
        await ctx.close();
        resolve(new Float32Array(resampled));
      } catch (err) {
        reject(err);
      }
    };
    (done as { _finish?: () => void })._finish = finish;
  });

  return {
    stop: () => {
      const finish = (done as { _finish?: () => void })._finish;
      finish?.();
    },
    done,
  };
}

async function resampleTo16k(
  samples: Float32Array,
  fromRate: number,
): Promise<Float32Array> {
  if (fromRate === TARGET_RATE) return samples;
  const duration = samples.length / fromRate;
  const outLen = Math.ceil(duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, outLen, TARGET_RATE);
  const buffer = offline.createBuffer(1, samples.length, fromRate);
  buffer.copyToChannel(new Float32Array(samples), 0);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/** Speak text with the browser Speech Synthesis API. */
export function speakText(text: string, voiceName?: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voiceName) {
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.name === voiceName);
    if (voice) u.voice = voice;
  }
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}
