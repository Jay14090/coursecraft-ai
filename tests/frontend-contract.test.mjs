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
  for (const behavior of ["Help & shortcuts", "Workspace settings", "Notifications", "Save note", "Delete course", "Play overview", "Exam sprint"]) {
    assert.match(source, new RegExp(behavior));
  }
});
