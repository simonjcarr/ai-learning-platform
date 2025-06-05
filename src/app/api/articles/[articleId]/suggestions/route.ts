import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Helper function to clean AI responses and remove JSON/technical details
function cleanAIResponse(response: string): string {
  if (!response) return response;
  
  // Remove JSON objects (anything between { and }) - handle nested braces
  let cleaned = response;
  let braceCount = 0;
  let inJson = false;
  let result = '';
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '{') {
      if (braceCount === 0) inJson = true;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) inJson = false;
    } else if (!inJson) {
      result += char;
    }
  }
  
  cleaned = result;
  
  // Remove any remaining JSON-like patterns
  cleaned = cleaned.replace(/\{.*?\}/gs, '');
  cleaned = cleaned.replace(/\[.*?\]/gs, '');
  
  // Remove RELEVANT: YES/NO from the display
  cleaned = cleaned.replace(/RELEVANT:\s*(YES|NO)/gi, '');
  
  // Remove technical markers and quotes
  cleaned = cleaned.replace(/```json.*?```/gs, '');
  cleaned = cleaned.replace(/```.*?```/gs, '');
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  
  // Remove any lines that start with technical markers
  cleaned = cleaned.replace(/^\s*["{[].*$/gm, '');
  cleaned = cleaned.replace(/^\s*".*":\s*.*$/gm, '');
  
  // Clean up extra whitespace and newlines
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove any remaining quotes around the entire response
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  return cleaned.trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all suggestions for this article with user info
    const suggestions = await prisma.articleSuggestion.findMany({
      where: {
        articleId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        suggestedAt: "desc",
      },
    });

    // Transform the data to include status information
    const transformedSuggestions = suggestions.map((suggestion) => ({
      id: suggestion.suggestionId,
      articleId: suggestion.articleId,
      userId: suggestion.clerkUserId,
      userName: suggestion.user.firstName 
        ? `${suggestion.user.firstName}${suggestion.user.lastName ? ' ' + suggestion.user.lastName : ''}`
        : suggestion.user.username || suggestion.user.email,
      type: suggestion.suggestionType,
      details: suggestion.suggestionDetails,
      status: getStatus(suggestion),
      statusMessage: getStatusMessage(suggestion),
      createdAt: suggestion.suggestedAt,
      processedAt: suggestion.processedAt,
      appliedAt: suggestion.appliedAt,
      rejectionReason: suggestion.rejectionReason ? cleanAIResponse(suggestion.rejectionReason) : suggestion.rejectionReason,
      aiResponse: suggestion.aiValidationResponse ? cleanAIResponse(suggestion.aiValidationResponse) : suggestion.aiValidationResponse,
    }));

    // Sort by creation date ascending (oldest first, newest last)
    transformedSuggestions.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return NextResponse.json({ suggestions: transformedSuggestions });
  } catch (error) {
    console.error("Failed to fetch suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}

function getStatus(suggestion: any): "pending" | "processing" | "approved" | "rejected" | "applied" {
  if (suggestion.isApplied) return "applied";
  if (suggestion.isApproved && !suggestion.isApplied) return "approved";
  if (suggestion.rejectionReason) return "rejected";
  if (suggestion.processedAt) return "rejected"; // Processed but not approved
  return "pending";
}

function getStatusMessage(suggestion: any): string {
  if (suggestion.isApplied) {
    return "This suggestion has been applied to the article.";
  }
  if (suggestion.isApproved && !suggestion.isApplied) {
    return "This suggestion has been approved and will be applied soon.";
  }
  if (suggestion.rejectionReason) {
    return "This suggestion was not accepted.";
  }
  if (suggestion.processedAt && !suggestion.isApproved) {
    return "This suggestion was not accepted.";
  }
  return "This suggestion is being reviewed...";
}