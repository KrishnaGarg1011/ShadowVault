const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Create a new secure drop
exports.createVault = async (req, res, next) => {
    try {
        const { payload, expiresInHours, maxViews, passcode, decoyPayload, maxFailedAttempts } = req.body;
        
        if (!payload) {
            return res.status(400).json({ error: 'Payload is required' });
        }

        const secretKey = uuidv4().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + (expiresInHours || 24) * 60 * 60 * 1000);
        
        let passcodeHash = null;
        if (passcode) {
            passcodeHash = await bcrypt.hash(passcode, 10);
        }

        const query = `
            INSERT INTO vaults (secret_key, payload, passcode_hash, expires_at, max_views, decoy_payload, max_failed_attempts)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, secret_key, expires_at, max_views, max_failed_attempts;
        `;
        
        const values = [
            secretKey, 
            payload, 
            passcodeHash, 
            expiresAt, 
            maxViews || 1, 
            decoyPayload || null, 
            maxFailedAttempts || 3
        ];

        const result = await pool.query(query, values);
        const vault = result.rows[0];

        // Audit Log
        await pool.query(
            'INSERT INTO audit_logs (vault_id, action, ip_address, details) VALUES ($1, $2, $3, $4)',
            [vault.id, 'CREATED', req.ip, 'Secure drop created successfully']
        );

        res.status(201).json({
            success: true,
            secretKey: vault.secret_key,
            expiresAt: vault.expires_at,
            accessUrl: `http://localhost:5173/vault/${vault.secret_key}`
        });
    } catch (err) {
        next(err);
    }
};

// Access a secure drop
exports.accessVault = async (req, res, next) => {
    try {
        const { secretKey } = req.params;
        const { passcode, useDecoy } = req.body;

        const result = await pool.query('SELECT * FROM vaults WHERE secret_key = $1', [secretKey]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vault drop not found or already destroyed.' });
        }

        const vault = result.rows[0];

        // Check if already burned or expired
        if (vault.is_burned || new Date() > new Date(vault.expires_at)) {
            return res.status(410).json({ error: 'This drop has expired or has been incinerated.' });
        }

        // Check failed attempts lock
        if (vault.failed_attempts >= vault.max_failed_attempts) {
            await pool.query('UPDATE vaults SET is_burned = TRUE WHERE id = $1', [vault.id]);
            await pool.query('INSERT INTO audit_logs (vault_id, action, ip_address, details) VALUES ($1, $2, $3, $4)', 
                [vault.id, 'BURNED', req.ip, 'Locked out due to max failed passcode attempts']);
            return res.status(403).json({ error: 'Security lockdown triggered. Drop incinerated.' });
        }

        // Verify Passcode if required
        if (vault.passcode_hash) {
            if (!passcode) {
                return res.status(401).json({ error: 'Passcode required to open this vault.', requiresPasscode: true });
            }
            const match = await bcrypt.compare(passcode, vault.passcode_hash);
            if (!match) {
                const newFailed = vault.failed_attempts + 1;
                await pool.query('UPDATE vaults SET failed_attempts = $1 WHERE id = $2', [newFailed, vault.id]);
                await pool.query('INSERT INTO audit_logs (vault_id, action, ip_address, details) VALUES ($1, $2, $3, $4)', 
                    [vault.id, 'VIEW_FAILED', req.ip, `Incorrect passcode attempt (${newFailed}/${vault.max_failed_attempts})`]);
                
                return res.status(401).json({ 
                    error: `Incorrect passcode. Attempt ${newFailed} of ${vault.max_failed_attempts}.`,
                    requiresPasscode: true 
                });
            }
        }

        // Increment views
        const newViews = vault.views_count + 1;
        let shouldBurn = newViews >= vault.max_views;

        await pool.query('UPDATE vaults SET views_count = $1, is_burned = $2 WHERE id = $3', [newViews, shouldBurn, vault.id]);
        
        await pool.query('INSERT INTO audit_logs (vault_id, action, ip_address, details) VALUES ($1, $2, $3, $4)', 
            [vault.id, 'VIEW_SUCCESS', req.ip, `Payload accessed successfully. Views: ${newViews}/${vault.max_views}`]);

        const deliveredPayload = (useDecoy && vault.decoy_payload) ? vault.decoy_payload : vault.payload;

        res.json({
            success: true,
            payload: deliveredPayload,
            viewsRemaining: Math.max(0, vault.max_views - newViews),
            isBurned: shouldBurn
        });
    } catch (err) {
        next(err);
    }
};

// Emergency Panic Revocation (Self-Destruct Now)
exports.burnVault = async (req, res, next) => {
    try {
        const { secretKey } = req.params;
        const result = await pool.query('UPDATE vaults SET is_burned = TRUE WHERE secret_key = $1 RETURNING id', [secretKey]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vault drop not found.' });
        }

        await pool.query('INSERT INTO audit_logs (vault_id, action, ip_address, details) VALUES ($1, $2, $3, $4)', 
            [result.rows[0].id, 'REVOKED', req.ip, 'Manual panic button annihilation triggered']);

        res.json({ success: true, message: 'Drop successfully incinerated.' });
    } catch (err) {
        next(err);
    }
};

// Fetch audit logs for telemetry UI
exports.getAuditLogs = async (req, res, next) => {
    try {
        const query = `
            v.secret_key, a.action, a.ip_address, a.details, a.created_at
            FROM audit_logs a
            JOIN vaults v ON a.vault_id = v.id
            ORDER BY a.created_at DESC
            LIMIT 50;
        `;
        const result = await pool.query(`SELECT ${query}`);
        res.json({ success: true, logs: result.rows });
    } catch (err) {
        next(err);
    }
};