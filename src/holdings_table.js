// ================================
// Holdings Table (持仓表) Module
// ================================
// Rendering and CRUD for the Holdings Table.
//
// Globals consumed (set by renderer.js before this runs):
//   holdingsData, holdingsCsvPath, holdingsTableBody,
//   HOLDINGS_FIELDS, HOLDINGS_YN_OPTIONS
//
// Globals produced:
//   makeHoldingsRow, loadHoldingsData, saveHoldingsData,
//   renderHoldingsTable, updateHoldingsCell, addHoldingsRow, deleteHoldingsRow,
//   refreshAllHoldingsPrices

// ─── Row Factory ──────────────────────────────────────────────────────

function makeHoldingsRow(row = {}) {
    return {
        'Ticker': row['Ticker'] || '',
        '股价': row['股价'] || row['状态'] || '',
        '均价 * 股数': row['均价 * 股数'] || '',
        'PnL': row['PnL'] || '',
        '警报': row['警报'] || row['是否有警报'] || '❌',
        '自动止损': row['自动止损'] || row['是否有自动止损'] || ''
    };
}

// ─── Data Loading ─────────────────────────────────────────────────────

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

// ─── Data Saving ──────────────────────────────────────────────────────

async function saveHoldingsData() {
    const csv = Papa.unparse(holdingsData, { columns: HOLDINGS_FIELDS });
    await window.electronAPI.writeFile(holdingsCsvPath, csv);
}

// ─── PnL Calculation ──────────────────────────────────────────────────

/**
 * Parse the "均价 * 股数" field to extract avgPrice and quantity.
 * Expected format: "150.2 * 100" → { avgPrice: 150.2, qty: 100 }
 * Returns null if parsing fails.
 */
function parseAvgPriceQty(detail) {
    if (!detail || typeof detail !== 'string') return null;
    const parts = detail.split('*').map(s => s.trim());
    if (parts.length !== 2) return null;
    const avgPrice = parseFloat(parts[0]);
    const qty = parseFloat(parts[1]);
    if (isNaN(avgPrice) || isNaN(qty) || qty === 0) return null;
    return { avgPrice, qty };
}

/**
 * Calculate PnL given current price and the "均价 * 股数" field.
 * Returns { value: number, percent: number, display: string } or null.
 */
function calculatePnL(currentPrice, detail) {
    const parsed = parseAvgPriceQty(detail);
    if (!parsed || !currentPrice) return null;
    const { avgPrice, qty } = parsed;
    const pnl = (currentPrice - avgPrice) * qty;
    const pctChange = ((currentPrice - avgPrice) / avgPrice) * 100;
    const sign = pnl >= 0 ? '+' : '';
    const display = `${sign}${pnl.toFixed(0)} (${sign}${pctChange.toFixed(1)}%)`;
    return { value: pnl, percent: pctChange, display };
}

// ─── Render Table ─────────────────────────────────────────────────────

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

        // 股价 (read-only, populated by refresh)
        const tdPrice = document.createElement('td');
        tdPrice.className = 'col-holdings-price';
        const priceVal = row['股价'];
        if (priceVal && priceVal !== '' && !isNaN(parseFloat(priceVal))) {
            tdPrice.textContent = parseFloat(priceVal).toFixed(2);
        } else {
            tdPrice.textContent = priceVal || '—';
        }
        tr.appendChild(tdPrice);

        // 均价 * 股数 (editable text)
        const tdDetail = document.createElement('td');
        tdDetail.className = 'col-holdings-detail';
        tdDetail.contentEditable = true;
        tdDetail.textContent = row['均价 * 股数'] || '';
        tdDetail.addEventListener('blur', () => updateHoldingsCell(index, '均价 * 股数', tdDetail.textContent));
        tr.appendChild(tdDetail);

        // PnL (calculated, read-only)
        const tdPnl = document.createElement('td');
        tdPnl.className = 'col-holdings-pnl';
        const currentPrice = parseFloat(row['股价']);
        const pnlResult = calculatePnL(currentPrice, row['均价 * 股数']);
        if (pnlResult) {
            tdPnl.textContent = pnlResult.display;
            tdPnl.classList.add(pnlResult.value >= 0 ? 'holdings-pnl-positive' : 'holdings-pnl-negative');
        } else {
            tdPnl.textContent = '—';
        }
        tr.appendChild(tdPnl);

        // 警报 (select: ✅ or ❌)
        const tdAlert = document.createElement('td');
        const alertVal = row['警报'];
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
        alertSelect.addEventListener('change', () => updateHoldingsCell(index, '警报', alertSelect.value));
        tdAlert.appendChild(alertSelect);
        tr.appendChild(tdAlert);

        // 自动止损 (editable text)
        const tdStop = document.createElement('td');
        tdStop.className = 'col-holdings-stoploss';
        tdStop.contentEditable = true;
        tdStop.textContent = row['自动止损'] || '';
        tdStop.addEventListener('blur', () => updateHoldingsCell(index, '自动止损', tdStop.textContent));
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

// ─── Cell Update ──────────────────────────────────────────────────────

async function updateHoldingsCell(index, field, value) {
    const trimmed = value.trim();
    if (holdingsData[index][field] !== trimmed) {
        holdingsData[index][field] = trimmed;

        // Recalculate PnL when 均价 * 股数 changes and we have a price
        if (field === '均价 * 股数') {
            const currentPrice = parseFloat(holdingsData[index]['股价']);
            const pnlResult = calculatePnL(currentPrice, trimmed);
            holdingsData[index]['PnL'] = pnlResult ? pnlResult.display : '';
        }

        await saveHoldingsData();
        renderHoldingsTable();
    }
}

// ─── Refresh Stock Prices ─────────────────────────────────────────────

/**
 * Fetch current prices for all tickers in parallel and update the table.
 */
async function refreshAllHoldingsPrices() {
    const btn = refreshHoldingsBtn;
    btn.classList.add('spinning');
    btn.disabled = true;

    const tickers = holdingsData
        .map((row, i) => ({ ticker: row['Ticker']?.trim(), index: i }))
        .filter(t => t.ticker);

    if (tickers.length === 0) {
        btn.classList.remove('spinning');
        btn.disabled = false;
        return;
    }

    // Fetch all prices in parallel
    const results = await Promise.allSettled(
        tickers.map(async ({ ticker, index }) => {
            const price = await window.electronAPI.fetchStockPrice(ticker);
            return { index, ticker, price };
        })
    );

    let changed = false;
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value.price != null) {
            const { index, price } = result.value;
            const priceStr = price.toString();
            if (holdingsData[index]['股价'] !== priceStr) {
                holdingsData[index]['股价'] = priceStr;
                changed = true;
            }
            // Recalculate PnL
            const pnlResult = calculatePnL(price, holdingsData[index]['均价 * 股数']);
            const pnlStr = pnlResult ? pnlResult.display : '';
            if (holdingsData[index]['PnL'] !== pnlStr) {
                holdingsData[index]['PnL'] = pnlStr;
                changed = true;
            }
        }
    }

    if (changed) {
        await saveHoldingsData();
    }
    renderHoldingsTable();

    btn.classList.remove('spinning');
    btn.disabled = false;
}

// ─── Add / Delete ─────────────────────────────────────────────────────

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
