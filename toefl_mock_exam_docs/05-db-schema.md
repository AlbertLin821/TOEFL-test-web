# 05. 資料庫設計與資料模型規格（DB Schema & Data Model）

> 文件版本：v1.0  
> 資料庫：PostgreSQL  
> ORM：Prisma  
> 架構：Multi-tenant SaaS + 固定整卷考卷

---

## 1. 設計原則

資料模型需滿足：

1. 多機構資料隔離
2. 固定整卷式考卷
3. 考卷版本可追溯
4. 學生作答可恢復
5. Reading / Listening 可自動批改
6. Speaking / Writing 可保存 AI 批改結果
7. 報告可版本化
8. 所有重要操作可 audit

---

## 2. ERD

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : has
    ORGANIZATION ||--o{ CLASS : has
    USER ||--o{ CLASS_MEMBER : joins
    CLASS ||--o{ CLASS_MEMBER : contains

    ORGANIZATION ||--o{ EXAM_PAPER : owns
    EXAM_PAPER ||--o{ EXAM_VERSION : has
    EXAM_VERSION ||--o{ EXAM_SECTION : contains
    EXAM_SECTION ||--o{ EXAM_MODULE : contains
    EXAM_MODULE ||--o{ EXAM_ITEM : contains
    EXAM_ITEM ||--o{ ANSWER_KEY : has
    EXAM_ITEM ||--o{ EXAM_ASSET : uses

    CLASS ||--o{ EXAM_ASSIGNMENT : assigned
    EXAM_VERSION ||--o{ EXAM_ASSIGNMENT : assigned

    EXAM_ASSIGNMENT ||--o{ ATTEMPT : has
    USER ||--o{ ATTEMPT : takes
    ATTEMPT ||--o{ RESPONSE : has
    ATTEMPT ||--o{ AUDIO_RESPONSE : has
    ATTEMPT ||--o{ AI_GRADE_RESULT : has
    ATTEMPT ||--o{ SCORE_REPORT : has
    SCORE_REPORT ||--o{ REPORT_VERSION : has
```

---

## 3. 核心資料表

## 3.1 organizations

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| name | varchar | 機構名稱 |
| slug | varchar | 機構識別 |
| status | enum | active / suspended |
| plan_type | varchar | 方案 |
| student_quota | int | 學生席位 |
| exam_quota | int | 考試次數 |
| ai_credit_quota | int | AI 額度 |
| created_at | timestamp | 建立時間 |
| updated_at | timestamp | 更新時間 |

---

## 3.2 users

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| organization_id | uuid | 所屬機構 |
| email | varchar | 登入 Email |
| password_hash | varchar | 密碼雜湊 |
| name | varchar | 姓名 |
| role | enum | platform_admin / org_admin / teacher / student |
| status | enum | active / inactive |
| email_verified_at | timestamp | Email 驗證時間 |
| last_login_at | timestamp | 最後登入時間 |
| created_at | timestamp | 建立時間 |

### Index

- unique(email)
- index(organization_id, role)

---

## 3.3 classes

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| organization_id | uuid | 所屬機構 |
| name | varchar | 班級名稱 |
| teacher_id | uuid | 主要老師 |
| status | enum | active / archived |
| created_at | timestamp | 建立時間 |

---

## 3.4 class_members

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| class_id | uuid | 班級 |
| user_id | uuid | 學生 |
| joined_at | timestamp | 加入時間 |

### Constraint

- unique(class_id, user_id)

---

## 4. 考卷資料模型

## 4.1 exam_papers

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| organization_id | uuid nullable | null 代表平台共用考卷 |
| title | varchar | 考卷名稱 |
| description | text | 描述 |
| status | enum | draft / published / archived |
| created_by | uuid | 建立者 |
| created_at | timestamp | 建立時間 |

---

## 4.2 exam_versions

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| exam_paper_id | uuid | 所屬考卷 |
| version_no | varchar | 例如 v1.0 |
| status | enum | draft / published / archived |
| total_score | int | 總分 |
| published_at | timestamp | 發布時間 |
| created_at | timestamp | 建立時間 |

### Constraint

- unique(exam_paper_id, version_no)

---

## 4.3 exam_sections

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| exam_version_id | uuid | 考卷版本 |
| section_type | enum | reading / listening / writing / speaking |
| title | varchar | Section 名稱 |
| order_no | int | 順序 |
| score_max | int | 滿分 |

### Constraint

- unique(exam_version_id, section_type)

---

## 4.4 exam_modules

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| section_id | uuid | 所屬 section |
| module_type | varchar | reading_module / listening_module / writing_email 等 |
| title | varchar | 模組名稱 |
| order_no | int | 順序 |
| time_limit_seconds | int nullable | 作答時間 |
| allow_back | boolean | 是否可返回 |
| allow_review | boolean | 是否可 review |
| allow_replay | boolean | 音檔是否可重播 |

---

## 4.5 exam_items

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| module_id | uuid | 所屬 module |
| item_type | varchar | 題型 |
| order_no | int | 順序 |
| content_json | jsonb | 題目內容 |
| grading_type | enum | auto / ai / manual |
| time_limit_seconds | int nullable | 單題時間 |
| score_max | decimal | 滿分 |
| created_at | timestamp | 建立時間 |

### item_type 範例

- reading_single_choice
- reading_fill_blank
- listening_single_choice
- writing_sentence_order
- writing_email
- writing_academic_discussion
- speaking_listen_repeat
- speaking_interview

---

## 4.6 exam_assets

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| exam_item_id | uuid nullable | 對應題目 |
| asset_type | enum | audio / image / pdf / video |
| storage_key | varchar | 物件儲存 key |
| public_url | text nullable | 公開或簽名 URL |
| mime_type | varchar | MIME type |
| duration_seconds | int nullable | 音檔長度 |
| checksum | varchar | 檔案校驗 |
| created_at | timestamp | 建立時間 |

---

## 4.7 answer_keys

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| exam_item_id | uuid | 題目 |
| answer_json | jsonb | 正確答案 |
| scoring_rule_json | jsonb | 計分規則 |
| created_at | timestamp | 建立時間 |

---

## 5. 考試指派與作答

## 5.1 exam_assignments

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| organization_id | uuid | 機構 |
| exam_version_id | uuid | 指派考卷版本 |
| class_id | uuid nullable | 指派班級 |
| assigned_by | uuid | 指派老師 |
| opens_at | timestamp | 開放時間 |
| closes_at | timestamp | 截止時間 |
| max_attempts | int | 最大作答次數 |
| status | enum | scheduled / active / closed |
| created_at | timestamp | 建立時間 |

---

## 5.2 attempts

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| organization_id | uuid | 機構 |
| assignment_id | uuid | 考試指派 |
| student_id | uuid | 學生 |
| exam_version_id | uuid | 考卷版本 |
| status | enum | not_started / hardware_check / in_progress / submitted / grading / completed / expired / error |
| started_at | timestamp | 開始時間 |
| submitted_at | timestamp | 交卷時間 |
| completed_at | timestamp | 批改完成時間 |
| last_saved_at | timestamp | 最後儲存時間 |
| current_section_id | uuid nullable | 目前 section |
| current_item_id | uuid nullable | 目前題目 |

---

## 5.3 attempt_section_states

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| attempt_id | uuid | 作答 |
| section_id | uuid | section |
| module_id | uuid nullable | 目前 module |
| status | enum | not_started / in_progress / completed |
| started_at | timestamp | 開始時間 |
| completed_at | timestamp | 完成時間 |
| remaining_seconds | int | 剩餘秒數 |

---

## 5.4 responses

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| attempt_id | uuid | 作答 |
| exam_item_id | uuid | 題目 |
| response_json | jsonb | 作答內容 |
| is_correct | boolean nullable | 是否正確 |
| score_awarded | decimal nullable | 得分 |
| saved_at | timestamp | 儲存時間 |

### Constraint

- unique(attempt_id, exam_item_id)

---

## 5.5 audio_responses

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| attempt_id | uuid | 作答 |
| exam_item_id | uuid | 題目 |
| storage_key | varchar | 錄音檔 key |
| mime_type | varchar | 錄音格式 |
| duration_ms | int | 時長 |
| transcript_text | text nullable | 語音轉文字 |
| transcript_model | varchar nullable | 轉寫模型 |
| status | enum | uploaded / transcribed / failed |
| created_at | timestamp | 建立時間 |

---

## 6. AI 批改與報告

## 6.1 grading_jobs

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| attempt_id | uuid | 作答 |
| job_type | enum | writing_grading / speaking_transcription / speaking_grading / report_generation |
| status | enum | queued / processing / succeeded / failed / retrying |
| retry_count | int | 重試次數 |
| error_message | text nullable | 錯誤 |
| created_at | timestamp | 建立時間 |
| updated_at | timestamp | 更新時間 |

---

## 6.2 ai_grade_results

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| attempt_id | uuid | 作答 |
| exam_item_id | uuid | 題目 |
| skill | enum | writing / speaking |
| model_name | varchar | 模型 |
| prompt_version | varchar | Prompt 版本 |
| overall_score | decimal | 總分 |
| rubric_json | jsonb | 分項分數 |
| feedback_json | jsonb | 評語 |
| token_usage_json | jsonb | token 使用量 |
| cost_estimate | decimal | 預估成本 |
| status | enum | succeeded / failed / manual_review_required |
| created_at | timestamp | 建立時間 |

---

## 6.3 score_reports

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| attempt_id | uuid | 作答 |
| student_id | uuid | 學生 |
| exam_version_id | uuid | 考卷版本 |
| total_score | decimal | 總分 |
| reading_score | decimal | 閱讀分數 |
| listening_score | decimal | 聽力分數 |
| writing_score | decimal | 寫作分數 |
| speaking_score | decimal | 口說分數 |
| report_json | jsonb | 完整報告 |
| pdf_storage_key | varchar nullable | PDF 檔案 |
| status | enum | draft / published |
| created_at | timestamp | 建立時間 |

---

## 6.4 report_versions

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| score_report_id | uuid | 報告 |
| version_no | int | 版本 |
| report_json | jsonb | 報告內容 |
| changed_by | uuid nullable | 修改者 |
| change_reason | text nullable | 修改原因 |
| created_at | timestamp | 建立時間 |

---

## 6.5 teacher_comments

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| score_report_id | uuid | 報告 |
| teacher_id | uuid | 老師 |
| comment_text | text | 評語 |
| created_at | timestamp | 建立時間 |

---

## 7. Email 與 Audit

## 7.1 email_logs

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| organization_id | uuid | 機構 |
| to_email | varchar | 收件人 |
| subject | varchar | 主旨 |
| template_key | varchar | 模板 |
| status | enum | queued / sent / failed |
| error_message | text nullable | 錯誤 |
| sent_at | timestamp nullable | 寄送時間 |
| created_at | timestamp | 建立時間 |

---

## 7.2 audit_logs

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| organization_id | uuid nullable | 機構 |
| actor_user_id | uuid nullable | 操作者 |
| action | varchar | 操作 |
| resource_type | varchar | 資源類型 |
| resource_id | uuid nullable | 資源 ID |
| metadata_json | jsonb | 額外資訊 |
| created_at | timestamp | 建立時間 |

---

## 8. Prisma Schema 方向範例

```prisma
model Organization {
  id             String   @id @default(uuid())
  name           String
  slug           String   @unique
  status         String   @default("active")
  planType       String?
  studentQuota   Int      @default(0)
  examQuota      Int      @default(0)
  aiCreditQuota  Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  users          User[]
  classes        Class[]
  examPapers     ExamPaper[]
}

model User {
  id             String   @id @default(uuid())
  organizationId String?
  email          String   @unique
  passwordHash   String
  name           String
  role           String
  status         String   @default("active")
  createdAt      DateTime @default(now())

  organization   Organization? @relation(fields: [organizationId], references: [id])
  attempts       Attempt[]
}

model ExamPaper {
  id             String   @id @default(uuid())
  organizationId String?
  title          String
  description    String?
  status         String   @default("draft")
  createdAt      DateTime @default(now())

  organization   Organization? @relation(fields: [organizationId], references: [id])
  versions       ExamVersion[]
}

model ExamVersion {
  id            String   @id @default(uuid())
  examPaperId   String
  versionNo     String
  status        String   @default("draft")
  totalScore    Int      @default(120)
  createdAt     DateTime @default(now())

  examPaper     ExamPaper @relation(fields: [examPaperId], references: [id])
  sections      ExamSection[]

  @@unique([examPaperId, versionNo])
}
```

---

## 9. Multi-tenant 查詢規則

所有查詢必須遵守：

```ts
where: {
  organizationId: currentUser.organizationId
}
```

Platform Admin 例外，但仍需記錄 audit log。

---

## 10. 資料保留策略

| 資料 | 建議保存 |
|---|---|
| 成績報告 | 長期保存 |
| 原始作文 | 依機構設定保存 |
| 口說錄音 | 30 / 90 / 180 天可設定 |
| AI 原始回傳 | 至少保存到報告確認完成 |
| Audit log | 至少 1 年 |
| Email log | 至少 180 天 |
