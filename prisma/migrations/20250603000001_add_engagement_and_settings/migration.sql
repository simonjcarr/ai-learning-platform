-- CreateEnum
CREATE TYPE "CertificateGrade" AS ENUM ('BRONZE', 'SILVER', 'GOLD');

-- Add engagement tracking fields to CourseProgress
ALTER TABLE "course_progress" ADD COLUMN "engagement_score" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "course_progress" ADD COLUMN "scroll_percentage" INTEGER DEFAULT 0;
ALTER TABLE "course_progress" ADD COLUMN "interaction_count" INTEGER DEFAULT 0;
ALTER TABLE "course_progress" ADD COLUMN "time_spent" INTEGER DEFAULT 0;
ALTER TABLE "course_progress" ADD COLUMN "is_completed" BOOLEAN DEFAULT false;
ALTER TABLE "course_progress" ADD COLUMN "last_engagement_update" TIMESTAMP(3);

-- Update CourseQuiz to support final exams
ALTER TABLE "course_quizzes" ADD COLUMN "course_id" TEXT;
ALTER TABLE "course_quizzes" ADD COLUMN "cooldown_hours" INTEGER;

-- Add foreign key for course final exams
ALTER TABLE "course_quizzes" ADD CONSTRAINT "course_quizzes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for course final exams
CREATE INDEX "course_quizzes_course_id_idx" ON "course_quizzes"("course_id");

-- Create CourseCompletionSettings table
CREATE TABLE "course_completion_settings" (
    "settingsId" TEXT NOT NULL,
    "bronze_threshold" DOUBLE PRECISION NOT NULL DEFAULT 65.0,
    "silver_threshold" DOUBLE PRECISION NOT NULL DEFAULT 75.0,
    "gold_threshold" DOUBLE PRECISION NOT NULL DEFAULT 90.0,
    "min_engagement_score" DOUBLE PRECISION NOT NULL DEFAULT 75.0,
    "min_quiz_average" DOUBLE PRECISION NOT NULL DEFAULT 70.0,
    "min_articles_completed_percent" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    "final_exam_required" BOOLEAN NOT NULL DEFAULT true,
    "final_exam_cooldown_hours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_completion_settings_pkey" PRIMARY KEY ("settingsId")
);

-- Create QuizGenerationSettings table
CREATE TABLE "quiz_generation_settings" (
    "settingsId" TEXT NOT NULL,
    "article_quiz_min_questions" INTEGER NOT NULL DEFAULT 3,
    "article_quiz_max_questions" INTEGER NOT NULL DEFAULT 5,
    "section_quiz_min_questions" INTEGER NOT NULL DEFAULT 5,
    "section_quiz_max_questions" INTEGER NOT NULL DEFAULT 8,
    "final_exam_min_questions" INTEGER NOT NULL DEFAULT 15,
    "final_exam_max_questions" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_generation_settings_pkey" PRIMARY KEY ("settingsId")
);

-- Update CourseCertificate to include grade
ALTER TABLE "course_certificates" ADD COLUMN "grade" "CertificateGrade";
ALTER TABLE "course_certificates" ADD COLUMN "final_score" DOUBLE PRECISION;
ALTER TABLE "course_certificates" ADD COLUMN "engagement_score" DOUBLE PRECISION;

-- Create FinalExamAttempt table for tracking cooldowns
CREATE TABLE "final_exam_attempts" (
    "attemptId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "canRetakeAt" TIMESTAMP(3),

    CONSTRAINT "final_exam_attempts_pkey" PRIMARY KEY ("attemptId")
);

-- Add foreign keys for FinalExamAttempt
ALTER TABLE "final_exam_attempts" ADD CONSTRAINT "final_exam_attempts_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("courseId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "final_exam_attempts" ADD CONSTRAINT "final_exam_attempts_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for FinalExamAttempt
CREATE INDEX "final_exam_attempts_courseId_idx" ON "final_exam_attempts"("courseId");
CREATE INDEX "final_exam_attempts_clerkUserId_idx" ON "final_exam_attempts"("clerkUserId");
CREATE INDEX "final_exam_attempts_attemptedAt_idx" ON "final_exam_attempts"("attemptedAt");

-- Insert default settings
INSERT INTO "course_completion_settings" ("settingsId") VALUES ('default');
INSERT INTO "quiz_generation_settings" ("settingsId") VALUES ('default');