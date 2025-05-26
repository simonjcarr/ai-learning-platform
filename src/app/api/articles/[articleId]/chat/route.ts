import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/openai';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { userId } = await auth();
  const { articleId } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        articleId,
        clerkUserId: userId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat messages' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { userId } = await auth();
  const { articleId } = await params;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content, exampleId } = await req.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Fetch the article with related data
    const article = await prisma.article.findUnique({
      where: { articleId },
      include: {
        category: true,
        stream: {
          include: {
            channel: true
          }
        },
        interactiveExamples: true,
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Create the user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        articleId,
        clerkUserId: userId,
        role: 'USER',
        content,
        exampleId,
      },
    });

    // Get previous chat history for context (last 10 messages)
    const previousMessages = await prisma.chatMessage.findMany({
      where: {
        articleId,
        clerkUserId: userId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10,
    });

    // Build context for AI
    let context = `Article Title: ${article.articleTitle}\n\n`;
    
    if (article.contentHtml) {
      // Strip HTML tags for AI context
      const textContent = article.contentHtml.replace(/<[^>]*>/g, '');
      context += `Article Content:\n${textContent.substring(0, 3000)}...\n\n`;
    }

    // If asking about a specific quiz question
    if (exampleId) {
      const example = article.interactiveExamples.find(e => e.exampleId === exampleId);
      if (example) {
        context += `\nUser is asking about this quiz question:\n`;
        context += `Question: ${example.scenarioOrQuestionText}\n`;
        
        if (example.optionsJson) {
          const options = example.optionsJson as any[];
          context += `Options:\n`;
          options.forEach((opt: any) => {
            context += `- ${opt.text}\n`;
          });
        }
        
        context += `\nCorrect Answer Explanation: ${example.correctAnswerDescription}\n`;
        if (example.aiMarkingPromptHint) {
          context += `Additional Context: ${example.aiMarkingPromptHint}\n`;
        }
      }
    }

    // Build messages for OpenAI
    const messages: any[] = [
      {
        role: 'system',
        content: `You are an AI tutor helping a student understand an IT/Linux learning article. 
Your role is to:
1. Answer questions about the article content clearly and concisely
2. Help explain quiz questions and guide students to understand the correct answers
3. Provide additional context and examples when helpful
4. Never directly give away quiz answers - instead guide the student to understand the concept
5. Be encouraging and supportive

Context about the article:
${context}`,
      },
    ];

    // Add previous conversation history (excluding the just-created user message)
    previousMessages.slice(0, -1).forEach(msg => {
      messages.push({
        role: msg.role.toLowerCase(),
        content: msg.content,
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content,
    });

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponseContent = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    // Create the assistant message
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        articleId,
        clerkUserId: userId,
        role: 'ASSISTANT',
        content: aiResponseContent,
        exampleId,
      },
    });

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error('Error creating chat message:', error);
    return NextResponse.json(
      { error: 'Failed to create chat message' },
      { status: 500 }
    );
  }
}