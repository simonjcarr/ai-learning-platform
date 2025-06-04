import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { callAI } from "@/lib/ai-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;
    const { answers } = await request.json();

    // Fetch the exam session with questions
    const session = await prisma.finalExamSession.findUnique({
      where: { sessionId },
      include: {
        questions: {
          include: {
            bankQuestion: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
        course: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
    }

    // Verify the session belongs to the current user
    if (session.clerkUserId !== user.clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if session is already completed
    if (session.completedAt) {
      return NextResponse.json({ error: "Exam session already completed" }, { status: 400 });
    }

    // Calculate score and create answer records
    let totalPoints = 0;
    let earnedPoints = 0;
    let pendingEssayPoints = 0;
    const feedback: Record<string, { isCorrect: boolean | null; explanation: string | null; requiresGrading?: boolean }> = {};
    const essayAnswers: Array<{ questionId: string; userAnswer: string; question: string; correctAnswer: string }> = [];

    for (const sessionQuestion of session.questions) {
      const question = sessionQuestion.bankQuestion;
      totalPoints += question.points;
      const userAnswer = answers[sessionQuestion.id];
      
      let isCorrect: boolean | null = null;
      let pointsEarned = 0;

      if (userAnswer) {
        switch (question.questionType) {
          case "MULTIPLE_CHOICE":
            isCorrect = userAnswer === question.correctAnswer;
            break;
          case "TRUE_FALSE":
            isCorrect = userAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
            break;
          case "FILL_IN_BLANK":
            // Case-insensitive comparison with trimming
            isCorrect = userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
            break;
          case "ESSAY":
            // Essays need AI grading - mark as pending
            isCorrect = null;
            pendingEssayPoints += question.points;
            essayAnswers.push({
              questionId: sessionQuestion.id,
              userAnswer,
              question: question.questionText,
              correctAnswer: question.correctAnswer,
              maxPoints: question.points, // Store the max points for this essay question
            });
            break;
          default:
            isCorrect = false;
        }
      }

      if (isCorrect === true) {
        earnedPoints += question.points;
        pointsEarned = question.points;
      } else if (isCorrect === false) {
        pointsEarned = 0;
      }
      // For essays (isCorrect === null), pointsEarned stays 0 until AI grading

      // Create answer record
      await prisma.finalExamAnswer.create({
        data: {
          sessionId: session.sessionId,
          questionId: sessionQuestion.id,
          userAnswer: userAnswer || "",
          isCorrect,
          pointsEarned: isCorrect !== null ? pointsEarned : null, // null for essays pending grading
        },
      });

      feedback[sessionQuestion.id] = {
        isCorrect,
        explanation: question.explanation,
        requiresGrading: question.questionType === 'ESSAY',
      };
    }

    // Process essay questions with AI grading
    if (essayAnswers.length > 0) {
      console.log(`🤖 Processing ${essayAnswers.length} essay questions with AI grading...`);
      
      // Get point settings for essay grading threshold
      const pointSettings = await prisma.questionPointSettings.findFirst({
        where: { settingsId: 'default' },
      });
      
      const essayPassingThreshold = pointSettings?.essayPassingThreshold || 0.6;
      
      for (const essayAnswer of essayAnswers) {
        try {
          const gradingPrompt = `Grade this essay answer based on the provided criteria.

Question: ${essayAnswer.question}

Expected Answer/Key Points: ${essayAnswer.correctAnswer}

Student Answer: ${essayAnswer.userAnswer}

This question is worth ${essayAnswer.maxPoints} points maximum. Please evaluate the student's answer based on:
1. Accuracy of information
2. Completeness of response
3. Understanding of concepts
4. Use of examples or practical applications
5. Overall quality of explanation

Return a JSON object with this structure:
{
  "score": 0.85,
  "feedback": "Detailed feedback explaining the grade and what the student did well or could improve...",
  "keyPointsCovered": ["specific point 1", "specific point 2"],
  "areasForImprovement": ["area for improvement 1", "area for improvement 2"],
  "pointsAwarded": 4.25
}

Score should be between 0.0 (completely incorrect) and 1.0 (perfect answer).
PointsAwarded should be the actual points to give based on the quality of the answer (between 0 and ${essayAnswer.maxPoints}).`;

          const gradingResponse = await callAI('essay_grading', gradingPrompt, {
            courseId: session.courseId,
            sessionId: session.sessionId,
            questionId: essayAnswer.questionId,
            maxPoints: essayAnswer.maxPoints,
          });

          const gradingResult = JSON.parse(gradingResponse);
          const essayScore = Math.max(0, Math.min(1, gradingResult.score)); // Clamp between 0 and 1
          
          // Calculate points earned - use AI's pointsAwarded if provided, otherwise calculate from score
          let essayPoints;
          if (gradingResult.pointsAwarded && gradingResult.pointsAwarded >= 0 && gradingResult.pointsAwarded <= essayAnswer.maxPoints) {
            essayPoints = gradingResult.pointsAwarded;
          } else {
            essayPoints = essayScore * essayAnswer.maxPoints;
          }
          
          // Ensure points don't exceed maximum
          essayPoints = Math.min(essayPoints, essayAnswer.maxPoints);

          // Update the answer with AI grading results
          await prisma.finalExamAnswer.update({
            where: {
              sessionId_questionId: {
                sessionId: session.sessionId,
                questionId: essayAnswer.questionId,
              },
            },
            data: {
              isCorrect: essayScore >= essayPassingThreshold, // Use configurable threshold
              pointsEarned: essayPoints,
              aiGrading: gradingResult,
              gradedAt: new Date(),
            },
          });

          earnedPoints += essayPoints;
          pendingEssayPoints -= essayAnswer.maxPoints; // Reduce pending points by actual max points

          // Update feedback
          feedback[essayAnswer.questionId] = {
            isCorrect: essayScore >= essayPassingThreshold,
            explanation: gradingResult.feedback,
            requiresGrading: false,
          };

          console.log(`✅ Essay graded: ${(essayScore * 100).toFixed(1)}% (${essayPoints}/${essayAnswer.maxPoints} points)`);
        } catch (error) {
          console.error(`❌ Failed to grade essay for question ${essayAnswer.questionId}:`, error);
          // If AI grading fails, give partial credit (50% of max points)
          const partialPoints = essayAnswer.maxPoints * 0.5;
          await prisma.finalExamAnswer.update({
            where: {
              sessionId_questionId: {
                sessionId: session.sessionId,
                questionId: essayAnswer.questionId,
              },
            },
            data: {
              isCorrect: true, // Give benefit of doubt for failed grading
              pointsEarned: partialPoints,
              aiGrading: { 
                error: 'AI grading failed, partial credit given', 
                score: 0.5,
                pointsAwarded: partialPoints 
              },
              gradedAt: new Date(),
            },
          });
          earnedPoints += partialPoints;
          pendingEssayPoints -= essayAnswer.maxPoints;
        }
      }
    }

    // Calculate percentage score
    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    
    // Get completion settings for pass mark
    const completionSettings = await prisma.courseCompletionSettings.findFirst({
      where: { settingsId: 'default' },
    });
    const passMarkPercentage = completionSettings?.minQuizAverage || 65.0;
    const passed = score >= passMarkPercentage;

    // Calculate cooldown time for next attempt if failed
    let canRetakeAt = null;
    if (!passed) {
      const cooldownHours = completionSettings?.finalExamCooldownHours || 24;
      canRetakeAt = new Date();
      canRetakeAt.setHours(canRetakeAt.getHours() + cooldownHours);
    }

    // Update session with results
    await prisma.finalExamSession.update({
      where: { sessionId: session.sessionId },
      data: {
        completedAt: new Date(),
        score,
        passed,
        canRetakeAt,
      },
    });

    // Also create record in FinalExamAttempt for backward compatibility
    await prisma.finalExamAttempt.create({
      data: {
        courseId: session.courseId,
        clerkUserId: user.clerkUserId,
        score,
        passed,
        canRetakeAt,
      },
    });

    // If passed, generate certificate
    if (passed) {
      try {
        const { generateCertificate } = await import("@/lib/certificate-generator");
        await generateCertificate({
          courseId: session.courseId,
          clerkUserId: user.clerkUserId,
          finalExamScore: score,
        });
        console.log(`🏆 Certificate generated for student ${user.clerkUserId} in course ${session.courseId}`);
      } catch (certError) {
        console.error("Failed to generate certificate:", certError);
        // Don't fail the exam submission if certificate generation fails
      }
    }

    console.log(`✅ Final exam completed: ${score.toFixed(1)}% (${passed ? 'PASSED' : 'FAILED'})`);

    return NextResponse.json({
      score,
      passed,
      feedback,
      passMarkPercentage,
      totalQuestions: session.questions.length,
      essayQuestions: essayAnswers.length,
    });
  } catch (error) {
    console.error("Failed to submit final exam:", error);
    return NextResponse.json(
      { error: "Failed to submit exam" },
      { status: 500 }
    );
  }
}