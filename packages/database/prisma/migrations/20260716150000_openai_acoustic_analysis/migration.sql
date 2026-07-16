ALTER TABLE "audio_responses"
  RENAME COLUMN "pronunciation_provider" TO "acoustic_provider";

ALTER TABLE "audio_responses"
  RENAME COLUMN "pronunciation_status" TO "acoustic_status";

ALTER TABLE "audio_responses"
  RENAME COLUMN "pronunciation_json" TO "acoustic_json";
