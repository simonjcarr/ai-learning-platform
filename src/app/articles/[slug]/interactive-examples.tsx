"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, CheckCircle, XCircle, Lightbulb } from "lucide-react";

interface Option {
  id: string;
  text: string;
}

interface Example {
  exampleId: string;
  questionType: "MULTIPLE_CHOICE" | "TEXT_INPUT" | "COMMAND_LINE";
  scenarioOrQuestionText: string;
  optionsJson: any;
  correctAnswerDescription: string;
}

interface InteractiveExamplesProps {
  articleId: string;
}

export default function InteractiveExamples({ articleId }: InteractiveExamplesProps) {
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissions, setSubmissions] = useState<Record<string, {
    isCorrect: boolean;
    feedback: string;
    correctAnswerDescription: string;
  }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const fetchExamples = useCallback(async () => {
    try {
      const response = await fetch(`/api/articles/${articleId}/examples`);
      if (!response.ok) throw new Error("Failed to fetch examples");
      const data = await response.json();
      console.log("Fetched examples:", data);
      setExamples(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchExamples();
  }, [fetchExamples]);

  const generateExamples = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/articles/${articleId}/examples`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to generate examples");
      const data = await response.json();
      setExamples([...examples, ...data.examples]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setGenerating(false);
    }
  };

  const submitAnswer = async (exampleId: string) => {
    const userAnswer = answers[exampleId];
    if (!userAnswer || userAnswer.trim().length === 0) return;

    setSubmitting(exampleId);
    setError(null);

    try {
      const response = await fetch(`/api/examples/${exampleId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAnswer }),
      });

      if (!response.ok) throw new Error("Failed to submit answer");

      const data = await response.json();
      setSubmissions({
        ...submissions,
        [exampleId]: {
          isCorrect: data.isCorrect,
          feedback: data.feedback,
          correctAnswerDescription: data.correctAnswerDescription,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(null);
    }
  };

  const renderExample = (example: Example) => {
    const submitted = submissions[example.exampleId];
    const isSubmitting = submitting === example.exampleId;

    return (
      <div key={example.exampleId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {example.questionType === "MULTIPLE_CHOICE" && "Multiple Choice"}
              {example.questionType === "TEXT_INPUT" && "Text Answer"}
              {example.questionType === "COMMAND_LINE" && "Command Line"}
            </h3>
            {submitted && (
              <div className="flex items-center">
                {submitted.isCorrect ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
            )}
          </div>
          <p className="text-gray-700">{example.scenarioOrQuestionText}</p>
        </div>

        {example.questionType === "MULTIPLE_CHOICE" && example.optionsJson && (
          <div className="space-y-2 mb-4">
            {(() => {
              // Parse optionsJson if it's a string or ensure it's properly formatted
              let options: Option[] = [];
              try {
                if (typeof example.optionsJson === 'string') {
                  options = JSON.parse(example.optionsJson);
                } else if (Array.isArray(example.optionsJson)) {
                  options = example.optionsJson;
                } else {
                  console.error('Invalid optionsJson format:', example.optionsJson);
                  return null;
                }
              } catch (error) {
                console.error('Error parsing optionsJson:', error);
                return null;
              }

              return options.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={`question-${example.exampleId}`}
                    value={option.text}
                    onChange={(e) => setAnswers({ ...answers, [example.exampleId]: e.target.value })}
                    disabled={!!submitted}
                    checked={answers[example.exampleId] === option.text}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-gray-700">{option.text}</span>
                </label>
              ));
            })()}
          </div>
        )}

        {(example.questionType === "TEXT_INPUT" || example.questionType === "COMMAND_LINE") && (
          <div className="mb-4">
            <input
              type="text"
              value={answers[example.exampleId] || ""}
              onChange={(e) => setAnswers({ ...answers, [example.exampleId]: e.target.value })}
              disabled={!!submitted}
              placeholder={example.questionType === "COMMAND_LINE" ? "Enter command..." : "Enter your answer..."}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
        )}

        {!submitted && (
          <button
            onClick={() => submitAnswer(example.exampleId)}
            disabled={!answers[example.exampleId] || isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Checking...
              </>
            ) : (
              "Submit Answer"
            )}
          </button>
        )}

        {submitted && (
          <div className="mt-4 space-y-3">
            <div className={`p-4 rounded-lg ${submitted.isCorrect ? "bg-green-50" : "bg-red-50"}`}>
              <p className={`text-sm ${submitted.isCorrect ? "text-green-800" : "text-red-800"}`}>
                {submitted.feedback}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start">
                <Lightbulb className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">Explanation:</p>
                  <p className="text-sm text-blue-800">{submitted.correctAnswerDescription}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <section className="border-t pt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Test Your Knowledge</h2>
        <button
          onClick={generateExamples}
          disabled={generating}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 mr-2" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate More Examples
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {examples.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No examples yet. Generate some to test your knowledge!</p>
          <button
            onClick={generateExamples}
            disabled={generating}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Generate Examples
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {examples.map(renderExample)}
        </div>
      )}
    </section>
  );
}