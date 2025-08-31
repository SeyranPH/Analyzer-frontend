import { useMemo, useState } from "react";
import { useSSEPost } from "./hooks/useSSEPost";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export default function App() {
  const [question, setQuestion] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [threshold, setThreshold] = useState(0.7);

  const { events, done, running, start, reset, cancel } = useSSEPost();

  const answer = useMemo(() => {
    // find the last streamed "result" carrying an "answer"
    const results = events.filter((e) => e.type === "result" && e.data?.type === "answer");
    if (results.length === 0) return "";
    return results[results.length - 1].data.answer ?? "";
  }, [events]);

  const logs = useMemo(() => {
    // show everything except the raw "result" blocks (those can be large)
    return events.filter((e) => !(e.type === "result" && e.data?.type === "answer"));
  }, [events]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    await start(`${API_BASE}/analysis/answer`, {
      question,
      namespace,
      threshold,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white py-4 shadow">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">✨ AI Analyzer</h1>
          <span className="text-xs opacity-90">RAG + Agent • Pinecone • arXiv</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Query section */}
        <section className="bg-white rounded-xl shadow p-4 md:p-6">
          <h2 className="font-semibold text-lg mb-3">Query</h2>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              className="md:col-span-4 border rounded-lg p-3 focus:ring focus:ring-indigo-300"
              placeholder="Ask a question to analyze (e.g., 'Effects of AI on education')"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
            <input
              className="md:col-span-1 border rounded-lg p-3"
              placeholder="namespace"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              title="Pinecone namespace"
            />
            <input
              className="md:col-span-1 border rounded-lg p-3"
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              title="retrieval score threshold"
            />
            <div className="md:col-span-6 flex gap-2">
              <button
                type="submit"
                disabled={running || !question}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {running ? "Analyzing..." : "Analyze"}
              </button>
              {running && (
                <button
                  type="button"
                  onClick={cancel}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              )}
              {!running && events.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Event Logs */}
        <section className="bg-white rounded-xl shadow p-4 md:p-6">
          <h2 className="font-semibold text-lg mb-3">Event Logs</h2>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {logs.length === 0 && (
              <p className="text-gray-400 italic">
                {running ? "Waiting for events..." : "No events yet."}
              </p>
            )}
            {logs.map((ev, idx) => (
              <div key={idx} className="text-sm p-2 border rounded-lg bg-gray-50">
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(ev, null, 2)}
                </pre>
              </div>
            ))}
          </div>
          {done && (
            <p className="text-xs text-gray-500 mt-2">
              Stream complete. ({events.length} messages)
            </p>
          )}
        </section>

        {/* Final Answer */}
        <section className="bg-green-50 border border-green-200 rounded-xl p-4 md:p-6">
          <h2 className="font-semibold text-lg text-green-800 mb-2">Final Answer</h2>
          <p className="text-gray-800 whitespace-pre-wrap min-h-10">
            {answer || (running ? "Generating answer..." : "—")}
          </p>
        </section>
      </main>
    </div>
  );
}
