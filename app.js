(() => {
  const PREPARE_SECONDS = 5;

  const els = {
    setup: document.getElementById("setup"),
    session: document.getElementById("session"),
    done: document.getElementById("done"),
    form: document.getElementById("config-form"),
    summary: document.getElementById("summary"),
    work: document.getElementById("work"),
    rest: document.getElementById("rest"),
    reps: document.getElementById("reps"),
    sets: document.getElementById("sets"),
    setRest: document.getElementById("set-rest"),
    phaseLabel: document.getElementById("phase-label"),
    clock: document.getElementById("clock"),
    progressBar: document.getElementById("progress-bar"),
    sessionMeta: document.getElementById("session-meta"),
    btnToggle: document.getElementById("btn-toggle"),
    btnSkip: document.getElementById("btn-skip"),
    btnEnd: document.getElementById("btn-end"),
    btnAgain: document.getElementById("btn-again"),
    btnEdit: document.getElementById("btn-edit"),
    doneCopy: document.getElementById("done-copy"),
  };

  /** @type {{ work: number, rest: number, reps: number, sets: number, setRest: number } | null} */
  let config = null;
  /** @type {{ kind: string, label: string, seconds: number, rep: number, set: number }[]} */
  let timeline = [];
  let stepIndex = 0;
  let remainingMs = 0;
  let stepTotalMs = 0;
  let running = false;
  let rafId = 0;
  let lastTs = 0;
  /** @type {AudioContext | null} */
  let audioCtx = null;

  function readConfig() {
    return {
      work: clampInt(els.work.value, 1, 600),
      rest: clampInt(els.rest.value, 0, 600),
      reps: clampInt(els.reps.value, 1, 99),
      sets: clampInt(els.sets.value, 1, 20),
      setRest: clampInt(els.setRest.value, 0, 900),
    };
  }

  function clampInt(value, min, max) {
    const n = Number.parseInt(String(value), 10);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function formatDuration(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    if (seconds === 0) return `${minutes}m`;
    return `${minutes}m ${seconds}s`;
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function estimateTotalSeconds(cfg) {
    const perSet = cfg.reps * cfg.work + Math.max(0, cfg.reps - 1) * cfg.rest;
    const between = Math.max(0, cfg.sets - 1) * cfg.setRest;
    return PREPARE_SECONDS + cfg.sets * perSet + between;
  }

  function updateSummary() {
    const cfg = readConfig();
    const total = estimateTotalSeconds(cfg);
    const setRestNote =
      cfg.sets > 1 ? ` · ${formatDuration(cfg.setRest)} between sets` : "";
    els.summary.textContent = `${cfg.sets} set${cfg.sets === 1 ? "" : "s"} · ${cfg.reps} reps · ~${formatDuration(total)}${setRestNote}`;
  }

  function buildTimeline(cfg) {
    /** @type {{ kind: string, label: string, seconds: number, rep: number, set: number }[]} */
    const steps = [
      {
        kind: "ready",
        label: "Get ready",
        seconds: PREPARE_SECONDS,
        rep: 1,
        set: 1,
      },
    ];

    for (let set = 1; set <= cfg.sets; set += 1) {
      for (let rep = 1; rep <= cfg.reps; rep += 1) {
        steps.push({
          kind: "work",
          label: "Work",
          seconds: cfg.work,
          rep,
          set,
        });
        const isLastRep = rep === cfg.reps;
        const isLastSet = set === cfg.sets;
        if (!isLastRep && cfg.rest > 0) {
          steps.push({
            kind: "rest",
            label: "Rest",
            seconds: cfg.rest,
            rep,
            set,
          });
        } else if (isLastRep && !isLastSet && cfg.setRest > 0) {
          steps.push({
            kind: "set-rest",
            label: "Set rest",
            seconds: cfg.setRest,
            rep,
            set,
          });
        }
      }
    }

    return steps;
  }

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function beep(kind) {
    const ctx = ensureAudio();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (kind === "work") {
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (kind === "rest") {
      osc.frequency.value = 523.25;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (kind === "tick") {
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.09);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.12);
      osc.frequency.setValueAtTime(783.99, now + 0.24);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.48);
    }
  }

  function showView(name) {
    els.setup.hidden = name !== "setup";
    els.session.hidden = name !== "session";
    els.done.hidden = name !== "done";
  }

  function setPhaseClass(kind) {
    els.session.classList.remove(
      "phase-ready",
      "phase-work",
      "phase-rest",
      "phase-set-rest"
    );
    els.session.classList.add(`phase-${kind}`);
  }

  function renderStep() {
    const step = timeline[stepIndex];
    if (!step) return;

    els.phaseLabel.textContent = step.label;
    els.clock.textContent = formatClock(remainingMs);
    els.sessionMeta.textContent = `Rep ${step.rep} of ${config.reps} · Set ${step.set} of ${config.sets}`;
    setPhaseClass(step.kind);

    const ratio = stepTotalMs === 0 ? 0 : remainingMs / stepTotalMs;
    els.progressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  }

  function enterStep(index, { silent = false } = {}) {
    stepIndex = index;
    const step = timeline[stepIndex];
    if (!step) {
      finishSession();
      return;
    }

    stepTotalMs = step.seconds * 1000;
    remainingMs = stepTotalMs;
    renderStep();

    if (!silent) {
      if (step.kind === "work") beep("work");
      else if (step.kind === "rest" || step.kind === "set-rest") beep("rest");
      else beep("tick");
    }
  }

  function finishSession() {
    stopLoop();
    running = false;
    els.session.classList.remove("is-paused");
    els.doneCopy.textContent = config
      ? `You crushed ${config.sets} set${config.sets === 1 ? "" : "s"} · ${config.reps} reps · ${formatDuration(config.work)} work.`
      : "You finished the full block.";
    showView("done");
    beep("done");
  }

  function tick(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const delta = ts - lastTs;
    lastTs = ts;

    const prevWhole = Math.ceil(remainingMs / 1000);
    remainingMs -= delta;
    const nextWhole = Math.ceil(Math.max(0, remainingMs) / 1000);

    if (nextWhole > 0 && nextWhole < prevWhole && nextWhole <= 3) {
      beep("tick");
    }

    if (remainingMs <= 0) {
      enterStep(stepIndex + 1);
    } else {
      renderStep();
    }

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    stopLoop();
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    lastTs = 0;
  }

  function startSession(cfg) {
    config = cfg;
    timeline = buildTimeline(cfg);
    running = true;
    els.btnToggle.textContent = "Pause";
    els.session.classList.remove("is-paused");
    showView("session");
    enterStep(0);
    startLoop();
  }

  function togglePause() {
    if (!timeline.length) return;
    running = !running;
    els.session.classList.toggle("is-paused", !running);
    els.btnToggle.textContent = running ? "Pause" : "Resume";
    if (running) {
      ensureAudio();
      startLoop();
    } else {
      stopLoop();
    }
  }

  function skipStep() {
    if (!timeline.length) return;
    ensureAudio();
    enterStep(stepIndex + 1);
    if (running) {
      lastTs = 0;
    }
  }

  function endSession() {
    stopLoop();
    running = false;
    timeline = [];
    els.session.classList.remove("is-paused");
    showView("setup");
    updateSummary();
  }

  function restartSame() {
    if (!config) return;
    ensureAudio();
    startSession(config);
  }

  els.form.addEventListener("input", updateSummary);
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const cfg = readConfig();
    els.work.value = String(cfg.work);
    els.rest.value = String(cfg.rest);
    els.reps.value = String(cfg.reps);
    els.sets.value = String(cfg.sets);
    els.setRest.value = String(cfg.setRest);
    ensureAudio();
    startSession(cfg);
  });

  els.btnToggle.addEventListener("click", togglePause);
  els.btnSkip.addEventListener("click", skipStep);
  els.btnEnd.addEventListener("click", endSession);
  els.btnAgain.addEventListener("click", restartSame);
  els.btnEdit.addEventListener("click", endSession);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) {
      togglePause();
    }
  });

  updateSummary();
})();
