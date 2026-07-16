import { z } from 'zod';

export const confidenceFlagSchema = z.enum(['normal', 'low_confidence']);

export const rubricScoreSchema = z.object({
  criterion: z.string().min(1),
  score: z.number().min(0).max(5),
  comment: z.string().min(1),
});

export const constructedGradeItemSchema = z.object({
  item_id: z.string().min(1),
  task_type: z.string().min(1),
  item_score: z.number().min(0).max(5),
  rubric_scores: z.array(rubricScoreSchema).min(1),
  overall_comment: z.string().min(1),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvement_suggestions: z.array(z.string()),
  confidence_flag: confidenceFlagSchema,
  evidence_flags: z.array(z.string()),
});

export const constructedGradeBatchSchema = z.object({
  items: z.array(constructedGradeItemSchema).min(1),
});

export type ConstructedGradeItem = z.infer<typeof constructedGradeItemSchema>;
export type ConstructedGradeBatch = z.infer<typeof constructedGradeBatchSchema>;

export const objectiveFeedbackSchema = z.object({
  overall_comment: z.string().min(1),
  categories: z.array(
    z.object({
      category_key: z.string().min(1),
      incorrect_item_labels: z.array(z.string()),
      comment: z.string().min(1),
    }),
  ),
  item_feedback: z.array(
    z.object({
      item_label: z.string().min(1),
      explanation: z.string().min(1),
      focus: z.string().min(1),
    }),
  ),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvement_suggestions: z.array(z.string()).min(1).max(5),
  confidence_flag: confidenceFlagSchema,
  evidence_flags: z.array(z.string()),
});

export type ObjectiveFeedback = z.infer<typeof objectiveFeedbackSchema>;

export const translatedFeedbackBatchSchema = z.object({
  items: z.array(
    z.object({
      result_key: z.string().min(1),
      overall_comment: z.string().min(1),
      rubric_comments: z.array(
        z.object({
          criterion: z.string().min(1),
          comment: z.string().min(1),
        }),
      ),
      categories: z.array(
        z.object({
          category_key: z.string().min(1),
          comment: z.string().min(1),
        }),
      ),
      item_feedback: z.array(
        z.object({
          item_label: z.string().min(1),
          explanation: z.string().min(1),
          focus: z.string().min(1),
        }),
      ),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      improvement_suggestions: z.array(z.string()),
    }),
  ),
});

export type TranslatedFeedbackBatch = z.infer<typeof translatedFeedbackBatchSchema>;

export interface ObjectiveItemResult {
  item_id: string;
  item_label: string;
  section_type: 'reading' | 'listening' | 'writing';
  module_no: number;
  module_title: string;
  question_no: number;
  task_type: string;
  category_key: string;
  skill_tags: string[];
  student_answer: string | string[] | null;
  correct_answer: string | string[];
  is_correct: boolean;
  question_text: string | null;
  options: string[];
  context_title: string | null;
  context_text: string | null;
  system_rationale: string | null;
}

export const WRITING_RUBRICS: Record<string, Record<string, string>> = {
  writing_email: {
    task_fulfillment: '任務完成度：是否涵蓋所有指定要點並符合 Email 情境',
    content_development: '內容發展：資訊是否具體且充分',
    organization: '組織結構：信件結構、連貫性與語氣是否合宜',
    grammar_accuracy: '文法準確度：句型與文法控制',
    vocabulary_range: '詞彙運用：用字範圍、準確度及自然度',
  },
  writing_academic_discussion: {
    relevance: '切題度：是否直接回應教授問題並對討論有所貢獻',
    idea_development: '觀點發展：立場、理由與例證是否清楚',
    organization: '組織結構：論述是否有邏輯且連貫',
    grammar_accuracy: '文法準確度：文法與句型控制',
    vocabulary_range: '詞彙運用：詞彙範圍與恰當性',
  },
};

export const SPEAKING_RUBRICS: Record<string, Record<string, string>> = {
  speaking_listen_repeat: {
    content_accuracy: '內容準確度：與參考句的詞語及意思一致程度',
    completeness: '完整度：遺漏、插入或未完成內容',
    pronunciation_intelligibility: '發音與可理解度：只依音訊分析證據判斷',
    fluency: '流暢度：停頓、節奏與連續性，只依音訊分析證據判斷',
  },
  speaking_interview: {
    relevance: '切題度：是否直接回答訪談問題',
    elaboration: '內容發展：理由、細節與例子是否充分',
    fluency: '流暢度：停頓、節奏與表達連續性',
    pronunciation_intelligibility: '發音與可理解度：是否容易理解',
    grammar_accuracy: '文法準確度：句型與文法控制',
    vocabulary_range: '詞彙運用：詞彙範圍與恰當性',
  },
};

export const PROMPT_VERSION = 'v2.0';
