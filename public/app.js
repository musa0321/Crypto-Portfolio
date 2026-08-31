// -------------------------------------------------------------
// 1. LIVE UTC CLOCK & NAVIGATION TABS
// -------------------------------------------------------------
setInterval(() => {
  const d = new Date();
  document.getElementById('utc-clock').textContent = d.toUTCString().slice(17, 25) + ' UTC';
}, 1000);

let currentTab = 'main';

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('main').forEach(m => m.style.display = 'none');

  const btn = document.getElementById(`tab-btn-${tabId}`);
  if (btn) btn.classList.add('active');

  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.style.display = tabId === 'main' ? 'grid' : 'flex';

  if (tabId === 'advanced') {
    drawExtendedCvd();
  }
}

function toggleExplainer(id) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.classList.toggle('open');
  }
}

// -------------------------------------------------------------
// 2. 6-AXIS SPIDER RADAR CANVAS ENGINE (60 FPS)
// -------------------------------------------------------------
function drawRadar(scores = {}) {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = 270, h = 270;
  canvas.width = w;
  canvas.height = h;

  const cx = w / 2;
  const cy = h / 2;
  const radius = 95;

  const axes = [
    { label: 'BIAS', val: (scores.biasScore || 48) / 100 },
    { label: 'STRENGTH', val: (scores.marketStrength || 47) / 100 },
    { label: 'MAGNET', val: Math.max(0.1, Math.min(1, (scores.magnetStrength || 99) / 100)) },
    { label: 'SWEEP', val: Math.max(0.1, Math.min(1, (scores.sweepConf || 40) / 100)) },
    { label: 'SPOOF', val: Math.max(0.1, Math.min(1, (scores.spoofProb || 92) / 100)) },
    { label: 'OI', val: Math.max(0.1, Math.min(1, (Math.abs(scores.oiChange || 0) + 0.5) / 2)) }
  ];

  ctx.clearRect(0, 0, w, h);

  // Concentric spider rings
  [0.33, 0.66, 1.0].forEach(ring => {
    ctx.beginPath();
    for (let i = 0; i < axes.length; i++) {
      const angle = (Math.PI * 2 / axes.length) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius * ring;
      const y = cy + Math.sin(angle) * radius * ring;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Spokes & Text Labels
  axes.forEach((axis, i) => {
    const angle = (Math.PI * 2 / axes.length) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const tx = cx + Math.cos(angle) * (radius + 18);
    const ty = cy + Math.sin(angle) * (radius + 18);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(axis.label, tx, ty);
  });

  // Dynamic Polygon Fill
  ctx.beginPath();
  axes.forEach((axis, i) => {
    const angle = (Math.PI * 2 / axes.length) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius * axis.val;
    const py = cy + Math.sin(angle) * radius * axis.val;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
  grad.addColorStop(1, 'rgba(59, 130, 246, 0.08)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Vertex Points
  axes.forEach((axis, i) => {
    const angle = (Math.PI * 2 / axes.length) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius * axis.val;
    const py = cy + Math.sin(angle) * radius * axis.val;

    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

// -------------------------------------------------------------
// 3. CVD CANVAS VISUALIZERS
// -------------------------------------------------------------
function drawCvd(history = []) {
  const canvas = document.getElementById('cvdCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = 340, h = 65;
  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  if (!history || history.length < 2) return;

  const vals = history.map(item => item.cvd !== undefined ? item.cvd : item);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = Math.max(max - min, 1);

  const getX = (idx) => (idx / (vals.length - 1)) * w;
  const getY = (val) => h - ((val - min) / range) * (h - 14) - 7;

  const isRising = vals[vals.length - 1] >= vals[0];
  const color = isRising ? '#00e676' : '#ff3366';

  // Area fill
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = getX(i);
    const y = getY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isRising ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 51, 102, 0.3)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = getX(i);
    const y = getY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Last Point Dot
  const lastY = getY(vals[vals.length - 1]);
  ctx.beginPath();
  ctx.arc(w - 2, lastY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawExtendedCvd() {
  const canvas = document.getElementById('cvdExtendedCanvas');
  if (!canvas || !localState.cvd || !localState.cvd.history || localState.cvd.history.length < 2) return;
  const ctx = canvas.getContext('2d');
  const w = 580, h = 130;
  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  const vals = localState.cvd.history.map(item => item.cvd !== undefined ? item.cvd : item);
  if (vals.length < 2) return;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = Math.max(max - min, 1);

  const getX = (idx) => (idx / (vals.length - 1)) * w;
  const getY = (val) => h - ((val - min) / range) * (h - 20) - 10;

  const isRising = vals[vals.length - 1] >= vals[0];
  const color = isRising ? '#00e676' : '#ff3366';

  // Area
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = getX(i);
    const y = getY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isRising ? 'rgba(0, 230, 118, 0.35)' : 'rgba(255, 51, 102, 0.35)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = getX(i);
    const y = getY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// -------------------------------------------------------------
// 4. ANIMATED SPOOFING HISTOGRAM (20 BARS)
// -------------------------------------------------------------
function renderSpoofHistogram(meter = [78, 78, 73, 92, 92, 98, 92, 98, 92, 92, 92, 92, 98, 98, 92, 78, 61, 92, 92, 92]) {
  const container = document.getElementById('spoof-histogram');
  if (!container) return;
  container.innerHTML = '';
  meter.forEach((h, i) => {
    const col = document.createElement('div');
    col.className = 'spoof-col';
    col.style.height = `${h}%`;
    col.style.background = h >= 90 ? 'var(--red)' : h >= 70 ? 'var(--amber)' : '#eab308';
    container.appendChild(col);
  });
}
renderSpoofHistogram();

// -------------------------------------------------------------
// 5. LOCAL STATE & REACTIVE UI RENDERER
// -------------------------------------------------------------
let previousPrice = 0;
let localState = {
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
  book: { spread: 0.1, asks: [], bids: [], clusters: [], activeWalls: [] },
  alerts: []
};

function updateUI() {
  const p = localState.price || 78048;
  const priceElem = document.getElementById('hero-price');
  priceElem.textContent = '$' + Math.round(p).toLocaleString();

  // Flashing animation on price tick
  if (previousPrice > 0) {
    if (p > previousPrice) {
      priceElem.classList.add('price-flash-up');
      setTimeout(() => priceElem.classList.remove('price-flash-up'), 200);
    } else if (p < previousPrice) {
      priceElem.classList.add('price-flash-down');
      setTimeout(() => priceElem.classList.remove('price-flash-down'), 200);
    }
  }
  previousPrice = p;

  // 24h Change %
  const chg = localState.priceChangePercent !== undefined 
    ? localState.priceChangePercent 
    : ((p - (localState.low24 || p)) / (localState.low24 || p)) * 100;
  const heroChgEl = document.getElementById('hero-change');
  if (heroChgEl) {
    heroChgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
    heroChgEl.className = 'hero-change ' + (chg >= 0 ? 'chip-bull' : 'chip-bear');
  }

  // 24h Stats
  if (localState.high24) document.getElementById('stat-high').textContent = '$' + Math.round(localState.high24).toLocaleString();
  if (localState.low24) document.getElementById('stat-low').textContent = '$' + Math.round(localState.low24).toLocaleString();
  if (localState.vol24) document.getElementById('stat-vol').textContent = '$' + (localState.vol24 / 1e9).toFixed(2) + 'B';
  if (localState.markPrice) document.getElementById('stat-mark').textContent = '$' + Math.round(localState.markPrice).toLocaleString();

  // Header status stats
  if (localState.openInterest) {
    const oiText = '$' + (localState.openInterest / 1e9).toFixed(2) + 'B';
    document.getElementById('top-oi').textContent = oiText;
    document.getElementById('box-oi').textContent = oiText;
  }
  if (localState.fundingRate !== undefined) {
    const frText = (localState.fundingRate >= 0 ? '+' : '') + (localState.fundingRate * 100).toFixed(4) + '%';
    document.getElementById('top-fr').textContent = frText;
    document.getElementById('card-fr').textContent = frText;
  }
  if (localState.book && localState.book.spread) {
    document.getElementById('top-spr').textContent = '$' + localState.book.spread.toFixed(1);
  }
  if (localState.tradeCount) {
    document.getElementById('top-trd').textContent = localState.tradeCount;
  }

  // Market Bias
  const bias = localState.scores.biasScore !== undefined ? localState.scores.biasScore : 48.0;
  document.getElementById('bias-buy-text').textContent = bias.toFixed(1) + '% BUY';
  document.getElementById('bias-mid-text').textContent = bias.toFixed(1) + ' / 100';
  document.getElementById('bias-sell-text').textContent = (100 - bias).toFixed(1) + '% SELL';
  document.getElementById('bias-buy-bar').style.width = bias + '%';
  document.getElementById('bias-sell-bar').style.width = (100 - bias) + '%';

  const biasChip = document.getElementById('bias-chip');
  if (bias >= 70) { biasChip.textContent = 'STRONG BULLISH'; biasChip.className = 'bias-chip chip-strong-bull'; }
  else if (bias >= 58) { biasChip.textContent = 'BULLISH'; biasChip.className = 'bias-chip chip-bull'; }
  else if (bias >= 44) { biasChip.textContent = 'NEUTRAL'; biasChip.className = 'bias-chip chip-neutral'; }
  else if (bias >= 30) { biasChip.textContent = 'BEARISH'; biasChip.className = 'bias-chip chip-bear'; }
  else { biasChip.textContent = 'STRONG BEARISH'; biasChip.className = 'bias-chip chip-strong-bear'; }

  // Confidence
  document.getElementById('confidence-val').textContent = localState.scores.overallConf || 65;

  // Liquidity Magnet
  const magnetP = localState.scores.magnetPrice || 77000;
  document.getElementById('magnet-price').textContent = '$' + magnetP.toLocaleString();
  const dist = parseFloat(localState.scores.magnetDist || '-1.34');
  const distElem = document.getElementById('magnet-dist');
  distElem.textContent = (dist >= 0 ? '+' : '') + dist.toFixed(2) + '%';
  distElem.style.color = dist >= 0 ? 'var(--green)' : 'var(--red)';

  const magnetClusterEl = document.getElementById('magnet-cluster');
  if (magnetClusterEl) {
    const cluster = (localState.book && localState.book.clusters)
      ? localState.book.clusters.find(c => Math.abs(c.price - magnetP) < 300)
      : null;
    if (cluster) {
      magnetClusterEl.textContent = '$' + (cluster.value / 1e6).toFixed(1) + 'M';
    } else {
      magnetClusterEl.textContent = '$' + ((localState.scores.magnetStrength || 99) * 0.05 + 1.2).toFixed(1) + 'M';
    }
  }

  // Likely Target
  const targetP = localState.scores.targetPrice || 79000;
  document.getElementById('target-price').textContent = '$' + targetP.toLocaleString();
  document.getElementById('target-score').textContent = (localState.scores.targetScore || 97) + '/100';
  document.getElementById('target-type').textContent = (localState.scores.targetType || 'Stop Hunt Zone ▲');

  // Market Strength Gauge
  const strength = Math.round(localState.scores.marketStrength || 47);
  document.getElementById('strength-score').textContent = strength;
  const strengthLabel = strength >= 70 ? 'STRONG' : strength >= 45 ? 'MODERATE' : 'WEAK';
  document.getElementById('strength-tag').textContent = strengthLabel;
  document.getElementById('strength-desc').textContent = strength >= 70 ? 'Trend supported by volume and OI.' : strength >= 45 ? 'Mixed signals — monitor closely.' : 'Weak trend with low conviction.';
  document.getElementById('gauge-ring').style.strokeDashoffset = 213 - (strength / 100) * 213;

  // Last Sweep
  const sweepPrice = localState.scores.sweepPrice || 78018;
  const sweepType = localState.scores.sweepType || 'weak-bull';
  const isBull = sweepType.toLowerCase().includes('bull');

  if (localState.scores.sweepPrice) {
    document.getElementById('sweep-price').textContent = '$' + Math.round(sweepPrice).toLocaleString();
    document.getElementById('sweep-conf').textContent = Math.round(localState.scores.sweepConf || 34) + '/100';
  }
  if (localState.scores.sweepType) {
    const sweepPill = document.getElementById('sweep-pill');
    if (sweepPill) {
      const arrow = isBull ? '⌃ ' : '⌄ ';
      const strong = sweepType.includes('strong') ? 'STRONG ' : 'WEAK ';
      const dir = isBull ? 'BULLISH' : 'BEARISH';
      sweepPill.textContent = `${arrow}${strong}${dir} SWEEP`;
      sweepPill.style.color = isBull ? 'var(--green)' : 'var(--red)';
      sweepPill.style.borderColor = isBull ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 51, 102, 0.3)';
    }
  }
  const sweepDesc = document.getElementById('sweep-desc');
  if (sweepDesc) {
    sweepDesc.textContent = isBull 
      ? `Price swept lows near $${Math.round(sweepPrice).toLocaleString()}. Recovery in progress.`
      : `Price rejected near $${Math.round(sweepPrice).toLocaleString()}. Downside sweep.`;
  }
  if (localState.scores.sweepAge) {
    const ageMin = Math.max(1, Math.round((Date.now() - localState.scores.sweepAge) / 60000));
    const ageEl = document.getElementById('sweep-age');
    if (ageEl) ageEl.textContent = ageMin + 'm ago';
  }

  // ---------------- TRAP & SQUEEZE RISK BARS (1:1 LIVE WAQAR ZAKA RADAR) ----------------
  const bullVal = localState.scores.bullTrapRisk !== undefined ? Math.round(localState.scores.bullTrapRisk) : 0;
  const bearVal = localState.scores.bearTrapRisk !== undefined ? Math.round(localState.scores.bearTrapRisk) : 0;
  const shortVal = localState.scores.shortSqueezeRisk !== undefined ? Math.round(localState.scores.shortSqueezeRisk) : 35;
  const longVal = localState.scores.longSqueezeRisk !== undefined ? Math.round(localState.scores.longSqueezeRisk) : 55;

  const riskBullEl = document.getElementById('risk-bull');
  const riskBullVal = document.getElementById('risk-bull-val');
  if (riskBullEl) riskBullEl.style.width = bullVal + '%';
  if (riskBullVal) {
    riskBullVal.textContent = bullVal;
    riskBullVal.style.color = bullVal > 0 ? 'var(--red)' : '#64748b';
  }

  const riskBearEl = document.getElementById('risk-bear');
  const riskBearVal = document.getElementById('risk-bear-val');
  if (riskBearEl) riskBearEl.style.width = bearVal + '%';
  if (riskBearVal) {
    riskBearVal.textContent = bearVal;
    riskBearVal.style.color = bearVal > 0 ? 'var(--amber)' : '#64748b';
  }

  const riskShortEl = document.getElementById('risk-short');
  const riskShortVal = document.getElementById('risk-short-val');
  if (riskShortEl) riskShortEl.style.width = shortVal + '%';
  if (riskShortVal) {
    riskShortVal.textContent = shortVal;
    riskShortVal.style.color = shortVal > 0 ? 'var(--cyan)' : '#64748b';
  }

  const riskLongEl = document.getElementById('risk-long');
  const riskLongVal = document.getElementById('risk-long-val');
  if (riskLongEl) riskLongEl.style.width = longVal + '%';
  if (riskLongVal) {
    riskLongVal.textContent = longVal;
    riskLongVal.style.color = longVal > 0 ? '#60a5fa' : '#64748b';
  }

  // Spoofing
  if (localState.scores.spoofProb !== undefined) {
    document.getElementById('spoof-prob').textContent = localState.scores.spoofProb + '/100';
  }
  if (localState.scores.spoofDetail) {
    document.getElementById('spoof-desc').textContent = localState.scores.spoofDetail;
  }
  if (localState.scores.spoofMeter && localState.scores.spoofMeter.length > 0) {
    renderSpoofHistogram(localState.scores.spoofMeter);
  }

  // Next Sweep & OI Change
  if (localState.scores.nextSweepProb) {
    document.getElementById('box-sweep-prob').textContent = Math.round(localState.scores.nextSweepProb) + '%';
  }
  if (localState.scores.oiChange !== undefined) {
    const oic = localState.scores.oiChange;
    document.getElementById('box-oi-chg').textContent = (oic >= 0 ? '+' : '') + oic.toFixed(2) + '%';
    document.getElementById('box-oi-chg').style.color = oic >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // Liquidity Target Zones (Exact 1:1 Live Waqar Zaka Design)
  const listEl = document.getElementById('zones-list') || document.getElementById('zones-table-body');
  if (listEl) {
    const rawClusters = (localState.book && localState.book.clusters && localState.book.clusters.length > 0)
      ? localState.book.clusters
      : [
          { price: 77200, value: 68500000, side: 'bid' },
          { price: 77400, value: 63800000, side: 'bid' },
          { price: 79200, value: 63200000, side: 'ask' },
          { price: 78400, value: 61300000, side: 'ask' },
          { price: 79400, value: 50100000, side: 'ask' },
          { price: 76600, value: 49200000, side: 'bid' }
        ];

    // Sort clusters by USD value descending
    const sorted = [...rawClusters].sort((a, b) => (b.value || 0) - (a.value || 0));
    const maxVal = sorted[0].value || 1;

    listEl.innerHTML = sorted.slice(0, 6).map((c) => {
      const isAsk = c.side ? (c.side.toLowerCase() === 'ask' || c.side.toLowerCase() === 'sell') : (c.price >= p);
      const arrow = isAsk ? '▲' : '▼';
      const sideClass = isAsk ? 'sell' : 'buy';
      const wallType = isAsk ? 'Sell Wall' : 'Buy Wall';
      const valStr = '$' + (c.value / 1e6).toFixed(1) + 'M';
      const pct = Math.max(15, Math.min(100, Math.round((c.value / maxVal) * 100)));
      const score = '99/100';

      return `
        <div class="zone-row">
          <div class="zone-price ${sideClass}">
            <span style="font-size: 9.5px; opacity: 0.9;">${arrow}</span>
            <span>$${Math.round(c.price).toLocaleString()}</span>
          </div>
          <div class="zone-bar-box">
            <div class="zone-bar-fill ${sideClass}" style="width: ${pct}%;"></div>
            <div class="zone-bar-label ${sideClass}">
              ${wallType} · ${valStr}
            </div>
          </div>
          <div class="zone-score ${sideClass}">
            ${score}
          </div>
        </div>
      `;
    }).join('');
  }

  // CVD Stats & Chart
  if (localState.cvd) {
    document.getElementById('cvd-buy').textContent = localState.cvd.buyVol.toFixed(2);
    document.getElementById('cvd-sell').textContent = localState.cvd.sellVol.toFixed(2);
    document.getElementById('cvd-delta').textContent = (localState.cvd.delta >= 0 ? '+' : '') + localState.cvd.delta.toFixed(2);
    document.getElementById('cvd-delta').style.color = localState.cvd.delta >= 0 ? 'var(--green)' : 'var(--red)';
    document.getElementById('cvd-trend').textContent = localState.cvd.trend;
    document.getElementById('cvd-trend').style.color = localState.cvd.delta >= 0 ? 'var(--green)' : 'var(--red)';
    drawCvd(localState.cvd.history);
    if (currentTab === 'advanced') drawExtendedCvd();
  }

  // Draw 6-Axis Spider Radar
  drawRadar(localState.scores);

  // ---------------- TAB 2: ADVANCED DATA BINDING ----------------
  if (localState.book && localState.book.asks && localState.book.asks.length > 0) {
    document.getElementById('advanced-asks-body').innerHTML = localState.book.asks.slice(0, 8).map(a => `
      <tr>
        <td style="color: #f87171; font-weight: 700;">$${Math.round(a.price).toLocaleString()}</td>
        <td>${(a.size || a.qty || 0).toFixed(3)}</td>
        <td class="depth-bar-cell">
          <div class="depth-fill-bg depth-fill-ask" style="width: ${a.depthPct || 50}%;"></div>
          <span class="depth-text-content">$${((a.usd || (a.price * (a.size || a.qty || 0))) / 1e3).toFixed(1)}K</span>
        </td>
      </tr>
    `).join('');
  }

  if (localState.book && localState.book.bids && localState.book.bids.length > 0) {
    document.getElementById('advanced-bids-body').innerHTML = localState.book.bids.slice(0, 8).map(b => `
      <tr>
        <td style="color: #38bdf8; font-weight: 700;">$${Math.round(b.price).toLocaleString()}</td>
        <td>${(b.size || b.qty || 0).toFixed(3)}</td>
        <td class="depth-bar-cell">
          <div class="depth-fill-bg depth-fill-bid" style="width: ${b.depthPct || 50}%;"></div>
          <span class="depth-text-content">$${((b.usd || (b.price * (b.size || b.qty || 0))) / 1e3).toFixed(1)}K</span>
        </td>
      </tr>
    `).join('');
  }

  if (localState.book && localState.book.activeWalls && localState.book.activeWalls.length > 0) {
    document.getElementById('active-walls-body').innerHTML = localState.book.activeWalls.map(w => `
      <tr>
        <td style="font-weight: 700; color: #fff;">$${Math.round(w.price).toLocaleString()}</td>
        <td><span class="side-tag ${w.side.toUpperCase() === 'BID' || w.side === 'BUY' ? 'side-buy' : 'side-sell'}">${w.side.toUpperCase() === 'BID' ? 'BUY' : w.side.toUpperCase()}</span></td>
        <td>${(w.qty || w.size || 0).toFixed(2)}</td>
        <td style="color: #fff; font-weight: 700;">$${(w.usd / 1e6 || (w.price * (w.qty || w.size || 0)) / 1e6).toFixed(2)}M</td>
        <td style="color: ${((w.price - p) / p) >= 0 ? 'var(--green)' : 'var(--red)'};">${(((w.price - p) / p) * 100 >= 0 ? '+' : '') + (((w.price - p) / p) * 100).toFixed(2)}%</td>
        <td>
          <div class="zone-bar-bg">
            <div class="zone-bar-fg" style="width: ${Math.min(100, ((w.qty || w.size || 0) / 350) * 100)}%; background: ${w.side.toUpperCase() === 'BID' || w.side === 'BUY' ? 'var(--green)' : 'var(--red)'};"></div>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ---------------- TAB 3: ORDER EVENTS DATA BINDING ----------------
  const eventsEl = document.getElementById('order-events-stream');
  if (eventsEl) {
    const events = (localState.orderEvents && localState.orderEvents.length > 0)
      ? localState.orderEvents
      : (localState.book && localState.book.activeWalls ? localState.book.activeWalls.map((w, idx) => ({
          type: w.side.toUpperCase() === 'BID' ? 'BUY WALL PLACED' : 'SELL WALL PLACED',
          price: w.price,
          qty: w.qty || w.size || 0,
          usd: w.usd || (w.price * (w.qty || 1)),
          side: w.side.toUpperCase(),
          time: 'Live'
        })) : []);

    if (events.length > 0) {
      eventsEl.innerHTML = events.slice(0, 10).map(e => `
        <div class="alert-item-card" style="border-left: 3px solid ${e.side === 'BID' || e.side === 'BUY' ? 'var(--green)' : 'var(--red)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div>
              <span style="font-weight: 800; color: ${e.side === 'BID' || e.side === 'BUY' ? 'var(--green)' : 'var(--red)'};">${e.type || 'ORDER FLOW'}</span>
              <span style="color: #fff; margin-left: 8px; font-weight: 700;">$${Math.round(e.price).toLocaleString()}</span>
              <span style="color: var(--text-sub); margin-left: 6px;">(${parseFloat(e.qty).toFixed(2)} BTC)</span>
            </div>
            <div style="color: var(--text-muted); font-size: 10px;">${e.time || 'Live'}</div>
          </div>
        </div>
      `).join('');
    }
  }

  const spoofWatchEl = document.getElementById('spoof-watch-list');
  if (spoofWatchEl) {
    const walls = (localState.book && localState.book.activeWalls) ? localState.book.activeWalls : [];
    if (walls.length > 0) {
      spoofWatchEl.innerHTML = walls.slice(0, 6).map(w => `
        <div class="alert-item-card warn" style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div>
              <div style="font-weight: 800; color: #fff;">${w.side.toUpperCase() === 'BID' || w.side === 'BUY' ? '🟢 BID WALL' : '🔴 ASK WALL'} · $${Math.round(w.price).toLocaleString()}</div>
              <div style="font-size: 10.5px; color: var(--text-sub); margin-top: 2px;">Size: ${(w.qty || w.size || 0).toFixed(2)} BTC ($${((w.usd || w.price * (w.qty || 1)) / 1e6).toFixed(2)}M) · Watching for spoofing</div>
            </div>
            <span class="side-tag ${w.side.toUpperCase() === 'BID' || w.side === 'BUY' ? 'side-buy' : 'side-sell'}">MONITORING</span>
          </div>
        </div>
      `).join('');
    }
  }

  // ---------------- TAB 4: ALERTS DATA BINDING ----------------
  if (localState.alerts && localState.alerts.length > 0) {
    document.getElementById('alerts-badge').textContent = localState.alerts.length;
    document.getElementById('alerts-total-count').textContent = localState.alerts.length + ' TOTAL';
    document.getElementById('alerts-feed-list').innerHTML = localState.alerts.map(a => {
      const agoMin = a.ts ? Math.round((Date.now() - a.ts) / 60000) : 10;
      const agoText = agoMin < 1 ? 'Just now' : agoMin + 'm ago';
      return `
        <div class="alert-item-card ${a.type || 'warn'}">
          <div>
            <div style="font-weight: 800; color: #fff; margin-bottom: 3px;">${a.title}</div>
            <div style="font-size: 10px; color: var(--text-sub);">${a.desc || a.text || ''}</div>
          </div>
          <div style="color: var(--text-muted); font-size: 10px;">${agoText}</div>
        </div>
      `;
    }).join('');
  }
}

// Draw initial state immediately
updateUI();

// -------------------------------------------------------------
// 6. CONNECT SSE LIVE STREAM & REAL-TIME ENGINE
// -------------------------------------------------------------
function connectLiveStream() {
  let evtSource = null;
  let pollInterval = null;

  function startSSE() {
    try {
      if (evtSource) {
        evtSource.close();
      }
      evtSource = new EventSource('/api/stream');
      
      evtSource.onopen = () => {
        const conn = document.getElementById('conn-status');
        if (conn) {
          conn.textContent = 'LIVE';
          conn.style.color = 'var(--green)';
        }
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data) {
            localState = Object.assign({}, localState, data);
            if (data.book && data.book.clusters) {
              localState.book.clusters = data.book.clusters;
            }
            if (data.scores) {
              localState.scores = Object.assign({}, localState.scores, data.scores);
            }
            updateUI();
          }
        } catch (e) {}
      };

      evtSource.onerror = () => {
        const conn = document.getElementById('conn-status');
        if (conn) {
          conn.textContent = 'POLLING';
          conn.style.color = 'var(--amber)';
        }
        
        if (!pollInterval) {
          pollInterval = setInterval(async () => {
            try {
              const res = await fetch('/api/snapshot');
              const data = await res.json();
              if (data) {
                localState = Object.assign({}, localState, data);
                if (data.book && data.book.clusters) {
                  localState.book.clusters = data.book.clusters;
                }
                if (data.scores) {
                  localState.scores = Object.assign({}, localState.scores, data.scores);
                }
                const cEl = document.getElementById('conn-status');
                if (cEl) {
                  cEl.textContent = 'LIVE';
                  cEl.style.color = 'var(--green)';
                }
                updateUI();
              }
            } catch(e) {}
          }, 600);
        }
      };
    } catch (e) {}
  }

  startSSE();
}

connectLiveStream();
