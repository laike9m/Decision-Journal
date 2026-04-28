// ================================
// Scoring Table (打分表) Module
// ================================
// Rendering, CRUD, sorting, and total-score calculation for the Scoring Table.
//
// Globals consumed (set by renderer.js before this runs):
//   scoringData, scoringCsvPath, scoringTableBody, scoringSort,
//   SCORING_FIELDS, SCORING_NUM_FIELDS
//
// Globals produced:
//   makeScoringRow, loadScoringData, saveScoringData, renderScoringTable,
//   calculateScoringTotal, updateScoringCell, addScoringRow, deleteScoringRow,
//   sortScoringData, updateScoringHeaderUI, compareScoringTime

// ─── Row Factory ──────────────────────────────────────────────────────

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

// ─── Data Loading ─────────────────────────────────────────────────────

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

// ─── Time Comparison ──────────────────────────────────────────────────

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

// ─── Data Saving ──────────────────────────────────────────────────────

async function saveScoringData() {
    const csv = Papa.unparse(scoringData, { columns: SCORING_FIELDS });
    await window.electronAPI.writeFile(scoringCsvPath, csv);
}

// ─── Render Table ─────────────────────────────────────────────────────

function renderScoringTable() {
    scoringTableBody.innerHTML = '';

    scoringData.forEach((row, index) => {
        const tr = document.createElement('tr');

        // Refresh button cell (first column, styled to look outside)
        tr.appendChild(createRefreshCell(index, row['代码']));

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

// ─── Total Score ──────────────────────────────────────────────────────

function calculateScoringTotal(row) {
    let total = 0;
    SCORING_NUM_FIELDS.forEach(field => {
        if (field === '总分') return; // skip total itself
        const val = parseFloat(row[field]);
        if (!isNaN(val)) total += val;
    });
    return total;
}

// ─── Cell Update ──────────────────────────────────────────────────────

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

// ─── Add / Delete ─────────────────────────────────────────────────────

async function addScoringRow() {
    scoringData.unshift(makeScoringRow());
    await saveScoringData();
    renderScoringTable();
}

// refreshScoringRow is defined in update_score.js

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

// ─── Sorting ──────────────────────────────────────────────────────────

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
