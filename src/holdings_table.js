// ================================
// Holdings Table (持仓表) Module
// ================================
// Rendering and CRUD for the Holdings Table.
//
// Globals consumed (set by renderer.js before this runs):
//   holdingsData, holdingsCsvPath, holdingsTableBody,
//   HOLDINGS_FIELDS, HOLDINGS_STATUS_OPTIONS, HOLDINGS_YN_OPTIONS
//
// Globals produced:
//   makeHoldingsRow, loadHoldingsData, saveHoldingsData,
//   renderHoldingsTable, updateHoldingsCell, addHoldingsRow, deleteHoldingsRow

// ─── Row Factory ──────────────────────────────────────────────────────

function makeHoldingsRow(row = {}) {
    return {
        'Ticker': row['Ticker'] || '',
        '状态': row['状态'] || '🔻',
        '均价 * 股数': row['均价 * 股数'] || '',
        '是否有警报': row['是否有警报'] || '❌',
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
        await saveHoldingsData();
        renderHoldingsTable();
    }
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
