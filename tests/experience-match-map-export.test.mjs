import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  buildQuestionOptionRows,
  buildSampleRows,
  codesToSelection,
  experienceCombinationCount,
  experienceQuestionCount,
  indexToSignature,
  lookupExperienceMatch,
  runCli
} from "../scripts/export-experience-match-map.mjs";

describe("experience match map export", () => {
  it("documents the true 15-question combination scale", () => {
    assert.equal(experienceQuestionCount, 15);
    assert.equal(experienceCombinationCount, 1_073_741_824);
    assert.equal(indexToSignature(0), "AAAAAAAAAAAAAAA");
    assert.equal(indexToSignature(experienceCombinationCount - 1), "DDDDDDDDDDDDDDD");
  });

  it("builds a question option code table for all experience choices", () => {
    const rows = buildQuestionOptionRows();

    assert.equal(rows.length, 60);
    assert.deepEqual(
      rows.slice(0, 4).map((row) => row.choice_code),
      ["A", "B", "C", "D"]
    );
    assert.equal(rows[0].question_no, 1);
    assert.equal(rows[0].option_id, "visual-01-a");
  });

  it("looks up a deterministic idol for any 15-letter answer signature", () => {
    const selection = codesToSelection("ACDABCDABCDABCD");
    const lookup = lookupExperienceMatch("ACDABCDABCDABCD");

    assert.equal(selection.length, 15);
    assert.equal(lookup.answer_signature, "ACDABCDABCDABCD");
    assert.ok(lookup.top_idol_id);
    assert.ok(lookup.top_idol_name);
    assert.ok(Number.isInteger(lookup.score));
  });

  it("writes bounded artifacts and refuses accidental full export", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "experience-match-map-"));
    const result = await runCli(["--sample", "4", "--output-dir", outputDir]);
    const manifest = JSON.parse(readFileSync(join(outputDir, "manifest.json"), "utf8"));
    const sampleCsv = readFileSync(join(outputDir, "sample-match-map.csv"), "utf8");

    assert.equal(result.sampleRows, 4);
    assert.equal(manifest.rawCombinationCount, experienceCombinationCount);
    assert.match(sampleCsv, /answer_signature/);
    assert.match(sampleCsv, /top_idol_name/);
    assert.equal(buildSampleRows(2).length, 2);

    await assert.rejects(runCli(["--full"]), /拒绝生成全量/);
  });
});
