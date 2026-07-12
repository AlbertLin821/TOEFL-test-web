-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('platform_admin', 'org_admin', 'teacher', 'student');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('reading', 'listening', 'writing', 'speaking');

-- CreateEnum
CREATE TYPE "GradingType" AS ENUM ('auto', 'ai', 'manual');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('audio', 'image', 'pdf', 'video');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('scheduled', 'active', 'closed');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('not_started', 'hardware_check', 'in_progress', 'submitted', 'grading', 'completed', 'expired', 'error');

-- CreateEnum
CREATE TYPE "SectionStateStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "AudioResponseStatus" AS ENUM ('uploaded', 'transcribed', 'failed');

-- CreateEnum
CREATE TYPE "GradingJobType" AS ENUM ('writing_grading', 'speaking_transcription', 'speaking_grading', 'report_generation');

-- CreateEnum
CREATE TYPE "GradingJobStatus" AS ENUM ('queued', 'processing', 'succeeded', 'failed', 'retrying');

-- CreateEnum
CREATE TYPE "AiSkill" AS ENUM ('writing', 'speaking');

-- CreateEnum
CREATE TYPE "AiResultStatus" AS ENUM ('succeeded', 'failed', 'manual_review_required');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'active',
    "plan_type" TEXT,
    "student_quota" INTEGER NOT NULL DEFAULT 0,
    "exam_quota" INTEGER NOT NULL DEFAULT 0,
    "ai_credit_quota" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacher_id" TEXT,
    "status" "ClassStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_members" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_papers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_versions" (
    "id" TEXT NOT NULL,
    "exam_paper_id" TEXT NOT NULL,
    "version_no" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "total_score" INTEGER NOT NULL DEFAULT 120,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_sections" (
    "id" TEXT NOT NULL,
    "exam_version_id" TEXT NOT NULL,
    "section_type" "SectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "order_no" INTEGER NOT NULL,
    "score_max" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "exam_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_modules" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "module_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_no" INTEGER NOT NULL,
    "time_limit_seconds" INTEGER,
    "allow_back" BOOLEAN NOT NULL DEFAULT false,
    "allow_review" BOOLEAN NOT NULL DEFAULT false,
    "allow_replay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "exam_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_items" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "order_no" INTEGER NOT NULL,
    "content_json" JSONB NOT NULL,
    "grading_type" "GradingType" NOT NULL,
    "time_limit_seconds" INTEGER,
    "score_max" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_assets" (
    "id" TEXT NOT NULL,
    "exam_item_id" TEXT,
    "asset_type" "AssetType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT,
    "mime_type" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "checksum" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_keys" (
    "id" TEXT NOT NULL,
    "exam_item_id" TEXT NOT NULL,
    "answer_json" JSONB NOT NULL,
    "scoring_rule_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "exam_version_id" TEXT NOT NULL,
    "class_id" TEXT,
    "assigned_by" TEXT,
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "exam_version_id" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'not_started',
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_saved_at" TIMESTAMP(3),
    "current_section_id" TEXT,
    "current_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_section_states" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "module_id" TEXT,
    "status" "SectionStateStatus" NOT NULL DEFAULT 'not_started',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "remaining_seconds" INTEGER,
    "current_item_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attempt_section_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "exam_item_id" TEXT NOT NULL,
    "response_json" JSONB NOT NULL,
    "is_correct" BOOLEAN,
    "score_awarded" DECIMAL(6,2),
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_responses" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "exam_item_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "transcript_text" TEXT,
    "transcript_model" TEXT,
    "status" "AudioResponseStatus" NOT NULL DEFAULT 'uploaded',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_jobs" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "job_type" "GradingJobType" NOT NULL,
    "status" "GradingJobStatus" NOT NULL DEFAULT 'queued',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grading_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_grade_results" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "exam_item_id" TEXT NOT NULL,
    "skill" "AiSkill" NOT NULL,
    "model_name" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "overall_score" DECIMAL(5,2) NOT NULL,
    "rubric_json" JSONB NOT NULL,
    "feedback_json" JSONB NOT NULL,
    "token_usage_json" JSONB,
    "cost_estimate" DECIMAL(10,6),
    "status" "AiResultStatus" NOT NULL DEFAULT 'succeeded',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_grade_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_reports" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "exam_version_id" TEXT NOT NULL,
    "total_score" DECIMAL(6,2),
    "reading_score" DECIMAL(5,2),
    "listening_score" DECIMAL(5,2),
    "writing_score" DECIMAL(5,2),
    "speaking_score" DECIMAL(5,2),
    "report_json" JSONB,
    "pdf_storage_key" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_versions" (
    "id" TEXT NOT NULL,
    "score_report_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "report_json" JSONB NOT NULL,
    "changed_by" TEXT,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_comments" (
    "id" TEXT NOT NULL,
    "score_report_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "comment_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'queued',
    "error_message" TEXT,
    "metadata_json" JSONB,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_role_idx" ON "users"("organization_id", "role");

