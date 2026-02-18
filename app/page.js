"use client";

import { useState, useEffect, useRef } from "react";

const formatPoints = (n) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
};

const PHASES = { WAGER: "wager", QUESTION: "question", INTER_RESULT: "inter_result", RESULT: "result" };
const TIMER_SECONDS = 30;

// ─── localStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY    = "ysat_player";
const SEEN_KEY       = "ysat_seen";
const SCHEMA_VERSION = 2;
const todayStr       = () => new Date().toISOString().slice(0, 10);

const defaultStats = () => ({
  schemaVersion: SCHEMA_VERSION,
  points: 0, streak: 0, totalCorrect: 0, totalPlayed: 0,
  lastPlayedDate: null, lastPlayedDay: null,
  dayStartPoints: null, dayStartedDay: null,
  history: [],
});

const migrateStats = (saved) => {
  const version = saved.schemaVersion ?? 0;
  if (version < 1) {
    saved = { ...saved, schemaVersion: 1 };
  }
  if (version < 2) {
    // v1 → v2: add day-budget tracking fields
    saved = { ...saved, schemaVersion: 2, dayStartPoints: null, dayStartedDay: null };
  }
  // Future migrations go here: if (version < 3) { ... }
  return saved;
};

const loadStats = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    let saved = migrateStats(JSON.parse(raw));
    if (saved.lastPlayedDate) {
      const daysDiff = Math.round((new Date(todayStr()) - new Date(saved.lastPlayedDate)) / 86400000);
      if (daysDiff > 1) return { ...saved, points: 0, streak: 0, dayStartPoints: null, dayStartedDay: null };
    }
    return saved;
  } catch { return defaultStats(); }
};

const saveStats = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, schemaVersion: SCHEMA_VERSION })); } catch {} };

// ─── Rules modal ──────────────────────────────────────────────────────────────
const RULES = [
  {
    icon: "★",
    heading: "Three questions a day",
    body: "Each day has three trivia questions across three different categories. You see one category at a time — the next is only revealed after you submit your answer.",
  },
  {
    icon: "$",
    heading: "Wager your balance",
    body: "Before each question you place a wager from your previous day's total. You can't bet today's winnings — only the balance you carried in. You must keep at least $1 in reserve for each remaining question.",
  },
  {
    icon: "?",
    heading: "Answer the question",
    body: "A trivia clue is revealed. You have 30 seconds to type your answer. Alternate spellings and last-name-only answers are accepted.",
  },
  {
    icon: "\u2713",
    heading: "Win or lose",
    body: "Correct: wagered points are added. Incorrect or time's up: wagered points are deducted. You can never go below zero.",
  },
  {
    icon: "\uD83D\uDD25",
    heading: "Keep your streak",
    body: "Complete all three questions each day to keep your streak alive. Miss a day entirely and your streak resets to zero.",
  },
];

