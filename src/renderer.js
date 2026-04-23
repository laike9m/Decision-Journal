// State
let csvPath = '';
let journalData = [];
let trendChart = null;
let currentSort = { field: null, ascending: true };

// Scoring table state
let scoringCsvPath = '';
let scoringData = [];
let scoringSort = { field: null, ascending: true };

// Holdings table state
let holdingsCsvPath = '';
let holdingsData = [];
const HOLDINGS_FIELDS = ['Ticker', '状态', '均价 * 股数', '是否有警报', '是否有自动止损'];
const HOLDINGS_STATUS_OPTIONS = ['🔻', '💹'];
const HOLDINGS_YN_OPTIONS = ['✅', '❌'];
const SCORING_FIELDS = ['代码', '总分', 'Time', 'Follow', 'Z rank', 'Z hold', 'CK', 'Call', 'Setup', '机构筹码', '过往信号', 'Vol', '题材', '消息', '情绪'];
const SCORING_NUM_FIELDS = ['总分', 'Follow', 'Z rank', 'Z hold', 'CK', 'Call', 'Setup', '机构筹码', '过往信号', 'Vol', '题材', '消息', '情绪'];

// DOM Elements
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

// Scoring DOM Elements
let scoringTableBody;
let scoringAddRowBtn;
let scoringCsvPathInput;
let scoringBrowseFileBtn;

// Holdings DOM Elements
let holdingsTableBody;
let addHoldingsRowBtn;
let holdingsCsvPathInput;
let holdingsBrowseFileBtn;


// Initialize
async function init() {
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
    holdingsCsvPathInput = document.getElementById('holdings-csv-path-input');
    holdingsBrowseFileBtn = document.getElementById('holdings-browse-file-btn');


    // Event Listeners
    addRowBtn.addEventListener('click', addRow);
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    closeModalBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

    // Header click listeners for sorting
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

    // Tab switching
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

    // Load saved path from config or get default
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



    // Handle external file changes (Bi-directional sync)
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

    // Webview URL persistence
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
// Decision Journal functions
// ================================

// Load Data
async function loadData() {
    try {
        const content = await window.electronAPI.readFile(csvPath);
        if (content) {
            const cleanContent = content.replace(/^\uFEFF/, '');
            const result = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
            journalData = result.data;

            // Ensure columns exist and fill defaults
            journalData = journalData.map(row => ({
                Date: row.Date || new Date().toISOString().split('T')[0],
                Ticker: row.Ticker || '',
                Action: row.Action || '',
                Rules: row.Rules || '',
                '后续走势': row['后续走势'] || '',
                'Rules Followed': row['Rules Followed'] || 'Yes'
            }));
        } else {
            // Default row if file doesn't exist
            journalData = [{
                Date: new Date().toISOString().split('T')[0],
                Ticker: '',
                Action: '',
                Rules: '',
                '后续走势': '',
                'Rules Followed': 'Yes'
            }];
            await saveData(); // Create the file
        }

        // Default sort by Date descending (without showing arrow)
        journalData.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        renderTable();
        updateStats();
        renderChart();
    } catch (error) {
        console.error('Failed to load data:', error);
        alert(`Failed to load CSV file: ${error.message}`);
    }
}

// Save Data
async function saveData() {
    const csv = Papa.unparse(journalData);
    await window.electronAPI.writeFile(csvPath, csv);
}

// Render Table
function renderTable() {
    tableBody.innerHTML = '';

    journalData.forEach((row, index) => {
        const tr = document.createElement('tr');

        // Empty action cell (matches header + button column)
        const tdAction0 = document.createElement('td');
        tdAction0.className = 'col-scoring-action';
        tr.appendChild(tdAction0);

        // Date
        const tdDate = document.createElement('td');
        tdDate.className = 'col-date';
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.value = row.Date;
        dateInput.className = 'date-picker';
        dateInput.addEventListener('change', () => updateCell(index, 'Date', dateInput.value));
        tdDate.appendChild(dateInput);
        tr.appendChild(tdDate);

        // Ticker
        const tdTicker = document.createElement('td');
        tdTicker.className = 'col-ticker';
        tdTicker.contentEditable = true;
        tdTicker.textContent = row.Ticker || '';
        tdTicker.addEventListener('blur', () => updateCell(index, 'Ticker', tdTicker.textContent));
        tr.appendChild(tdTicker);

        // Action
        const tdAction = document.createElement('td');
        tdAction.contentEditable = true;
        tdAction.textContent = row.Action;
        tdAction.addEventListener('blur', () => updateCell(index, 'Action', tdAction.textContent));
        tr.appendChild(tdAction);

        // Rules
        const tdRules = document.createElement('td');
        tdRules.contentEditable = true;
        tdRules.textContent = row.Rules;
        tdRules.addEventListener('blur', () => updateCell(index, 'Rules', tdRules.textContent));
        tr.appendChild(tdRules);

        // 后续走势
        const tdTrend = document.createElement('td');
        tdTrend.contentEditable = true;
        tdTrend.textContent = row['后续走势'] || '';
        tdTrend.addEventListener('blur', () => updateCell(index, '后续走势', tdTrend.textContent));
        tr.appendChild(tdTrend);

        // Rules Followed (Select)
        const tdFollowed = document.createElement('td');
        tdFollowed.className = 'col-rules-followed';
        const select = document.createElement('select');
        select.className = 'status-select';
        ['Yes', 'No'].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt === 'Yes' ? '✅ Yes' : '❌ No';
            if (opt === row['Rules Followed']) option.selected = true;
            select.appendChild(option);
        });
        select.addEventListener('change', () => updateCell(index, 'Rules Followed', select.value));
        tdFollowed.appendChild(select);
        tr.appendChild(tdFollowed);

        // Actions
        const tdActions = document.createElement('td');
        tdActions.className = 'col-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete Row';
        deleteBtn.addEventListener('click', () => deleteRow(index));
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);
    });
}

