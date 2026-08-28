"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DEFAULT_STT_MODEL_ID } from "@/lib/config";
import { InferenceClient } from "@/lib/engine/worker-client";
import { recordUntilStop, speakText, stopSpeaking } from "@/lib/audio/record";

let sttClient: InferenceClient | null = null;
function sttEngine(): InferenceClient {
  sttClient ??= new InferenceClient();
  return sttClient;
}

export function AudioBar({
  onTranscript,
  ttsEnabled,
  onTtsEnabledChange,
  lastAssistantText,
}: {
  onTranscript: (text: string) => void;
  ttsEnabled: boolean;
  onTtsEnabledChange: (v: boolean) => void;
  lastAssistantText?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const sessionRef = useRef<{
    stop: () => void;
    done: Promise<Float32Array>;
  } | null>(null);

  async function onMicClick() {
    if (!recording) {
      setRecording(true);
      sessionRef.current = await recordUntilStop(setLevel);
      return;
    }
    sessionRef.current?.stop();
    setRecording(false);
    setBusy(true);
    try {
      const audio = await sessionRef.current!.done;
      const text = await sttEngine().transcribe(DEFAULT_STT_MODEL_ID, audio);
      if (text) onTranscript(text);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
      setLevel(0);
      sessionRef.current = null;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={recording ? "primary" : "secondary"}
        disabled={busy}
        onClick={() => void onMicClick()}
      >
        {busy ? "Transcribing…" : recording ? "Stop" : "Mic"}
      </Button>
      {recording && (
        <span
          className="h-2 w-16 overflow-hidden rounded-full bg-border"
          aria-hidden
        >
          <span
            className="block h-full bg-accent transition-all"
            style={{ width: `${Math.min(100, level * 400)}%` }}
          />
        </span>
      )}
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={ttsEnabled}
          onChange={(e) => onTtsEnabledChange(e.target.checked)}
        />
        Read replies aloud
      </label>
      {ttsEnabled && lastAssistantText && (
        <>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => speakText(lastAssistantText)}
          >
            Play
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={stopSpeaking}>
            Stop voice
          </Button>
        </>
      )}
    </div>
  );
}