function RulesModal({ onClose, isOnboarding }) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} className="modalIn" onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalEyebrow}>{isOnboarding ? "Welcome to" : "How to play"}</div>
            <div style={S.modalTitle}>You Sure About That?</div>
          </div>
          <button style={S.modalClose} onClick={onClose}>&#x2715;</button>
        </div>

        <div style={S.modalRules}>
          {RULES.map((r, i) => (
            <div key={i} style={S.ruleRow}>
              <div style={S.ruleIcon}>{r.icon}</div>
              <div>
                <div style={S.ruleHeading}>{r.heading}</div>
                <div style={S.ruleBody}>{r.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={S.modalNote}>
          A new set of questions drops every day at midnight UTC. Don&apos;t miss a day!
        </div>

        <button style={{ ...S.mainBtn, background: "var(--gold)" }} className="mainBtn" onClick={onClose}>
          {isOnboarding ? "Let's Play!" : "Got It"}
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [stats, setStats] = useState(() => loadStats());

  // ─── Remote question state ─────────────────────────────────────────────────
  const [gameData, setGameData]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // ─── Game state ────────────────────────────────────────────────────────────
  const [phase, setPhase]                 = useState(PHASES.WAGER);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [wagers, setWagers]         = useState([null, null, null]);
  const [wager, setWager]           = useState("");
  const [answers, setAnswers]       = useState(["", "", ""]);
  const [answer, setAnswer]         = useState("");
  const [results, setResults]       = useState([null, null, null]);
  const [timedOuts, setTimedOuts]   = useState([false, false, false]);
  const [matchMethods, setMatchMethods] = useState([null, null, null]);

  const [finalPoints, setFinalPoints] = useState(null);
  const [checking, setChecking]       = useState(false);
  const [copied, setCopied]           = useState(false);
  const [showInfo, setShowInfo]       = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem(SEEN_KEY); } catch { return true; }
  });
  const inputRef = useRef(null);

  // ─── Fetch today's question ────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setFetchError(false);

    fetch("/api/question")
      .then(res => {
        if (!res.ok) throw new Error("no question");
        return res.json();
      })
      .then(data => {
        setGameData(data);

        if (stats.lastPlayedDay === data.day) {
          // Already completed today — restore final result screen
          const last = stats.history.at(-1);
          if (last?.questions) {
            setResults(last.questions.map(q => q.correct));
            setTimedOuts(last.questions.map(q => q.timedOut ?? false));
            setWagers(last.questions.map(q => q.wager));
            setFinalPoints(last.pointsAfter ?? stats.points);
          }
          setPhase(PHASES.RESULT);
        } else if (stats.dayStartedDay !== data.day) {
          // First time seeing today — lock the budget
          setStats(prev => ({
            ...prev,
            dayStartPoints: prev.points,
            dayStartedDay: data.day,
          }));
        }
        // If dayStartedDay === data.day but not fully played: they refreshed mid-game.
        // Reset to Q1 wager with locked budget still in stats.

        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const alreadyPlayed = gameData ? stats.lastPlayedDay === gameData.day : false;

  const missedDay = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved.lastPlayedDate || !saved.streak) return false;
      return Math.round((new Date(todayStr()) - new Date(saved.lastPlayedDate)) / 86400000) > 1;
    } catch { return false; }
  })();

  // ─── Budget ────────────────────────────────────────────────────────────────
  const dayBudget      = Math.max(stats.dayStartPoints ?? stats.points, 1000);
  const allocatedSoFar = wagers.slice(0, questionIndex).reduce((sum, w) => sum + (w ?? 0), 0);
  const reserve        = Math.max(0, 2 - questionIndex); // $1 per remaining future question
  const maxWager       = Math.max(0, dayBudget - allocatedSoFar - reserve);

  useEffect(() => { saveStats(stats); }, [stats]);
  useEffect(() => {
    if (phase === PHASES.QUESTION) setTimeout(() => inputRef.current?.focus(), 400);
  }, [phase]);

  const dismissOnboarding = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setShowOnboarding(false);
  };

  // ─── Game actions ─────────────────────────────────────────────────────────
  const handleWager = () => {
    const w = parseInt(wager, 10);
    if (isNaN(w) || w < 1 || w > maxWager) return;
    const next = [...wagers];
    next[questionIndex] = w;
    setWagers(next);
    setWager("");
    setPhase(PHASES.QUESTION);
  };

  const commitFinalResult = (finalResults, finalTimedOuts, finalWagers) => {
    const pointsBefore = stats.dayStartPoints ?? stats.points;
    let pointsChange = 0;
    for (let i = 0; i < 3; i++) {
      const w = finalWagers[i] ?? 0;
      pointsChange += finalResults[i] ? w : -w;
    }
    const pointsAfter = Math.max(0, pointsBefore + pointsChange);
    setFinalPoints(pointsAfter);

    setStats(prev => ({
      ...prev,
      points: pointsAfter,
      streak: prev.streak + 1,
      totalCorrect: prev.totalCorrect + finalResults.filter(Boolean).length,
      totalPlayed: prev.totalPlayed + 3,
      lastPlayedDate: todayStr(),
      lastPlayedDay: gameData.day,
      dayStartPoints: null,
      dayStartedDay: null,
      history: [...prev.history, {
        day: gameData.day,
        date: todayStr(),
        questions: finalResults.map((correct, i) => ({
          correct,
          timedOut: finalTimedOuts[i],
          wager: finalWagers[i] ?? 0,
        })),
        pointsBefore,
        pointsAfter,
      }],
    }));
  };

  const checkAnswer = async (isTimeout = false) => {
    if (!answer.trim() && !isTimeout) return;
    setChecking(true);

    const lockedWager = wagers[questionIndex];

    const finalize = (correct, timedOut, method) => {
      const newResults    = results.map((r, i) => i === questionIndex ? correct : r);
      const newTimedOuts  = timedOuts.map((t, i) => i === questionIndex ? timedOut : t);
      const newMethods    = matchMethods.map((m, i) => i === questionIndex ? method : m);
      const newAnswers    = answers.map((a, i) => i === questionIndex ? answer.trim() : a);
      const newWagers     = wagers.map((w, i) => i === questionIndex ? lockedWager : w);

      setResults(newResults);
      setTimedOuts(newTimedOuts);
      setMatchMethods(newMethods);
      setAnswers(newAnswers);

      if (questionIndex === 2) {
        commitFinalResult(newResults, newTimedOuts, newWagers);
        setPhase(PHASES.RESULT);
      } else {
        setPhase(PHASES.INTER_RESULT);
      }
    };

    if (isTimeout) {
      finalize(false, true, null);
      setChecking(false);
      return;
    }

    try {
      const q = gameData.questions[questionIndex];
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAnswer: answer.trim(),
          correctAnswer: q.answer,
          alternateAnswers: q.alternateAnswers,
          question: q.question,
          category: q.category,
        }),
      });
      const data = await res.json();
      finalize(data.correct, false, data.method);
    } catch {
      finalize(false, false, null);
    }

    setChecking(false);
  };

  const advanceToNextQuestion = () => {
    const next = questionIndex + 1;
    setQuestionIndex(next);
    setAnswer("");
    setPhase(PHASES.WAGER);
  };

  const handleShare = () => {
    const emojiFor = (i) => results[i] ? "\uD83D\uDFE9" : timedOuts[i] ? "\uD83D\uDFEA" : "\uD83D\uDFE5";
    const squares  = [0, 1, 2].map(emojiFor).join("");
    const totalWagered = wagers.reduce((sum, w) => sum + (w ?? 0), 0);
    const displayPoints = finalPoints ?? stats.points;
    const url = "https://yousureaboutthat.app";

    const text = [
      `You Sure About That? #${String(gameData.day).padStart(3, "0")}`,
      squares,
      `\uD83C\uDFB0 Total wagered: ${formatPoints(totalWagered)} pts`,
      `\uD83D\uDCB0 New total: ${formatPoints(displayPoints)} pts`,
      `\uD83D\uDD25 Streak: ${stats.streak}`,
    ].join("\n");

    if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n\n${url}`).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // ─── Main content renderer ────────────────────────────────────────────────
  const renderMain = () => {
    if (loading) {
      return (
        <div style={S.card} className="fadeIn">
          <div style={S.loadingWrap}>
            <div style={S.loadingSpinner} className="spinner" />
            <div style={S.loadingText}>Loading today&apos;s questions&hellip;</div>
          </div>
        </div>
      );
    }

    if (fetchError || !gameData) {
      return (
        <div style={S.card} className="fadeIn">
          <div style={S.errorWrap}>
            <div style={S.errorIcon}>!</div>
            <div style={S.errorTitle}>No questions today</div>
            <div style={S.errorText}>
              We couldn&apos;t load today&apos;s questions. Check back later or try refreshing.
            </div>
            <button
              style={{ ...S.mainBtn, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
              onClick={() => setRetryCount(c => c + 1)}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    const q = gameData.questions[questionIndex];

    return (
      <>
        {phase === PHASES.WAGER && (
          <WagerPhase
            {...{ wager, setWager, maxWager, handleWager }}
            category={q.category}
            questionIndex={questionIndex}
            dayBudget={dayBudget}
            allocatedSoFar={allocatedSoFar}
          />
        )}
        {phase === PHASES.QUESTION && (
          <QuestionPhase
            {...{ answer, setAnswer, checking, checkAnswer, inputRef }}
            wagerLocked={wagers[questionIndex]}
            category={q.category}
            question={q.question}
            questionIndex={questionIndex}
          />
        )}
        {phase === PHASES.INTER_RESULT && (
          <InterResultPhase
            result={results[questionIndex]}
            timedOut={timedOuts[questionIndex]}
            correctAnswer={q.answer}
            userAnswer={answers[questionIndex]}
            nextCategory={gameData.questions[questionIndex + 1]?.category}
            questionIndex={questionIndex}
            onContinue={advanceToNextQuestion}
          />
        )}
        {phase === PHASES.RESULT && (
          <ResultPhase
            results={results}
            timedOuts={timedOuts}
            wagers={wagers}
            questions={gameData.questions}
            finalPoints={finalPoints ?? stats.points}
            streak={stats.streak}
            totalCorrect={stats.totalCorrect}
            totalPlayed={stats.totalPlayed}
            handleShare={handleShare}
            copied={copied}
            alreadyPlayed={alreadyPlayed}
          />
        )}
      </>
    );
  };

  const displayPoints = (phase === PHASES.RESULT || alreadyPlayed)
    ? (finalPoints ?? stats.points)
    : (stats.dayStartPoints ?? stats.points);

  return (
    <div style={S.root}>
      <style>{css}</style>

      {showOnboarding && <RulesModal onClose={dismissOnboarding} isOnboarding />}
      {showInfo && !showOnboarding && <RulesModal onClose={() => setShowInfo(false)} />}

      <div style={S.container}>
        {/* ── Header ── */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.dayBadge}>
              {gameData ? `#${String(gameData.day).padStart(3, "0")}` : "\u2026"}
            </div>
            <h1 style={S.title}>
              <span style={S.titleYou}>You</span>
              <span style={S.titleSure}> Sure </span>
              <span style={S.titleAbout}>About</span>
              <span style={S.titleThat}> That?</span>
            </h1>
            <button style={S.infoBtn} className="infoBtn" onClick={() => setShowInfo(true)} aria-label="How to play">?</button>
          </div>
          <div style={S.pointsBar}>
            <div style={S.pointsLeft}>
              <span style={S.pointsLabel}>Your Points</span>
              <span style={S.pointsValue}>{formatPoints(displayPoints)}</span>
            </div>
            <div style={S.streakBadge}>&#x1F525; {stats.streak}</div>
          </div>
        </header>

        {/* ── Missed-day banner ── */}
        {missedDay && phase === PHASES.WAGER && questionIndex === 0 && !loading && (
          <div style={S.missedDayBanner} className="fadeIn">
            <span style={S.missedDayIcon}>&#x1F494;</span>
            <div>
              <div style={S.missedDayTitle}>Your streak is over</div>
              <div style={S.missedDayText}>Keep playing daily to build your points back up.</div>
            </div>
          </div>
        )}

        {/* ── Progress dots ── */}
        {!loading && !fetchError && gameData && phase !== PHASES.RESULT && (
          <div style={S.progressDots}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  ...S.progressDot,
                  background: i < questionIndex
                    ? (results[i] ? "var(--green)" : timedOuts[i] ? "var(--purple)" : "var(--red)")
                    : i === questionIndex
                      ? "var(--gold)"
                      : "var(--surface2)",
                  border: i === questionIndex ? "2px solid var(--gold)" : "2px solid transparent",
                }}
              />
            ))}
          </div>
        )}

        {/* ── Main card ── */}
        <main>{renderMain()}</main>

        <footer style={S.footer}>
          {alreadyPlayed
            ? "Come back tomorrow to keep your streak and points!"
            : "Daily at midnight UTC \u00b7 Don\u2019t miss a day"}
        </footer>
      </div>
    </div>
  );
}

