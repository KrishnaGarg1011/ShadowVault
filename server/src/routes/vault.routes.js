const express = require('express');
const router = express.Router();
const vaultController = require('../controllers/vault.controller');

router.post('/create', vaultController.createVault);
router.post('/access/:secretKey', vaultController.accessVault);
router.post('/burn/:secretKey', vaultController.burnVault);
router.get('/logs/telemetry', vaultController.getAuditLogs);

module.exports = router;