/**
 * Scoring Table — Refresh Button
 *
 * Creates the per-row refresh (↻) button and handles its click behaviour.
 * This module exposes two functions on the global scope so renderer.js can
 * call them without a bundler:
 *
 *   createRefreshCell(index)   — returns a <td> element for the given row
 *   refreshScoringRow(index)   — called when the button is clicked
 */

/**
 * Create a <td> containing a refresh button for the given row index.
 *
 * @param {number} index  Row index in scoringData
 * @returns {HTMLTableCellElement}
 */
function createRefreshCell(index) {
    const td = document.createElement('td');
    td.className = 'col-scoring-action';

    const btn = document.createElement('button');
    btn.className = 'refresh-btn';
    btn.innerHTML = '↻';
    btn.title = 'Refresh';
    btn.addEventListener('click', () => refreshScoringRow(index));

    td.appendChild(btn);
    return td;
}

/**
 * Handle a refresh-button click for the given row.
 *
 * TODO: Add custom refresh logic here (e.g. fetch latest data for the
 *       ticker, recalculate scores from an external source, etc.).
 *       For now this only updates the Time field to today.
 *
 * @param {number} index  Row index in scoringData
 */
async function refreshScoringRow(index) {
    const now = new Date();
    const newTime = `${now.getMonth() + 1}/${now.getDate()}`;
    if (scoringData[index]['Time'] !== newTime) {
        scoringData[index]['Time'] = newTime;
        await saveScoringData();
        renderScoringTable();
    }
}
