"use client";

import { useState, useEffect, useRef } from "react";
import questions from "./questions.json";

// Dates that have questions — used to avoid breaking streaks on question-less days
const questionDates = new Set(questions.map((q) => q.date));

// Returns the number of days with questions that were skipped between lastPlayedDate and today
function missedQuestionDays(lastPlayedDate) {
  const today = new Date(todayStr());
  const last  = new Date(lastPlayedDate);
  let count = 0;
  for (let d = new Date(last); d < today; d.setDate(d.getDate() + 1)) {
    const s = d.toISOString().slice(0, 10);
    if (s !== lastPlayedDate && questionDates.has(s)) count++;
  }
  return count;
}

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
    saved = { ...saved, schemaVersion: 2, dayStartPoints: null, dayStartedDay: null };
  }
  return saved;
};

const loadStats = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    let saved = migrateStats(JSON.parse(raw));
    if (saved.lastPlayedDate) {
      const daysDiff = Math.round((new Date(todayStr()) - new Date(saved.lastPlayedDate)) / 86400000);
      if (daysDiff > 1 && missedQuestionDays(saved.lastPlayedDate) > 0) return { ...saved, points: 0, streak: 0, dayStartPoints: null, dayStartedDay: null };
    }
    return saved;
  } catch { return defaultStats(); }
};

const saveStats = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, schemaVersion: SCHEMA_VERSION })); } catch {} };

// ─── Rules content ────────────────────────────────────────────────────────────
const RULES = [
  { icon: "★", heading: "Three questions a day", body: "Each day has three trivia questions across three different categories. You see one category at a time — the next is only revealed after you submit your answer." },
  { icon: "$", heading: "Wager your balance", body: "Before each question you place a wager from your previous day's total. You can't bet today's winnings — only the balance you carried in. You must keep at least $1 in reserve for each remaining question." },
  { icon: "?", heading: "Answer the question", body: "A trivia clue is revealed. You have 30 seconds to type your answer. Alternate spellings and last-name-only answers are accepted." },
  { icon: "✓", heading: "Win or lose", body: "Correct: wagered points are added. Incorrect or time's up: wagered points are deducted. You can never go below zero." },
  { icon: "🔥", heading: "Keep your streak", body: "Complete all three questions each day to keep your streak alive. Miss a day entirely and your streak resets to zero." },
];

// ─── Wordmark ─────────────────────────────────────────────────────────────────
function Wordmark({ size = 1 }) {
  const px = Math.round(size * 96);
  return (
    <div style={{ fontSize: px, lineHeight: 1, display: "flex", alignItems: "center", gap: "0.14em", userSelect: "none" }}>
      <span style={{ fontFamily: "var(--display-font), sans-serif", fontSize: "0.42em", letterSpacing: "0.04em", color: "var(--text)" }}>You</span>
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{ fontFamily: "var(--display-font), sans-serif", fontSize: "0.42em", letterSpacing: "0.04em", color: "var(--giants)" }}>Sure</span>
        <svg aria-hidden="true" style={{ position: "absolute", bottom: "-0.22em", left: "-4%", width: "108%", overflow: "visible", pointerEvents: "none", display: "block" }} viewBox="0 0 64 8" preserveAspectRatio="none">
          <path d="M2,6 Q16,1 32,5 Q48,9 62,3" stroke="var(--giants-2)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ fontFamily: "var(--display-font), sans-serif", fontSize: "0.42em", letterSpacing: "0.04em", color: "var(--text)" }}>About</span>
      <span style={{ fontFamily: "var(--display-font), sans-serif", fontSize: "0.42em", letterSpacing: "0.04em", color: "var(--text)" }}>That</span>
      <span style={{ fontFamily: "var(--display-font), sans-serif", fontSize: "1em", color: "var(--giants)", textShadow: "2px 2px 0 var(--giants-deep), 4px 4px 0 rgba(0,0,0,0.45)", filter: "drop-shadow(0 4px 22px var(--giants-shadow))", display: "inline-block", transform: "rotate(-2deg)", transformOrigin: "50% 80%" }}>?</span>
    </div>
  );
}

