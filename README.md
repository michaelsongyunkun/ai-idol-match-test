# 爱豆匹配测试 MVP

本地 Next.js + TypeScript + Tailwind 应用。用户可以选择两种测试版本：

- 体验版：15题，更快完成，适合先玩一轮。
- 专业版：40题，画像更细，推荐解释更完整。

答完后会展示 Top 1 最可能粉上的爱豆、Top 3 候选、匹配标签、入坑理由和用户画像解释。

启动时会运行 `scripts/build-idol-profiles.mjs`，优先查找：

- `knowledge-base/年轻向全球idol资料清单_120plus.md`
- 工作区内包含“明星对话”的 Markdown/TXT/JSON
- 工作区内包含“idol资料”或“120plus”的 Markdown

未找到 RAG 时会生成清晰标注的 mock 候选库，保证 MVP 可运行。

如果资料是 `.docx`，先导入为项目内 Markdown：

```bash
python scripts/import-docx-rag.py "C:\Users\Michael Song\Desktop\年轻向全球idol资料清单_120plus.docx"
```

再运行或重启应用，候选库会自动从 `knowledge-base/年轻向全球idol资料清单_120plus.md` 生成。

## Run

双击 `start-idol-match-test.cmd` 可以启动并打开本地网页。

也可以用命令行启动：

```bash
npm install
npm run dev -- --port 3220
```

## Check

```bash
npm run verify
```