// ─── Wager phase ──────────────────────────────────────────────────────────────
function WagerPhase({ wager, setWager, maxWager, handleWager, category, questionIndex, dayBudget, allocatedSoFar }) {
  const w     = parseInt(wager, 10);
  const valid = !isNaN(w) && w >= 1 && w <= maxWager;
  const pct   = valid ? Math.min(100, maxWager > 0 ? (w / maxWager) * 100 : 0) : 0;
  const remaining = dayBudget - allocatedSoFar;

  const presets = [
    { label: "Safe",   val: Math.floor(maxWager * 0.1) },
    { label: "Half",   val: Math.floor(maxWager * 0.5) },
    { label: "All In", val: maxWager },
  ];
  return (
    <div style={S.card} className="fadeIn">
      <div style={S.phaseTag}>QUESTION {questionIndex + 1} OF 3 &nbsp;·&nbsp; PLACE YOUR WAGER</div>
      <div style={S.categoryReveal}>
        <div style={S.categoryLabel}>Category {questionIndex + 1}</div>
        <div style={S.categoryName} className="popIn">{category}</div>
      </div>

      {questionIndex > 0 && (
        <div style={S.budgetRow}>
          <span style={S.budgetLabel}>Budget remaining</span>
          <span style={S.budgetValue}>{formatPoints(remaining)} pts</span>
        </div>
      )}

      <div style={S.wagerSection}>
        <div style={S.wagerRow}>
          <div style={S.wagerInputWrap}>
            <span style={S.wagerCurrency}>&#9733;</span>
            <input type="number" min={1} max={maxWager} value={wager}
              onChange={e => setWager(e.target.value)} placeholder="1" style={S.wagerInput}
              onKeyDown={e => e.key === "Enter" && valid && handleWager()} />
          </div>
        </div>
        <div style={S.sliderWrap}>
          <div style={S.sliderTrack}><div style={{ ...S.sliderFill, width: `${pct}%` }} /></div>
          <div style={S.sliderLabels}><span>0</span><span>{formatPoints(maxWager)}</span></div>
        </div>
        <div style={S.presets}>
          {presets.map(p => (
            <button key={p.label} style={S.presetBtn} className="presetBtn" onClick={() => setWager(String(p.val))}>
              {p.label}<span style={S.presetVal}>{formatPoints(p.val)}</span>
            </button>
          ))}
        </div>
        <button style={{ ...S.mainBtn, opacity: valid ? 1 : 0.4, cursor: valid ? "pointer" : "not-allowed" }}
          className={valid ? "mainBtn" : ""} onClick={handleWager} disabled={!valid}>
          Lock It In &#x2192;
        </button>
      </div>
    </div>
  );
}

