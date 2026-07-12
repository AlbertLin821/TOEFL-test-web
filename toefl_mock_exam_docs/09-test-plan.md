# 09. 測試計畫與測試案例文件（Test Plan & Test Cases）

> 文件版本：v1.0  
> 測試範圍：學生端、老師端、管理端、API、AI 批改、Email、部署安全

---

## 1. 測試目標

確保系統能夠穩定完成：

- 多機構登入與權限控制
- 完整四科模擬考流程
- 答案自動儲存與斷線恢復
- Reading / Listening 自動批改
- Writing / Speaking AI 批改
- 成績報告產生
- Email 通知
- 多機構資料隔離
- 口說錄音上傳與保存

---

## 2. 測試類型

| 類型 | 說明 |
|---|---|
| Unit Test | 單一函式、計分邏輯、權限判斷 |
| Integration Test | API + DB + Queue + Storage |
| E2E Test | 從登入到完成考試與查看報告 |
| Load Test | 同時作答與 AI queue 壓力 |
| Security Test | 權限、跨機構存取、登入安全 |
| Accessibility Test | 鍵盤操作、視覺提示、表單標籤 |
| Manual QA | 音檔、錄音、瀏覽器相容性 |

---

## 3. 測試環境

| 環境 | 用途 |
|---|---|
| local | 開發者本機 |
| staging | 測試與 Demo |
| production | 正式環境 |

### Staging 必須包含

- 測試 organization A
- 測試 organization B
- 老師帳號
- 學生帳號
- 一份完整四科考卷
- 測試 OpenAI key 或 mock AI service
- 測試 Email service sandbox

---

## 4. 單元測試案例

## UT-001 自動批改單選題

### Given
學生選擇答案 B，正確答案 B。

### When
系統執行 scoreSingleChoice。

### Then
回傳 is_correct = true，score_awarded = 滿分。

---

## UT-002 自動批改錯誤答案

### Given
學生選擇答案 A，正確答案 C。

### Then
回傳 is_correct = false，score_awarded = 0。

---

## UT-003 Build a Sentence 排序批改

### Given
學生排序與正確排序一致。

### Then
回傳滿分。

---

## UT-004 organization scope 檢查

### Given
currentUser.organization_id = org_A  
resource.organization_id = org_B

### Then
系統拒絕存取並回傳 403。

---

## UT-005 AI JSON schema 驗證

### Given
AI 回傳缺少 overall_score。

### Then
schema validation failed，建立 retry。

---

## 5. API 整合測試

## IT-001 登入成功

### Steps

1. POST /auth/login
2. 使用正確帳密

### Expected

- 200
- 回傳 user
- 設定 session cookie

---

## IT-002 學生取得可考考試

### Steps

1. 學生登入。
2. GET /student/available-exams。

### Expected

- 只回傳該學生所屬班級的考試。
- 不包含其他機構或其他班級考試。

---

## IT-003 開始考試

### Steps

1. POST /attempts/start
2. 傳入 assignment_id

### Expected

- 建立 attempt
- status = hardware_check
- 綁定 exam_version_id

---

## IT-004 儲存答案

### Steps

1. PATCH /attempts/:id/response
2. 傳入 item_id 與 response_json

### Expected

- 回傳 saved = true
- DB responses 有資料
- last_saved_at 更新

---

## IT-005 交卷後建立批改任務

### Steps

1. POST /attempts/:id/submit

### Expected

- attempt status = grading
- Reading / Listening 分數已計算
- Writing / Speaking grading_jobs 建立

---

## 6. E2E 測試案例

## E2E-001 完整考試流程

### Steps

1. 學生登入。
2. 選擇可考考試。
3. 完成硬體檢查。
4. 完成 Reading。
5. 完成 Listening。
6. 完成 Writing。
7. 完成 Speaking。
8. 交卷。
9. 等待批改完成。
10. 查看報告。

### Expected

- 全流程無錯誤。
- 報告包含四科分數。
- Email log 有 sent 記錄。

---

## E2E-002 Reading Review 行為

### Steps

