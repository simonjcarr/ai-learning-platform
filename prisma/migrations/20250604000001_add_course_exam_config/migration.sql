-- CreateTable
CREATE TABLE "course_exam_configs" (
    "configId" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "courseId" TEXT NOT NULL,
    "questionBankSize" INTEGER NOT NULL DEFAULT 125,
    "essayQuestionsInBank" INTEGER NOT NULL DEFAULT 10,
    "examQuestionCount" INTEGER NOT NULL DEFAULT 25,
    "minEssayQuestions" INTEGER NOT NULL DEFAULT 1,
    "maxEssayQuestions" INTEGER NOT NULL DEFAULT 2,
    "examTimeLimit" INTEGER DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_exam_configs_pkey" PRIMARY KEY ("configId")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_exam_configs_courseId_key" ON "course_exam_configs"("courseId");

-- CreateIndex
CREATE INDEX "course_exam_configs_courseId_idx" ON "course_exam_configs"("courseId");

-- AddForeignKey
ALTER TABLE "course_exam_configs" ADD CONSTRAINT "course_exam_configs_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update the default question bank size in quiz generation settings
UPDATE "quiz_generation_settings" 
SET "finalExamMinQuestions" = 125, 
    "finalExamMaxQuestions" = 125 
WHERE "settingsId" = 'default';