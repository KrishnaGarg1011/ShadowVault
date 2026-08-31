DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS vaults CASCADE;

CREATE TABLE vaults (
    id SERIAL PRIMARY KEY,
    secret_key VARCHAR(64) UNIQUE NOT NULL,
    payload TEXT NOT NULL, -- The secret message or file reference
    is_file BOOLEAN DEFAULT FALSE,
    passcode_hash VARCHAR(255), -- Optional bcrypt hash for extra security
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    max_views INT DEFAULT 1,
    views_count INT DEFAULT 0,
    failed_attempts INT DEFAULT 0,
    max_failed_attempts INT DEFAULT 3,
    is_burned BOOLEAN DEFAULT FALSE,
    decoy_payload TEXT, -- Decoy payload for duress situations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    vault_id INT REFERENCES vaults(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- CREATED, VIEW_SUCCESS, VIEW_FAILED, BURNED, REVOKED
    ip_address VARCHAR(45),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vaults_secret_key ON vaults(secret_key);
CREATE INDEX idx_audit_vault_id ON audit_logs(vault_id);