import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractProfilesFromMarkdown,
  pickProfileTags
} from "../scripts/profile-builder.mjs";

describe("idol profile builder", () => {
  it("extracts candidate idol profiles from headings and nearby copy", () => {
    const markdown = `
## 星野晴
清冷但很温柔，舞台表现稳定，采访里有反差感，也有演员作品。

## 夏天一
综艺里很搞笑，热血舞台和团魂感强，适合喜欢陪伴感的粉丝。
`;

    const profiles = extractProfilesFromMarkdown(markdown, "sample.md");

    assert.equal(profiles.length, 2);
    assert.equal(profiles[0].name, "星野晴");
    assert.ok(profiles[0].tags.includes("清冷"));
    assert.ok(profiles[0].tags.includes("温柔"));
    assert.ok(profiles[1].tags.includes("搞笑"));
  });

  it("maps source keywords into stable profile tags", () => {
    const tags = pickProfileTags("舞台爆发力强，作品路线清晰，粉丝觉得很养成系");

    assert.ok(tags.includes("舞台型"));
    assert.ok(tags.includes("演员型"));
    assert.ok(tags.includes("养成系"));
  });

  it("extracts profiles from numbered RAG list lines", () => {
    const markdown = `
1. 林光：舞台爆发力强，综艺里搞笑，粉丝互动自然。
2. Mira｜清冷高级感，影视作品和角色反差突出。
`;

    const profiles = extractProfilesFromMarkdown(markdown, "numbered.md");

    assert.equal(profiles.length, 2);
    assert.equal(profiles[0].name, "林光");
    assert.ok(profiles[0].tags.includes("舞台型"));
    assert.ok(profiles[1].tags.includes("演员型"));
  });

  it("extracts idol table rows using the name column instead of the index column", () => {
    const markdown = `
| 序号 | 姓名 | 年龄 | 主业 | 公开性格印象 | 代表成绩 | 人设定位 |
| 1 | 王一博 | 28 | 演员/歌手/舞者 | 冷感、专注、酷 | 舞台与影视作品突出 | 酷盖全能、街舞赛车男主 |
| 2 | Taylor Swift | 36 | 歌手/音乐人 | 自律、叙事强 | 全球巡演与专辑纪录突出 | 全球创作天后 |
| 标签 | 代表人物 | 适合写法 |
| 酷感唱跳 | 王一博、Lisa | 冷脸、舞台强 |
`;

    const profiles = extractProfilesFromMarkdown(markdown, "table.md");

    assert.equal(profiles.length, 2);
    assert.deepEqual(
      profiles.map((profile) => profile.name),
      ["王一博", "Taylor Swift"]
    );
    assert.ok(profiles[0].tags.includes("舞台型"));
    assert.ok(profiles[1].tags.includes("创作型"));
  });
});
