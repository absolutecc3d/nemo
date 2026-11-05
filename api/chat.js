export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.OLLAMA_API_KEY;
  const model = process.env.OLLAMA_MODEL;
  if (!apiKey) return res.status(503).json({ error: "OLLAMA_API_KEY has not been configured in Vercel." });
  if (!model) return res.status(503).json({ error: "OLLAMA_MODEL has not been configured in Vercel." });

  const { messages = [], currentMessage = "" } = req.body || {};
  if (typeof currentMessage !== "string" || !currentMessage.trim() || currentMessage.length > 12000) {
    return res.status(400).json({ error: "Write a message between 1 and 12,000 characters." });
  }
  if (!Array.isArray(messages) || messages.length > 80 || messages.some(m =>
    !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 12000
  )) return res.status(400).json({ error: "Conversation history is invalid or too long." });

  const history = messages.map(m => `${m.role === "assistant" ? "Nemo3" : "User"}: ${m.content}`).join("\n\n");
  const prompt = `Hello, you are Nemo3, a helpful AI chatbot which can answer questions and help with problems
Below is the current conversation history for this chat, the current message is marked with the [CURRENT]: tag and will always be at the end of the list. Answer questions helpfully, detailed and a good resource

Conversation history:
${history ? history + "\n\n" : ""}[CURRENT]: ${currentMessage.trim()}`;

  let upstream;
  try {
    upstream = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], stream: true })
    });
  } catch {
    return res.status(502).json({ error: "Could not connect to Ollama. Please try again." });
  }
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return res.status(upstream.status).json({ error: detail.slice(0, 500) || `Ollama returned ${upstream.status}. Check your API key and model name.` });
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!upstream.body) return res.end();
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}
