import { useRef, useState } from "react";

export interface SSEMsg {
  event?: string;
  type?: string;
  data: any;
}

export function useSSEPost() {
  const [events, setEvents] = useState<SSEMsg[]>([]);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  async function start(url: string, body: unknown) {
    // reset state
    setEvents([]);
    setDone(false);
    setRunning(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    if (!resp.ok || !resp.body) {
      setRunning(false);
      setDone(true);
      setEvents((prev) => [...prev, { event: "error", data: { status: resp.status } }]);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by blank line
        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sepIndex).trim();
          buffer = buffer.slice(sepIndex + 2);

          // parse only "data:" lines
          const dataLines = frame
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim());

          for (const dl of dataLines) {
            try {
              const parsed = JSON.parse(dl);
              setEvents((prev) => [...prev, parsed]);
              if (parsed?.event === "complete") {
                setDone(true);
                setRunning(false);
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      }
    } catch (e) {
      setEvents((prev) => [...prev, { event: "error", data: { message: String(e) } }]);
    } finally {
      setRunning(false);
      setDone(true);
      reader.releaseLock();
      controllerRef.current = null;
    }
  }

  function cancel() {
    controllerRef.current?.abort();
    setRunning(false);
  }

  function reset() {
    setEvents([]);
    setDone(false);
    setRunning(false);
  }

  return { events, done, running, start, cancel, reset };
}
