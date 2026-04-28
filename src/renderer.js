// ================================
// Shared State & Initialisation
// ================================
// This file declares all shared state (globals) consumed by the table
// modules and wires up initialisation, tab switching, settings, file
// watching, and find-in-page.
//
// Table-specific rendering lives in:
//   journal_table.js  — Decision Journal
//   scoring_table.js  — 打分表
//   holdings_table.js — 持仓表
//
// Score refresh UI lives in:
//   update-score.js   — ↻ button & toast notifications

// ─── State ────────────────────────────────────────────────────────────

// Journal state
let csvPath = '';
let journalData = [];
let currentSort = { field: null, ascending: true };

// Scoring state
let scoringCsvPath = '';
let scoringData = [];
let scoringSort = { field: null, ascending: true };

// Holdings state
let holdingsCsvPath = '';
let holdingsData = [];

// Field definitions (shared constants)
const HOLDINGS_FIELDS = ['Ticker', '股价', '均价 * 股数', 'PnL', '警报', '自动止损'];
const HOLDINGS_YN_OPTIONS = ['✅', '❌'];
const SCORING_FIELDS = ['代码', '总分', 'Time', 'Follow', 'Z rank', 'Z hold', 'CK', 'Call', 'Setup', '机构筹码', '过往信号', 'Vol', '题材', '消息', '情绪'];
const SCORING_NUM_FIELDS = ['总分', 'Follow', 'Z rank', 'Z hold', 'CK', 'Call', 'Setup', '机构筹码', '过往信号', 'Vol', '题材', '消息', '情绪'];

// ─── DOM References ───────────────────────────────────────────────────

// Journal DOM
let tableBody;
let addRowBtn;
let statYes;
let statNo;
let statRate;
let settingsBtn;
let settingsModal;
let closeModalBtn;
let csvPathInput;
let browseFileBtn;

// Scoring DOM
let scoringTableBody;
let scoringAddRowBtn;
let scoringCsvPathInput;
let scoringBrowseFileBtn;

// Holdings DOM
let holdingsTableBody;
let addHoldingsRowBtn;
let refreshHoldingsBtn;
let holdingsCsvPathInput;
let holdingsBrowseFileBtn;

// ─── Initialisation ───────────────────────────────────────────────────

