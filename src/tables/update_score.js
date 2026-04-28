/**
 * Scoring Table — Refresh Button + Toast Notifications
 *
 * Creates the per-row refresh (↻) button and handles its click behaviour.
 * Also provides a toast notification system for live progress feedback.
 *
 * Global functions:
 *   createRefreshCell(index)   — returns a <td> element for the given row
 *   refreshScoringRow(index)   — called when the button is clicked
 *   showToast(message, type)   — displays a toast notification
 */

// ─── Toast Notification System ────────────────────────────────────────

const TOAST_STYLES = document.createElement('style');
TOAST_STYLES.textContent = `
  #toast-container {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 400px;
    pointer-events: none;
  }

  .toast {
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.4;
    color: #fff;
    background: #1a1a2e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    pointer-events: auto;
    animation: toastSlideIn 0.3s ease-out;
    transition: opacity 0.3s ease, transform 0.3s ease;
    word-break: break-word;
  }

  .toast.toast-info {
    border-left: 3px solid #9d4edd;
    background: linear-gradient(135deg, #1a1a2e, #16213e);
  }

  .toast.toast-success {
    border-left: 3px solid #2ecc71;
    background: linear-gradient(135deg, #1a2e1a, #162e21);
  }

  .toast.toast-error {
    border-left: 3px solid #e74c3c;
    background: linear-gradient(135deg, #2e1a1a, #2e1621);
  }

  .toast.toast-progress {
    border-left: 3px solid #3498db;
    background: linear-gradient(135deg, #1a1a2e, #162136);
  }

  .toast.toast-fade-out {
    opacity: 0;
    transform: translateX(100%);
  }

  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(TOAST_STYLES);

/**
 * Show a toast notification.
 * @param {string} message - Message to display
 * @param {'info'|'success'|'error'|'progress'} type - Toast type
 * @param {number} duration - Duration in ms (0 = persistent until manually removed)
 * @returns {HTMLElement} The toast element (for manual removal)
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return null;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Limit max visible toasts to 8
  const toasts = container.querySelectorAll('.toast');
  if (toasts.length > 8) {
    toasts[0].remove();
  }

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

/** Clear all toasts */
function clearToasts() {
  const container = document.getElementById('toast-container');
  if (container) container.innerHTML = '';
}

// ─── Listen for progress events from the ws_server ────────────────────
if (window.electronAPI && window.electronAPI.onScoreProgress) {
  window.electronAPI.onScoreProgress((msg) => {
    // Determine toast type from the emoji
    let type = 'progress';
    if (msg.startsWith('✅')) type = 'success';
    else if (msg.startsWith('❌') || msg.startsWith('⚠️')) type = 'error';
    else if (msg.startsWith('🚀')) type = 'info';

    showToast(msg, type, type === 'success' ? 6000 : 3000);
  });
}

// ─── Refresh Button ───────────────────────────────────────────────────

/**
 * Create a <td> containing a refresh button for the given row index.
 *
 * @param {number} index  Row index in scoringData
 * @param {string} ticker  Ticker symbol for stable identification
 * @returns {HTMLTableCellElement}
 */
function createRefreshCell(index, ticker) {
  const td = document.createElement('td');
  td.className = 'col-scoring-action';

  const btn = document.createElement('button');
  btn.className = 'refresh-btn';
  btn.innerHTML = '↻';
  btn.title = 'Refresh';
  if (ticker) btn.setAttribute('data-ticker', ticker);
  btn.addEventListener('click', () => refreshScoringRow(index));

  td.appendChild(btn);
  return td;
}

/**
 * Handle a refresh-button click for the given row.
 *
 * Uses the ticker as a stable identifier so that concurrent refreshes
 * don't corrupt each other when the array is mutated (splice/unshift).
 *
 * @param {number} index  Row index in scoringData (used only for initial lookup)
 */
async function refreshScoringRow(index) {
  const ticker = scoringData[index]['代码'];
  const currentCall = scoringData[index]['Call'];
  const skipCall = currentCall && currentCall !== '0';

  if (!ticker) {
    showToast('No ticker found in this row.', 'error');
    return;
  }

  // Use data-attribute to reliably find the button for this ticker
  const btn = document.querySelector(`.refresh-btn[data-ticker="${ticker}"]`);
  if (btn) {
    btn.innerHTML = '⌛';
    btn.disabled = true;
  }

  showToast(`Fetching scores for $${ticker}…`, 'info', 0);

  // Open TradingView chart in the default browser
  const tvUrl = `https://cn.tradingview.com/chart/?symbol=${encodeURIComponent(ticker)}`;
  window.electronAPI.openExternal(tvUrl);


  try {
    const results = await window.electronAPI.updateScores(ticker, skipCall);
    console.log('Update results:', results);

    // Re-resolve index by ticker after the async call, since concurrent
    // refreshes may have spliced/unshifted the array, shifting all indices.
    const currentIndex = scoringData.findIndex(r => r['代码'] === ticker);
    if (currentIndex === -1) {
      showToast(`⚠️ Row for $${ticker} was removed during refresh.`, 'error', 5000);
      return;
    }

    // Only overwrite scores that were successfully fetched
    if (results.zRank !== 'failed') scoringData[currentIndex]['Z rank'] = results.zRank;
    if (results.zHold !== 'failed') scoringData[currentIndex]['Z hold'] = results.zHold;
    if (results.chaikin !== 'failed') scoringData[currentIndex]['CK'] = results.chaikin;
    if (results.sentiment !== 'failed') scoringData[currentIndex]['情绪'] = results.sentiment;

    // Discord Call/Put → Call column: call=1, put=-1, both/empty=0
    if (results.discordCall !== undefined && results.discordCall !== 'failed') {
      let callScore = 0;
      if (results.discordCall === 'call') callScore = 1;
      else if (results.discordCall === 'put') callScore = -1;
      scoringData[currentIndex]['Call'] = String(callScore);
    }

    // Recalculate total score
    if (typeof calculateScoringTotal === 'function') {
      scoringData[currentIndex]['总分'] = String(calculateScoringTotal(scoringData[currentIndex]));
    }

    // Update time as well
    const now = new Date();
    scoringData[currentIndex]['Time'] = `${now.getMonth() + 1}/${now.getDate()}`;

    // Move updated row to the top
    const [row] = scoringData.splice(currentIndex, 1);
    scoringData.unshift(row);

    await saveScoringData();
    renderScoringTable();

    clearToasts();

    // Build toast message with red "failed" labels
    const fmtVal = (label, val) => {
      if (val === 'failed') return `${label}=<span style="color:#e74c3c;font-weight:bold">failed</span>`;
      return `${label}=${val}`;
    };
    const discordLabel = results.discordCall === undefined ? 'skipped' : (results.discordCall || 'none');
    const toastMsg = `✅ $${ticker}: ${fmtVal('Z rank', results.zRank)}, ${fmtVal('Z hold', results.zHold)}, ${fmtVal('CK', results.chaikin)}, ${fmtVal('情绪', results.sentiment)}, ${fmtVal('Call', discordLabel)}`;
    const toast = showToast('', 'success', 8000);
    if (toast) toast.innerHTML = toastMsg;
  } catch (error) {
    console.error('Failed to refresh score:', error);
    clearToasts();
    showToast(`❌ Failed to refresh $${ticker}: ${error.message}`, 'error', 8000);
  } finally {
    // Re-find the button by ticker since the DOM may have been re-rendered
    const finalBtn = document.querySelector(`.refresh-btn[data-ticker="${ticker}"]`);
    if (finalBtn) {
      finalBtn.innerHTML = '↻';
      finalBtn.disabled = false;
    }
  }
}
