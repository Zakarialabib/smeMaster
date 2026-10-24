-- 039_voice_agent_config.sql
--
-- Move voice settings from the global settings table into the agents
-- table so each agent carries its own voice configuration (STT/TTS
-- provider, voice id, model, offline paths, speed). This eliminates
-- the global voice_* settings that VoiceSettings previously wrote to
-- and makes the VoiceSettings tab bind to the selected agent record
-- instead of a shared global row.
--
-- NOTE: numbered 039, not 035 — 035_calendar_account_id.sql already owns
-- that slot. Two files sharing a prefix means one is silently never applied
-- (the registry is an ordered array, not a glob), and the
-- test_migration_files_match_registry guard exists precisely to catch this.
--
-- Additive and safe to re-run.

ALTER TABLE agents ADD COLUMN voice_provider TEXT DEFAULT NULL;
ALTER TABLE agents ADD COLUMN voice_base_url TEXT DEFAULT NULL;
ALTER TABLE agents ADD COLUMN voice_tts_voice TEXT DEFAULT NULL;
ALTER TABLE agents ADD COLUMN voice_stt_model TEXT DEFAULT NULL;
ALTER TABLE agents ADD COLUMN voice_tts_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agents ADD COLUMN voice_stt_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agents ADD COLUMN voice_tts_speed REAL NOT NULL DEFAULT 1.0;
ALTER TABLE agents ADD COLUMN voice_offline_tts_dir TEXT DEFAULT NULL;
ALTER TABLE agents ADD COLUMN voice_offline_stt_dir TEXT DEFAULT NULL;
