/**
 * ws_server.js — WebSocket bridge to the WebDataWizard Chrome extension
 *
 * The Decision Journal delegates data fetching to the
 * WebDataWizard Chrome extension running in the user's browser
 * (which is already logged in to Zacks & Chaikin).
 *
 * This module:
 *   1. Starts a WebSocket server on localhost:18234
 *   2. Waits for the Chrome extension to connect
 *   3. Sends ticker fetch requests and receives results
 */

const WebSocket = require('ws');

const WS_PORT = 18234;

let wss = null;
let extensionSocket = null;
let pendingRequests = new Map(); // ticker -> { resolve, reject, onProgress }

/**
 * Start the WebSocket server (called once at app startup).
 * @param {(msg: string) => void} onProgress — global progress callback
 */
function startServer(onProgress = () => { }) {
    if (wss) return; // Already running

    wss = new WebSocket.Server({ port: WS_PORT }, () => {
        console.log(`[ws_server] WebSocket server listening on port ${WS_PORT}`);
    });

    wss.on('connection', (socket) => {
        // Close previous connection if still open (prevents duplicates)
        if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
            extensionSocket.close();
        }
        console.log('[ws_server] Chrome extension connected');
        extensionSocket = socket;

        socket.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw.toString()); } catch { return; }

            if (msg.type === 'hello') {
                console.log('[ws_server] Extension identified:', msg.from);
                return;
            }

            if (msg.type === 'progress') {
                // Forward progress to all pending request callbacks
                for (const [, req] of pendingRequests) {
                    req.onProgress(msg.message);
                }
                return;
            }

            if (msg.type === 'result' && msg.ticker) {
                const pending = pendingRequests.get(msg.ticker);
                if (pending) {
                    pendingRequests.delete(msg.ticker);
                    pending.resolve(msg);
                }
                return;
            }

            if (msg.type === 'error' && msg.ticker) {
                const pending = pendingRequests.get(msg.ticker);
                if (pending) {
                    pendingRequests.delete(msg.ticker);
                    pending.reject(new Error(msg.error));
                }
                return;
            }
        });

        socket.on('close', () => {
            console.log('[ws_server] Extension disconnected');
            if (extensionSocket === socket) {
                extensionSocket = null;
            }
        });
    });

    wss.on('error', (err) => {
        console.error('[ws_server] WebSocket server error:', err.message);
    });
}

/**
 * Stop the WebSocket server (called at app shutdown).
 */
function stopServer() {
    if (wss) {
        wss.close();
        wss = null;
        extensionSocket = null;
    }
}

/**
 * Fetch scores for a ticker via the Chrome extension.
 *
 * @param {string} ticker
 * @param {string} userDataPath — unused now, kept for API compat
 * @param {(msg: string) => void} onProgress
 * @returns {Promise<{ticker, zRank, zHold, chaikin, sentiment, raw}>}
 */
async function updateScores(ticker, userDataPath, onProgress = () => { }, skipCall = false) {
    if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
        throw new Error(
            'WebDataWizard extension is not connected. ' +
            'Please make sure the Chrome extension is installed and your browser is running.'
        );
    }

    onProgress(`🚀 Sending fetch request for $${ticker} to Chrome extension…`);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingRequests.delete(ticker);
            reject(new Error(`Timeout: no response for ${ticker} after 60 seconds`));
        }, 60000);

        pendingRequests.set(ticker, {
            resolve: (result) => {
                clearTimeout(timeout);
                resolve({
                    ticker: result.ticker,
                    zRank: result.zRank,
                    zHold: result.zHold,
                    chaikin: result.chaikin,
                    sentiment: result.sentiment,
                    discordCall: result.discordCall,
                    raw: result.raw,
                });
            },
            reject: (err) => {
                clearTimeout(timeout);
                reject(err);
            },
            onProgress,
        });

        extensionSocket.send(JSON.stringify({
            action: 'fetchScores',
            ticker,
            skipCall,
        }));
    });
}

/**
 * Open a URL in the Chrome extension (background tab).
 * @param {string} url
 * @returns {boolean} true if request was sent, false otherwise
 */
function openUrlInExtension(url) {
    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
        extensionSocket.send(JSON.stringify({
            action: 'openUrl',
            url,
        }));
        return true;
    }
    return false;
}

module.exports = { startServer, stopServer, updateScores, openUrlInExtension };
