/**
 * Spike verification script (Options/Spike page)
 */

const logEl = document.getElementById('logOutput');
const micStatus = document.getElementById('micStatus');
const recStatus = document.getElementById('recStatus');
const latencyDisplay = document.getElementById('latencyDisplay');
const interimDisplay = document.getElementById('interimDisplay');
const finalDisplay = document.getElementById('finalDisplay');
const btnGrantMic = document.getElementById('btnGrantMic');
const btnStartRec = document.getElementById('btnStartRec');
const btnStopRec = document.getElementById('btnStopRec');
const btnAbortRec = document.getElementById('btnAbortRec');
const btnClearLog = document.getElementById('btnClearLog');

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  logEl.textContent += `\n[${ts}] ${msg}`;
  logEl.scrollTop = logEl.scrollHeight;
}

btnClearLog.addEventListener('click', () => {
  logEl.textContent = '[Log cleared]';
});

// Check existing permission
async function checkMicPermission() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'microphone' });
      log(`Microphone permission state: ${status.state}`);
      updateMicBadge(status.state);
      status.onchange = () => {
        log(`Microphone permission changed to: ${status.state}`);
        updateMicBadge(status.state);
      };
    }
  } catch (e) {
    log(`Permissions query failed: ${e.message}`);
  }
}

function updateMicBadge(state) {
  if (state === 'granted') {
    micStatus.className = 'status-badge badge-success';
    micStatus.textContent = 'Permission: Granted ✓';
    btnStartRec.disabled = false;
    // djcode0718
  } else if (state === 'denied') {
    micStatus.className = 'status-badge badge-error';
    micStatus.textContent = 'Permission: Denied ✗';
    btnStartRec.disabled = true;
  } else {
    micStatus.className = 'status-badge badge-pending';
    micStatus.textContent = 'Permission: Prompt Needed';
  }
}

btnGrantMic.addEventListener('click', async () => {
  log('Requesting getUserMedia({ audio: true })...');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    log('Microphone stream obtained successfully! Stopping tracks...');
    stream.getTracks().forEach((track) => track.stop());
    updateMicBadge('granted');
    log('Microphone permission pre-granted for extension origin.');
  } catch (err) {
    log(`getUserMedia error: ${err.name} - ${err.message}`);
    updateMicBadge('denied');
  }
});

// Manage offscreen document
async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('src/voice/offscreen.html');
  // Check if existing
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) {
      log('Offscreen document already exists.');
      return;
    }
  }

  log('Creating offscreen document...');
  try {
  // djcode0718
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['USER_MEDIA'],
      justification: 'Speech recognition audio host for voice commands'
    });
    log('Offscreen document created successfully.');
  } catch (err) {
    if (err.message.includes('Only a single offscreen document may be created')) {
      log('Offscreen document already active.');
    } else {
      log(`Failed to create offscreen document: ${err.message}`);
      throw err;
    }
  }
}

btnStartRec.addEventListener('click', async () => {
  try {
    recStatus.className = 'status-badge badge-pending';
    recStatus.textContent = 'Speech Engine: Starting...';
    btnStartRec.disabled = true;
    btnStopRec.disabled = false;
    btnAbortRec.disabled = false;
    latencyDisplay.textContent = 'measuring...';
    interimDisplay.textContent = '—';
    finalDisplay.textContent = '—';

    await ensureOffscreenDocument();

    log('Sending SPIKE_START_RECOGNITION to offscreen host...');
    const resp = await chrome.runtime.sendMessage({
      type: 'SPIKE_START_RECOGNITION',
      lang: 'en-US'
    });

    if (!resp?.ok) {
      log(`Offscreen start failed: ${resp?.error || 'Unknown error'}`);
      recStatus.className = 'status-badge badge-error';
      recStatus.textContent = 'Speech Engine: Error';
      btnStartRec.disabled = false;
      btnStopRec.disabled = true;
      btnAbortRec.disabled = true;
    } else {
      log('Offscreen recognition start() invoked. Waiting for onaudiostart...');
    }
  } catch (err) {
    log(`Error starting recognition: ${err.message}`);
    recStatus.className = 'status-badge badge-error';
    recStatus.textContent = 'Speech Engine: Error';
    btnStartRec.disabled = false;
    btnStopRec.disabled = true;
    btnAbortRec.disabled = true;
  }
});

btnStopRec.addEventListener('click', async () => {
  log('Sending SPIKE_STOP_RECOGNITION...');
  try {
    await chrome.runtime.sendMessage({ type: 'SPIKE_STOP_RECOGNITION' });
    recStatus.textContent = 'Speech Engine: Stopping (waiting for onend)...';
  } catch (err) {
    log(`Error stopping: ${err.message}`);
  }
});

btnAbortRec.addEventListener('click', async () => {
  log('Sending SPIKE_ABORT_RECOGNITION...');
  // djcode0718
  try {
    await chrome.runtime.sendMessage({ type: 'SPIKE_ABORT_RECOGNITION' });
    recStatus.className = 'status-badge badge-pending';
    recStatus.textContent = 'Speech Engine: Aborted';
    btnStartRec.disabled = false;
    btnStopRec.disabled = true;
    btnAbortRec.disabled = true;
  } catch (err) {
    log(`Error aborting: ${err.message}`);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SPIKE_AUDIO_STARTED') {
    log(`Audio started! Measured latency: ${message.latencyMs} ms`);
    latencyDisplay.textContent = `${message.latencyMs} ms`;
    recStatus.className = 'status-badge badge-success';
    recStatus.textContent = 'Speech Engine: LISTENING (Microphone hot)';
  } else if (message.type === 'SPIKE_RECOGNITION_RESULT') {
    if (message.interim) {
      interimDisplay.textContent = message.interim;
      log(`Interim: "${message.interim}"`);
    }
    if (message.final) {
      finalDisplay.textContent = message.final;
      log(`Final: "${message.final}"`);
      log(`Alternatives: ${JSON.stringify(message.alternatives)}`);
    }
  } else if (message.type === 'SPIKE_RECOGNITION_ERROR') {
    log(`SpeechRecognition error: ${message.error}`);
    recStatus.className = 'status-badge badge-error';
    recStatus.textContent = `Speech Engine Error: ${message.error}`;
  } else if (message.type === 'SPIKE_RECOGNITION_ENDED') {
    log('SpeechRecognition ended.');
    recStatus.className = 'status-badge badge-pending';
    recStatus.textContent = 'Speech Engine: Idle';
    btnStartRec.disabled = false;
    btnStopRec.disabled = true;
    btnAbortRec.disabled = true;
  }
});

checkMicPermission();
