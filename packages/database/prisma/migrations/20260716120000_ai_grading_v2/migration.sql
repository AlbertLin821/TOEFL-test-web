ALTER TYPE "GradingJobType" ADD VALUE IF NOT EXISTS 'objective_feedback';
ALTER TYPE "GradingJobType" ADD VALUE IF NOT EXISTS 'feedback_translation';

ALTER TYPE "AiSkill" ADD VALUE IF NOT EXISTS 'reading';
ALTER TYPE "AiSkill" ADD VALUE IF NOT EXISTS 'listening';

ALTER TABLE "audio_responses"
  ADD COLUMN "display_transcript" TEXT,
  ADD COLUMN "transcript_confidence" DECIMAL(5,4),
  ADD COLUMN "transcript_meta_json" JSONB,
  ADD COLUMN "audio_quality_json" JSONB,
  ADD COLUMN "pronunciation_provider" TEXT,
  ADD COLUMN "pronunciation_status" TEXT,
  ADD COLUMN "pronunciation_json" JSONB;

ALTER TABLE "ai_grade_results"
  ALTER COLUMN "exam_item_id" DROP NOT NULL,
  ADD COLUMN "result_key" TEXT,
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'zh-TW',
  ADD COLUMN "input_hash" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ai_grade_results"
SET "result_key" = 'legacy:' || "id";

ALTER TABLE "ai_grade_results"
  ALTER COLUMN "result_key" SET NOT NULL;

CREATE UNIQUE INDEX "ai_grade_results_attempt_id_result_key_prompt_version_locale_key"
  ON "ai_grade_results"("attempt_id", "result_key", "prompt_version", "locale");
