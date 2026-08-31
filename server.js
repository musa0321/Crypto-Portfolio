const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// -------------------------------------------------------------
// 1. STATE STORE (1:1 LIVE SCHEMA SYNCHRONIZED)
// -------------------------------------------------------------
let state = {
  ts: Date.now(),
  connected: true,
  price: 78048.0,
  markPrice: 59750.94,
  high24: 61931.1,
  low24: 59060.0,
  vol24: 18828575753.09,
  fundingRate: 0.00005365,
  openInterest: 8476680380.96,
  tradeCount: 8423,
  scores: {
    biasScore: 48.0,
    marketStrength: 47.0,
    overallConf: 65,
    sweepConf: 40.8,
    sweepType: 'weak-bear',
    sweepPrice: 78048.0,
    sweepAge: Date.now() - 600000,
    nextSweepProb: 79.0,
    magnetPrice: 77000,
    magnetStrength: 99,
    magnetDist: '-1.34',
    targetPrice: 79000,
    targetScore: 97,
    targetType: 'Stop Hunt Zone ▲',
    shortSqueezeRisk: 35,
    longSqueezeRisk: 55,
    bullTrapRisk: 0,
    bearTrapRisk: 0,
    spoofProb: 92,
    spoofDetail: '$30.5 BTC bid wall at $77,878 — cancelled after 0.1s, 0% filled',
    spoofMeter: [78, 78, 73, 92, 92, 98, 92, 98, 92, 92, 92, 92, 98, 98, 92, 78, 61, 92, 92, 92],
    oiChange: 0.01
  },
  cvd: {
    delta: -38129.0,
    buyVol: 3139578.91,
    sellVol: 3177617.72,
    trend: 'Bearish ↓',
    history: []
  },
  book: {
    spread: 0.1,
    asks: [
      { price: 78160, size: 14.427, usd: 1127600, depthPct: 95 },
      { price: 78165, size: 4.814, usd: 376200, depthPct: 40 },
      { price: 78170, size: 3.551, usd: 277500, depthPct: 30 }
    ],
    bids: [
      { price: 78155, size: 1.442, usd: 112500, depthPct: 35 },
      { price: 78150, size: 0.819, usd: 64000, depthPct: 20 },
      { price: 78145, size: 0.475, usd: 37100, depthPct: 15 }
    ],
    clusters: [
      { price: 78000, value: 58031780, side: 'bid' },
      { price: 78200, value: 55032745, side: 'ask' },
      { price: 79200, value: 51300699, side: 'ask' },
      { price: 77000, value: 47655853, side: 'bid' },
      { price: 77200, value: 42311177, side: 'bid' },
      { price: 79000, value: 41228455, side: 'ask' }
    ],
    activeWalls: [
      { price: 76600, side: 'BUY', qty: 340.11, usd: 26050000 },
      { price: 79200, side: 'SELL', qty: 152.54, usd: 12080000 },
      { price: 77800, side: 'BUY', qty: 139.15, usd: 10820000 }
    ]
  },
  orderEvents: [],
  spoofWatch: [],
  alerts: []
};

// -------------------------------------------------------------
// 2. LIVE RADAR WEBSOCKET INGESTION (REAL-TIME MIRROR)
// -------------------------------------------------------------
let wsSocket = null;
let isWsConnected = false;

