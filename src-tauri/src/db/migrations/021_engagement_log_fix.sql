-- Engagement log: add entity tracking columns that were missing from 003_contacts.sql
-- The Rust struct and TypeScript types already expect these fields.

ALTER TABLE engagement_log ADD COLUMN entity_type TEXT;
ALTER TABLE engagement_log ADD COLUMN entity_id TEXT;
ALTER TABLE engagement_log ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';
