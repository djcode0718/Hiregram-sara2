/**
 * Offscreen document speech recognition host.
 */
let recognition = null;
let startTime = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SPIKE_START_RECOGNITION') {
    handleStart(message.lang || 'en-US', sendResponse);
    return true;
  }
  if (message.type === 'SPIKE_STOP_RECOGNITION') {
    handleStop(sendResponse);
    return true;
  }
  if (message.type === 'SPIKE_ABORT_RECOGNITION') {
    handleAbort(sendResponse);
    return true;
  }
});

function handleStart(lang, sendResponse) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    sendResponse({ ok: false, error: 'SpeechRecognition not supported in offscreen document' });
    return;
  }

  if (recognition) {
    try { recognition.abort(); } catch { /* ignore */ }
    recognition = null;
  }

  try {
    recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = lang;

    startTime = performance.now();

    recognition.onaudiostart = () => {
      const audioStartLatency = Math.round(performance.now() - startTime);
      chrome.runtime.sendMessage({
        type: 'SPIKE_AUDIO_STARTED',
        latencyMs: audioStartLatency
      }).catch(() => {});
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      const allAlternatives = [];

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
        for (let a = 0; a < res.length; a++) {
          allAlternatives.push(res[a].transcript);
        }
      }

      chrome.runtime.sendMessage({
        type: 'SPIKE_RECOGNITION_RESULT',
        interim,
        final,
        alternatives: allAlternatives
      }).catch(() => {});
    };

    recognition.onerror = (event) => {
      chrome.runtime.sendMessage({
        type: 'SPIKE_RECOGNITION_ERROR',
        error: event.error,
        message: event.message
      }).catch(() => {});
    };

    recognition.onend = () => {
      chrome.runtime.sendMessage({
        type: 'SPIKE_RECOGNITION_ENDED'
      }).catch(() => {});
      recognition = null;
    };

    recognition.start();
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }
}

function handleStop(sendResponse) {
  if (!recognition) {
    sendResponse({ ok: false, error: 'No active recognition' });
    return;
  }
  try {
    recognition.stop();
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }
}

function handleAbort(sendResponse) {
  if (!recognition) {
    sendResponse({ ok: false, error: 'No active recognition' });
    return;
  }
  try {
    recognition.abort();
    recognition = null;
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }
}
