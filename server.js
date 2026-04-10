#!/usr/bin/env node
/**
 * @file server.js
 * @description Production-ready server for Open-MiMo-TTS platform.
 * Supports cloud deployment, auto-cleanup of temporary files, and ENV configuration.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Configuration ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3456;
const AUDIO_DIR = path.join(__dirname, 'audio');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const STATIC_DIR = path.join(__dirname, 'static');
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const FILE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Ensure directories exist
[AUDIO_DIR, UPLOAD_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Environment Loading ────────────────────────────────────────────────
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const API_ENDPOINT = process.env.MIMO_API_ENDPOINT || 'https://api.xiaomimimo.com/v1/chat/completions';
const API_MODEL = process.env.MIMO_TTS_MODEL || 'mimo-v2-tts';

const VOICES = [
  { id: 'mimo_default', name: '默认音色', desc: 'MiMo 通用音色，适合大多数场景', emoji: '🎙️' },
  { id: 'default_zh', name: '中文音色', desc: '优化的中文发音，更自然流畅', emoji: '🇨🇳' },
  { id: 'default_en', name: '英文音色', desc: '优化的英文发音，适合双语场景', emoji: '🇬🇧' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.wav': 'audio/wav',
  '.json': 'application/json',
};

// ── Shared Logic ────────────────────────────────────────────────────────

/**
 * Resolves the API Key from headers or environment.
 * @param {Object} reqHeaders 
 * @returns {string}
 */
function getApiKey(reqHeaders) {
  if (reqHeaders && reqHeaders['x-mimo-api-key']) return reqHeaders['x-mimo-api-key'];
  return process.env.MIMO_API_KEY || '';
}

/**
 * Automated Cleanup Task
 * Deletes files older than FILE_MAX_AGE every CLEANUP_INTERVAL.
 */
function runCleanup() {
  const now = Date.now();
  [AUDIO_DIR, UPLOAD_DIR].forEach(dir => {
    fs.readdir(dir, (err, files) => {
      if (err) return;
      files.forEach(file => {
        if (!file.endsWith('.wav')) return;
        const filePath = path.join(dir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          if (now - stats.mtimeMs > FILE_MAX_AGE) {
            fs.unlink(filePath, () => {});
          }
        });
      });
    });
  });
}
setInterval(runCleanup, CLEANUP_INTERVAL);

