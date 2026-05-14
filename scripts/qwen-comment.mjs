#!/usr/bin/env node
/**
 * Sends a source file to local Qwen (via Ollama) and gets it back with human comments.
 *
 * Usage:
 *   node scripts/qwen-comment.mjs <file>          # preview output
 *   node scripts/qwen-comment.mjs <file> --write  # write back to file
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import http from 'node:http';

const MODEL = 'qwen2.5-coder:14b';

const file = process.argv[2];
const shouldWrite = process.argv.includes('--write');

if (!file) {
  console.error('Usage: node scripts/qwen-comment.mjs <file> [--write]');
  process.exit(1);
}

const filePath = resolve(file);
const content = readFileSync(filePath, 'utf-8');

const SYSTEM = `You are a senior developer adding comments to a real estate CRM codebase (Next.js 16, TypeScript, Supabase, Claude AI API).

Rules:
- Write comments like a real developer would — conversational, direct, no corporate speak
- Explain WHY, not WHAT — the code already shows what it does
- One short line per comment max — no multi-paragraph docstrings
- Use // for inline comments; short JSDoc /** */ only for exported functions or types
- Skip obvious things: never write "// return true" or "// increment i"
- Only comment where the reason is non-obvious to a future reader
- Do not remove, reformat, or restructure any existing code — only add comments
- For React components: a 1-2 line comment at the top explaining the component's role is good
- For API routes: comment the overall request/response contract at the top

Return ONLY the file contents with comments added. No explanation. No markdown code fences. No preamble.`;

const USER = `Add comments to this file following the rules above.

File: ${file}

\`\`\`
${content}
\`\`\``;

console.error(`Sending ${file} to ${MODEL}...`);

const payload = JSON.stringify({
  model: MODEL,
  messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: USER },
  ],
  stream: true, // streaming keeps the socket alive during long generation; stream:false goes silent until done and triggers timeouts
  options: {
    temperature: 0.2,
    num_ctx: 16384,
  },
});

// Accumulate streamed NDJSON chunks from Ollama into a single string
const commented = await new Promise((resolve, reject) => {
  const req = http.request(
    { hostname: 'localhost', port: 11434, path: '/api/chat', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
    (res) => {
      let result = '';
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop(); // keep incomplete trailing line
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.message?.content) result += obj.message.content;
            if (obj.done) resolve(result.trim());
          } catch { /* ignore malformed lines */ }
        }
      });
      res.on('end', () => resolve(result.trim()));
    }
  );
  req.on('error', reject);
  req.write(payload);
  req.end();
});

if (!commented) {
  console.error('Empty response from Qwen — check Ollama logs');
  process.exit(1);
}

const stripped = commented.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

if (shouldWrite) {
  writeFileSync(filePath, stripped, 'utf-8');
  console.error(`Done. Written to: ${filePath}`);
} else {
  process.stdout.write(stripped);
}
