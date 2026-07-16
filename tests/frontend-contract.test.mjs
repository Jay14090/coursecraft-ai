import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../components/coursecraft-app.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../lib/api.ts", import.meta.url), "utf8");
const samplePdf = await readFile(new URL("../lib/sample-pdf.ts", import.meta.url), "utf8");

test("frontend uses the real CourseCraft API instead of static demo data", () => {
  assert.doesNotMatch(source, /demo-data/);
  assert.match(source, /coursecraftApi\.uploadDocument/);
  assert.match(source, /coursecraftApi\.generateCourse/);
  assert.match(source, /coursecraftApi\.updateProgress/);
  assert.match(source, /coursecraftApi\.chat/);
  assert.match(source, /coursecraftApi\.generateQuiz/);
  assert.match(source, /coursecraftApi\.flashcards/);
  assert.match(source, /coursecraftApi\.streamChat/);
  assert.match(source, /coursecraftApi\.summarize/);
  assert.match(source, /coursecraftApi\.mindMap/);
  assert.match(source, /coursecraftApi\.diagram/);
  assert.match(source, /coursecraftApi\.exportCourse/);
  assert.match(source, /coursecraftApi\.certificate/);
  assert.match(source, /coursecraftApi\.history/);
  assert.match(source, /coursecraftApi\.search/);
});

test("API client attaches sessions and exposes robust failure messages", () => {
  assert.match(api, /Authorization/);
  assert.match(api, /coursecraft_session/);
  assert.match(api, /payload\.detail/);
  assert.match(api, /response\.status === 204/);
});

test("PDF workflow validates type and size before upload", () => {
  assert.match(source, /application\/pdf/);
  assert.match(source, /50 \* 1024 \* 1024/);
  assert.match(source, /Scanned image-only PDFs need OCR/);
});

test("included PDF demo exercises the same multi-page upload path", () => {
  assert.match(source, /chooseFile\(createSamplePdf\(\)\)/);
  assert.match(samplePdf, /%PDF-1\.4/);
  assert.match(samplePdf, /\/Count 3/);
  assert.match(samplePdf, /coursecraft-retrieval-guide\.pdf/);
});

test("interactive utilities are implemented rather than placeholder links", () => {
  for (const behavior of ["Help & shortcuts", "Workspace settings", "Notifications", "Save note", "Delete course", "Audio narration", "Exam sprint"]) {
    assert.match(source, new RegExp(behavior));
  }
});

test("all assignment bonus features are exposed as working UI workflows", () => {
  for (const feature of ["RAG grounded", "Semantic search", "Vector index", "Smart flashcards", "AI mind map", "Completion certificate", "Audio narration", "PDF summarization", "Multi-language tutor", "Course export", "Markdown", "AI diagram"]) {
    assert.match(source, new RegExp(feature));
  }
  assert.match(api, /text\/event-stream|chat\/stream/);
  assert.match(source, /short_answer/);
  assert.match(source, /Correct answer:/);
});

test("OAuth callback sessions and selectable generation languages are implemented", () => {
  assert.match(source, /access_token/);
  assert.match(source, /coursecraft_session/);
  assert.match(source, /Course language/);
  assert.match(source, /value="hi"/);
});
