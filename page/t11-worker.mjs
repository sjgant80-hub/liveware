// page/t11-worker.mjs — runs T11 off the page's main thread, so the page stays responsive while ~2,900 tampered exams
// are re-scored. The same body CI measures (src/t11.mjs); the result comes back as plain data.
import { t11 } from '../src/t11.mjs';

self.onmessage = (e) => {
  try {
    const t0 = performance.now(), ran = t11(e.data);
    self.postMessage({ ok: true, ran, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    self.postMessage({ ok: false, why: String(err && err.message) });
  }
};
