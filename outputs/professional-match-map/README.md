# 专业版 40 题答案映射表

本目录由 `npm run export:professional-map` 生成，用来记录 40 题专业版的选项编码和匹配查询规则。

## 为什么不直接生成全量表

40 题、每题 4 个选项，完整排列组合是：

```text
4^40 = 1,208,925,819,614,629,174,706,176 行
```

这个规模不适合放进 Excel、CSV、Git 仓库或前端包。当前脚本默认生成可审计的小表，并支持对任意一种答案组合做精确查询。

## 文件

- `question-options.csv`：40 道题、每题 A/B/C/D 对应的 option id、文案、标签和权重。
- `sample-match-map.csv`：从完整组合空间等距抽样出的答案签名和 Top1 爱豆结果。
- `manifest.json`：生成参数、候选爱豆数量、完整组合数和数据源。

## 查询任意一种结果

```powershell
npm run export:professional-map -- --signature ABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD
```

答案签名长度必须是 40 位，每一位对应 `question-options.csv` 中同题号的 A/B/C/D。

## 重新生成

```powershell
npm run export:professional-map -- --sample 2048 --output-dir outputs/professional-match-map
```
