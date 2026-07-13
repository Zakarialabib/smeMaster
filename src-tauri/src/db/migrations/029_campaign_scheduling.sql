-- Campaign scheduling: add scheduled_at and recurring_cron to campaigns,
-- and create campaign_schedules table for tracking scheduled instances.

ALTER TABLE campaigns ADD COLUMN scheduled_at INTEGER;
ALTER TABLE campaigns ADD COLUMN recurring_cron TEXT;

CREATE TABLE IF NOT EXISTS campaign_schedules (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    scheduled_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaign_schedules_due ON campaign_schedules(status, scheduled_at);