// ─── Question phase ───────────────────────────────────────────────────────────
function QuestionPhase({ category, question, answer, setAnswer, checking, checkAnswer, wagerLocked, inputRef, questionIndex }) {
  const [timeLeft, setTimeLeft]     = useState(TIMER_SECONDS);
  const [checkStage, setCheckStage] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (checking) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); checkAnswer(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [checking]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!checking) { setCheckStage(0); return; }
    let i = 0;
    const t = setInterval(() => { i++; setCheckStage(Math.min(i, 3)); }, 400);
    return () => clearInterval(t);
  }, [checking]);

  const stages    = ["Checking", "Normalizing", "Analyzing", "AI verifying"];
  const pct       = (timeLeft / TIMER_SECONDS) * 100;
  const isUrgent  = timeLeft <= 10;
  const timerColor = timeLeft > 10 ? "var(--gold)" : timeLeft > 5 ? "#ff9500" : "var(--red)";

  return (
    <div style={S.card} className="fadeIn">
      <div style={S.phaseTag}>QUESTION {questionIndex + 1} OF 3 &nbsp;·&nbsp; ANSWER THE QUESTION</div>
      <div style={S.wagerDisplay}>Wagered <strong>{formatPoints(wagerLocked)} pts</strong></div>

      <div style={S.timerWrap}>
        <div style={S.timerRow}>
          <span style={{ ...S.timerCount, color: timerColor }} className={isUrgent ? "timerUrgent" : ""}>{timeLeft}</span>
          <span style={S.timerLabel}>seconds</span>
        </div>
        <div style={S.timerTrack}>
          <div style={{ ...S.timerFill, width: `${pct}%`, background: timerColor, transition: "width 1s linear, background 0.3s ease" }} />
        </div>
      </div>

      <div style={S.questionBox}>
        <div style={S.questionCategory}>{category}</div>
        <p style={S.questionText}>{question}</p>
      </div>

      <div style={S.answerSection}>
        <input ref={inputRef} type="text" value={answer} onChange={e => setAnswer(e.target.value)}
          placeholder="Your answer..." disabled={checking}
          style={{ ...S.answerInput, borderColor: isUrgent ? timerColor : "var(--border)", transition: "border-color 0.3s ease" }}
          onKeyDown={e => e.key === "Enter" && !checking && answer.trim() && checkAnswer(false)} />
        <button style={{ ...S.mainBtn, opacity: answer.trim() && !checking ? 1 : 0.4 }}
          className={answer.trim() && !checking ? "mainBtn" : ""} onClick={() => checkAnswer(false)} disabled={!answer.trim() || checking}>
          {checking
            ? <span className="checking">{stages[checkStage]}<span className="dots">...</span></span>
            : "Submit Answer \u2192"}
        </button>
      </div>
    </div>
  );
}