// ── Direct TTS API call ─────────────────────────────────────────────────
async function callTTS(text, style, voice, voiceSamplePath, overrideApiKey) {
  const currentApiKey = overrideApiKey || getApiKey();
  if (!currentApiKey) throw new Error('API Key missing. Please configure it in environment or via Config tab.');

  return new Promise((resolve, reject) => {
    const content = style ? `<style>${style}</style>${text}` : text;
    let payload;

    if (voiceSamplePath) {
      const audioB64 = fs.readFileSync(voiceSamplePath).toString('base64');
      payload = JSON.stringify({
        model: API_MODEL,
        audio: { format: 'wav', voice_audio: { format: 'wav', data: audioB64 } },
        messages: [{ role: 'assistant', content }],
      });
    } else {
      payload = JSON.stringify({
        model: API_MODEL,
        audio: { format: 'wav', voice: voice || 'mimo_default' },
        messages: [{ role: 'assistant', content }],
      });
    }

    const url = new URL(API_ENDPOINT);
    const options = {
      hostname: url.hostname, port: url.port || 443, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': currentApiKey, 'Content-Length': Buffer.byteLength(payload) },
    };

    const proto = url.protocol === 'https:' ? require('https') : require('http');
    const req = proto.request(options, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message || JSON.stringify(json.error)));
          const audioB64 = json.choices[0].message.audio.data;
          const raw = Buffer.from(audioB64, 'base64');

          // Add WAV Header if missing
          if (raw.slice(0, 4).toString() === 'RIFF') {
            resolve(raw);
          } else {
            const sr = 24000, bps = 16, ch = 1;
            const dataSize = raw.length;
            const header = Buffer.alloc(44);
            header.write('RIFF', 0); header.writeUInt32LE(36 + dataSize, 4); header.write('WAVE', 8);
            header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
            header.writeUInt16LE(ch, 22); header.writeUInt32LE(sr, 24);
            header.writeUInt32LE(sr * ch * bps / 8, 28); header.writeUInt16LE(ch * bps / 8, 32);
            header.writeUInt16LE(bps, 34); header.write('data', 36); header.writeUInt32LE(dataSize, 40);
            resolve(Buffer.concat([header, raw]));
          }
        } catch (e) { reject(new Error('Failed to parse API response: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Verifies the validity of an API Key by calling the upstream models endpoint.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function verifyApiKey(key) {
  if (!key) return false;
  return new Promise((resolve) => {
    const url = new URL(API_ENDPOINT);
    const options = {
      hostname: url.hostname, port: 443,
      path: '/v1/models',
      method: 'GET',
      headers: { 'api-key': key },
      timeout: 5000
    };
    const proto = require('https');
    const req = proto.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ── HTTP helpers ─────────────────────────────────────────────────────────
function serveStatic(req, res) {
  let fp = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  fp = path.join(STATIC_DIR, fp);
  if (!fp.startsWith(STATIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}

function serveFile(dir, req, res) {
  const fn = path.basename(req.url.split('?')[0]);
  const fp = path.join(dir, fn);
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end('Not Found'); return; }
  const st = fs.statSync(fp);
  res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(fp).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(buf, boundary) {
  const fields = {}, files = {};
  const bnd = Buffer.from('--' + boundary);
  let start = buf.indexOf(bnd) + bnd.length + 2;
  while (true) {
    const end = buf.indexOf(bnd, start);
    if (end === -1) break;
    const part = buf.slice(start, end - 2);
    const hdrEnd = part.indexOf('\r\n\r\n');
    if (hdrEnd === -1) { start = end + bnd.length + 2; continue; }
    const hdr = part.slice(0, hdrEnd).toString();
    const body = part.slice(hdrEnd + 4);
    const nm = hdr.match(/name="([^"]+)"/);
    const fn = hdr.match(/filename="([^"]+)"/);
    if (nm) { if (fn) files[nm[1]] = { filename: fn[1], data: body }; else fields[nm[1]] = body.toString(); }
    const nxt = buf.indexOf('\r\n', end + bnd.length);
    if (nxt !== -1 && buf.slice(end + bnd.length, nxt).toString() === '--') break;
    start = end + bnd.length + 2;
  }
  return { fields, files };
}

// ── Route handlers ───────────────────────────────────────────────────────
async function handleGenerate(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const { text, style, voice } = body;
    if (!text?.trim()) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '请输入文本' })); return; }

    const id = crypto.randomBytes(8).toString('hex');
    const outPath = path.join(AUDIO_DIR, `${id}.wav`);

    const wav = await callTTS(text, style, voice, null, req.headers['x-mimo-api-key']);

    fs.writeFileSync(outPath, wav);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, id, url: `/audio/${id}.wav`, size: wav.length }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handleClone(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const { text, style, voiceSampleId } = body;
    if (!text?.trim()) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '请输入文本' })); return; }

    const samplePath = path.join(UPLOAD_DIR, `${voiceSampleId}.wav`);
    if (!fs.existsSync(samplePath)) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '声音样本不存在' })); return; }

    const id = crypto.randomBytes(8).toString('hex');
    const outPath = path.join(AUDIO_DIR, `${id}.wav`);

    const wav = await callTTS(text, style, null, samplePath, req.headers['x-mimo-api-key']);

    fs.writeFileSync(outPath, wav);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, id, url: `/audio/${id}.wav`, size: wav.length, cloned: true }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handleUpload(req, res) {
  try {
    const buf = await readBody(req);
    const ct = req.headers['content-type'] || '';
    const bm = ct.match(/boundary=(.+)/);
    if (!bm) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing boundary' })); return; }

    const { files } = parseMultipart(buf, bm[1]);
    if (!files.voice) { res.writeHead(400); res.end(JSON.stringify({ error: '请上传 WAV 文件' })); return; }

    const id = crypto.randomBytes(8).toString('hex');
    const fp = path.join(UPLOAD_DIR, `${id}.wav`);
    fs.writeFileSync(fp, files.voice.data);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, id, filename: files.voice.filename, url: `/uploads/${id}.wav` }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ── Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mimo-api-key');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    if (req.url === '/api/generate' && req.method === 'POST') return await handleGenerate(req, res);
    if (req.url === '/api/clone' && req.method === 'POST') return await handleClone(req, res);
    if (req.url === '/api/voices' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ voices: VOICES, model: API_MODEL, endpoint: API_ENDPOINT, hasApiKey: !!getApiKey(req.headers) }));
      return;
    }
    if (req.url === '/api/status' && req.method === 'GET') {
      const key = getApiKey(req.headers);
      const isValid = await verifyApiKey(key);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        online: true, 
        configured: !!key,
        valid: isValid,
        keyPreview: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null 
      }));
      return;
    }

    if (req.url === '/api/upload' && req.method === 'POST') return await handleUpload(req, res);
    if (req.url.startsWith('/audio/')) return serveFile(AUDIO_DIR, req, res);
    if (req.url.startsWith('/uploads/')) return serveFile(UPLOAD_DIR, req, res);
    serveStatic(req, res);
  } catch (e) {
    console.error('[Server] Error:', e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎙️  Open-MiMo-TTS Platform Ready`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`   Model: ${API_MODEL}`);
  console.log(`   Config: .env or Environment Variables`);
});