async function init() {
    // Journal DOM
    tableBody = document.getElementById('table-body');
    addRowBtn = document.getElementById('add-row-btn');
    statYes = document.getElementById('stat-yes');
    statNo = document.getElementById('stat-no');
    statRate = document.getElementById('stat-rate');
    settingsBtn = document.getElementById('settings-btn');
    settingsModal = document.getElementById('settings-modal');
    closeModalBtn = document.getElementById('close-modal-btn');
    csvPathInput = document.getElementById('csv-path-input');
    browseFileBtn = document.getElementById('browse-file-btn');

    // Scoring DOM
    scoringTableBody = document.getElementById('scoring-table-body');
    scoringAddRowBtn = document.getElementById('scoring-add-row-btn');
    scoringCsvPathInput = document.getElementById('scoring-csv-path-input');
    scoringBrowseFileBtn = document.getElementById('scoring-browse-file-btn');

    // Holdings DOM
    holdingsTableBody = document.getElementById('holdings-table-body');
    addHoldingsRowBtn = document.getElementById('add-holdings-row-btn');
    refreshHoldingsBtn = document.getElementById('refresh-holdings-btn');
    holdingsCsvPathInput = document.getElementById('holdings-csv-path-input');
    holdingsBrowseFileBtn = document.getElementById('holdings-browse-file-btn');

    // ── Event Listeners ───────────────────────────────────────────────

    addRowBtn.addEventListener('click', addRow);
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    closeModalBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

    // Header click listeners for sorting (Journal)
    const headers = document.querySelectorAll('#journal-table th[data-field]');
    headers.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortData(header.getAttribute('data-field')));
    });

    const titleBar = document.getElementById('title-bar');
    titleBar.addEventListener('dblclick', () => {
        window.electronAPI.toggleFullscreen();
    });

    browseFileBtn.addEventListener('click', async () => {
        const newPath = await window.electronAPI.selectFile();
        if (newPath) {
            csvPath = newPath;
            csvPathInput.value = csvPath;
            await window.electronAPI.saveConfig(csvPath, scoringCsvPath, holdingsCsvPath);
            await loadData();
        }
    });

    // Scoring event listeners
    scoringAddRowBtn.addEventListener('click', addScoringRow);
    addHoldingsRowBtn.addEventListener('click', addHoldingsRow);
    refreshHoldingsBtn.addEventListener('click', refreshAllHoldingsPrices);

    scoringBrowseFileBtn.addEventListener('click', async () => {
        const newPath = await window.electronAPI.selectFile();
        if (newPath) {
            scoringCsvPath = newPath;
            scoringCsvPathInput.value = scoringCsvPath;
            await window.electronAPI.saveConfig(csvPath, scoringCsvPath, holdingsCsvPath);
            await loadScoringData();
        }
    });

    holdingsBrowseFileBtn.addEventListener('click', async () => {
        const newPath = await window.electronAPI.selectFile();
        if (newPath) {
            holdingsCsvPath = newPath;
            holdingsCsvPathInput.value = holdingsCsvPath;
            await window.electronAPI.saveConfig(csvPath, scoringCsvPath, holdingsCsvPath);
            await loadHoldingsData();
        }
    });

    // Scoring table header sorting
    const scoringHeaders = document.querySelectorAll('#scoring-table th[data-scoring-field]');
    scoringHeaders.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortScoringData(header.getAttribute('data-scoring-field')));
    });

    // ── Tab Switching ─────────────────────────────────────────────────

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            // Activate clicked tab
            btn.classList.add('active');
            const tab = btn.getAttribute('data-tab');
            const tabId = 'tab-' + tab;
            document.getElementById(tabId).classList.add('active');
            // Persist active tab
            localStorage.setItem('activeTab', tab);
        });
    });

    // Restore last active tab (survives Cmd+R reload)
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
        const savedBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
        if (savedBtn) {
            savedBtn.click();
        }
    }

    // ── Load Config & Data ────────────────────────────────────────────

    try {
        const config = await window.electronAPI.getConfig();
        csvPath = config.csvPath;
        scoringCsvPath = config.scoringCsvPath || '';
        holdingsCsvPath = config.holdingsCsvPath || '';
        if (!csvPath) {
            csvPath = await window.electronAPI.getDefaultPath();
            await window.electronAPI.saveConfig(csvPath, scoringCsvPath, holdingsCsvPath);
        }
        if (!scoringCsvPath) {
            // Default scoring CSV in same directory as journal CSV
            const parts = csvPath.split('/');
            parts.pop();
            scoringCsvPath = parts.join('/') + '/scoring_table.csv';
            await window.electronAPI.saveConfig(csvPath, scoringCsvPath, holdingsCsvPath);
        }
        if (!holdingsCsvPath) {
            const parts = csvPath.split('/');
            parts.pop();
            holdingsCsvPath = parts.join('/') + '/holdings.csv';
            await window.electronAPI.saveConfig(csvPath, scoringCsvPath, holdingsCsvPath);
        }
        csvPathInput.value = csvPath;
        scoringCsvPathInput.value = scoringCsvPath;
        holdingsCsvPathInput.value = holdingsCsvPath;
        await loadData();
        await loadScoringData();
        await loadHoldingsData();
    } catch (e) {
        console.error('Failed to initialize data:', e);
        // Fallback to default path if everything fails
        if (!csvPath) {
            csvPath = await window.electronAPI.getDefaultPath();
            csvPathInput.value = csvPath;
            await loadData();
        }
    }

    // ── File Watching (Bi-directional Sync) ───────────────────────────

    window.electronAPI.onFileChanged(async (path) => {
        console.log('File changed:', path);
        if (path === csvPath) {
            const content = await window.electronAPI.readFile(csvPath);
            if (content) {
                const cleanContent = content.replace(/^\uFEFF/, '');
                const result = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
                const newData = result.data.map(row => ({
                    Date: row.Date || new Date().toISOString().split('T')[0],
                    Ticker: row.Ticker || '',
                    Action: row.Action || '',
                    Rules: row.Rules || '',
                    '后续走势': row['后续走势'] || '',
                    'Rules Followed': row['Rules Followed'] || 'Yes'
                }));

                // Only update if data actually changed to avoid infinite loops
                if (JSON.stringify(newData) !== JSON.stringify(journalData)) {
                    journalData = newData;
                    renderTable();
                    updateStats();
                    renderChart();
                }
            }
        } else if (path === holdingsCsvPath) {
            const content = await window.electronAPI.readFile(holdingsCsvPath);
            if (content) {
                const cleanContent = content.replace(/^\uFEFF/, '');
                const result = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
                const newData = result.data.map(row => makeHoldingsRow(row));
                if (JSON.stringify(newData) !== JSON.stringify(holdingsData)) {
                    holdingsData = newData;
                    renderHoldingsTable();
                }
            }
        } else if (path === scoringCsvPath) {
            const content = await window.electronAPI.readFile(scoringCsvPath);
            if (content) {
                const cleanContent = content.replace(/^\uFEFF/, '');
                const result = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
                const newData = result.data.map(row => makeScoringRow(row));
                if (JSON.stringify(newData) !== JSON.stringify(scoringData)) {
                    scoringData = newData;
                    renderScoringTable();
                }
            }
        }
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });

    // ── Webview URL Persistence ───────────────────────────────────────

    const webviewX = document.getElementById('webview-x');
    const webviewXhs = document.getElementById('webview-xhs');

    if (webviewX && webviewXhs) {
        const savedUrlX = localStorage.getItem('lastUrl-x');
        if (savedUrlX) webviewX.src = savedUrlX;

        const saveUrl = (key, url) => {
            if (url && url !== 'about:blank') {
                localStorage.setItem(key, url);
            }
        };

        webviewX.addEventListener('did-navigate', (e) => saveUrl('lastUrl-x', e.url));
        webviewX.addEventListener('did-navigate-in-page', (e) => saveUrl('lastUrl-x', e.url));
        
        // Xiaohongshu always loads the default URL specified in HTML, so we don't restore or save it.
    }
}

