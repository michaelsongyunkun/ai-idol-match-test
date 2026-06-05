export type ShareTextInput = {
  modeName: string;
  idolName: string;
  score: number;
  tags: string[];
};

export const buildShareText = ({ modeName, idolName, score, tags }: ShareTextInput) =>
  `我的爱豆匹配测试${modeName}结果：${idolName}，${score}分。关键词：${tags.slice(0, 3).join(" / ")}。`;
