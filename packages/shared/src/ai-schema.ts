import { z } from 'zod';

export const aiGradeResultSchema = z.object({
  skill: z.enum(['writing', 'speaking']),
  task_type: z.string().min(1),
  overall_score: z.number().min(0).max(30),
  score_scale: z.literal('0-30'),
  rubric_scores: z.record(z.string(), z.number().min(0).max(5)),
  comments: z
    .object({
      overall: z.string(),
    })
    .catchall(z.string()),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvement_suggestions: z.array(z.string()),
  confidence_flag: z.enum(['normal', 'low_confidence']),
});

export type AiGradeResult = z.infer<typeof aiGradeResultSchema>;

export const WRITING_RUBRICS: Record<string, Record<string, string>> = {
  writing_email: {
    task_fulfillment: 'Task Fulfillment (25%): whether the response completes the task requirements',
    content_development: 'Content Development (20%): completeness and specificity of content',
    organization: 'Organization (20%): clarity of structure',
    grammar_accuracy: 'Grammar Accuracy (20%): grammatical correctness',
    vocabulary_range: 'Vocabulary Range (15%): variety and appropriateness of vocabulary',
  },
  writing_academic_discussion: {
    relevance: 'Relevance (25%): whether the response addresses the discussion topic',
    idea_development: 'Idea Development (25%): clear position with supporting reasons',
    organization: 'Organization (15%): logical flow of argument',
    grammar_accuracy: 'Grammar Accuracy (20%): grammar and sentence structures',
    vocabulary_range: 'Vocabulary Range (15%): variety of vocabulary',
  },
};

export const SPEAKING_RUBRICS: Record<string, Record<string, string>> = {
  speaking_listen_repeat: {
    content_accuracy: 'Content Accuracy (40%): whether key content was repeated',
    fluency: 'Fluency (20%): smoothness of delivery',
    pronunciation: 'Pronunciation (20%): clarity of pronunciation',
    grammar_structure: 'Grammar / Structure (10%): completeness of sentence structure',
    completeness: 'Completeness (10%): whether the answer is complete',
  },
  speaking_interview: {
    task_fulfillment: 'Task Fulfillment (25%): whether the question is answered',
    content_development: 'Content Development (25%): specificity of content',
    fluency: 'Fluency (20%): smoothness of delivery',
    grammar_accuracy: 'Grammar Accuracy (15%): grammar',
    vocabulary_range: 'Vocabulary Range (15%): vocabulary',
  },
};

export const PROMPT_VERSION = 'v1.0';
