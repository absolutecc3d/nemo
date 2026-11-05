# Nemo — static HTML + Vercel API

This version uses a normal `index.html`, `styles.css`, and `app.js`. The Ollama key stays server-side in a Vercel Function at `api/chat.js`.

## Deploy
1. Upload the contents of this folder to a GitHub repository.
2. Import the repository at https://vercel.com/new.
3. In Vercel → Project → Settings → Environment Variables, add:
   - `OLLAMA_API_KEY` — your Ollama API key
   - `OLLAMA_MODEL` — the Ollama cloud model name you want to use
4. Redeploy after adding the variables.

The site calls `/api/chat`; do not open `index.html` as a local file and expect AI requests to work. Deploy it to Vercel so the serverless API route is available.

## Files
- `index.html` — website markup
- `styles.css` — liquid-glass styling and animations
- `app.js` — chat UI, model picker, local chat history, streaming
- `api/chat.js` — secure Vercel serverless function for Ollama