// ─── Inter-result popup ───────────────────────────────────────────────────────
function InterResultPhase({ result, timedOut, correctAnswer, userAnswer, nextCategory, questionIndex, onContinue }) {
  const bannerBg    = result ? "var(--green)" : timedOut ? "var(--purple)" : "var(--red)";
  const bannerIcon  = result ? "\u2713" : timedOut ? "\u23F1" : "\u2717";
  const bannerLabel = result ? "CORRECT!" : timedOut ? "TIME'S UP!" : "INCORRECT";

  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modal, gap: 16 }} className="modalIn">
        <div style={S.interPhaseTag}>QUESTION {questionIndex + 1} RESULT</div>

        <div style={{ ...S.resultBanner, background: bannerBg }} className="popIn">
          <span style={S.resultEmoji}>{bannerIcon}</span>
          <span style={S.resultLabel}>{bannerLabel}</span>
        </div>

        {!result && (
          <div style={{
            ...S.correctAnswerBox,
            background: timedOut ? "rgba(139,92,246,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${timedOut ? "rgba(139,92,246,0.25)" : "rgba(239,68,68,0.2)"}`,
          }}>
            {timedOut && <span style={{ ...S.correctAnswerLabel, color: "var(--purple)" }}>YOU RAN OUT OF TIME</span>}
            <span style={S.correctAnswerLabel}>Correct Answer:</span>
            <span style={S.correctAnswerText}>{correctAnswer}</span>
            {!timedOut && userAnswer && <span style={S.yourAnswerText}>You said: <em>{userAnswer}</em></span>}
          </div>
        )}

        <div style={S.nextCategoryPreview}>
          <div style={S.nextCategoryLabel}>Up next — Category {questionIndex + 2}</div>
          <div style={S.nextCategoryName} className="popIn">{nextCategory}</div>
        </div>

        <button style={{ ...S.mainBtn, background: "var(--gold)" }} className="mainBtn" onClick={onContinue}>
          Place Your Wager &#x2192;
        </button>
      </div>
    </div>
  );
}