// Update Cell
async function updateCell(index, field, value) {
    if (journalData[index][field] !== value) {
        journalData[index][field] = value;
        await saveData();
        updateStats();
        renderChart();
    }
}

// Sort Data
function sortData(field) {
    if (currentSort.field === field) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.field = field;
        // Date defaults to descending (newest first), others ascending
        currentSort.ascending = field !== 'Date';
    }

    journalData.sort((a, b) => {
        let valA = a[field] || '';
        let valB = b[field] || '';

        if (field === 'Date') {
            return currentSort.ascending ? new Date(valA) - new Date(valB) : new Date(valB) - new Date(valA);
        }

        valA = valA.toLowerCase();
        valB = valB.toLowerCase();

        if (valA < valB) return currentSort.ascending ? -1 : 1;
        if (valA > valB) return currentSort.ascending ? 1 : -1;
        return 0;
    });

    renderTable();
    updateHeaderUI();
}

// Update Header UI
function updateHeaderUI() {
    const headers = document.querySelectorAll('#journal-table th[data-field]');
    headers.forEach(header => {
        const field = header.getAttribute('data-field');
        if (!field) return;

        // Remove existing arrows
        let text = header.textContent.replace(/ [▲▼]$/, '');

        if (field === currentSort.field) {
            text += currentSort.ascending ? ' ▲' : ' ▼';
        }
        header.textContent = text;
    });
}

// Add Row
async function addRow() {
    journalData.unshift({
        Date: new Date().toISOString().split('T')[0],
        Ticker: '',
        Action: '',
        Rules: '',
        '后续走势': '',
        'Rules Followed': 'Yes'
    });
    await saveData();
    renderTable();
    updateStats();
    renderChart();
}

// Delete Row
async function deleteRow(index) {
    if (confirm('Are you sure you want to delete this row?')) {
        journalData.splice(index, 1);
        if (journalData.length === 0) {
            journalData.push({
                Date: new Date().toISOString().split('T')[0],
                Ticker: '',
                Action: '',
                Rules: '',
                '后续走势': '',
                'Rules Followed': 'Yes'
            });
        }
        await saveData();
        renderTable();
        updateStats();
        renderChart();
    }
}

// Pure functions for logic (testable)
function calculateStats(data) {
    const validRows = data.filter(row => row.Action && row.Action.trim() !== '');
    if (validRows.length === 0) return { yes: 0, no: 0, rate: 0 };

    const yes = validRows.filter(row => row['Rules Followed'] === 'Yes').length;
    const no = validRows.filter(row => row['Rules Followed'] === 'No').length;
    const total = yes + no;
    const rate = total > 0 ? Math.round((yes / total) * 100) : 0;
    return { yes, no, rate };
}

