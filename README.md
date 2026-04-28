# Decision Journal

A desktop application for tracking trading decisions.

## Prerequisites

- Node.js (v20+ recommended)

## Setup and Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the application:
   ```bash
   npm start
   ```

3. Build the application (for local standalone use):
   ```bash
   npm run build
   ```

## Features

- **Editable Table**: Click and edit cells directly.
- **Auto-save**: Automatically saves to CSV on edit.
- **Stats**: Real-time summary of compliance.
- **Chart**: Interactive trend chart.
- **Holdings Tracker**: Real-time stock prices via Yahoo Finance with PnL calculation.
- **Premium UI**: Modern aesthetic with glassmorphism touches.

## Project Structure

```
src/
├── main.js             # Electron main process
├── preload.js          # Preload script (IPC bridge)
├── renderer.js         # Shared state, init, tab switching, file watching, find
├── tables/
│   ├── journal_table.js    # Decision Journal table rendering & CRUD
│   ├── scoring_table.js    # 打分表 table rendering & CRUD
│   ├── holdings_table.js   # 持仓表 table rendering & CRUD
│   └── update_score.js     # Score refresh button & toast notifications
├── ws_server.js        # WebSocket server for Chrome extension comm
├── index.html          # Main HTML
└── styles.css          # Styles
```