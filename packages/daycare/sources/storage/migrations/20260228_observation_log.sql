CREATE TABLE observation_log (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    type        TEXT    NOT NULL,
    source      TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    details     TEXT,
    data        TEXT,
    created_at  BIGINT  NOT NULL
);
-->statement-breakpoint
CREATE INDEX idx_observation_log_user ON observation_log (user_id);
-->statement-breakpoint
CREATE INDEX idx_observation_log_type ON observation_log (type);
-->statement-breakpoint
CREATE INDEX idx_observation_log_created ON observation_log (created_at);
-->statement-breakpoint
CREATE INDEX idx_observation_log_user_created ON observation_log (user_id, created_at);
-->statement-breakpoint
CREATE TABLE observation_log_scopes (
    observation_id  TEXT NOT NULL REFERENCES observation_log(id) ON DELETE CASCADE,
    scope_id        TEXT NOT NULL,
    PRIMARY KEY (observation_id, scope_id)
);
-->statement-breakpoint
CREATE INDEX idx_observation_log_scopes_scope ON observation_log_scopes (scope_id);