// ================================
// Find in Page (native Electron API)
// ================================
let findBarVisible = false;

function initFind() {
    const findBar = document.getElementById('find-bar');
    const findInput = document.getElementById('find-input');
    const findMatchCount = document.getElementById('find-match-count');
    const findPrev = document.getElementById('find-prev');
    const findNext = document.getElementById('find-next');
    const findClose = document.getElementById('find-close');

    function showFindBar() {
        findBar.style.display = 'flex';
        findBarVisible = true;
        findInput.focus();
        findInput.select();
    }

    function hideFindBar() {
        findBar.style.display = 'none';
        findBarVisible = false;
        findInput.value = '';
        findMatchCount.textContent = '';
        window.electronAPI.stopFindInPage();
    }

    function refocusFindInput() {
        // findInPage steals focus to the page; reclaim it after a tick
        setTimeout(() => {
            if (findBarVisible) {
                findInput.focus();
            }
        }, 0);
    }

    function performSearch(query) {
        if (!query) {
            findMatchCount.textContent = '';
            window.electronAPI.stopFindInPage();
            return;
        }
        window.electronAPI.findInPage(query);
        refocusFindInput();
    }

    // Listen for match results from the main process
    window.electronAPI.onFoundInPageResults((result) => {
        if (result.matches !== undefined) {
            if (result.matches === 0) {
                findMatchCount.textContent = '0';
            } else {
                findMatchCount.textContent = `${result.activeMatchOrdinal}/${result.matches}`;
            }
        }
        // Each result event can also steal focus, reclaim it
        refocusFindInput();
    });

    findInput.addEventListener('input', () => performSearch(findInput.value));

    findNext.addEventListener('click', () => {
        if (findInput.value) {
            window.electronAPI.findInPage(findInput.value, { forward: true, findNext: true });
            refocusFindInput();
        }
    });

    findPrev.addEventListener('click', () => {
        if (findInput.value) {
            window.electronAPI.findInPage(findInput.value, { forward: false, findNext: true });
            refocusFindInput();
        }
    });

    findInput.addEventListener('keydown', (e) => {
        // Cmd/Ctrl+A should select find-input text, not the whole page
        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
            e.stopPropagation();
            e.preventDefault();
            findInput.select();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) findPrev.click();
            else findNext.click();
        }
        if (e.key === 'Escape') hideFindBar();
    });

    findClose.addEventListener('click', hideFindBar);

    // Listen for Cmd+F from main process
    window.electronAPI.onToggleFind(() => {
        if (findBarVisible) {
            findInput.focus();
            findInput.select();
        } else {
            showFindBar();
        }
    });
}

