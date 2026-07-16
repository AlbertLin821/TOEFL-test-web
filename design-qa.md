# Design QA — Listening and Writing

Date: 2026-07-13  
Reference: `TF介面/TF 介面.pptx`, slides 20–55  
Implementation viewport: 1280 × 720 (16:9)  
Reference viewport: 1600 × 900 (16:9)

## Coverage

| Area | Reference slides | Verified implementation |
| --- | --- | --- |
| Listening overview and module directions | 20–21 | Task table, module transition, volume, no-back directions |
| Listening playback and answer timing | 22–27 | Audio-first lock, 00:00:00 during playback, 20-second answer timer, no replay/back |
| Listening module/section endings | 35, 42 | Module 1 end, Module 2 transition, section end |
| Writing overview and sentence building | 44–48 | 12-question overview, 10 sentence items, 6-minute shared timer, Back after item 1, Time Remaining gate |
| Email writing | 49–51 | 7-minute timer, To/Subject metadata, editor tools, word count, confirmation gate |
| Academic discussion | 52–55 | 10-minute timer, professor prompt, two student posts, source portraits, editor tools, section end |

## Visual comparison

- Combined comparison reviewed for the key states: Listening intro/playback, sentence building, Time Remaining, email editor, and academic discussion editor.
- Final discussion screenshot: `C:/Users/Administrator/AppData/Local/Temp/codex-presentations/toefl-listening-writing-audit/current/after-final/writing-discussion-final-v2.png`
- Reference slide render: `C:/Users/Administrator/AppData/Local/Temp/codex-presentations/toefl-listening-writing-audit/tmp/slides/slide-53.png`
- Result: PASS. Header hierarchy, split-panel layout, timer placement, editor toolbar, word count, spacing, and source portraits follow the presentation. Prompt wording and names use the real seeded exam content rather than the presentation's illustrative sample.

## Functional verification

- Listening options remain disabled until the associated audio finishes; the item timer begins only after playback.
- Listening item timers reset to 20 seconds for consecutive questions, including follow-up questions without another audio asset.
- Writing module timers use deadline-based elapsed time and continue through the Time Remaining screen.
- Sentence tokens support click and drag, preserve duplicate tokens with stable IDs, and enforce the answer-slot count.
- Essay Cut/Paste/Undo/Redo, word count, autosave, immediate navigation flush, timeout locking, and transition double-click protection were checked.
- A rapid sequence of email edits followed immediately by Next persisted the newest value in PostgreSQL.

## Content inventory constraint

The presentation states 35–45 Listening questions, while the current database contains 34 (18 in Module 1 and 16 in Module 2). All 23 available listening audio assets are wired into the flow. No question or audio was duplicated or fabricated to hide the one-item content gap.

## Outcome

PASS for interface, interaction flow, timing, navigation, and persistence behavior. The only remaining gap is the Listening content inventory count documented above.
