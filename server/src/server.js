const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = require('./config/db');
const vaultRoutes = require('./routes/vault.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/vaults', vaultRoutes);
app.use(errorHandler);

// Function to automatically execute schema.sql on startup
async function initializeDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log("[ShadowVault] Database tables initialized successfully.");
    } catch (err) {
        console.error("[ShadowVault] Error initializing database schema:", err);
    }
}

// Function to terminate any process currently running on the assigned port before starting
const terminateExistingProcessAndStart = () => {
    const isWindows = process.platform === 'win32';
    const findCmd = isWindows 
        ? `netstat -ano | findstr :${PORT}` 
        : `lsof -ti :${PORT}`;

    exec(findCmd, (err, stdout) => {
        if (!err && stdout) {
            console.log(`[Lifecycle] Port ${PORT} is currently active. Terminating old process...`);
            let killCmd = '';
            if (isWindows) {
                const lines = stdout.trim().split('\n');
                const pids = new Set();
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && !isNaN(pid)) pids.add(pid);
                });
                pids.forEach(pid => {
                    exec(`taskkill /F /PID ${pid}`, () => {});
                });
            } else {
                exec(`kill -9 ${stdout.trim()}`, () => {});
            }
            setTimeout(() => startServer(), 1000);
        } else {
            startServer();
        }
    });
};

const startServer = () => {
    app.listen(PORT, async () => {
        console.log(`[ShadowVault] Backend engine online and listening on port ${PORT}`);
        await initializeDatabase();
    });
};

terminateExistingProcessAndStart();