-- CreateIndex
CREATE INDEX "classes_organization_id_idx" ON "classes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_members_class_id_user_id_key" ON "class_members"("class_id", "user_id");

-- CreateIndex
CREATE INDEX "exam_papers_organization_id_idx" ON "exam_papers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_versions_exam_paper_id_version_no_key" ON "exam_versions"("exam_paper_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sections_exam_version_id_section_type_key" ON "exam_sections"("exam_version_id", "section_type");

-- CreateIndex
CREATE INDEX "exam_modules_section_id_idx" ON "exam_modules"("section_id");

-- CreateIndex
CREATE INDEX "exam_items_module_id_idx" ON "exam_items"("module_id");

-- CreateIndex
CREATE INDEX "exam_assets_exam_item_id_idx" ON "exam_assets"("exam_item_id");

-- CreateIndex
CREATE INDEX "answer_keys_exam_item_id_idx" ON "answer_keys"("exam_item_id");

-- CreateIndex
CREATE INDEX "exam_assignments_organization_id_idx" ON "exam_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "exam_assignments_class_id_idx" ON "exam_assignments"("class_id");

-- CreateIndex
CREATE INDEX "attempts_organization_id_idx" ON "attempts"("organization_id");

-- CreateIndex
CREATE INDEX "attempts_assignment_id_student_id_idx" ON "attempts"("assignment_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_section_states_attempt_id_section_id_key" ON "attempt_section_states"("attempt_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "responses_attempt_id_exam_item_id_key" ON "responses"("attempt_id", "exam_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "audio_responses_attempt_id_exam_item_id_key" ON "audio_responses"("attempt_id", "exam_item_id");

-- CreateIndex
CREATE INDEX "grading_jobs_attempt_id_idx" ON "grading_jobs"("attempt_id");

-- CreateIndex
CREATE INDEX "ai_grade_results_attempt_id_idx" ON "ai_grade_results"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_reports_attempt_id_key" ON "score_reports"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_versions_score_report_id_version_no_key" ON "report_versions"("score_report_id", "version_no");

-- CreateIndex
CREATE INDEX "teacher_comments_score_report_id_idx" ON "teacher_comments"("score_report_id");

-- CreateIndex
CREATE INDEX "email_logs_organization_id_idx" ON "email_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_versions" ADD CONSTRAINT "exam_versions_exam_paper_id_fkey" FOREIGN KEY ("exam_paper_id") REFERENCES "exam_papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sections" ADD CONSTRAINT "exam_sections_exam_version_id_fkey" FOREIGN KEY ("exam_version_id") REFERENCES "exam_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_modules" ADD CONSTRAINT "exam_modules_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "exam_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "exam_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_assets" ADD CONSTRAINT "exam_assets_exam_item_id_fkey" FOREIGN KEY ("exam_item_id") REFERENCES "exam_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_keys" ADD CONSTRAINT "answer_keys_exam_item_id_fkey" FOREIGN KEY ("exam_item_id") REFERENCES "exam_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_exam_version_id_fkey" FOREIGN KEY ("exam_version_id") REFERENCES "exam_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "exam_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exam_version_id_fkey" FOREIGN KEY ("exam_version_id") REFERENCES "exam_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_section_states" ADD CONSTRAINT "attempt_section_states_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_section_states" ADD CONSTRAINT "attempt_section_states_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "exam_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_exam_item_id_fkey" FOREIGN KEY ("exam_item_id") REFERENCES "exam_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_responses" ADD CONSTRAINT "audio_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_responses" ADD CONSTRAINT "audio_responses_exam_item_id_fkey" FOREIGN KEY ("exam_item_id") REFERENCES "exam_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_jobs" ADD CONSTRAINT "grading_jobs_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_grade_results" ADD CONSTRAINT "ai_grade_results_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_grade_results" ADD CONSTRAINT "ai_grade_results_exam_item_id_fkey" FOREIGN KEY ("exam_item_id") REFERENCES "exam_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_reports" ADD CONSTRAINT "score_reports_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_reports" ADD CONSTRAINT "score_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_reports" ADD CONSTRAINT "score_reports_exam_version_id_fkey" FOREIGN KEY ("exam_version_id") REFERENCES "exam_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_score_report_id_fkey" FOREIGN KEY ("score_report_id") REFERENCES "score_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_comments" ADD CONSTRAINT "teacher_comments_score_report_id_fkey" FOREIGN KEY ("score_report_id") REFERENCES "score_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_comments" ADD CONSTRAINT "teacher_comments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