1. 進入 Reading。
2. 作答前幾題。
3. 點 Review。
4. 跳回未答題。
5. 進入下一 Module。
6. 嘗試回上一 Module。

### Expected

- Review 正常。
- 同 module 可跳題。
- 不可返回上一 module。

---

## E2E-003 Listening 灰階選項

### Steps

1. 進入 Listening 題。
2. 音檔播放期間嘗試點選答案。
3. 音檔播放完後點選答案。

### Expected

- 播放期間不可點選。
- 播放完可點選。
- 沒有 Back 按鈕。

---

## E2E-004 Writing 字數統計

### Steps

1. 進入 Writing Email。
2. 輸入文字。
3. 查看字數。
4. 點 Hide Word Count。

### Expected

- 字數即時更新。
- 可隱藏字數。
- 文字自動儲存。

---

## E2E-005 Speaking 錄音

### Steps

1. 進入 Speaking。
2. 播放題目音檔。
3. 自動開始錄音。
4. 時間到。
5. 查看 Stop Speaking。
6. 檢查錄音上傳。

### Expected

- 錄音檔成功上傳。
- audio_response 與 item_id 對應。
- 可進入下一題。

---

## 7. 斷線與恢復測試

## NET-001 作答中斷線

### Steps

1. 學生作答 Writing。
2. 模擬網路斷線。
3. 繼續輸入。
4. 恢復網路。

### Expected

- 顯示斷線提示。
- 恢復後可儲存。
- 不造成資料損壞。

---

## NET-002 關閉瀏覽器後恢復

### Steps

1. 學生作答 Reading。
2. 關閉瀏覽器。
3. 重新登入。
4. 回到考試。

### Expected

- 回到最後儲存題目。
- 剩餘時間不會重置。

---

## 8. AI 批改測試

## AI-001 Writing 批改成功

### Expected

- 回傳 JSON 符合 schema。
- ai_grade_results 寫入成功。
- token usage 有記錄。

---

## AI-002 Speaking 轉寫成功

### Expected

- audio_response transcript_text 有內容。
- transcript_model 有記錄。
- 進入 speaking grading。

---

## AI-003 AI JSON 格式錯誤

### Expected

- schema validation failed。
- grading_job retry_count +1。
- 未直接產生錯誤報告。

---

## AI-004 AI 超時

### Expected

- job 狀態 retrying。
- 超過 retry 上限後 manual_review_required。

---

## 9. Email 測試

## EMAIL-001 報告完成寄信

### Expected

- 學生收到 Email。
- Email 包含報告連結。
- email_logs status = sent。

---

## EMAIL-002 Email 失敗

### Expected

- email_logs status = failed。
- error_message 有內容。
- 系統可 retry。

---

## 10. 安全測試

## SEC-001 跨機構讀取報告

### Steps

1. 使用 org_A 老師 token。
2. 讀取 org_B 學生 report。

### Expected

- 403 Forbidden。

---

## SEC-002 未登入存取 API

### Expected

- 401 Unauthorized。

---

## SEC-003 學生修改他人答案

### Expected

- 403 Forbidden。

---

## SEC-004 已交卷後修改答案

### Expected

- 409 Conflict 或 422。

---

## 11. 壓力測試

### 測試項目

- 100 名學生同時登入
- 100 名學生同時儲存答案
- 50 名學生同時上傳錄音
- 50 份 AI 批改任務排隊
- Email 批量寄送

### 觀察指標

- API latency
- DB CPU
- Queue backlog
- AI job duration
- Storage upload error rate
- Email delivery rate

---

## 12. 上線前驗收 Checklist

- [ ] 完整四科考試 E2E 通過
- [ ] AI 批改成功與失敗流程通過
- [ ] Email 成功與失敗流程通過
- [ ] 多機構隔離測試通過
- [ ] 錄音功能 HTTPS 正常
- [ ] 報告 PDF 下載正常
- [ ] 密碼不可明碼保存
- [ ] API key 未出現在前端
- [ ] 備份策略已設定
- [ ] 錯誤監控已設定
