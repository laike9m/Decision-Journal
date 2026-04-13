// State
let csvPath = '';
let journalData = [];
let trendChart = null;
let currentSort = { field: null, ascending: true };

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
            await window.electronAPI.saveConfig(csvPath);
            await loadData();
        }
    });

    // Load saved path from config or get default
    try {
        const config = await window.electronAPI.getConfig();
        csvPath = config.csvPath;
        if (!csvPath) {
            csvPath = await window.electronAPI.getDefaultPath();
            await window.electronAPI.saveConfig(csvPath);
        }
        csvPathInput.value = csvPath;
        await loadData();
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
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });
}

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
        currentSort.ascending = true;
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
    journalData.push({
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
                            callback: function(value) {
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

// Run if in browser
if (typeof document !== 'undefined') {
    init();
}

// Export for testing in Node
if (typeof module !== 'undefined') {
    module.exports = { calculateStats, calculateChartData };
}
