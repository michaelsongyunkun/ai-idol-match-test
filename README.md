# 爱豆匹配测试 MVP

本地 Next.js + TypeScript + Tailwind 应用。用户可以选择两种测试版本：

- 体验版：15题，更快完成，适合先玩一轮。
- 专业版：40题，画像更细，推荐解释更完整。

用户必须先在开始页连接自己的 DeepSeek API Key，才能进入测评流程。
答完后会先由本地固定匹配规则确定 Top 1 和候选排序，同一组选项永远对应同一个爱豆；随后把固定匹配结果和候选短名单发送给 DeepSeek，由 DeepSeek 生成匹配理由、三步入坑路径和候选差异分析。
结果页支持下载分享海报、复制结果文案，以及浏览器本地收藏/历史记录。

DeepSeek API 连接使用官方 OpenAI 兼容接口：

- `GET https://api.deepseek.com/models` 校验用户 API Key。
- `POST https://api.deepseek.com/chat/completions` 生成固定匹配结果的解释文案。
- 当前结果模型：`deepseek-v4-flash`。

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

## Production Verification

```bash
npm ci
npm run verify
```

The app is ready to deploy after the command above passes and `data/idol-profiles.generated.ts` has been regenerated from the current `knowledge-base/` source.