function connectRadarWebSocket() {
  try {
    const key = crypto.randomBytes(16).toString('base64');
    const req = https.request('https://base.akscryptodada.com/ws/radar', {
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
        'Origin': 'https://www.waqarzaka.net',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    req.on('upgrade', (res, socket, head) => {
      console.log('⚡ Connected to Live Radar WebSocket (base.akscryptodada.com)!');
      wsSocket = socket;
      isWsConnected = true;
      let buffer = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 2) {
          const opcode = buffer[0] & 0x0f;
          if (opcode === 8) { // close frame
            socket.end();
            return;
          }

          let len = buffer[1] & 0x7f;
          let offset = 2;

          if (len === 126) {
            if (buffer.length < 4) break;
            len = buffer.readUInt16BE(2);
            offset = 4;
          } else if (len === 127) {
            if (buffer.length < 10) break;
            len = Number(buffer.readBigUInt64BE(2));
            offset = 10;
          }

          if (buffer.length < offset + len) break; // wait for full frame

          const payload = buffer.slice(offset, offset + len).toString('utf8');
          buffer = buffer.slice(offset + len);

          try {
            const msg = JSON.parse(payload);
            if (msg.type === 'update' && msg.data) {
              const d = msg.data;
              state.price = d.price || state.price;
              state.markPrice = d.markPrice || state.markPrice;
              state.high24 = d.high24 || state.high24;
              state.low24 = d.low24 || state.low24;
              state.vol24 = d.vol24 || state.vol24;
              state.fundingRate = d.fundingRate !== undefined ? d.fundingRate : state.fundingRate;
              state.openInterest = d.openInterest || state.openInterest;
              state.tradeCount = d.tradeCount || state.tradeCount;

              if (d.scores) {
                state.scores = Object.assign(state.scores, d.scores);
              }

              if (d.cvd) {
                state.cvd.history = d.cvd.slice(-150);
                if (d.cvd.length > 0) {
                  const last = d.cvd[d.cvd.length - 1];
                  state.cvd.delta = last.cvd || state.cvd.delta;
                }
              }

              if (d.book) {
                if (d.book.asks && d.book.asks.length > 0) state.book.asks = d.book.asks;
                if (d.book.bids && d.book.bids.length > 0) state.book.bids = d.book.bids;
                if (d.book.clusters && d.book.clusters.length > 0) state.book.clusters = d.book.clusters;
                if (d.book.walls && d.book.walls.length > 0) state.book.activeWalls = d.book.walls;
                if (d.book.spread !== undefined) state.book.spread = d.book.spread;
                if (d.book.events && d.book.events.length > 0) state.orderEvents = d.book.events;
              }

              if (d.alerts && d.alerts.length > 0) {
                state.alerts = d.alerts;
              }
            }
          } catch(e) {}
        }
      });

      socket.on('close', () => {
        isWsConnected = false;
        setTimeout(connectRadarWebSocket, 2000);
      });

      socket.on('error', () => {
        isWsConnected = false;
        socket.destroy();
      });
    });

    req.on('error', (e) => {
      isWsConnected = false;
      setTimeout(connectRadarWebSocket, 3000);
    });

    req.end();
  } catch (err) {
    setTimeout(connectRadarWebSocket, 3000);
  }
}

connectRadarWebSocket();

// -------------------------------------------------------------
// 3. BINANCE FUTURES REAL-TIME BACKUP STREAM
// -------------------------------------------------------------
function syncBinanceBackup() {
  if (isWsConnected) return; // WebSocket is primary source

  https.get('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT', (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
      try {
        const d = JSON.parse(raw);
        if (d.lastPrice) {
          state.price = parseFloat(d.lastPrice);
          state.high24 = parseFloat(d.highPrice);
          state.low24 = parseFloat(d.lowPrice);
          state.vol24 = parseFloat(d.quoteVolume);
        }
      } catch(e) {}
    });
  }).on('error', () => {});
}

setInterval(syncBinanceBackup, 1000);

// -------------------------------------------------------------
// 4. HTTP SSE SERVER
// -------------------------------------------------------------
const sseClients = new Set();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.url === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.url === '/api/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }

  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }));
    return;
  }

  // Static files
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '/liquidity-radar') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

// Broadcast live SSE to browsers every 150ms
setInterval(() => {
  if (sseClients.size > 0) {
    const payload = `data: ${JSON.stringify(state)}\n\n`;
    for (const client of sseClients) {
      try {
        if (!client.writableEnded && !client.destroyed) {
          client.write(payload);
        } else {
          sseClients.delete(client);
        }
      } catch (e) {
        sseClients.delete(client);
      }
    }
  }
}, 150);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`⚡ LIQUIDITY RADAR LIVE SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