// ─── Rules modal ──────────────────────────────────────────────────────────────
function RulesModal({ onClose, isOnboarding }) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} className="modalIn" onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalEyebrow}>{isOnboarding ? "WELCOME TO" : "HOW TO PLAY"}</div>
            <Wordmark size={0.38} />
          </div>
          <button style={S.modalClose} onClick={onClose}>&#x2715;</button>
        </div>

        <div style={S.modalRules}>
          {RULES.map((r, i) => (
            <div key={i} style={S.ruleRow}>
              <div style={S.ruleIcon}>
                <span style={{ fontFamily: "var(--display-font), sans-serif", fontSize: 18, color: "var(--cream)", lineHeight: 1 }}>{r.icon}</span>
              </div>
              <div>
                <div style={S.ruleHeading}>{r.heading}</div>
                <div style={S.ruleBody}>{r.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={S.modalNote}>
          A new set of questions drops every day at midnight PST. Don&apos;t miss a day!
        </div>

        <button style={S.mainBtn} className="mainBtn" onClick={onClose}>
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
          const last = stats.history.at(-1);
          if (last?.questions) {
            setResults(last.questions.map(q => q.correct));
            setTimedOuts(last.questions.map(q => q.timedOut ?? false));
            setWagers(last.questions.map(q => q.wager));
            setFinalPoints(last.pointsAfter ?? stats.points);
          }
          setPhase(PHASES.RESULT);
        } else if (stats.dayStartedDay !== data.day) {
          setStats(prev => ({
            ...prev,
            dayStartPoints: prev.points,
            dayStartedDay: data.day,
          }));
        }

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
      const daysDiff = Math.round((new Date(todayStr()) - new Date(saved.lastPlayedDate)) / 86400000);
      return daysDiff > 1 && missedQuestionDays(saved.lastPlayedDate) > 0;
    } catch { return false; }
  })();

  // ─── Budget ────────────────────────────────────────────────────────────────
  const dayBudget      = Math.max(stats.dayStartPoints ?? stats.points, 1000);
  const allocatedSoFar = wagers.slice(0, questionIndex).reduce((sum, w) => sum + (w ?? 0), 0);
  const reserve        = Math.max(0, 2 - questionIndex);
  const maxWager       = Math.max(0, dayBudget - allocatedSoFar - reserve);

  useEffect(() => { saveStats(stats); }, [stats]);
  useEffect(() => {
    if (phase === PHASES.QUESTION) setTimeout(() => inputRef.current?.focus(), 400);
  }, [phase]);

  const dismissOnboarding = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setShowOnboarding(false);
  };

  // ─── Game actions ──────────────────────────────────────────────────────────
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
    setWager("");
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
        <div style={S.card} className="fadeUp">
          <div style={S.loadingWrap}>
            <div style={S.loadingSpinner} className="spinner" />
            <div style={S.loadingText}>Loading today&apos;s questions&hellip;</div>
          </div>
        </div>
      );
    }

    if (fetchError || !gameData) {
      return (
        <div style={S.card} className="fadeUp">
          <div style={S.errorWrap}>
            <div style={S.errorIcon}>!</div>
            <div style={S.errorTitle}>No questions today</div>
            <div style={S.errorText}>
              We couldn&apos;t load today&apos;s questions. Check back later or try refreshing.
            </div>
            <button
              style={{ ...S.mainBtn, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)", boxShadow: "none" }}
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
          <div style={S.headerTop}>
            <div style={S.dayBadge}>
              {gameData ? `\u2116\u00a0${String(gameData.day).padStart(3, "0")}` : "\u2026"}
            </div>
            <Wordmark size={0.62} />
            <button style={S.infoBtn} className="infoBtn" onClick={() => setShowInfo(true)} aria-label="How to play">?</button>
          </div>
          <div style={S.pointsBar}>
            <div style={S.pointsLeft}>
              <span style={S.pointsLabel}>YOUR POINTS</span>
              <span style={S.pointsValue}>{formatPoints(displayPoints)}</span>
            </div>
            <div style={S.streakBubble}>
              <span style={S.streakStar}>&#x2605;</span>
              <span style={S.streakNum}>{stats.streak}</span>
              <span style={S.streakWord}>day streak</span>
            </div>
          </div>
        </header>

        {/* ── Missed-day banner ── */}
        {missedDay && phase === PHASES.WAGER && questionIndex === 0 && !loading && (
          <div style={S.missedDayBanner} className="fadeUp">
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
            {[0, 1, 2].map(i => {
              const isPast    = i < questionIndex;
              const isCurrent = i === questionIndex;
              const dotBg = isPast
                ? (results[i] ? "var(--ink-green)" : timedOuts[i] ? "var(--ink-purple)" : "var(--ink-red)")
                : isCurrent ? "var(--giants)" : "var(--surface)";
              const dotBorder = isCurrent
                ? "2px solid var(--cream)"
                : isPast ? "2px solid transparent" : "1.5px dashed var(--border-strong)";
              return (
                <div
                  key={i}
                  style={{ ...S.progressDot, background: dotBg, border: dotBorder, transform: isCurrent ? "scale(1.12)" : "scale(1)" }}
                  className={isCurrent ? "dotPulse" : ""}
                >
                  <span style={{ fontFamily: "var(--display-font), sans-serif", fontSize: 14, color: isCurrent || isPast ? "var(--cream)" : "var(--muted)", lineHeight: 1 }}>{i + 1}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Main card ── */}
        <main>{renderMain()}</main>

        <footer style={S.footer}>
          {alreadyPlayed
            ? "Come back tomorrow to keep your streak and points!"
            : "Daily at midnight PST \u00b7 Don\u2019t miss a day"}
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
    { label: "Safe", val: Math.max(1, Math.floor(maxWager * 0.1)) },
    { label: "Half", val: Math.max(1, Math.floor(maxWager * 0.5)) },
    { label: "Max",  val: maxWager },
  ];

  return (
    <div style={S.card} className="fadeUp">
      <div style={S.phaseTag}>&#x2605; QUESTION {questionIndex + 1} OF 3 &mdash; PLACE YOUR WAGER &#x2605;</div>

      <div style={S.categoryReveal}>
        <div style={S.categoryLabel}>CATEGORY {questionIndex + 1}</div>
        <div style={S.categoryName} className="popIn">{category}</div>
      </div>

      {questionIndex > 0 && (
        <div style={S.budgetRow}>
          <span style={S.budgetLabel}>BUDGET REMAINING</span>
          <span style={S.budgetValue}>{formatPoints(remaining)} pts</span>
        </div>
      )}

      <div style={S.wagerSection}>
        <div style={S.wagerRow}>
          <div style={S.wagerInputWrap}>
            <span style={S.wagerCurrency}>&#x2605;</span>
            <input
              type="number" min={1} max={maxWager} value={wager}
              onChange={e => setWager(e.target.value)} placeholder="1" style={S.wagerInput}
              onKeyDown={e => e.key === "Enter" && valid && handleWager()}
            />
            <span style={S.wagerSuffix}>pts</span>
          </div>
        </div>

        <div style={S.sliderWrap}>
          <div style={S.sliderTrack}>
            <div style={{ ...S.sliderFill, width: `${pct}%` }} />
          </div>
          <div style={S.sliderLabels}><span>0</span><span>{formatPoints(maxWager)}</span></div>
        </div>

        <div style={S.presets}>
          {presets.map(p => (
            <button key={p.label} style={S.presetBtn} className="presetBtn" onClick={() => setWager(String(p.val))}>
              <span style={S.presetLabel}>{p.label}</span>
              <span style={S.presetVal}>{formatPoints(p.val)}</span>
            </button>
          ))}
        </div>

        <button
          style={{ ...S.mainBtn, opacity: valid ? 1 : 0.45, cursor: valid ? "pointer" : "not-allowed" }}
          className={valid ? "mainBtn" : ""}
          onClick={handleWager}
          disabled={!valid}
        >
          Lock it in &#x2192;
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

  const stages     = ["Checking", "Normalizing", "Analyzing", "AI verifying"];
  const pct        = (timeLeft / TIMER_SECONDS) * 100;
  const isUrgent   = timeLeft <= 10;
  const timerColor = timeLeft > 10 ? "var(--giants)" : timeLeft > 5 ? "var(--ink-amber)" : "var(--ink-red)";

  return (
    <div style={S.card} className="fadeUp">
      <div style={S.phaseTag}>&#x2605; QUESTION {questionIndex + 1} OF 3 &mdash; ANSWER THE QUESTION &#x2605;</div>

      <div style={S.wagerDisplay}>
        <span style={S.wagerDisplayLabel}>YOU WAGERED</span>
        <span style={S.wagerDisplayValue}>{formatPoints(wagerLocked)} pts</span>
      </div>

      <div style={S.timerWrap}>
        <div style={S.timerRow}>
          <span style={{ ...S.timerCount, color: timerColor }} className={isUrgent ? "timerUrgent" : ""}>{timeLeft}</span>
          <span style={S.timerCaption}>seconds left!</span>
        </div>
        <div style={S.timerTrack}>
          <div style={{ ...S.timerFill, width: `${pct}%`, background: timerColor }} />
        </div>
      </div>

      <div style={S.questionBox}>
        <div style={S.questionCategory}>{category}</div>
        <p style={S.questionText}>{question}</p>
      </div>

      <div style={S.answerSection}>
        <div style={S.answerInputWrap}>
          <span style={S.answerPrefix}>A.</span>
          <input
            ref={inputRef} type="text" value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Your answer\u2026" disabled={checking}
            style={S.answerInput}
            onKeyDown={e => e.key === "Enter" && !checking && answer.trim() && checkAnswer(false)}
          />
        </div>
        <button
          style={{ ...S.mainBtn, opacity: answer.trim() && !checking ? 1 : 0.45 }}
          className={answer.trim() && !checking ? "mainBtn" : ""}
          onClick={() => checkAnswer(false)}
          disabled={!answer.trim() || checking}
        >
          {checking
            ? <span className="checking">{stages[checkStage]}<span className="dots">&#x2026;</span></span>
            : "Submit Answer \u2192"}
        </button>
      </div>
    </div>
  );
}

// ─── Inter-result popup ───────────────────────────────────────────────────────
function InterResultPhase({ result, timedOut, correctAnswer, userAnswer, nextCategory, questionIndex, onContinue }) {
  const bannerBg    = result ? "var(--ink-green)" : timedOut ? "var(--ink-purple)" : "var(--ink-red)";
  const bannerIcon  = result ? "\u2713" : timedOut ? "\u23F1" : "\u2717";
  const bannerLabel = result ? "CORRECT" : timedOut ? "TIME EXPIRED" : "INCORRECT";

  return (
    <div style={S.modalOverlay}>
      <div style={S.modal} className="modalIn">
        <div style={S.interPhaseTag}>QUESTION {questionIndex + 1} RESULT</div>

        <div style={{ ...S.resultBanner, background: bannerBg }} className="popIn">
          <span style={S.resultIcon}>{bannerIcon}</span>
          <span style={S.resultLabel}>{bannerLabel}</span>
        </div>

        {!result && (
          <div style={{ ...S.correctAnswerBox, border: `1.5px dashed ${timedOut ? "rgba(164,127,214,0.5)" : "rgba(229,78,58,0.5)"}` }}>
            <span style={S.correctAnswerEyebrow}>THE CORRECT ANSWER</span>
            <span style={S.correctAnswerText}>{correctAnswer}</span>
            {!timedOut && userAnswer && (
              <span style={S.yourAnswerText}>You said: <em>&ldquo;{userAnswer}&rdquo;</em></span>
            )}
          </div>
        )}

        {nextCategory && (
          <div style={S.nextCategoryPreview}>
            <div style={S.nextCategoryLabel}>UP NEXT &mdash; CATEGORY {questionIndex + 2}</div>
            <div style={S.nextCategoryName} className="popIn">{nextCategory}</div>
          </div>
        )}

        <button style={S.mainBtn} className="mainBtn" onClick={onContinue}>
          Place your wager &#x2192;
        </button>
      </div>
    </div>
  );
}

// ─── Result phase ─────────────────────────────────────────────────────────────
function ResultPhase({ results, timedOuts, wagers, questions, finalPoints, streak, totalCorrect, totalPlayed, handleShare, copied, alreadyPlayed }) {
  const totalWagered = wagers.reduce((sum, w) => sum + (w ?? 0), 0);
  const correctCount = results.filter(Boolean).length;

  const bannerBg    = correctCount === 3 ? "var(--ink-green)" : correctCount === 0 ? "var(--ink-red)" : "var(--giants)";
  const bannerLabel = correctCount === 3 ? "PERFECT DAY" : correctCount === 0 ? "TOUGH ROUND" : `${correctCount} OF 3 CORRECT`;
  const bannerIcon  = correctCount === 3 ? "\u2605" : correctCount === 0 ? "\u2717" : "\u25D0";

  return (
    <div style={S.card} className="fadeUp">
      <div style={S.phaseTag}>&#x2605; TODAY&apos;S RESULTS &#x2605;</div>

      <div style={{ ...S.resultBanner, background: bannerBg }} className="popIn">
        <span style={S.resultIcon}>{bannerIcon}</span>
        <span style={S.resultLabel}>{bannerLabel}</span>
      </div>

      {/* Per-question breakdown */}
      <div style={S.questionBreakdown}>
        {questions.map((q, i) => {
          const correct = results[i];
          const timeout = timedOuts[i];
          const accent  = correct ? "var(--ink-green)" : timeout ? "var(--ink-purple)" : "var(--ink-red)";
          const icon    = correct ? "\u2713" : timeout ? "\u23F1" : "\u2717";
          return (
            <div key={i} style={{ ...S.breakdownRow, borderLeft: `3px solid ${accent}` }}>
              <div style={{ ...S.breakdownIconCircle, background: accent }}>
                <span style={{ fontFamily: "var(--display-font), sans-serif", fontSize: 14, color: "#fff", lineHeight: 1 }}>{icon}</span>
              </div>
              <div style={S.breakdownContent}>
                <div style={S.breakdownCategory}>{q.category}</div>
                <div style={S.breakdownAnswer}>
                  <span style={S.breakdownAnswerLabel}>Answer: </span>
                  <span style={S.breakdownAnswerText}>{q.answer}</span>
                </div>
              </div>
              <div style={{
                ...S.breakdownWager,
                color: correct ? "var(--ink-green)" : "var(--ink-red)",
                background: correct ? "rgba(111,184,79,0.12)" : "rgba(229,78,58,0.12)",
                border: `1px solid ${correct ? "rgba(111,184,79,0.3)" : "rgba(229,78,58,0.3)"}`,
              }}>
                {correct ? "+" : "\u2212"}{formatPoints(wagers[i] ?? 0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div style={S.statsGrid}>
        <Stat label="WAGERED"   value={`${formatPoints(totalWagered)} pts`} />
        <Stat label="CORRECT"   value={`${correctCount} / 3`} />
        <Stat label="NEW TOTAL" value={`${formatPoints(finalPoints)} pts`} big />
        <Stat label="STREAK"    value={`${streak} days \uD83D\uDD25`} />
        <Stat label="ACCURACY"  value={totalPlayed ? `${Math.round((totalCorrect / totalPlayed) * 100)}%` : "\u2014"} />
      </div>

      <div style={S.streakMessage}>Come back tomorrow to keep your streak and points!</div>

      <button style={S.mainBtn} className="mainBtn" onClick={handleShare}>
        {copied ? "\u2713 Copied to clipboard!" : "Share your result \u2192"}
      </button>

      {alreadyPlayed && (
        <div style={S.alreadyPlayedNotice}>
          You&apos;ve already played today. Come back tomorrow!
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, big }) {
  return (
    <div style={{ ...S.statCard, ...(big ? S.statCardBig : {}) }}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, ...(big ? S.statValueBig : {}) }}>{value}</div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  :root {
    --giants:        #FD5A1E;
    --giants-2:      #FF8A50;
    --giants-deep:   #C73E12;
    --giants-shadow: rgba(253,90,30,0.4);
    --bg:            #0d0c0a;
    --bg-2:          #14110d;
    --surface:       #1c1813;
    --surface-2:     #25201a;
    --border:        rgba(247,231,201,0.10);
    --border-strong: rgba(247,231,201,0.18);
    --cream:         #f7e7c9;
    --cream-2:       #ebd9b6;
    --cream-deep:    #d8c195;
    --cream-ink:     #3a2a14;
    --cream-paper:   #f3e2c1;
    --text:          #f7e7c9;
    --text-dim:      rgba(247,231,201,0.62);
    --muted:         rgba(247,231,201,0.42);
    --ink-green:     #6fb84f;
    --ink-red:       #e54e3a;
    --ink-amber:     #f5a523;
    --ink-purple:    #a47fd6;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    font-family: var(--body-font), system-ui, sans-serif;
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  /* Entry animations — transform only, opacity never starts at 0 */
  .fadeUp { animation: fadeUp 0.4s ease both; }
  @keyframes fadeUp {
    from { opacity: 0.6; transform: translateY(16px); }
    to   { opacity: 1;   transform: translateY(0); }
  }
  .popIn { animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
  @keyframes popIn {
    from { opacity: 0.6; transform: scale(0.85); }
    to   { opacity: 1;   transform: scale(1); }
  }
  .modalIn { animation: modalIn 0.32s cubic-bezier(0.34,1.4,0.64,1) both; }
  @keyframes modalIn {
    from { opacity: 0.6; transform: translateY(28px) scale(0.97); }
    to   { opacity: 1;   transform: translateY(0) scale(1); }
  }

  /* Progress dot glow ring */
  .dotPulse { position: relative; }
  .dotPulse::after {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid var(--giants);
    animation: dotPulse 1.6s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes dotPulse {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50%       { opacity: 0;   transform: scale(1.7); }
  }

  /* Timer urgent shake */
  .timerUrgent { animation: timerShake 0.5s ease-in-out infinite; }
  @keyframes timerShake {
    0%, 100% { transform: rotate(0deg); }
    25%       { transform: rotate(3deg); }
    75%       { transform: rotate(-3deg); }
  }

  /* Button interactions */
  .mainBtn:hover  { transform: translateY(-1px); }
  .mainBtn:active {
    transform: translateY(5px) !important;
    box-shadow: inset 4px 4px 0 var(--giants-deep), inset -4px -4px 0 var(--giants-2), 0 1px 0 #000 !important;
  }
  .infoBtn:hover  { transform: rotate(8deg) scale(1.08); }
  .presetBtn:hover { transform: translateY(-1px); }
  .presetBtn:active {
    transform: translateY(3px) !important;
    box-shadow: inset 3px 3px 0 var(--cream-deep), inset -3px -3px 0 #fff, 0 1px 0 #000 !important;
  }

  /* Input number spinners */
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
  input[type=number] { -moz-appearance: textfield; }

  /* Checking animation */
  .checking { display: inline-flex; align-items: center; gap: 2px; }
  .dots { display: inline-block; animation: dots 1s infinite; }
  @keyframes dots { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

  /* Spinner */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { animation: spin 0.8s linear infinite; }
`;

// ─── Style helpers ────────────────────────────────────────────────────────────
const bevelOrange = {
  boxShadow: "inset -4px -4px 0 var(--giants-deep), inset 4px 4px 0 var(--giants-2), 0 6px 0 #000, 0 8px 24px rgba(253,90,30,0.25)",
};
const bevelCream = {
  boxShadow: "inset -3px -3px 0 var(--cream-deep), inset 3px 3px 0 #fff, 0 4px 0 #000",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root:      { minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px 64px", color: "var(--text)" },
  container: { width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 16 },

  header:    { display: "flex", flexDirection: "column", gap: 12 },
  headerTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },

  dayBadge:  { fontFamily: "var(--hand-font), cursive", fontSize: 18, fontWeight: 700, letterSpacing: "0.02em", color: "var(--text)", background: "var(--surface)", border: "1.5px dashed var(--border-strong)", borderRadius: 999, padding: "4px 12px", transform: "rotate(-2deg)", display: "inline-block", userSelect: "none" },
  infoBtn:   { width: 38, height: 38, borderRadius: "50%", border: "2px solid var(--cream-deep)", background: "var(--cream)", color: "var(--cream-ink)", fontSize: 22, fontFamily: "var(--display-font), sans-serif", cursor: "pointer", transition: "transform 0.15s ease", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...bevelCream },

  pointsBar:  { position: "relative", overflow: "hidden", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(180deg, var(--surface) 0%, var(--bg-2) 100%)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 18px" },
  pointsLeft: { display: "flex", flexDirection: "column", gap: 2 },
  pointsLabel:{ fontFamily: "var(--body-font), sans-serif", fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.16em", textTransform: "uppercase" },
  pointsValue:{ fontFamily: "var(--display-font), sans-serif", fontSize: 30, color: "var(--giants)", letterSpacing: "0.01em", lineHeight: 1, textShadow: "1px 1px 0 var(--giants-deep)" },

  streakBubble:{ display: "flex", alignItems: "center", gap: 4, border: "1.5px dashed var(--giants)", borderRadius: 999, padding: "6px 14px", transform: "rotate(2deg)" },
  streakStar:  { fontFamily: "var(--hand-font), cursive", fontSize: 16, fontWeight: 700, color: "var(--giants)" },
  streakNum:   { fontFamily: "var(--display-font), sans-serif", fontSize: 22, color: "var(--text)", lineHeight: 1 },
  streakWord:  { fontFamily: "var(--body-font), sans-serif", fontSize: 13, color: "var(--text-dim)", letterSpacing: "0.02em" },

  progressDots:{ display: "flex", justifyContent: "center", gap: 14 },
  progressDot: { width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s ease, transform 0.3s ease", flexShrink: 0 },

  missedDayBanner:{ display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(164,127,214,0.1)", border: "1px solid rgba(164,127,214,0.25)", borderRadius: 12, padding: "14px 16px" },
  missedDayIcon:  { fontSize: 22, lineHeight: 1.2, flexShrink: 0 },
  missedDayTitle: { fontSize: 13, fontWeight: 700, color: "var(--ink-purple)", marginBottom: 3 },
  missedDayText:  { fontSize: 12, color: "var(--muted)", lineHeight: 1.5 },

  card: { background: "linear-gradient(180deg, var(--surface) 0%, var(--bg-2) 100%)", border: "1px solid var(--border)", borderRadius: 18, padding: "24px 22px", display: "flex", flexDirection: "column", gap: 20 },

  phaseTag: { fontFamily: "var(--display-font), sans-serif", fontSize: 13, color: "var(--giants)", letterSpacing: "0.18em", textTransform: "uppercase", borderTop: "1.5px dashed rgba(253,90,30,0.4)", borderBottom: "1.5px dashed rgba(253,90,30,0.4)", padding: "6px 0", textAlign: "center", textShadow: "0 0 12px rgba(253,90,30,0.35)" },

  loadingWrap:   { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 0" },
  loadingSpinner:{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--giants)" },
  loadingText:   { fontFamily: "var(--body-font), sans-serif", fontSize: 14, color: "var(--muted)" },

  errorWrap:  { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0", textAlign: "center" },
  errorIcon:  { width: 48, height: 48, borderRadius: "50%", background: "rgba(229,78,58,0.1)", border: "1px solid rgba(229,78,58,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "var(--ink-red)" },
  errorTitle: { fontFamily: "var(--body-font), sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text)" },
  errorText:  { fontFamily: "var(--body-font), sans-serif", fontSize: 13, color: "var(--muted)", lineHeight: 1.6, maxWidth: 280 },

  categoryReveal:{ textAlign: "center", padding: "8px 0" },
  categoryLabel: { fontFamily: "var(--body-font), sans-serif", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 },
  categoryName:  { fontFamily: "var(--display-font), sans-serif", fontSize: 44, color: "var(--giants)", lineHeight: 1, letterSpacing: "0.04em", textTransform: "uppercase" },

  budgetRow:  { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1.5px dashed var(--border-strong)", borderRadius: 10, padding: "8px 14px" },
  budgetLabel:{ fontFamily: "var(--body-font), sans-serif", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.14em", textTransform: "uppercase" },
  budgetValue:{ fontFamily: "var(--display-font), sans-serif", fontSize: 20, color: "var(--giants)", letterSpacing: "0.02em" },

  wagerSection:  { display: "flex", flexDirection: "column", gap: 14 },
  wagerRow:      { display: "flex", justifyContent: "center" },
  wagerInputWrap:{ display: "flex", alignItems: "center", gap: 8, background: "var(--cream)", border: "2px solid var(--cream-2)", borderRadius: 14, padding: "10px 18px", width: "100%", maxWidth: 280, ...bevelCream },
  wagerCurrency: { fontFamily: "var(--display-font), sans-serif", color: "var(--giants-deep)", fontSize: 22, userSelect: "none", flexShrink: 0 },
  wagerInput:    { background: "transparent", border: "none", outline: "none", color: "var(--giants-deep)", fontSize: 36, fontFamily: "var(--display-font), sans-serif", letterSpacing: "0.04em", width: "100%", textAlign: "center" },
  wagerSuffix:   { fontFamily: "var(--body-font), sans-serif", fontSize: 13, color: "var(--cream-ink)", opacity: 0.5, flexShrink: 0 },

  sliderWrap:  { display: "flex", flexDirection: "column", gap: 4 },
  sliderTrack: { height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" },
  sliderFill:  { height: "100%", background: "linear-gradient(90deg, var(--giants-deep), var(--giants), var(--giants-2))", borderRadius: 99, transition: "width 0.2s ease", boxShadow: "0 0 8px rgba(253,90,30,0.4)" },
  sliderLabels:{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em" },

  presets:    { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  presetBtn:  { background: "var(--cream)", border: "2px solid var(--cream-2)", borderRadius: 10, color: "var(--cream-ink)", padding: "10px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "transform 0.1s ease, box-shadow 0.1s ease", ...bevelCream },
  presetLabel:{ fontFamily: "var(--display-font), sans-serif", fontSize: 18, color: "var(--giants-deep)", letterSpacing: "0.04em", lineHeight: 1 },
  presetVal:  { fontFamily: "var(--display-font), sans-serif", fontSize: 14, color: "var(--cream-ink)", letterSpacing: "0.02em" },

  mainBtn: { background: "var(--giants)", color: "var(--cream)", border: "none", borderRadius: 12, padding: "15px 20px", fontFamily: "var(--display-font), sans-serif", fontSize: 22, letterSpacing: "0.04em", cursor: "pointer", transition: "transform 0.1s ease, box-shadow 0.1s ease", width: "100%", ...bevelOrange },

  wagerDisplay:      { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, border: "1.5px dashed var(--border-strong)", borderRadius: 999, padding: "8px 20px", alignSelf: "center", minWidth: 160 },
  wagerDisplayLabel: { fontFamily: "var(--body-font), sans-serif", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.14em", textTransform: "uppercase" },
  wagerDisplayValue: { fontFamily: "var(--display-font), sans-serif", fontSize: 22, color: "var(--giants)", letterSpacing: "0.02em" },

  timerWrap:    { display: "flex", flexDirection: "column", gap: 6 },
  timerRow:     { display: "flex", alignItems: "baseline", gap: 8 },
  timerCount:   { fontFamily: "var(--display-font), sans-serif", fontSize: 56, lineHeight: 1, letterSpacing: "0.02em", display: "inline-block" },
  timerCaption: { fontFamily: "var(--hand-font), cursive", fontSize: 18, fontWeight: 700, color: "var(--text-dim)" },
  timerTrack:   { height: 10, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)" },
  timerFill:    { height: "100%", borderRadius: 99, transition: "width 1s linear, background 0.3s ease" },

  questionBox:     { background: "var(--cream)", border: "2px solid var(--cream-2)", borderRadius: 14, padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 10 },
  questionCategory:{ fontFamily: "var(--display-font), sans-serif", fontSize: 22, color: "var(--giants-deep)", letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1 },
  questionText:    { fontFamily: "var(--body-font), sans-serif", fontSize: 17, fontWeight: 500, lineHeight: 1.55, color: "var(--cream-ink)" },

  answerSection:  { display: "flex", flexDirection: "column", gap: 12 },
  answerInputWrap:{ display: "flex", alignItems: "center", gap: 10, background: "var(--cream)", border: "2px solid var(--cream-2)", borderRadius: 14, padding: "10px 16px", ...bevelCream },
  answerPrefix:   { fontFamily: "var(--display-font), sans-serif", fontSize: 22, color: "var(--giants-deep)", flexShrink: 0, lineHeight: 1 },
  answerInput:    { background: "transparent", border: "none", outline: "none", color: "var(--cream-ink)", fontSize: 17, fontFamily: "var(--body-font), sans-serif", width: "100%", fontStyle: "italic" },

  interPhaseTag:       { fontFamily: "var(--display-font), sans-serif", fontSize: 13, color: "var(--muted)", letterSpacing: "0.18em", textTransform: "uppercase", textAlign: "center" },
  nextCategoryPreview: { textAlign: "center", padding: "4px 0" },
  nextCategoryLabel:   { fontFamily: "var(--body-font), sans-serif", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 },
  nextCategoryName:    { fontFamily: "var(--display-font), sans-serif", fontSize: 36, color: "var(--giants)", lineHeight: 1, letterSpacing: "0.04em", textTransform: "uppercase" },

  resultBanner:{ borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "inset -3px -3px 0 rgba(0,0,0,0.2), inset 3px 3px 0 rgba(255,255,255,0.18), 0 6px 0 rgba(0,0,0,0.3)" },
  resultIcon:  { fontFamily: "var(--display-font), sans-serif", fontSize: 32, color: "#fff", lineHeight: 1 },
  resultLabel: { fontFamily: "var(--display-font), sans-serif", fontSize: 26, color: "#fff", letterSpacing: "0.06em" },

  correctAnswerBox:    { borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, background: "rgba(0,0,0,0.2)" },
  correctAnswerEyebrow:{ fontFamily: "var(--body-font), sans-serif", fontSize: 10, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" },
  correctAnswerText:   { fontFamily: "var(--body-font), sans-serif", fontSize: 20, fontWeight: 700, color: "var(--cream)", lineHeight: 1.4 },
  yourAnswerText:      { fontFamily: "var(--body-font), sans-serif", fontSize: 12, color: "var(--muted)" },

  questionBreakdown:{ display: "flex", flexDirection: "column", gap: 8 },
  breakdownRow:     { display: "flex", alignItems: "center", gap: 12, background: "var(--surface-2)", borderRadius: 10, padding: "10px 14px" },
  breakdownIconCircle:{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  breakdownContent: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  breakdownCategory:{ fontFamily: "var(--display-font), sans-serif", fontSize: 16, color: "var(--text-dim)", letterSpacing: "0.06em", textTransform: "uppercase" },
  breakdownAnswer:  { display: "flex", gap: 4, flexWrap: "wrap" },
  breakdownAnswerLabel:{ fontFamily: "var(--body-font), sans-serif", fontSize: 11, color: "var(--muted)" },
  breakdownAnswerText: { fontFamily: "var(--body-font), sans-serif", fontWeight: 600, color: "var(--text)", fontSize: 13 },
  breakdownWager:   { fontFamily: "var(--display-font), sans-serif", fontSize: 14, fontWeight: 700, flexShrink: 0, borderRadius: 6, padding: "2px 8px", letterSpacing: "0.02em" },

  statsGrid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  statCard:     { background: "var(--surface-2)", border: "1.5px dashed var(--border-strong)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 },
  statCardBig:  { gridColumn: "span 2", background: "rgba(253,90,30,0.06)", border: "1.5px dashed var(--giants)" },
  statLabel:    { fontFamily: "var(--body-font), sans-serif", fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.14em" },
  statValue:    { fontFamily: "var(--body-font), sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text)" },
  statValueBig: { fontFamily: "var(--display-font), sans-serif", fontSize: 38, color: "var(--giants)", letterSpacing: "0.02em", lineHeight: 1, textShadow: "1px 1px 0 var(--giants-deep)" },

  streakMessage:       { fontFamily: "var(--body-font), sans-serif", textAlign: "center", fontSize: 13, lineHeight: 1.6, color: "var(--muted)", borderTop: "1.5px dashed var(--border-strong)", paddingTop: 16 },
  alreadyPlayedNotice: { textAlign: "center", fontSize: 12, color: "var(--muted)", background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", lineHeight: 1.5 },

  modalOverlay:{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  modal:       { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px 20px 0 0", padding: "28px 24px 36px", width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 20, maxHeight: "90vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  modalEyebrow:{ fontFamily: "var(--body-font), sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--giants)", marginBottom: 8 },
  modalClose:  { background: "var(--surface-2)", border: "1.5px dashed var(--border-strong)", color: "var(--muted)", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 13, fontFamily: "var(--body-font), sans-serif", flexShrink: 0, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center" },
  modalRules:  { display: "flex", flexDirection: "column", gap: 16 },
  ruleRow:     { display: "flex", gap: 14, alignItems: "flex-start" },
  ruleIcon:    { width: 36, height: 36, borderRadius: 10, background: "var(--giants)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...bevelOrange },
  ruleHeading: { fontFamily: "var(--display-font), sans-serif", fontSize: 16, color: "var(--text)", marginBottom: 3, letterSpacing: "0.04em" },
  ruleBody:    { fontFamily: "var(--body-font), sans-serif", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 },
  modalNote:   { fontFamily: "var(--body-font), sans-serif", fontSize: 12, color: "var(--muted)", border: "1.5px dashed var(--giants)", borderRadius: 8, padding: "10px 14px", lineHeight: 1.5, textAlign: "center" },

  footer: { fontFamily: "var(--body-font), sans-serif", textAlign: "center", fontSize: 11, fontWeight: 500, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" },
};
