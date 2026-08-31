const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
require('dotenv').config();

const vaultRoutes = require('./routes/vault.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/vaults', vaultRoutes);
app.use(errorHandler);

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
                // Extract PID from netstat output lines
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
            // Wait a moment for port release before binding
            setTimeout(() => startServer(), 1000);
        } else {
            startServer();
        }
    });
};

const startServer = () => {
    app.listen(PORT, () => {
        console.log(`[ShadowVault] Backend engine online and listening on port ${PORT}`);
    });
};

terminateExistingProcessAndStart();