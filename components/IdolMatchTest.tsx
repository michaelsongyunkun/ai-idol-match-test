"use client";

import { useEffect, useMemo, useState } from "react";

import { idolDataBundle } from "@/data/idol-profiles.generated";
import { buildUserPreferenceProfile, getTopUserTags, matchIdols } from "@/lib/matcher";
import {
  getQuizQuestionsForMode,
  quizModes,
  quizQuestions,
  requiredDimensions,
  type QuizModeId
} from "@/lib/quiz";

type Screen = "start" | "quiz" | "result" | "error";
type Answers = Record<string, string>;
type StoredQuizState = {
  mode: QuizModeId;
  answers: Answers;
};

const storageKey = "idol-match-test.state.v2";

const isQuizModeId = (value: unknown): value is QuizModeId =>
  typeof value === "string" && value in quizModes;

const isQuizValid = () =>
  quizQuestions.length === 40 &&
  requiredDimensions.length === 8 &&
  quizQuestions.every((question) => question.options.length === 4);

const getAnsweredCount = (answers: Answers, questions = quizQuestions) =>
  questions.filter((question) => Boolean(answers[question.id])).length;

const sourceLabel = idolDataBundle.status.mode === "rag" ? "RAG 已读取" : "Mock 演示";

export function IdolMatchTest() {
  const [screen, setScreen] = useState<Screen>("start");
  const [mode, setMode] = useState<QuizModeId>("experience");
  const [answers, setAnswers] = useState<Answers>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const activeQuestions = useMemo(() => getQuizQuestionsForMode(mode), [mode]);
  const activeMode = quizModes[mode];
  const answeredCount = getAnsweredCount(answers, activeQuestions);
  const currentQuestion = activeQuestions[currentIndex];
  const progress = Math.round((answeredCount / activeQuestions.length) * 100);
  const fatalError = idolDataBundle.profiles.length === 0 || !isQuizValid();
  const selectedOptionIds = useMemo(
    () =>
      activeQuestions
        .map((question) => answers[question.id])
        .filter((optionId): optionId is string => Boolean(optionId)),
    [activeQuestions, answers]
  );
  const userProfile = useMemo(
    () => buildUserPreferenceProfile(selectedOptionIds),
    [selectedOptionIds]
  );
  const matches = useMemo(
    () => (answeredCount === activeQuestions.length ? matchIdols(userProfile, idolDataBundle.profiles) : []),
    [activeQuestions.length, answeredCount, userProfile]
  );
  const topMatch = matches[0];
  const topUserTags = getTopUserTags(userProfile, 8);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<StoredQuizState> | Answers;
          const savedMode: QuizModeId =
            "mode" in parsed && isQuizModeId(parsed.mode)
              ? parsed.mode
              : "experience";
          const savedAnswers =
            "answers" in parsed && parsed.answers ? parsed.answers : (parsed as Answers);
          const savedQuestions = getQuizQuestionsForMode(savedMode);
          const safeAnswers = Object.fromEntries(
            Object.entries(savedAnswers).filter(([questionId, optionId]) =>
              quizQuestions.some(
                (question) =>
                  question.id === questionId &&
                  question.options.some((option) => option.id === optionId)
              )
            )
          );
          if (!cancelled) {
            setMode(savedMode);
            setAnswers(safeAnswers);
            if (getAnsweredCount(safeAnswers, savedQuestions) === savedQuestions.length) {
              setScreen("result");
            }
          }
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(storageKey, JSON.stringify({ mode, answers } satisfies StoredQuizState));
    }
  }, [answers, hydrated, mode]);

  const selectMode = (nextMode: QuizModeId) => {
    setMode(nextMode);
    setScreen("start");
    const nextQuestions = getQuizQuestionsForMode(nextMode);
    const firstUnanswered = nextQuestions.findIndex((question) => !answers[question.id]);
    setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
  };

  const startQuiz = () => {
    if (fatalError) {
      setScreen("error");
      return;
    }
    setScreen("quiz");
    const firstUnanswered = activeQuestions.findIndex((question) => !answers[question.id]);
    setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
  };

  const chooseOption = (optionId: string) => {
    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: optionId
    }));
  };

  const goNext = () => {
    if (!answers[currentQuestion.id]) {
      return;
    }

    if (currentIndex === activeQuestions.length - 1) {
      if (answeredCount === activeQuestions.length) {
        setScreen("result");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const firstUnanswered = activeQuestions.findIndex((question) => !answers[question.id]);
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : currentIndex);
      return;
    }

    setCurrentIndex((index) => Math.min(index + 1, activeQuestions.length - 1));
  };

  const goPrev = () => {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  };

  const restart = () => {
    setAnswers({});
    setCurrentIndex(0);
    setScreen("start");
    window.localStorage.removeItem(storageKey);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (screen === "error") {
    return (
      <main className="app-shell">
        <section className="error-card">
          <p className="hero-kicker">DATA CHECK</p>
          <h1>数据暂时不可用</h1>
          <p>
            {idolDataBundle.profiles.length === 0
              ? "候选爱豆库为空，无法计算匹配结果。"
              : "题库结构异常，需要保持 40 道题且每题 4 个选项。"}
          </p>
          <p className="small-muted">{idolDataBundle.status.message}</p>
          <button className="primary-button" type="button" onClick={() => setScreen("start")}>
            回到首页
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">{activeMode.questionCount}</div>
            <div>
              <h1 className="brand-title">爱豆匹配测试</h1>
              <p className="brand-subtitle">{activeMode.name} · 娱乐向偏好测算</p>
            </div>
          </div>
          <div className="source-pill" data-mode={idolDataBundle.status.mode}>
            {sourceLabel} · {idolDataBundle.profiles.length} 位候选
          </div>
        </header>

        {screen === "start" && (
          <section className="start-grid">
            <div className="panel">
              <p className="hero-kicker">IDOL MATCH LAB</p>
              <h2 className="hero-title">{activeMode.questionCount}题找到你最可能粉上的爱豆</h2>
              <p className="hero-copy">
                体验版更快，专业版更细。两种版本都会从颜值审美、舞台/作品偏好、陪伴需求、反差感、消费倾向和饭圈互动方式建模。
              </p>
              <div className="mode-picker" aria-label="选择测试版本">
                {(Object.keys(quizModes) as QuizModeId[]).map((modeId) => {
                  const item = quizModes[modeId];

                  return (
                    <button
                      className="mode-button"
                      data-active={mode === modeId}
                      key={modeId}
                      type="button"
                      onClick={() => selectMode(modeId)}
                    >
                      <span className="mode-name">{item.name}</span>
                      <span className="mode-count">{item.shortName}</span>
                      <span className="mode-summary">{item.summary}</span>
                    </button>
                  );
                })}
              </div>
              <div className="start-actions">
                <button className="primary-button" type="button" onClick={startQuiz}>
                  开始{activeMode.name}
                </button>
                {answeredCount > 0 && (
                  <button className="secondary-button" type="button" onClick={() => setScreen("quiz")}>
                    继续第 {Math.min(currentIndex + 1, activeQuestions.length)} 题
                  </button>
                )}
              </div>
              {idolDataBundle.status.mode !== "rag" && (
                <div className="notice">
                  <strong>知识库未命中，当前为 mock 兜底</strong>
                  {idolDataBundle.status.message}
                </div>
              )}
            </div>

            <aside className="panel">
              <p className="section-kicker">READY</p>
              <div className="stat-grid">
                <div className="stat-tile">
                  <span className="stat-number">{activeMode.questionCount}</span>
                  <span className="stat-label">{activeMode.name}，每题 4 个选项</span>
                </div>
                <div className="stat-tile">
                  <span className="stat-number">8</span>
                  <span className="stat-label">偏好维度覆盖完整</span>
                </div>
                <div className="stat-tile">
                  <span className="stat-number">{idolDataBundle.profiles.length}</span>
                  <span className="stat-label">候选爱豆画像</span>
                </div>
                <div className="stat-tile">
                  <span className="stat-number">{answeredCount}</span>
                  <span className="stat-label">当前版本已答题目</span>
                </div>
              </div>
            </aside>
          </section>
        )}

        {screen === "quiz" && currentQuestion && (
          <section className="quiz-layout">
            <article className="question-card">
              <div className="progress-line">
                <div className="progress-meta">
                  <span className="dimension-chip">{currentQuestion.dimension}</span>
                  <span className="progress-count">
                    {currentIndex + 1} / {activeQuestions.length}
                  </span>
                </div>
                <span className="progress-count">{activeMode.name} · 已答 {answeredCount}</span>
              </div>
              <div className="bar" aria-label={`答题进度 ${progress}%`}>
                <div className="bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <h2 className="question-title">{currentQuestion.text}</h2>
              <div className="options-grid">
                {currentQuestion.options.map((item) => (
                  <button
                    className="option-button"
                    data-selected={answers[currentQuestion.id] === item.id}
                    key={item.id}
                    type="button"
                    onClick={() => chooseOption(item.id)}
                  >
                    <span className="option-label">{item.label}</span>
                    <span className="option-tags">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span className="mini-tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <div className="quiz-actions">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={goPrev}
                >
                  上一题
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!answers[currentQuestion.id]}
                  onClick={goNext}
                >
                  {currentIndex === activeQuestions.length - 1 ? "查看结果" : "下一题"}
                </button>
              </div>
            </article>

            <aside className="panel answer-panel">
              <p className="section-kicker">ANSWER MAP</p>
              <h2 className="brand-title">已答状态</h2>
              <p className="small-muted">点亮代表已选择，可点击任意题回看修改。</p>
              <div className="answer-strip">
                {activeQuestions.map((question, index) => (
                  <button
                    aria-label={`第 ${index + 1} 题`}
                    className="answer-dot"
                    data-answered={Boolean(answers[question.id])}
                    data-current={index === currentIndex}
                    key={question.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <p className="small-muted">还差 {activeQuestions.length - answeredCount} 题即可生成推荐。</p>
            </aside>
          </section>
        )}

        {screen === "result" && topMatch && (
          <section className="result-stack">
            <article className="result-hero">
              <div className="result-top">
                <div>
                  <p className="idol-rank">TOP 1 · {activeMode.name} · 最可能入坑</p>
                  <h2 className="idol-name">{topMatch.idol.name}</h2>
                  <p className="idol-summary">{topMatch.idol.summary}</p>
                  <div className="chip-cloud" style={{ marginTop: 16 }}>
                    {topMatch.idol.tags.slice(0, 8).map((tag) => (
                      <span className="tag-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="score-badge">
                  <span>
                    <span className="score-value">{topMatch.score}</span>
                    <span className="score-label">匹配分</span>
                  </span>
                </div>
              </div>

              <div className="result-body">
                <div>
                  <p className="section-kicker">WHY MATCH</p>
                  <ul className="reason-list">
                    {topMatch.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <aside>
                  <p className="section-kicker">YOUR PROFILE</p>
                  <div className="chip-cloud">
                    {topUserTags.map((tag) => (
                      <span className="matched-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="section-kicker" style={{ marginTop: 22 }}>
                    ENTRY PATH
                  </p>
                  <ul className="entry-list">
                    {topMatch.idol.entryReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </aside>
              </div>
            </article>

            <section>
              <div className="progress-line">
                <div>
                  <p className="section-kicker">TOP 3</p>
                  <h2 className="brand-title">候选推荐</h2>
                </div>
                <button className="secondary-button" type="button" onClick={restart}>
                  重新测试
                </button>
              </div>
              <div className="top3-grid">
                {matches.slice(0, 3).map((match, index) => (
                  <article className="candidate-card" key={match.idol.id}>
                    <span className="candidate-rank">#{index + 1} · {match.score} 分</span>
                    <h3>{match.idol.name}</h3>
                    <p>{match.matchedTags.slice(0, 4).join(" / ") || "偏好路径较分散"}</p>
                  </article>
                ))}
              </div>
            </section>

            {idolDataBundle.status.mode !== "rag" && (
              <div className="notice">
                <strong>当前结果基于 mock 候选库</strong>
                把 `年轻向全球idol资料清单_120plus.md` 放入项目 `knowledge-base/` 后重启服务，即可生成真实 RAG 候选库。
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
