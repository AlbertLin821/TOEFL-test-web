# TOEFL-style 四技能模擬考平台文件包

這個資料夾包含 10 份 Markdown 規格文件，對應產品規劃、需求、UI/UX、架構、資料庫、API、AI 批改、報告通知、測試與部署安全。

## 文件清單

1. `01-product-brief.md`  
   產品願景與商業需求說明（BRD / Product Brief）

2. `02-srs.md`  
   軟體需求規格書（SRS）

3. `03-flow-wireframe-spec.md`  
   使用者流程與 UI/UX 規格

4. `04-architecture.md`  
   系統架構與設計文件

5. `05-db-schema.md`  
   資料庫設計與資料模型規格

6. `06-api-spec.md`  
   REST API 規格文件

7. `07-ai-grading-spec.md`  
   AI 批改規格與 Prompt 設計文件

8. `08-report-email-spec.md`  
   成績報告與 Email 範本規格

9. `09-test-plan.md`  
   測試計畫與測試案例文件

10. `10-devops-security.md`  
    部署、維運與安全性說明

## 核心產品設定

- 產品定位：TOEFL-style 四技能英語模擬測驗平台
- 目標客群：補習班、學校、語言中心、教育機構
- 架構：B2B Multi-tenant SaaS
- 考卷模式：固定整卷式考卷
- 技術：React + TypeScript + Node.js/Express + REST API + PostgreSQL + Prisma
- 批改：Reading / Listening 自動批改；Writing / Speaking 使用 OpenAI API
- 報告：四科整合報告 + PDF + Email 通知
