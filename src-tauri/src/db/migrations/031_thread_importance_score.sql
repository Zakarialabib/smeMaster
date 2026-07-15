-- 031: add importance_score to threads for priority/Focused inbox sorting.
-- `is_important` already exists (boolean); `importance_score` is a nullable
-- integer rank (higher = more important) used to sort a "Focused" inbox and
-- to drive the priority split. Additive, safe to re-run.
ALTER TABLE threads ADD COLUMN importance_score INTEGER;
UPDATE threads SET importance_score = CASE WHEN is_important = 1 THEN 100 ELSE 0 END
  WHERE importance_score IS NULL;
