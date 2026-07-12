# 06. REST API 規格文件（REST API Spec / OpenAPI Style）

> 文件版本：v1.0  
> Base URL：`/api/v1`  
> 認證方式：HttpOnly Cookie Session 或 JWT Cookie  
> 回應格式：JSON

---

## 1. 全域規格

### 1.1 Headers

```http
Content-Type: application/json
Accept: application/json
```

### 1.2 認證

登入成功後由後端設定：

```http
Set-Cookie: __Host-session=...; HttpOnly; Secure; SameSite=Lax; Path=/
```

### 1.3 錯誤格式

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request body.",
  "details": {
    "field": "email"
  },
  "request_id": "req_123"
}
```

### 1.4 Pagination

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

---

## 2. Auth API

## POST /auth/login

### Request

```json
{
  "email": "student@example.com",
  "password": "password123"
}
```

### Response 200

```json
{
  "user": {
    "id": "user_001",
    "name": "Student A",
    "email": "student@example.com",
    "role": "student",
    "organization_id": "org_001"
  }
}
```

---

## POST /auth/logout

### Response 200

```json
{
  "success": true
}
```

---

## GET /users/me

### Response 200

```json
{
  "id": "user_001",
  "name": "Student A",
  "email": "student@example.com",
  "role": "student",
  "organization_id": "org_001"
}
```

---

## 3. Organization API

## GET /organizations/:id

### 權限

- Platform Admin
- Organization Admin 僅能查自己機構

### Response 200

```json
{
  "id": "org_001",
  "name": "ABC English Center",
  "status": "active",
  "plan_type": "pro",
  "student_quota": 200,
  "exam_quota": 500,
  "ai_credit_quota": 500
}
```

---

## POST /organizations

### 權限

- Platform Admin

### Request

```json
{
  "name": "ABC English Center",
  "slug": "abc-english",
  "plan_type": "starter"
}
```

---

## 4. User API

## GET /users

### Query

| 參數 | 說明 |
|---|---|
| role | teacher / student |
| class_id | 班級 |
| page | 頁碼 |
| page_size | 每頁筆數 |

### Response 200

```json
{
  "data": [
    {
      "id": "user_001",
      "name": "Student A",
      "email": "student@example.com",
      "role": "student",
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1
  }
}
```

---

## POST /users

### Request

```json
{
  "name": "Student A",
  "email": "student@example.com",
  "role": "student",
  "password": "temporaryPassword123"
}
```

---

## POST /users/import

### Request

```json
{
  "class_id": "class_001",
  "students": [
    {
      "name": "Student A",
      "email": "student@example.com"
    }
  ]
}
```

### Response 200

```json
{
  "created_count": 1,
  "failed_count": 0,
  "errors": []
}
```

---

## 5. Class API

## GET /classes

### Response

```json
{
  "data": [
    {
      "id": "class_001",
      "name": "TOEFL Class A",
      "teacher_id": "teacher_001",
      "student_count": 25
    }
  ]
}
```

---

## POST /classes

### Request

```json
{
  "name": "TOEFL Class A",
  "teacher_id": "teacher_001"
}
```

---

## POST /classes/:id/members

### Request

```json
{
  "user_ids": ["student_001", "student_002"]
}
```

---

## 6. Exam Paper API

## GET /exam-papers

### Response

```json
{
  "data": [
    {
      "id": "exam_001",
      "title": "TOEFL-style Mock Test 01",
      "status": "published",
      "latest_version": "v1.0"
    }
  ]
}
```

---

## POST /exam-papers

### Request

```json
{
  "title": "TOEFL-style Mock Test 01",
  "description": "Full four-skill mock test."
}
```

---

## POST /exam-papers/:id/versions

### Request

```json
{
  "version_no": "v1.0",
  "sections": [
    {
      "section_type": "reading",
      "title": "Reading Section",
      "order_no": 1
    }
  ]
}
```

---

## GET /exam-versions/:id

### Response

```json
{
  "id": "exam_v001",
  "exam_paper_id": "exam_001",
  "version_no": "v1.0",
  "status": "published",
  "sections": []
}
```

---

## 7. Assignment API

## POST /assignments

### Request

```json
{
  "exam_version_id": "exam_v001",
  "class_id": "class_001",
  "opens_at": "2026-07-10T10:00:00+08:00",
  "closes_at": "2026-07-10T12:30:00+08:00",
  "max_attempts": 1
}
```

### Response

```json
{
  "id": "assignment_001",
  "status": "scheduled"
}
```

---

## GET /assignments

### Query

| 參數 | 說明 |
|---|---|
| class_id | 班級 |
| status | scheduled / active / closed |

---

## 8. Student Exam API

## GET /student/available-exams

### Response

```json
{
  "data": [
    {
      "assignment_id": "assignment_001",
      "exam_title": "TOEFL-style Mock Test 01",
      "status": "available",
      "opens_at": "2026-07-10T10:00:00+08:00",
      "closes_at": "2026-07-10T12:30:00+08:00"
    }
  ]
}
```

---

## POST /attempts/start

### Request

```json
{
  "assignment_id": "assignment_001"
}
```

### Response

```json
{
  "attempt_id": "attempt_001",
  "status": "hardware_check",
  "exam_version_id": "exam_v001"
}
```

---

## GET /attempts/:id

### Response

```json
{
  "id": "attempt_001",
  "status": "in_progress",
  "current_section_id": "section_reading",
  "current_item_id": "item_r001",
  "last_saved_at": "2026-07-10T10:15:00+08:00"
}
```

---

## PATCH /attempts/:id/response

### Request

```json
{
  "exam_item_id": "item_r001",
  "response_json": {
    "selected_option_index": 2
  },
  "client_saved_at": "2026-07-10T10:15:00+08:00"
}
```

### Response

```json
{
  "saved": true,
  "server_saved_at": "2026-07-10T10:15:02+08:00"
}
```

---

## POST /attempts/:id/audio

### 說明

建議實作為 multipart upload 或先取得 signed upload URL。

### Response

```json
{
  "audio_response_id": "audio_resp_001",
  "status": "uploaded"
}
```

---

## POST /attempts/:id/submit

### Response

```json
{
  "attempt_id": "attempt_001",
  "status": "grading",
  "grading_job_ids": ["job_001", "job_002"]
}
```

---

## 9. Grading API

## GET /grading-jobs/:id

### Response

```json
{
  "id": "job_001",
  "status": "processing",
  "job_type": "writing_grading",
  "retry_count": 0
}
```

---

## POST /grading-jobs/:id/retry

### 權限

- Teacher
- Organization Admin
- Platform Admin

---

## 10. Report API

## GET /reports/:attemptId

### Response

```json
{
  "attempt_id": "attempt_001",
  "student": {
    "name": "Student A",
    "email": "student@example.com"
  },
  "scores": {
    "reading": 24,
    "listening": 23,
    "writing": 22,
    "speaking": 21,
    "total": 90
  },
  "ai_feedback": {
    "writing": {},
    "speaking": {}
  },
  "teacher_comment": null
}
```

---

## GET /reports/:attemptId/pdf

### Response

```json
{
  "download_url": "https://storage.example.com/signed-url"
}
```

---

## POST /reports/:attemptId/email

### Request

```json
{
  "recipients": ["student", "teacher"]
}
```

---

## PATCH /reports/:attemptId/teacher-comment

### Request

```json
{
  "comment_text": "Your speaking fluency improved, but grammar accuracy still needs work."
}
```

---

## 11. Teacher Result API

## GET /teacher/results

### Query

| 參數 | 說明 |
|---|---|
| class_id | 班級 |
| assignment_id | 考試 |
| status | completed / grading |

### Response

```json
{
  "data": [
    {
      "student_id": "student_001",
      "student_name": "Student A",
      "attempt_id": "attempt_001",
      "status": "completed",
      "total_score": 90,
      "reading_score": 24,
      "listening_score": 23,
      "writing_score": 22,
      "speaking_score": 21
    }
  ]
}
```

---

## 12. 狀態碼規則

| Code | 說明 |
|---|---|
| 200 | 成功 |
| 201 | 建立成功 |
| 400 | Request 格式錯誤 |
| 401 | 未登入 |
| 403 | 無權限 |
| 404 | 找不到資源 |
| 409 | 狀態衝突 |
| 422 | 業務規則不符 |
| 500 | 系統錯誤 |

---

## 13. 常見錯誤代碼

| code | 說明 |
|---|---|
| AUTH_INVALID_CREDENTIALS | 帳號或密碼錯誤 |
| AUTH_FORBIDDEN | 無權限 |
| TENANT_SCOPE_VIOLATION | 跨機構存取 |
| EXAM_NOT_OPEN | 考試尚未開放 |
| EXAM_CLOSED | 考試已截止 |
| ATTEMPT_ALREADY_SUBMITTED | 已交卷不可修改 |
| AUDIO_UPLOAD_FAILED | 錄音上傳失敗 |
| AI_GRADING_FAILED | AI 批改失敗 |
| REPORT_NOT_READY | 報告尚未完成 |
