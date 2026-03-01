CREATE TABLE observation_log (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    type        TEXT    NOT NULL,
    source      TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    details     TEXT,
    data        TEXT,
    scope_ids   TEXT[]  NOT NULL DEFAULT '{}',
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
CREATE INDEX idx_observation_log_scopes ON observation_log USING GIN (scope_ids);