// ─── Result phase ─────────────────────────────────────────────────────────────
function ResultPhase({ results, timedOuts, wagers, questions, finalPoints, streak, totalCorrect, totalPlayed, handleShare, copied, alreadyPlayed }) {
  const totalWagered = wagers.reduce((sum, w) => sum + (w ?? 0), 0);
  const correctCount = results.filter(Boolean).length;

  const bannerBg    = correctCount === 3 ? "var(--green)" : correctCount === 0 ? "var(--red)" : "var(--gold)";
  const bannerLabel = correctCount === 3 ? "PERFECT DAY!" : correctCount === 0 ? "TOUGH ONE" : `${correctCount} OF 3 CORRECT`;
  const bannerIcon  = correctCount === 3 ? "\u2713" : correctCount === 0 ? "\u2717" : "\u25D0";


  return (
    <div style={S.card} className="fadeIn">
      {/* Overall banner */}
      <div style={{ ...S.resultBanner, background: bannerBg }} className="popIn">
        <span style={S.resultEmoji}>{bannerIcon}</span>
        <span style={S.resultLabel}>{bannerLabel}</span>
      </div>

      {/* Per-question breakdown */}
      <div style={S.questionBreakdown}>
        {questions.map((q, i) => {
          const correct  = results[i];
          const timeout  = timedOuts[i];
          const accent   = correct ? "var(--green)" : timeout ? "var(--purple)" : "var(--red)";
          const icon     = correct ? "\u2713" : timeout ? "\u23F1" : "\u2717";
          return (
            <div key={i} style={{ ...S.breakdownRow, borderLeft: `3px solid ${accent}` }}>
              <div style={{ ...S.breakdownIcon, color: accent }}>{icon}</div>
              <div style={S.breakdownContent}>
                <div style={S.breakdownCategory}>{q.category}</div>
                <div style={S.breakdownAnswer}>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>Answer: </span>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>{q.answer}</span>
                </div>
              </div>
              <div style={{ ...S.breakdownWager, color: correct ? "var(--green)" : "var(--red)" }}>
                {correct ? "+" : "-"}{formatPoints(wagers[i] ?? 0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div style={S.statsGrid}>
        <Stat label="Total Wagered"  value={`${formatPoints(totalWagered)} pts`} />
        <Stat label="Questions Right" value={`${correctCount} / 3`} />
        <Stat label="New Total"      value={`${formatPoints(finalPoints)} pts`} big />
        <Stat label="Streak"         value={`${streak} days \uD83D\uDD25`} />
        <Stat label="Accuracy"       value={totalPlayed ? `${Math.round((totalCorrect / totalPlayed) * 100)}%` : "\u2014"} />
      </div>

      <div style={S.streakMessage}>Come back tomorrow to keep your streak and points!</div>

      <button style={{ ...S.mainBtn, background: "var(--gold)" }} className="mainBtn" onClick={handleShare}>
        {copied ? "\u2713 Copied to clipboard!" : "Share Result"}
      </button>

      {alreadyPlayed && (
        <div style={S.alreadyPlayedNotice}>
          You&apos;ve already played today. Come back tomorrow!
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, big }) {
  return (
    <div style={{ ...S.statCard, ...(big ? S.statCardBig : {}) }}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, ...(accent ? { color: accent } : {}), ...(big ? S.statValueBig : {}) }}>{value}</div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
  :root {
    --bg:#0d0d0f; --surface:#16161a; --surface2:#1e1e24;
    --border:rgba(255,255,255,0.07); --gold:#f5c518; --gold2:#ffdd6e;
    --green:#22c55e; --red:#ef4444; --purple:#8b5cf6;
    --text:#f0ede8; --muted:rgba(240,237,232,0.45);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);font-family:'DM Sans',sans-serif;}
  .fadeIn{animation:fadeIn 0.4s ease forwards;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .popIn{animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;}
  @keyframes popIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
  .modalIn{animation:modalIn 0.3s cubic-bezier(0.34,1.3,0.64,1) forwards;}
  @keyframes modalIn{from{opacity:0;transform:translateY(30px) scale(0.97)}to{opacity:1;transform:none}}
  .timerUrgent{animation:pulse 0.6s ease-in-out infinite;}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
  .mainBtn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(245,197,24,0.35)!important;}
  .mainBtn:active{transform:translateY(0);}
  .infoBtn:hover{background:var(--surface2)!important;border-color:var(--gold)!important;color:var(--gold)!important;}
  .presetBtn:hover{background:var(--surface2)!important;border-color:var(--gold)!important;color:var(--gold)!important;}
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
  input[type=number]{-moz-appearance:textfield;}
  .checking{display:inline-flex;align-items:center;gap:2px;}
  .dots{display:inline-block;animation:dots 1s infinite;}
  @keyframes dots{0%,100%{opacity:0.3}50%{opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .spinner{animation:spin 0.8s linear infinite;}
`;

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root:       { minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"24px 16px 48px", color:"var(--text)" },
  container:  { width:"100%", maxWidth:480, display:"flex", flexDirection:"column", gap:16 },

  header:     { display:"flex", flexDirection:"column", gap:8 },
  headerInner:{ display:"flex", alignItems:"center", justifyContent:"space-between" },
  title:      { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:"0.02em", lineHeight:1 },
  titleYou:   { color:"var(--text)" },
  titleSure:  { color:"var(--gold)" },
  titleAbout: { color:"var(--text)" },
  titleThat:  { color:"var(--gold2)" },
  dayBadge:   { fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:600, color:"var(--muted)", letterSpacing:"0.08em", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:"3px 8px" },
  infoBtn:    { width:32, height:32, borderRadius:"50%", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--muted)", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s ease", display:"flex", alignItems:"center", justifyContent:"center" },
  pointsBar:  { display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 16px" },
  pointsLeft: { display:"flex", flexDirection:"column", gap:2 },
  pointsLabel:{ fontSize:11, fontWeight:600, color:"var(--muted)", letterSpacing:"0.08em", textTransform:"uppercase" },
  pointsValue:{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"var(--gold)", letterSpacing:"0.03em" },
  streakBadge:{ fontSize:13, fontWeight:600, color:"#ff9500", background:"rgba(255,149,0,0.12)", border:"1px solid rgba(255,149,0,0.25)", borderRadius:8, padding:"4px 12px" },

  progressDots:{ display:"flex", justifyContent:"center", gap:10 },
  progressDot: { width:12, height:12, borderRadius:"50%", transition:"background 0.3s ease" },

  missedDayBanner:{ display:"flex", alignItems:"flex-start", gap:12, background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.25)", borderRadius:12, padding:"14px 16px" },
  missedDayIcon:  { fontSize:22, lineHeight:1.2, flexShrink:0 },
  missedDayTitle: { fontSize:13, fontWeight:700, color:"var(--purple)", marginBottom:3 },
  missedDayText:  { fontSize:12, color:"var(--muted)", lineHeight:1.5 },

  card:       { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:"24px 20px", display:"flex", flexDirection:"column", gap:20 },
  phaseTag:   { fontSize:10, fontWeight:700, letterSpacing:"0.15em", color:"var(--gold)", textTransform:"uppercase" },

  loadingWrap:{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"40px 0" },
  loadingSpinner:{ width:32, height:32, borderRadius:"50%", border:"3px solid var(--border)", borderTopColor:"var(--gold)" },
  loadingText:{ fontSize:14, color:"var(--muted)" },

  errorWrap:  { display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"32px 0", textAlign:"center" },
  errorIcon:  { width:48, height:48, borderRadius:"50%", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, color:"var(--red)" },
  errorTitle: { fontSize:16, fontWeight:700, color:"var(--text)" },
  errorText:  { fontSize:13, color:"var(--muted)", lineHeight:1.6, maxWidth:280 },

  categoryReveal:{ textAlign:"center", padding:"8px 0" },
  categoryLabel: { fontSize:11, color:"var(--muted)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 },
  categoryName:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:60, color:"var(--gold)", lineHeight:1, letterSpacing:"0.04em", textShadow:"0 0 40px rgba(245,197,24,0.4)" },
  budgetRow:     { display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--surface2)", borderRadius:8, padding:"8px 14px" },
  budgetLabel:   { fontSize:11, fontWeight:600, color:"var(--muted)", letterSpacing:"0.08em", textTransform:"uppercase" },
  budgetValue:   { fontSize:13, fontWeight:700, color:"var(--text)" },
  wagerSection:  { display:"flex", flexDirection:"column", gap:14 },
  wagerRow:      { display:"flex", justifyContent:"center" },
  wagerInputWrap:{ display:"flex", alignItems:"center", gap:8, background:"var(--surface2)", border:"2px solid var(--gold)", borderRadius:12, padding:"8px 16px", width:"100%", maxWidth:260 },
  wagerCurrency: { color:"var(--gold)", fontSize:18, fontWeight:700, userSelect:"none" },
  wagerInput:    { background:"transparent", border:"none", outline:"none", color:"var(--text)", fontSize:28, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.04em", width:"100%", textAlign:"center" },
  sliderWrap:    { display:"flex", flexDirection:"column", gap:4 },
  sliderTrack:   { height:4, background:"var(--surface2)", borderRadius:99, overflow:"hidden" },
  sliderFill:    { height:"100%", background:"var(--gold)", borderRadius:99, transition:"width 0.2s ease" },
  sliderLabels:  { display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted)", letterSpacing:"0.06em" },
  presets:       { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 },
  presetBtn:     { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text)", padding:"8px 6px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontSize:11, fontWeight:600, fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s ease", letterSpacing:"0.04em" },
  presetVal:     { fontSize:10, color:"var(--muted)", fontWeight:400 },
  mainBtn:       { background:"var(--gold)", color:"#0d0d0f", border:"none", borderRadius:12, padding:"14px 20px", fontSize:14, fontWeight:700, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", letterSpacing:"0.04em", transition:"all 0.2s ease", width:"100%" },

  wagerDisplay: { textAlign:"center", fontSize:13, color:"var(--muted)", background:"var(--surface2)", borderRadius:8, padding:"8px 12px" },
  timerWrap:   { display:"flex", flexDirection:"column", gap:6 },
  timerRow:    { display:"flex", alignItems:"baseline", gap:6 },
  timerCount:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:40, lineHeight:1, letterSpacing:"0.02em", display:"inline-block" },
  timerLabel:  { fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600 },
  timerTrack:  { height:5, background:"var(--surface2)", borderRadius:99, overflow:"hidden" },
  timerFill:   { height:"100%", borderRadius:99 },
  questionBox: { background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12, padding:20, display:"flex", flexDirection:"column", gap:12 },
  questionCategory:{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"var(--gold)", letterSpacing:"0.08em" },
  questionText:    { fontSize:15, lineHeight:1.6, color:"var(--text)" },
  answerSection:   { display:"flex", flexDirection:"column", gap:12 },
  answerInput:     { background:"var(--surface2)", border:"2px solid var(--border)", borderRadius:12, color:"var(--text)", padding:"12px 16px", fontSize:16, fontFamily:"'DM Sans',sans-serif", outline:"none", width:"100%" },

  interPhaseTag:       { fontSize:10, fontWeight:700, letterSpacing:"0.15em", color:"var(--muted)", textTransform:"uppercase" },
  nextCategoryPreview: { textAlign:"center", padding:"4px 0" },
  nextCategoryLabel:   { fontSize:11, color:"var(--muted)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 },
  nextCategoryName:    { fontFamily:"'Bebas Neue',sans-serif", fontSize:48, color:"var(--gold)", lineHeight:1, letterSpacing:"0.04em", textShadow:"0 0 30px rgba(245,197,24,0.4)" },

  resultBanner:    { borderRadius:12, padding:"16px 20px", display:"flex", alignItems:"center", gap:12 },
  resultEmoji:     { fontSize:28, fontWeight:700, color:"#fff" },
  resultLabel:     { fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:"#fff", letterSpacing:"0.08em" },

  correctAnswerBox:  { borderRadius:10, padding:"12px 16px", display:"flex", flexDirection:"column", gap:4 },
  correctAnswerLabel:{ fontSize:10, color:"var(--red)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700 },
  correctAnswerText: { fontSize:16, fontWeight:600, color:"var(--text)" },
  yourAnswerText:    { fontSize:12, color:"var(--muted)" },

  questionBreakdown: { display:"flex", flexDirection:"column", gap:8 },
  breakdownRow:      { display:"flex", alignItems:"center", gap:12, background:"var(--surface2)", borderRadius:10, padding:"10px 14px" },
  breakdownIcon:     { fontSize:16, fontWeight:700, width:20, textAlign:"center", flexShrink:0 },
  breakdownContent:  { flex:1, display:"flex", flexDirection:"column", gap:2 },
  breakdownCategory: { fontSize:11, fontWeight:700, color:"var(--muted)", letterSpacing:"0.08em", textTransform:"uppercase" },
  breakdownAnswer:   { fontSize:13 },
  breakdownWager:    { fontSize:13, fontWeight:700, flexShrink:0 },

  statsGrid:      { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  statCard:       { background:"var(--surface2)", borderRadius:10, padding:"12px 14px", display:"flex", flexDirection:"column", gap:4 },
  statCardBig:    { gridColumn:"span 2", background:"rgba(245,197,24,0.06)", border:"1px solid rgba(245,197,24,0.2)" },
  statLabel:      { fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600 },
  statValue:      { fontSize:16, fontWeight:600, color:"var(--text)" },
  statValueBig:   { fontSize:28, fontFamily:"'Bebas Neue',sans-serif", color:"var(--gold)", letterSpacing:"0.04em" },
  streakMessage:  { textAlign:"center", fontSize:13, lineHeight:1.6, color:"var(--muted)", fontStyle:"italic", borderTop:"1px solid var(--border)", paddingTop:16 },
  alreadyPlayedNotice:{ textAlign:"center", fontSize:12, color:"var(--muted)", background:"var(--surface2)", borderRadius:8, padding:"10px 14px", lineHeight:1.5 },

  modalOverlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 },
  modal:        { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"20px 20px 0 0", padding:"28px 24px 36px", width:"100%", maxWidth:480, display:"flex", flexDirection:"column", gap:20, maxHeight:"90vh", overflowY:"auto" },
  modalHeader:  { display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
  modalEyebrow: { fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--gold)", marginBottom:4 },
  modalTitle:   { fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:"var(--text)", letterSpacing:"0.02em", lineHeight:1 },
  modalClose:   { background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:"50%", width:32, height:32, cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif", flexShrink:0, transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center" },
  modalRules:   { display:"flex", flexDirection:"column", gap:16 },
  ruleRow:      { display:"flex", gap:14, alignItems:"flex-start" },
  ruleIcon:     { width:36, height:36, borderRadius:10, background:"rgba(245,197,24,0.12)", border:"1px solid rgba(245,197,24,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 },
  ruleHeading:  { fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:3 },
  ruleBody:     { fontSize:12, color:"var(--muted)", lineHeight:1.6 },
  modalNote:    { fontSize:12, color:"var(--muted)", background:"var(--surface2)", borderRadius:8, padding:"10px 14px", lineHeight:1.5, textAlign:"center" },

  footer: { textAlign:"center", fontSize:11, color:"var(--muted)", letterSpacing:"0.05em" },
};