function calculateChartData(data) {
    const validRows = data.filter(row => row.Action && row.Action.trim() !== '');
    if (validRows.length === 0) return { labels: [], data: [] };

    const sortedRows = [...validRows].sort((a, b) => new Date(a.Date) - new Date(b.Date));
    const labels = [];
    const chartData = [];
    let cumulativeYes = 0;

    sortedRows.forEach((row, index) => {
        labels.push(row.Date);
        if (row['Rules Followed'] === 'Yes') {
            cumulativeYes++;
        }
        const rate = (cumulativeYes / (index + 1)) * 100;
        chartData.push(rate);
    });
    return { labels, data: chartData };
}

// Update Stats
function updateStats() {
    const stats = calculateStats(journalData);
    statYes.textContent = stats.yes;
    statNo.textContent = stats.no;
    statRate.textContent = `${stats.rate}%`;
}

// Render Chart
function renderChart() {
    const { labels, data } = calculateChartData(journalData);

    if (labels.length === 0) {
        if (trendChart) {
            trendChart.destroy();
            trendChart = null;
        }
        return;
    }

    const ctx = document.getElementById('trend-chart').getContext('2d');

    if (trendChart) {
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = data;
        trendChart.update();
    } else {
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Yes Rate (%)',
                    data: data,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function (value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// ================================
// Scoring Table (打分表) functions
// ================================

function makeScoringRow(row = {}) {
    const result = {};
    SCORING_FIELDS.forEach(field => {
        result[field] = row[field] !== undefined ? String(row[field]) : '';
    });
    // Backward compat: migrate old Chaikin → CK
    if (!result['CK'] && row['Chaikin'] !== undefined) {
        result['CK'] = String(row['Chaikin']);
    }
    // Backward compat: merge old 好消息 + 坏消息 → 消息
    if (!result['消息'] && (row['好消息'] !== undefined || row['坏消息'] !== undefined)) {
        const good = parseFloat(row['好消息']) || 0;
        const bad = parseFloat(row['坏消息']) || 0;
        const sum = good + bad;
        result['消息'] = sum !== 0 ? String(sum) : '';
    }
    // Default Time to today if empty on new rows
    if (!result['Time'] && !row['Time']) {
        const now = new Date();
        result['Time'] = `${now.getMonth() + 1}/${now.getDate()}`;
    }
    return result;
}

async function loadScoringData() {
    try {
        const content = await window.electronAPI.readFile(scoringCsvPath);
        if (content) {
            const cleanContent = content.replace(/^\uFEFF/, '');
            const result = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
            scoringData = result.data.map(row => makeScoringRow(row));
        } else {
            scoringData = [makeScoringRow()];
            await saveScoringData();
        }

        // Default sort by Time descending
        scoringData.sort((a, b) => {
            return compareScoringTime(b['Time'], a['Time']);
        });

        renderScoringTable();
    } catch (error) {
        console.error('Failed to load scoring data:', error);
    }
}

function compareScoringTime(a, b) {
    // Parse "M/D" format, assuming current year
    const parseTime = (t) => {
        if (!t) return 0;
        const parts = t.split('/');
        if (parts.length !== 2) return 0;
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        return month * 100 + day;
    };
    return parseTime(a) - parseTime(b);
}

async function saveScoringData() {
    const csv = Papa.unparse(scoringData, { columns: SCORING_FIELDS });
    await window.electronAPI.writeFile(scoringCsvPath, csv);
}

function renderScoringTable() {
    scoringTableBody.innerHTML = '';

    scoringData.forEach((row, index) => {
        const tr = document.createElement('tr');

        // Refresh button cell (first column, styled to look outside)
        tr.appendChild(createRefreshCell(index));

        SCORING_FIELDS.forEach(field => {
            const td = document.createElement('td');

            if (field === '代码') {
                td.className = 'col-scoring-code';
                td.contentEditable = true;
                td.textContent = row[field] || '';
                td.addEventListener('blur', () => updateScoringCell(index, field, td.textContent));
            } else if (field === '总分') {
                td.className = 'col-scoring-num';
                // Total is auto-calculated, but also editable as override
                const total = calculateScoringTotal(row);
                td.textContent = total;
                td.classList.add('score-total');
                // Force red when Setup is 0 (disqualified)
                const setupVal = parseFloat(row['Setup']);
                if (setupVal === 0 && !isNaN(setupVal) && row['Setup'].trim() !== '') {
                    td.classList.add('score-low');
                } else if (total >= 6) {
                    td.classList.add('score-high');
                } else if (total >= 4) {
                    td.classList.add('score-medium');
                } else {
                    td.classList.add('score-low');
                }
            } else if (field === 'Time') {
                td.className = 'col-scoring-time';
                td.contentEditable = true;
                td.textContent = row[field] || '';
                td.addEventListener('blur', () => updateScoringCell(index, field, td.textContent));
            } else {
                // Numeric scoring fields
                td.className = 'col-scoring-num';
                td.contentEditable = true;
                const val = parseFloat(row[field]);
                // Setup=0: show ❌ instead of 0
                if (field === 'Setup' && val === 0 && !isNaN(val) && row[field].trim() !== '') {
                    td.textContent = '❌';
                    td.classList.add('score-deep-red');
                } else {
                    td.textContent = row[field] || '';
                    if (!isNaN(val)) {
                        if (val === 1 || val === 1.5) td.classList.add('score-green');
                        else if (val === 0.5) td.classList.add('score-orange');
                        else if (val === 0) td.classList.add('score-zero');
                        else if (val === -0.5) td.classList.add('score-light-red');
                        else if (val <= -1) td.classList.add('score-deep-red');
                    }
                }
                td.addEventListener('blur', () => {
                    let cellValue = td.textContent;
                    // Convert ❌ back to "0" for Setup field
                    if (field === 'Setup' && cellValue.trim() === '❌') {
                        cellValue = '0';
                    }
                    updateScoringCell(index, field, cellValue);
                });
            }

            tr.appendChild(td);
        });

        // Delete button
        const tdActions = document.createElement('td');
        tdActions.className = 'col-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete Row';
        deleteBtn.addEventListener('click', () => deleteScoringRow(index));
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);

        scoringTableBody.appendChild(tr);
    });
}

function calculateScoringTotal(row) {
    let total = 0;
    SCORING_NUM_FIELDS.forEach(field => {
        if (field === '总分') return; // skip total itself
        const val = parseFloat(row[field]);
        if (!isNaN(val)) total += val;
    });
    return total;
}

async function updateScoringCell(index, field, value) {
    const trimmed = value.trim();
    if (scoringData[index][field] !== trimmed) {
        scoringData[index][field] = trimmed;
        // Recalculate total
        scoringData[index]['总分'] = String(calculateScoringTotal(scoringData[index]));
        await saveScoringData();
        renderScoringTable();
    }
}

async function addScoringRow() {
    scoringData.unshift(makeScoringRow());
    await saveScoringData();
    renderScoringTable();
}

// refreshScoringRow is defined in scoring-refresh.js

async function deleteScoringRow(index) {
    if (confirm('确定删除这行吗？')) {
        scoringData.splice(index, 1);
        if (scoringData.length === 0) {
            scoringData.push(makeScoringRow());
        }
        await saveScoringData();
        renderScoringTable();
    }
}

function sortScoringData(field) {
    if (scoringSort.field === field) {
        scoringSort.ascending = !scoringSort.ascending;
    } else {
        scoringSort.field = field;
        scoringSort.ascending = false;
    }

    scoringData.sort((a, b) => {
        let valA = a[field] || '';
        let valB = b[field] || '';

        if (field === 'Time') {
            const cmp = compareScoringTime(valA, valB);
            return scoringSort.ascending ? cmp : -cmp;
        }

        // Try numeric comparison for scoring fields
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
            return scoringSort.ascending ? numA - numB : numB - numA;
        }

        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
        if (valA < valB) return scoringSort.ascending ? -1 : 1;
        if (valA > valB) return scoringSort.ascending ? 1 : -1;
        return 0;
    });

    renderScoringTable();
    updateScoringHeaderUI();
}

function updateScoringHeaderUI() {
    const headers = document.querySelectorAll('#scoring-table th[data-scoring-field]');
    headers.forEach(header => {
        const field = header.getAttribute('data-scoring-field');
        if (!field) return;

        let text = header.textContent.replace(/ [▲▼]$/, '');

        if (field === scoringSort.field) {
            text += scoringSort.ascending ? ' ▲' : ' ▼';
        }
        header.textContent = text;
    });
}

// ================================
// Holdings Table (持仓表) functions
// ================================

function makeHoldingsRow(row = {}) {
    return {
        'Ticker': row['Ticker'] || '',
        '状态': row['状态'] || '🔻',
        '均价 * 股数': row['均价 * 股数'] || '',
        '是否有警报': row['是否有警报'] || '❌',
        '是否有自动止损': row['是否有自动止损'] || '❌'
    };
}

async function loadHoldingsData() {
    try {
        const content = await window.electronAPI.readFile(holdingsCsvPath);
        if (content) {
            const cleanContent = content.replace(/^\uFEFF/, '');
            const result = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
            holdingsData = result.data.map(row => makeHoldingsRow(row));
        } else {
            holdingsData = [];
            await saveHoldingsData();
        }
        renderHoldingsTable();
    } catch (error) {
        console.error('Failed to load holdings data:', error);
    }
}

async function saveHoldingsData() {
    const csv = Papa.unparse(holdingsData, { columns: HOLDINGS_FIELDS });
    await window.electronAPI.writeFile(holdingsCsvPath, csv);
}

function renderHoldingsTable() {
    holdingsTableBody.innerHTML = '';

    holdingsData.forEach((row, index) => {
        const tr = document.createElement('tr');

        // Ticker (editable)
        const tdTicker = document.createElement('td');
        tdTicker.className = 'col-holdings-ticker';
        tdTicker.contentEditable = true;
        tdTicker.textContent = row['Ticker'] || '';
        tdTicker.addEventListener('blur', () => updateHoldingsCell(index, 'Ticker', tdTicker.textContent));
        tr.appendChild(tdTicker);

        // 状态 (select: 🔻 or 🥊)
        const tdStatus = document.createElement('td');
        tdStatus.className = 'holdings-status-cell';
        const statusSelect = document.createElement('select');
        statusSelect.className = 'holdings-status-select';
        HOLDINGS_STATUS_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            if (opt === row['状态']) option.selected = true;
            statusSelect.appendChild(option);
        });
        statusSelect.addEventListener('change', () => updateHoldingsCell(index, '状态', statusSelect.value));
        tdStatus.appendChild(statusSelect);
        tr.appendChild(tdStatus);

        // 均价 * 股数 (editable text)
        const tdDetail = document.createElement('td');
        tdDetail.className = 'col-holdings-detail';
        tdDetail.contentEditable = true;
        tdDetail.textContent = row['均价 * 股数'] || '';
        tdDetail.addEventListener('blur', () => updateHoldingsCell(index, '均价 * 股数', tdDetail.textContent));
        tr.appendChild(tdDetail);

        // 是否有警报 (select: ✅ or ❌)
        const tdAlert = document.createElement('td');
        const alertVal = row['是否有警报'];
        tdAlert.className = alertVal === '✅' ? 'holdings-yes' : 'holdings-no';
        const alertSelect = document.createElement('select');
        alertSelect.className = 'holdings-yn-select';
        HOLDINGS_YN_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            if (opt === alertVal) option.selected = true;
            alertSelect.appendChild(option);
        });
        alertSelect.addEventListener('change', () => updateHoldingsCell(index, '是否有警报', alertSelect.value));
        tdAlert.appendChild(alertSelect);
        tr.appendChild(tdAlert);

        // 是否有自动止损 (select: ✅ or ❌)
        const tdStop = document.createElement('td');
        const stopVal = row['是否有自动止损'];
        tdStop.className = stopVal === '✅' ? 'holdings-yes' : 'holdings-no';
        const stopSelect = document.createElement('select');
        stopSelect.className = 'holdings-yn-select';
        HOLDINGS_YN_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            if (opt === stopVal) option.selected = true;
            stopSelect.appendChild(option);
        });
        stopSelect.addEventListener('change', () => updateHoldingsCell(index, '是否有自动止损', stopSelect.value));
        tdStop.appendChild(stopSelect);
        tr.appendChild(tdStop);

        // Delete button
        const tdActions = document.createElement('td');
        tdActions.className = 'col-holdings-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete Row';
        deleteBtn.addEventListener('click', () => deleteHoldingsRow(index));
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);

        holdingsTableBody.appendChild(tr);
    });
}

async function updateHoldingsCell(index, field, value) {
    const trimmed = value.trim();
    if (holdingsData[index][field] !== trimmed) {
        holdingsData[index][field] = trimmed;
        await saveHoldingsData();
        renderHoldingsTable();
    }
}

async function addHoldingsRow() {
    holdingsData.push(makeHoldingsRow());
    await saveHoldingsData();
    renderHoldingsTable();
}

async function deleteHoldingsRow(index) {
    if (confirm('确定删除这行吗？')) {
        holdingsData.splice(index, 1);
        await saveHoldingsData();
        renderHoldingsTable();
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

// Init find after DOM is ready
if (typeof document !== 'undefined') {
    initFind();
}


// Run if in browser
if (typeof document !== 'undefined') {
    init();
}

// Export for testing in Node
if (typeof module !== 'undefined') {
    module.exports = { calculateStats, calculateChartData };
}
