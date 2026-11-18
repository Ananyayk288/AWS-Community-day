/**
 * PROMPT QUEST — AWS Gaming & AI Prompt Engineering Challenge Client Engine
 * Matches the "Prompt Quest AWS Gaming Dashboard" Reference Design
 * Preserves 100% of Backend APIs, Evaluation, Image Synthesis & Leaderboard Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  const state = {
    participant: null,
    currentChallenge: null,
    currentReferenceUri: null,
    currentImage: null,
    currentEvaluation: null,
    generations: [],
    isComparing: false,
    isAdmin: false,
    adminToken: null,
    compState: null,
    timeRemaining: 300
  };

  // ---------------------------------------------------------------------------
  // 0. OPENING AWS LOGO ANIMATION (Precision Single-Element FLIP Transition)
  // ---------------------------------------------------------------------------
  const introStage = document.getElementById("aws-intro-stage");
  const flyingLogo = document.getElementById("aws-flying-logo");
  const navLogoSlot = document.getElementById("navbar-logo-slot");
  const replayIntroBtn = document.getElementById("replay-intro-btn");

  let introTimers = [];
  function clearIntroTimers() {
    introTimers.forEach(t => clearTimeout(t));
    introTimers = [];
  }

  function finishIntroImmediately() {
    clearIntroTimers();
    document.body.classList.remove("intro-active");
    document.body.classList.add("intro-complete");
    if (introStage) {
      introStage.classList.add("stage-hidden");
      introStage.classList.remove("is-Revealed", "is-Docking");
    }
  }

  function runOpeningLogoAnimation(forcePlay = false) {
    if (!introStage || !flyingLogo || !navLogoSlot) {
      finishIntroImmediately();
      return;
    }

    const prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion && !forcePlay) {
      finishIntroImmediately();
      return;
    }

    clearIntroTimers();

    document.body.classList.remove("intro-complete");
    document.body.classList.add("intro-active");
    introStage.classList.remove("stage-hidden", "is-Revealed", "is-Docking");

    // Base dimensions of the flying AWS logo (matches 286:176 aspect ratio)
    const baseW = Math.min(190, Math.max(140, window.innerWidth * 0.19));
    const baseH = baseW * (176 / 286);
    flyingLogo.style.width = `${baseW}px`;
    flyingLogo.style.height = `${baseH}px`;

    const startX = (window.innerWidth - baseW) / 2;
    const startY = (window.innerHeight - baseH) / 2 - 24;

    flyingLogo.style.transition = "none";
    flyingLogo.style.opacity = "0";
    flyingLogo.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(0.9)`;

    void flyingLogo.offsetWidth;

    flyingLogo.style.transition =
      "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease";
    flyingLogo.style.opacity = "1";
    flyingLogo.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(1)`;
    introStage.classList.add("is-Revealed");

    // Glide from center to exact top-left sidebar slot bounding box
    const tDock = setTimeout(() => {
      const targetRect = navLogoSlot.getBoundingClientRect();
      const targetX = targetRect.width > 0 ? targetRect.left : 28;
      const targetY = targetRect.height > 0 ? targetRect.top : 24;
      const scaleX = (targetRect.width || 78) / baseW;
      const scaleY = (targetRect.height || 48) / baseH;

      introStage.classList.add("is-Docking");
      flyingLogo.style.transition =
        "transform 0.8s cubic-bezier(0.65, 0, 0.15, 1), filter 0.8s ease";
      flyingLogo.style.filter = "drop-shadow(0 2px 8px rgba(182, 154, 255, 0.2))";
      flyingLogo.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(${scaleX}, ${scaleY})`;
    }, 800);

    // Seamless 0ms handoff
    const tComplete = setTimeout(() => {
      finishIntroImmediately();
    }, 1620);

    introTimers.push(tDock, tComplete);
  }

  runOpeningLogoAnimation(false);

  if (replayIntroBtn) {
    replayIntroBtn.addEventListener("click", () => {
      playAudioTone("click");
      runOpeningLogoAnimation(true);
    });
  }

  // ---------------------------------------------------------------------------
  // SCREENS & MOBILE SIDEBAR NAVIGATION
  // ---------------------------------------------------------------------------
  const screens = {
    identifier: document.getElementById("identifier-screen"),
    game: document.getElementById("game-screen"),
    leaderboard: document.getElementById("leaderboard-screen"),
    achievements: document.getElementById("achievements-screen"),
    profile: document.getElementById("profile-screen")
  };

  const sidebarEl = document.getElementById("pq-sidebar");
  const mobileToggleBtn = document.getElementById("mobile-sidebar-toggle");
  if (mobileToggleBtn && sidebarEl) {
    mobileToggleBtn.addEventListener("click", () => {
      sidebarEl.classList.toggle("mobile-open");
    });
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.remove("active"));
    if (screens[name]) {
      screens[name].classList.add("active");
    }

    document.querySelectorAll(".nav-route-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.screen === name);
    });

    if (sidebarEl) sidebarEl.classList.remove("mobile-open");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (name === "leaderboard" || name === "identifier") {
      loadLeaderboard();
    }
    if (name === "profile") {
      syncProfileScreen();
    }
  }

  // ---------------------------------------------------------------------------
  // SOCKET.IO & LIVE DASHBOARD METRICS
  // ---------------------------------------------------------------------------
  let socket = null;
  try {
    if (typeof io !== "undefined") {
      socket = io();
      socket.on("connect", () => {
        console.log("[Socket.IO] Connected to real-time session");
      });
      socket.on("state_update", (payload) => {
        applyLiveCompetitionState(payload);
      });
      socket.on("vote_update", () => {
        loadLeaderboard();
      });
      socket.on("new_submission", () => {
        refreshCompetitionState();
        loadLeaderboard();
      });
    }
  } catch (err) {
    console.warn("[Socket.IO] Standard REST mode active:", err);
  }

  function formatSecondsToHMS(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const hrs = String(Math.floor(s / 3600)).padStart(2, "0");
    const mins = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const secs = String(s % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  }

  function applyLiveCompetitionState(payload) {
    if (!payload) return;
    state.compState = payload;
    if (typeof payload.time_remaining === "number") {
      state.timeRemaining = payload.time_remaining;
    }

    const statusText = document.getElementById("nav-comp-status");
    const subCountEl = document.getElementById("nav-submissions-count");
    const homePhaseEl = document.getElementById("home-stat-phase");
    const homeTimerEl = document.getElementById("home-stat-timer");
    const homePlayersEl = document.getElementById("home-stat-players");
    const homePlayersLabel = document.getElementById("home-stat-players-label");

    if (statusText) {
      statusText.textContent =
        payload.status === "battle"
          ? `Round ${payload.round_number || 1} Live`
          : "Live Event";
    }
    if (subCountEl && typeof payload.submission_count === "number") {
      subCountEl.textContent = payload.submission_count;
    }
    if (homePhaseEl) {
      const st = payload.status || "lobby";
      homePhaseEl.textContent = st === "battle" ? "Battle Live" : "Live Now";
    }
    if (homeTimerEl) {
      homeTimerEl.textContent = formatSecondsToHMS(state.timeRemaining);
    }
    if (homePlayersEl && typeof payload.participant_count === "number") {
      if (payload.participant_count > 0) {
        homePlayersEl.textContent = `${payload.participant_count} Online`;
        if (homePlayersLabel) homePlayersLabel.textContent = "Builders Registered";
      }
    }
  }

  // Smooth 1-second timer tick for the Home Stat Card #4
  setInterval(() => {
    if (state.compState && state.compState.status === "battle" && state.timeRemaining > 0) {
      state.timeRemaining -= 1;
      const homeTimerEl = document.getElementById("home-stat-timer");
      if (homeTimerEl) homeTimerEl.textContent = formatSecondsToHMS(state.timeRemaining);
    }
  }, 1000);

  async function refreshCompetitionState() {
    try {
      const resp = await fetch("/api/state");
      if (resp.ok) {
        const data = await resp.json();
        applyLiveCompetitionState(data);
      }
    } catch (e) { }
  }

  // Update Home Progress Circular Ring & Profile Screen
  function updateDashboardProgressRing(scoreValue, tierTitle) {
    const pctEl = document.getElementById("home-progress-pct");
    const circleEl = document.getElementById("home-progress-circle");
    const levelEl = document.getElementById("home-progress-level");
    const badgeEl = document.getElementById("home-progress-badge-text");

    const numericScore = Math.min(100, Math.max(0, Math.round(Number(scoreValue) || 0)));
    const circumference = 289; // 2 * pi * 46
    const offset = circumference - (numericScore / 100) * circumference;

    if (pctEl) pctEl.textContent = `${numericScore}%`;
    if (circleEl) circleEl.style.strokeDashoffset = String(offset);

    if (levelEl) {
      const lvl = numericScore >= 88 ? 5 : numericScore >= 75 ? 4 : numericScore >= 60 ? 3 : numericScore > 0 ? 2 : 1;
      levelEl.textContent = `Level ${lvl}`;
    }
    if (badgeEl && tierTitle) {
      badgeEl.textContent = tierTitle.replace(/^[^\w]+/, "").trim();
    }
  }

  function syncProfileScreen() {
    const nameEl = document.getElementById("profile-display-name");
    const emailEl = document.getElementById("profile-display-email");
    const avatarEl = document.getElementById("profile-avatar-lg");
    const genEl = document.getElementById("profile-gen-count");
    const bestEl = document.getElementById("profile-best-score");
    const questEl = document.getElementById("profile-quest-name");

    if (state.participant) {
      if (nameEl) nameEl.textContent = state.participant.name;
      if (emailEl) emailEl.textContent = state.participant.email;
      if (avatarEl) avatarEl.textContent = (state.participant.name || "A").slice(0, 2).toUpperCase();
    }
    if (genEl) genEl.textContent = state.generations.length;
    if (bestEl) {
      const best = state.generations.reduce((m, g) => Math.max(m, g.evaluation?.total_score || 0), 0);
      bestEl.textContent = best.toFixed(1);
    }
    if (questEl) {
      questEl.textContent = state.currentChallenge ? state.currentChallenge.title : "Unassigned";
    }
  }

  // Subtle Web Audio Feedback
  let audioCtx = null;
  function playAudioTone(type = "click") {
    try {
      if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioClass();
      }
      if (!audioCtx) return;
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === "click") {
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "success") {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) { }
  }

  // Toast Notifications
  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // ---------------------------------------------------------------------------
  // NAVIGATION TRIGGERS
  // ---------------------------------------------------------------------------
  const navHomeBtn = document.getElementById("nav-home-btn");
  const navStudioBtn = document.getElementById("nav-studio-btn");
  const navLeaderboardBtn = document.getElementById("nav-leaderboard-btn");
  const navAchievementsBtn = document.getElementById("nav-achievements-btn");
  const navProfileBtn = document.getElementById("nav-profile-btn");
  const brandHomeTrigger = document.getElementById("brand-home-trigger");
  const heroEnterArenaBtn = document.getElementById("hero-enter-arena-btn");
  const aboutLearnMoreBtn = document.getElementById("about-learn-more-btn");
  const homeViewAllLbBtn = document.getElementById("home-view-all-lb-btn");
  const backToGameBtn = document.getElementById("back-to-game-btn");
  const studioToLeaderboardBtn = document.getElementById("studio-to-leaderboard-btn");
  const refreshLeaderboardBtn = document.getElementById("refresh-leaderboard-btn");
  const achToArenaBtn = document.getElementById("ach-to-arena-btn");
  const profileToArenaBtn = document.getElementById("profile-to-arena-btn");
  const defaultAvatarTrigger = document.getElementById("default-avatar-trigger");

  function navigateToArenaOrRegister() {
    playAudioTone("click");
    if (state.participant) {
      showScreen("game");
    } else {
      showScreen("identifier");
      const regDock = document.getElementById("registration-card-dock");
      const nameInput = document.getElementById("identifier-name");
      if (regDock) regDock.scrollIntoView({ behavior: "smooth", block: "center" });
      if (nameInput) setTimeout(() => nameInput.focus(), 250);
    }
  }

  if (navHomeBtn) navHomeBtn.addEventListener("click", () => { playAudioTone("click"); showScreen("identifier"); });
  if (brandHomeTrigger) brandHomeTrigger.addEventListener("click", () => { playAudioTone("click"); showScreen("identifier"); });
  if (navStudioBtn) navStudioBtn.addEventListener("click", navigateToArenaOrRegister);
  if (heroEnterArenaBtn) heroEnterArenaBtn.addEventListener("click", navigateToArenaOrRegister);
  if (aboutLearnMoreBtn) aboutLearnMoreBtn.addEventListener("click", navigateToArenaOrRegister);
  if (achToArenaBtn) achToArenaBtn.addEventListener("click", navigateToArenaOrRegister);
  if (profileToArenaBtn) profileToArenaBtn.addEventListener("click", navigateToArenaOrRegister);
  if (defaultAvatarTrigger) defaultAvatarTrigger.addEventListener("click", navigateToArenaOrRegister);

  if (navLeaderboardBtn) navLeaderboardBtn.addEventListener("click", () => { playAudioTone("click"); showScreen("leaderboard"); });
  if (homeViewAllLbBtn) homeViewAllLbBtn.addEventListener("click", () => { playAudioTone("click"); showScreen("leaderboard"); });
  if (studioToLeaderboardBtn) studioToLeaderboardBtn.addEventListener("click", () => { playAudioTone("click"); showScreen("leaderboard"); });
  if (navAchievementsBtn) navAchievementsBtn.addEventListener("click", () => { playAudioTone("click"); showScreen("achievements"); });
  if (navProfileBtn) navProfileBtn.addEventListener("click", () => { playAudioTone("click"); showScreen("profile"); });

  if (backToGameBtn) {
    backToGameBtn.addEventListener("click", () => {
      playAudioTone("click");
      if (state.participant) showScreen("game");
      else showScreen("identifier");
    });
  }

  if (refreshLeaderboardBtn) {
    refreshLeaderboardBtn.addEventListener("click", () => {
      playAudioTone("click");
      loadLeaderboard();
      showToast("Leaderboard standings refreshed.", "info");
    });
  }

  // Switch User / Logout button
  const changeUserBtn = document.getElementById("change-user-btn");
  if (changeUserBtn) {
    changeUserBtn.addEventListener("click", () => {
      playAudioTone("click");
      try {
        localStorage.removeItem("sbg_builder_name");
        localStorage.removeItem("sbg_builder_email");
        localStorage.removeItem("sbg_participant_id");
      } catch (e) { }

      state.participant = null;
      state.currentChallenge = null;
      state.generations = [];

      const userPill = document.getElementById("top-nav-user-pill");
      if (userPill) userPill.classList.add("hidden");
      if (defaultAvatarTrigger) defaultAvatarTrigger.classList.remove("hidden");

      showScreen("identifier");
      showToast("Signed out. Enter your builder alias to start a new session.", "info");
    });
  }

  // ---------------------------------------------------------------------------
  // 1. IDENTIFIER REGISTRATION (Name + Email)
  // ---------------------------------------------------------------------------
  const identifierForm = document.getElementById("identifier-form");
  const identifierNameInput = document.getElementById("identifier-name");
  const identifierEmailInput = document.getElementById("identifier-email");
  const identifierError = document.getElementById("identifier-error");
  const startBtn = document.getElementById("start-game-btn");
  const quickDemoFillBtn = document.getElementById("quick-demo-fill-btn");

  if (quickDemoFillBtn) {
    quickDemoFillBtn.addEventListener("click", () => {
      playAudioTone("click");
      const demoNames = ["CloudDreamer", "PromptPro", "AWSExplorer", "NovaArchitect"];
      const picked = demoNames[Math.floor(Math.random() * demoNames.length)];
      if (identifierNameInput) identifierNameInput.value = picked;
      if (identifierEmailInput) identifierEmailInput.value = `${picked.toLowerCase()}@aws-community.dev`;
      hideIdentifierError();
    });
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showIdentifierError(msg) {
    if (identifierError) {
      identifierError.textContent = msg;
      identifierError.classList.remove("hidden");
    }
  }

  function hideIdentifierError() {
    if (identifierError) {
      identifierError.textContent = "";
      identifierError.classList.add("hidden");
    }
  }

  let isSubmittingIdentifier = false;

  async function handleIdentifierSubmit(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (isSubmittingIdentifier) return;

    const name = identifierNameInput ? identifierNameInput.value.trim() : "";
    const email = identifierEmailInput ? identifierEmailInput.value.trim().toLowerCase() : "";

    if (!name) {
      showIdentifierError("Please enter your builder alias or full name.");
      if (identifierNameInput) identifierNameInput.focus();
      return;
    }

    if (!email || !validateEmail(email)) {
      showIdentifierError("Please enter a valid email address (e.g. builder@university.edu).");
      if (identifierEmailInput) identifierEmailInput.focus();
      return;
    }

    hideIdentifierError();
    isSubmittingIdentifier = true;

    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = `<span class="awsui-spinner-inline"></span><span>Entering Prompt Quest Arena...</span>`;
    }

    try {
      const resp = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      });
      const data = await resp.json();

      if (resp.ok && data.success && data.participant) {
        playAudioTone("success");
        state.participant = data.participant;
        state.currentChallenge = data.challenge;

        try {
          localStorage.setItem("sbg_builder_name", name);
          localStorage.setItem("sbg_builder_email", email);
          localStorage.setItem("sbg_participant_id", data.participant.id);
        } catch (storageErr) { }

        updateUserNavProfile(name, email);

        const gName = document.getElementById("game-builder-name");
        const gEmail = document.getElementById("game-builder-email");
        if (gName) gName.textContent = name;
        if (gEmail) gEmail.textContent = `(${email})`;

        renderAssignedChallenge(data.challenge);
        refreshCompetitionState();

        showScreen("game");
        showToast(`Welcome, ${name}! Assigned Quest: "${data.challenge.title}"`, "success");
      } else {
        showIdentifierError(data.error || "Unable to register session. Please try again.");
      }
    } catch (err) {
      console.error("Join error:", err);
      showIdentifierError("Network connection error. Please ensure the local server is running.");
    } finally {
      isSubmittingIdentifier = false;
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = `<span>Launch Prompt Arena &amp; Reveal Challenge</span><span class="btn-arrow">→</span>`;
      }
    }
  }

  if (startBtn) startBtn.addEventListener("click", handleIdentifierSubmit);
  if (identifierForm) identifierForm.addEventListener("submit", handleIdentifierSubmit);
  if (identifierNameInput) {
    identifierNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); handleIdentifierSubmit(); }
    });
  }
  if (identifierEmailInput) {
    identifierEmailInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); handleIdentifierSubmit(); }
    });
  }

  function updateUserNavProfile(name, email) {
    const pill = document.getElementById("top-nav-user-pill");
    const nameEl = document.getElementById("top-nav-user-name");
    const emailEl = document.getElementById("top-nav-user-email");
    const avatarEl = document.getElementById("user-avatar-initials");

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;

    if (avatarEl) {
      const parts = name.trim().split(/\s+/);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
      avatarEl.textContent = initials || "A";
    }

    if (pill) pill.classList.remove("hidden");
    if (defaultAvatarTrigger) defaultAvatarTrigger.classList.add("hidden");
  }

  function checkSavedIdentity() {
    try {
      const savedName = localStorage.getItem("sbg_builder_name");
      const savedEmail = localStorage.getItem("sbg_builder_email");
      if (savedName && identifierNameInput) identifierNameInput.value = savedName;
      if (savedEmail && identifierEmailInput) identifierEmailInput.value = savedEmail;
    } catch (e) { }
  }

  // ---------------------------------------------------------------------------
  // 2. TARGET REFERENCE SCENE GENERATOR & CHALLENGE RENDERING
  // ---------------------------------------------------------------------------
  function buildChallengeReferenceDataURI(ch) {
    const cat = (ch && ch.category) || "Cloud-Powered Innovation";
    const title = (ch && ch.title) || "Future Vision";
    const safeTitle = title.replace(/[<>&"']/g, "");
    const safeCat = cat.replace(/[<>&"']/g, "").toUpperCase();

    const palettes = {
      "Future of Education": { sky1: "#08080B", sky2: "#211832", accent: "#B69AFF", sec: "#D8C8FF" },
      "Smart Cities and Sustainable Living": { sky1: "#08080B", sky2: "#211832", accent: "#B69AFF", sec: "#C4B5FD" },
      "Artificial Intelligence and Humanity": { sky1: "#08080B", sky2: "#211832", accent: "#B69AFF", sec: "#D8C8FF" },
      "Space Exploration and Future Civilizations": { sky1: "#08080B", sky2: "#211832", accent: "#B69AFF", sec: "#DDD6FE" },
      "Technology for Social Impact": { sky1: "#08080B", sky2: "#211832", accent: "#B69AFF", sec: "#D8C8FF" },
      "Future of Work": { sky1: "#08080B", sky2: "#211832", accent: "#B69AFF", sec: "#C4B5FD" },
      "Cloud-Powered Innovation": { sky1: "#08080B", sky2: "#211832", accent: "#B69AFF", sec: "#D8C8FF" },
      "Robotics and Automation": { sky1: "#08080B", sky2: "#211832", accent: "#B69AFF", sec: "#C4B5FD" }
    };

    const pal = palettes[cat] || palettes["Cloud-Powered Innovation"];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${pal.sky1}"/>
          <stop offset="100%" stop-color="${pal.sky2}"/>
        </linearGradient>
        <radialGradient id="orbGlow" cx="72%" cy="32%" r="42%">
          <stop offset="0%" stop-color="${pal.accent}" stop-opacity="0.5"/>
          <stop offset="55%" stop-color="#35244F" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${pal.sky1}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="800" height="450" fill="url(#bgGrad)"/>
      <rect width="800" height="450" fill="url(#orbGlow)"/>
      <line x1="0" y1="320" x2="800" y2="320" stroke="${pal.accent}" stroke-opacity="0.45" stroke-width="1.5"/>
      <line x1="0" y1="360" x2="800" y2="360" stroke="${pal.sec}" stroke-opacity="0.22" stroke-width="1"/>
      <line x1="400" y1="320" x2="120" y2="450" stroke="${pal.accent}" stroke-opacity="0.2" stroke-width="1"/>
      <line x1="400" y1="320" x2="680" y2="450" stroke="${pal.accent}" stroke-opacity="0.2" stroke-width="1"/>
      <circle cx="575" cy="145" r="54" fill="#35244F" fill-opacity="0.55" stroke="${pal.accent}" stroke-width="1.5"/>
      <circle cx="575" cy="145" r="30" fill="${pal.accent}" fill-opacity="0.45"/>
      <path d="M90 320 L90 175 L155 140 L155 320 Z" fill="#211832" stroke="${pal.sec}" stroke-width="1.8"/>
      <path d="M185 320 L185 110 L270 78 L270 320 Z" fill="#35244F" stroke="${pal.accent}" stroke-width="2"/>
      <path d="M300 320 C300 185, 510 185, 510 320 Z" fill="#211832" fill-opacity="0.92" stroke="${pal.sec}" stroke-width="2"/>
      <path d="M550 320 L550 160 L640 125 L640 320 Z" fill="#35244F" stroke="${pal.sec}" stroke-width="1.8"/>
      <path d="M155 210 Q170 198 185 210" fill="none" stroke="${pal.accent}" stroke-width="2.5"/>
      <path d="M270 165 Q410 105 550 185" fill="none" stroke="${pal.sec}" stroke-dasharray="6 4" stroke-width="1.8"/>
      <rect x="24" y="22" width="350" height="54" rx="8" fill="#211832" fill-opacity="0.94" stroke="${pal.accent}" stroke-width="1.2"/>
      <text x="40" y="43" fill="${pal.accent}" font-family="monospace" font-size="11" font-weight="bold">TARGET SCENE // ${safeCat}</text>
      <text x="40" y="62" fill="#FFFFFF" font-family="sans-serif" font-size="13.5" font-weight="bold">${safeTitle.slice(0, 38)}</text>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function renderAssignedChallenge(ch) {
    if (!ch) return;
    state.currentChallenge = ch;

    const catNameEl = document.getElementById("player-cat-name");
    const titleEl = document.getElementById("player-challenge-title");
    const briefEl = document.getElementById("player-challenge-brief");
    const visualEl = document.getElementById("player-visual-goals");
    const kwContainer = document.getElementById("player-keywords-container");
    const refImg = document.getElementById("challenge-reference-img");
    const compareRefImg = document.getElementById("compare-ref-img");

    if (catNameEl) catNameEl.textContent = ch.category;
    if (titleEl) titleEl.textContent = ch.title;
    if (briefEl) briefEl.textContent = ch.brief;
    if (visualEl) visualEl.textContent = ch.visual_goals || "Emphasize futuristic realism and storytelling composition.";

    const refUri = buildChallengeReferenceDataURI(ch);
    state.currentReferenceUri = refUri;
    if (refImg) refImg.src = refUri;
    if (compareRefImg) compareRefImg.src = refUri;

    if (kwContainer) {
      kwContainer.innerHTML = "";
      (ch.inspiration_keywords || []).forEach(kw => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "keyword-chip";
        chip.textContent = `+ ${kw}`;
        chip.addEventListener("click", () => {
          playAudioTone("click");
          appendModifier(kw);
        });
        kwContainer.appendChild(chip);
      });
    }
  }

  const inspectRefBtn = document.getElementById("inspect-reference-btn");
  if (inspectRefBtn) {
    inspectRefBtn.addEventListener("click", () => {
      if (state.currentReferenceUri && state.currentChallenge) {
        playAudioTone("click");
        openImageModal(
          state.currentReferenceUri,
          `Target Reference: ${state.currentChallenge.title} — Visual Goals: ${state.currentChallenge.visual_goals || ""}`
        );
      }
    });
  }

  // Re-roll Challenge
  const rerollBtn = document.getElementById("reroll-challenge-btn");
  if (rerollBtn) {
    rerollBtn.addEventListener("click", async () => {
      if (!state.participant) {
        showToast("Please register on the Home screen first.", "error");
        return;
      }
      playAudioTone("click");
      rerollBtn.disabled = true;
      rerollBtn.textContent = "🔄 Rolling...";

      try {
        const resp = await fetch("/api/reroll-challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participant_id: state.participant.id })
        });
        const data = await resp.json();
        if (data.success && data.challenge) {
          renderAssignedChallenge(data.challenge);
          showToast(`New Quest Assigned: "${data.challenge.title}"`, "info");
        } else {
          showToast(data.error || "Could not re-roll challenge.", "error");
        }
      } catch (e) {
        showToast("Network error re-rolling challenge.", "error");
      } finally {
        rerollBtn.disabled = false;
        rerollBtn.textContent = "🔄 Re-roll Quest";
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 3. PROMPT CONSOLE
  // ---------------------------------------------------------------------------
  const promptInput = document.getElementById("prompt-input");
  const charCounter = document.getElementById("char-counter");
  const qualityPill = document.getElementById("prompt-quality-indicator");

  function updateCharCount() {
    if (!promptInput || !charCounter) return;
    const text = promptInput.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    charCounter.textContent = `${text.length} chars / ${words} words`;

    if (qualityPill) {
      qualityPill.classList.remove("quality-good", "quality-strong");
      if (words === 0) {
        qualityPill.textContent = "Readiness: Waiting";
      } else if (words < 10) {
        qualityPill.textContent = "Readiness: Brief";
      } else if (words < 20) {
        qualityPill.textContent = "Readiness: Good";
        qualityPill.classList.add("quality-good");
      } else {
        qualityPill.textContent = "Readiness: Optimal ✓";
        qualityPill.classList.add("quality-strong");
      }
    }
  }

  if (promptInput) promptInput.addEventListener("input", updateCharCount);

  function appendModifier(modifier) {
    if (!promptInput) return;
    const current = promptInput.value.trim();
    if (!current) {
      promptInput.value = modifier.startsWith(",") ? modifier.replace(/^,\s*/, "") : modifier;
    } else {
      const cleanMod = modifier.startsWith(",") ? modifier : `, ${modifier}`;
      promptInput.value = current + cleanMod;
    }
    updateCharCount();
    promptInput.focus();
  }

  document.querySelectorAll(".mod-pill-tag").forEach(pill => {
    pill.addEventListener("click", () => {
      playAudioTone("click");
      appendModifier(pill.dataset.insert);
    });
  });

  const clearBtn = document.getElementById("clear-prompt-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (promptInput) {
        promptInput.value = "";
        updateCharCount();
        promptInput.focus();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 4. IMAGE GENERATION & AI EVALUATION
  // ---------------------------------------------------------------------------
  const generateBtn = document.getElementById("generate-image-btn");
  const submitBtn = document.getElementById("submit-masterpiece-btn");
  const overlay = document.getElementById("generating-overlay");
  const activeImg = document.getElementById("active-generated-image");
  const placeholder = document.getElementById("canvas-placeholder");
  const viewFullBtn = document.getElementById("view-full-image-btn");
  const toggleCompareBtn = document.getElementById("toggle-compare-btn");
  const comparisonSplitView = document.getElementById("comparison-split-view");
  const compareGenImg = document.getElementById("compare-gen-img");

  function setComparisonMode(enabled) {
    state.isComparing = enabled;
    if (!comparisonSplitView || !activeImg) return;
    if (enabled && state.currentImage) {
      comparisonSplitView.classList.remove("hidden");
      activeImg.classList.add("hidden");
      if (toggleCompareBtn) toggleCompareBtn.textContent = "▣ Single View";
    } else {
      comparisonSplitView.classList.add("hidden");
      if (state.currentImage) activeImg.classList.remove("hidden");
      if (toggleCompareBtn) toggleCompareBtn.textContent = "⇄ Compare Reference";
    }
  }

  if (toggleCompareBtn) {
    toggleCompareBtn.addEventListener("click", () => {
      playAudioTone("click");
      setComparisonMode(!state.isComparing);
    });
  }

  async function handleGenerate() {
    const prompt = promptInput ? promptInput.value.trim() : "";
    if (!prompt) {
      showToast("Please enter a prompt for your assigned quest.", "error");
      if (promptInput) promptInput.focus();
      return;
    }

    if (!state.currentChallenge) {
      showToast("No quest assigned. Please register on Home first.", "error");
      return;
    }

    playAudioTone("click");
    if (generateBtn) generateBtn.disabled = true;
    if (overlay) overlay.classList.remove("hidden");

    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: state.participant ? state.participant.id : null,
          challenge_id: state.currentChallenge.id,
          prompt: prompt
        })
      });
      const data = await resp.json();

      if (data.success && data.generation) {
        playAudioTone("success");
        const gen = data.generation;
        state.currentImage = gen.image_data;
        state.currentEvaluation = gen.evaluation;
        state.generations.push(gen);

        setComparisonMode(false);
        if (activeImg) {
          activeImg.src = gen.image_data;
          activeImg.classList.remove("hidden");
        }
        if (compareGenImg) compareGenImg.src = gen.image_data;
        if (placeholder) placeholder.classList.add("hidden");
        if (viewFullBtn) viewFullBtn.disabled = false;
        if (toggleCompareBtn) toggleCompareBtn.classList.remove("hidden");

        const sourceTag = document.getElementById("canvas-source-tag");
        if (sourceTag) {
          sourceTag.textContent = `Engine: ${(gen.source || "AI").toUpperCase()}`;
          sourceTag.classList.remove("hidden");
        }

        const latencyTag = document.getElementById("canvas-latency-tag");
        if (latencyTag) {
          latencyTag.textContent = `${gen.latency || "1.0"}s`;
          latencyTag.classList.remove("hidden");
        }

        renderEvaluationScorecard(gen.evaluation);
        renderHistoryReel();
        updateDashboardProgressRing(gen.evaluation?.total_score, gen.evaluation?.tier_badge);

        if (submitBtn) submitBtn.disabled = false;
        showToast("Visual synthesized & evaluated by AI Judge!", "success");
      } else {
        showToast(data.error || "Generation error. Please retry.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error generating visual.", "error");
    } finally {
      if (generateBtn) generateBtn.disabled = false;
      if (overlay) overlay.classList.add("hidden");
    }
  }

  if (generateBtn) generateBtn.addEventListener("click", handleGenerate);

  // ---------------------------------------------------------------------------
  // 5. RENDER AI EVALUATION SCORECARD
  // ---------------------------------------------------------------------------
  function renderEvaluationScorecard(ev) {
    if (!ev) return;
    const card = document.getElementById("ai-eval-preview-card");
    if (card) card.classList.remove("hidden");

    const chName = document.getElementById("eval-challenge-name");
    if (chName && state.currentChallenge) {
      chName.textContent = `${state.currentChallenge.title} (${state.currentChallenge.category})`;
    }

    const totalEl = document.getElementById("eval-total-score");
    if (totalEl) totalEl.textContent = ev.total_score;

    const tierPill = document.getElementById("eval-tier-pill");
    if (tierPill) tierPill.textContent = ev.tier_badge;

    const b = ev.breakdown || {};
    const sRel = b.thematic_relevance?.score || 0;
    const sCre = b.creativity_originality?.score || 0;
    const sTec = b.prompt_engineering?.score || 0;
    const sImp = b.future_impact?.score || 0;

    const elRel = document.getElementById("score-rel");
    const barRel = document.getElementById("bar-rel");
    if (elRel) elRel.textContent = `${sRel} / 25`;
    if (barRel) barRel.style.width = `${(sRel / 25) * 100}%`;

    const elCre = document.getElementById("score-cre");
    const barCre = document.getElementById("bar-cre");
    if (elCre) elCre.textContent = `${sCre} / 25`;
    if (barCre) barCre.style.width = `${(sCre / 25) * 100}%`;

    const elTec = document.getElementById("score-tec");
    const barTec = document.getElementById("bar-tec");
    if (elTec) elTec.textContent = `${sTec} / 25`;
    if (barTec) barTec.style.width = `${(sTec / 25) * 100}%`;

    const elImp = document.getElementById("score-imp");
    const barImp = document.getElementById("bar-imp");
    if (elImp) elImp.textContent = `${sImp} / 25`;
    if (barImp) barImp.style.width = `${(sImp / 25) * 100}%`;

    const summaryEl = document.getElementById("eval-summary-text");
    if (summaryEl) summaryEl.textContent = ev.summary_comment || "";

    const badgeRow = document.getElementById("eval-badges-row");
    if (badgeRow) {
      badgeRow.innerHTML = "";
      (ev.special_badges || []).forEach(bg => {
        const tag = document.createElement("span");
        tag.className = "badge-tag";
        tag.textContent = bg;
        badgeRow.appendChild(tag);
      });
    }
  }

  function renderHistoryReel() {
    const reel = document.getElementById("history-reel-container");
    const countBadge = document.getElementById("history-count");
    if (countBadge) countBadge.textContent = state.generations.length;
    if (!reel) return;

    reel.innerHTML = "";
    state.generations.forEach((gen, idx) => {
      const img = document.createElement("img");
      img.src = gen.image_data;
      img.className = `history-thumb ${idx === state.generations.length - 1 ? "selected" : ""}`;
      img.title = `Prompt: ${gen.prompt.slice(0, 50)}... (Score: ${gen.evaluation?.total_score || "N/A"})`;
      img.addEventListener("click", () => {
        playAudioTone("click");
        document.querySelectorAll(".history-thumb").forEach(t => t.classList.remove("selected"));
        img.classList.add("selected");

        if (activeImg) activeImg.src = gen.image_data;
        if (compareGenImg) compareGenImg.src = gen.image_data;
        if (promptInput) promptInput.value = gen.prompt;
        updateCharCount();
        state.currentImage = gen.image_data;
        state.currentEvaluation = gen.evaluation;
        renderEvaluationScorecard(gen.evaluation);
      });
      reel.appendChild(img);
    });
  }

  // ---------------------------------------------------------------------------
  // 6. SUBMIT MASTERPIECE & STORE SCORE
  // ---------------------------------------------------------------------------
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      if (!state.participant) {
        showToast("Please register on Home first.", "error");
        return;
      }
      if (!state.currentImage) {
        showToast("Generate an image first before submitting.", "error");
        return;
      }

      playAudioTone("success");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="awsui-spinner-inline"></span><span>Submitting...</span>`;

      try {
        const resp = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participant_id: state.participant.id,
            prompt: promptInput ? promptInput.value.trim() : "",
            image_data: state.currentImage
          })
        });
        const data = await resp.json();

        if (data.success) {
          refreshCompetitionState();
          updateDashboardProgressRing(data.submission.ai_score, data.submission.tier_badge);
          showToast(
            `Masterpiece locked in with AI Score: ${data.submission.ai_score}!`,
            "success"
          );
          showScreen("leaderboard");
        } else {
          showToast(data.error || "Submission failed.", "error");
        }
      } catch (err) {
        showToast("Error submitting masterpiece.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>🏆 Submit to Leaderboard</span>`;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 7. LEADERBOARD & HOME "TOP PLAYERS" WIDGET
  // ---------------------------------------------------------------------------
  const leaderboardBody = document.getElementById("leaderboard-table-body");
  const leaderboardFilter = document.getElementById("leaderboard-cat-filter");
  const podiumSection = document.getElementById("leaderboard-podium-section");
  const homeTopPlayersList = document.getElementById("home-top-players-list");

  function renderHomeTopPlayersWidget(list) {
    if (!homeTopPlayersList) return;

    const displayItems =
      list && list.length > 0
        ? list.slice(0, 3).map((e, i) => ({
          rank: i + 1,
          name: e.player_name,
          score: `${e.composite_score} pts`
        }))
        : [
          { rank: 1, name: "CloudDreamer", score: "98.5" },
          { rank: 2, name: "PromptPro", score: "93.2" },
          { rank: 3, name: "AWSExplorer", score: "89.7" }
        ];

    homeTopPlayersList.innerHTML = "";
    displayItems.forEach(item => {
      const row = document.createElement("div");
      row.className = "pq-mini-lb-row";
      const initials = item.name.slice(0, 1).toUpperCase();
      row.innerHTML = `
        <div class="pq-mini-lb-left">
          <span class="pq-medal-badge pq-medal-${item.rank}">${item.rank}</span>
          <span class="pq-mini-rank-num">${item.rank}</span>
          <span class="pq-mini-avatar">${initials}</span>
          <span class="pq-mini-name">${item.name}</span>
        </div>
        <span class="pq-mini-score">${item.score}</span>
      `;
      homeTopPlayersList.appendChild(row);
    });
  }

  async function loadLeaderboard() {
    try {
      const url =
        leaderboardFilter && leaderboardFilter.value
          ? `/api/leaderboard?category=${encodeURIComponent(leaderboardFilter.value)}`
          : "/api/leaderboard";
      const resp = await fetch(url);
      const data = await resp.json();
      const list = data.leaderboard || [];

      if (!leaderboardFilter || !leaderboardFilter.value) {
        renderHomeTopPlayersWidget(list);
        const subCountEl = document.getElementById("nav-submissions-count");
        if (subCountEl) subCountEl.textContent = list.length;
      }

      if (!leaderboardBody) return;

      if (list.length === 0) {
        if (podiumSection) {
          podiumSection.innerHTML = "";
          podiumSection.classList.add("hidden");
        }
        leaderboardBody.innerHTML = `
          <tr>
            <td colspan="8" class="table-empty">No entries for this category yet. Submit creations from the Prompt Arena!</td>
          </tr>
        `;
        return;
      }

      if (podiumSection) {
        podiumSection.innerHTML = "";
        podiumSection.classList.remove("hidden");
        list.slice(0, 3).forEach(entry => {
          const card = document.createElement("div");
          card.className = `podium-card podium-rank-${entry.rank}`;
          card.innerHTML = `
            <div class="podium-img-wrap" title="Click to inspect full resolution">
              <img src="${entry.image_data}" alt="${entry.player_name}">
              <span class="podium-rank-badge">#${entry.rank} ${entry.rank === 1 ? "🏆" : entry.rank === 2 ? "🥈" : "🥉"}</span>
            </div>
            <div class="podium-body">
              <div class="podium-builder-row">
                <span class="podium-builder-name">${entry.player_name}</span>
                <span class="podium-score-val">${entry.composite_score} pts</span>
              </div>
              <div class="podium-cat-text">${entry.category} &bull; ${entry.challenge_title}</div>
              <p class="podium-prompt-snip">"${entry.prompt}"</p>
            </div>
          `;
          card.querySelector(".podium-img-wrap").addEventListener("click", () => {
            openImageModal(
              entry.image_data,
              `"${entry.prompt}" — ${entry.player_name} (${entry.player_email || ""}) | Score: ${entry.composite_score} pts`
            );
          });
          podiumSection.appendChild(card);
        });
      }

      leaderboardBody.innerHTML = "";
      list.forEach(entry => {
        const tr = document.createElement("tr");
        const rankClass =
          entry.rank === 1 ? "rank-1" : entry.rank === 2 ? "rank-2" : entry.rank === 3 ? "rank-3" : "";

        tr.innerHTML = `
          <td class="table-rank ${rankClass}">#${entry.rank}</td>
          <td><strong>${entry.player_name}</strong></td>
          <td><span style="font-size:12px; color:var(--aws-blue); font-family:var(--font-mono);">${entry.player_email || "—"}</span></td>
          <td>
            <div style="font-size:11px; font-weight:700; color:var(--aws-orange);">${entry.category}</div>
            <div style="font-size:12.5px;">${entry.challenge_title}</div>
          </td>
          <td class="table-score">${entry.ai_score}</td>
          <td style="font-weight:800; font-size:14px; font-family:var(--font-mono);">${entry.composite_score}</td>
          <td><span class="badge-tag">${entry.tier_badge}</span></td>
          <td>
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="btn-vote-applause" title="Upvote creation (+2 pts)">
                👏 ${entry.votes || 0}
              </button>
              <button type="button" class="pq-btn-outline-pill btn-sm inspect-entry-btn">Inspect</button>
            </div>
          </td>
        `;

        const voteBtn = tr.querySelector(".btn-vote-applause");
        if (voteBtn) {
          voteBtn.addEventListener("click", async () => {
            playAudioTone("click");
            const voterId = state.participant ? state.participant.id : "guest_voter";
            try {
              const vResp = await fetch("/api/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submission_id: entry.id, voter_id: voterId })
              });
              const vData = await vResp.json();
              if (vResp.ok && vData.success) {
                loadLeaderboard();
              } else {
                showToast(vData.error || "Unable to vote on this entry.", "error");
              }
            } catch (e) {
              showToast("Error submitting vote.", "error");
            }
          });
        }

        tr.querySelector(".inspect-entry-btn").addEventListener("click", () => {
          openImageModal(
            entry.image_data,
            `"${entry.prompt}" — ${entry.player_name} (${entry.player_email || ""}) | Score: ${entry.composite_score} pts`
          );
        });

        leaderboardBody.appendChild(tr);
      });
    } catch (err) {
      console.error("Leaderboard load error:", err);
    }
  }

  if (leaderboardFilter) {
    leaderboardFilter.addEventListener("change", loadLeaderboard);
  }

  // ---------------------------------------------------------------------------
  // 8. IMAGE ZOOM MODAL
  // ---------------------------------------------------------------------------
  const imageModal = document.getElementById("image-modal");
  const modalImg = document.getElementById("modal-full-image");
  const modalCaption = document.getElementById("modal-image-caption");
  const closeImageModal = document.getElementById("close-image-modal");

  function openImageModal(src, caption) {
    if (!imageModal || !modalImg) return;
    modalImg.src = src;
    if (modalCaption) modalCaption.textContent = caption || "";
    imageModal.classList.remove("hidden");
  }

  if (closeImageModal) {
    closeImageModal.addEventListener("click", () => imageModal.classList.add("hidden"));
  }
  if (imageModal) {
    imageModal.addEventListener("click", (e) => {
      if (e.target === imageModal) imageModal.classList.add("hidden");
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (imageModal && !imageModal.classList.contains("hidden")) imageModal.classList.add("hidden");
      if (adminModal && !adminModal.classList.contains("hidden")) adminModal.classList.add("hidden");
    }
  });

  if (viewFullBtn) {
    viewFullBtn.addEventListener("click", () => {
      if (state.currentImage) {
        openImageModal(state.currentImage, `Prompt: ${promptInput ? promptInput.value : ""}`);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 9. ADMIN MODAL & CONTROLS
  // ---------------------------------------------------------------------------
  const adminModal = document.getElementById("admin-modal");
  const openAdminBtn = document.getElementById("open-admin-btn");
  const closeAdminModal = document.getElementById("close-admin-modal");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const adminCodeInput = document.getElementById("admin-code-input");
  const adminAuthError = document.getElementById("admin-auth-error");
  const adminAuthPanel = document.getElementById("admin-auth-panel");
  const adminDashPanel = document.getElementById("admin-dashboard-panel");

  if (openAdminBtn) {
    openAdminBtn.addEventListener("click", () => {
      adminModal.classList.remove("hidden");
      if (state.isAdmin) loadAdminChallenges();
    });
  }

  if (closeAdminModal) {
    closeAdminModal.addEventListener("click", () => adminModal.classList.add("hidden"));
  }

  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", async () => {
      const code = adminCodeInput ? adminCodeInput.value.trim() : "";
      try {
        const resp = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admin_code: code })
        });
        const data = await resp.json();
        if (data.success) {
          state.isAdmin = true;
          state.adminToken = code;
          if (adminAuthPanel) adminAuthPanel.classList.add("hidden");
          if (adminDashPanel) adminDashPanel.classList.remove("hidden");
          if (adminAuthError) adminAuthError.classList.add("hidden");
          playAudioTone("success");
          loadAdminChallenges();
        } else {
          if (adminAuthError) adminAuthError.classList.remove("hidden");
        }
      } catch (e) {
        if (adminAuthError) adminAuthError.classList.remove("hidden");
      }
    });
  }

  document.querySelectorAll(".modal-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal-tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".modal-tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  document.querySelectorAll(".btn-phase-ctrl").forEach(btn => {
    btn.addEventListener("click", async () => {
      const phase = btn.dataset.phase;
      if (!phase || !state.adminToken) return;
      playAudioTone("click");
      try {
        const resp = await fetch("/api/admin/phase", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Code": state.adminToken
          },
          body: JSON.stringify({ phase })
        });
        const data = await resp.json();
        if (data.success) {
          applyLiveCompetitionState(data.state);
          showToast(`Competition phase switched to: ${phase.toUpperCase()}`, "success");
        }
      } catch (e) {
        showToast("Error updating competition phase.", "error");
      }
    });
  });

  const accHead = document.getElementById("toggle-add-challenge-form");
  const accContent = document.getElementById("add-challenge-form-body");
  if (accHead && accContent) {
    accHead.addEventListener("click", () => accContent.classList.toggle("hidden"));
  }

  const adminChallengesTable = document.getElementById("admin-challenges-table-body");
  const adminCatFilter = document.getElementById("admin-cat-filter");

  async function loadAdminChallenges() {
    if (!adminChallengesTable) return;
    try {
      const cat = adminCatFilter ? adminCatFilter.value : "";
      const url = cat ? `/api/challenges?category=${encodeURIComponent(cat)}` : "/api/challenges";
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.stats) {
        const t = document.getElementById("stat-total-challenges");
        const a = document.getElementById("stat-active-challenges");
        const c = document.getElementById("stat-categories-count");
        if (t) t.textContent = data.stats.total;
        if (a) a.textContent = data.stats.active;
        if (c) c.textContent = Object.keys(data.stats.categories || {}).length;
      }

      adminChallengesTable.innerHTML = "";
      (data.challenges || []).forEach(ch => {
        const tr = document.createElement("tr");
        const isActive = ch.is_active;

        tr.innerHTML = `
          <td><span class="status-badge ${isActive ? "active" : "inactive"}">${isActive ? "ACTIVE" : "INACTIVE"}</span></td>
          <td><strong style="color:var(--aws-orange);">${ch.category}</strong></td>
          <td>
            <div style="font-weight:700;">${ch.title}</div>
            <div style="font-size:11.5px; color:var(--pq-text-secondary);">${ch.brief.slice(0, 90)}...</div>
          </td>
          <td>
            <div style="display:flex; gap:6px;">
              <button type="button" class="pq-btn-outline-pill btn-sm toggle-act-btn">${isActive ? "Deactivate" : "Activate"}</button>
              <button type="button" class="awsui-btn-danger btn-sm delete-ch-btn" style="margin-top:0;">Delete</button>
            </div>
          </td>
        `;

        tr.querySelector(".toggle-act-btn").addEventListener("click", async () => {
          playAudioTone("click");
          await fetch(`/api/challenges/${ch.id}/toggle`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Admin-Code": state.adminToken
            },
            body: JSON.stringify({ is_active: !isActive })
          });
          loadAdminChallenges();
        });

        tr.querySelector(".delete-ch-btn").addEventListener("click", async () => {
          if (confirm(`Delete challenge "${ch.title}"?`)) {
            playAudioTone("click");
            await fetch(`/api/challenges/${ch.id}`, {
              method: "DELETE",
              headers: { "X-Admin-Code": state.adminToken }
            });
            loadAdminChallenges();
          }
        });

        adminChallengesTable.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  if (adminCatFilter) {
    adminCatFilter.addEventListener("change", loadAdminChallenges);
  }

  const saveChallengeBtn = document.getElementById("save-new-challenge-btn");
  if (saveChallengeBtn) {
    saveChallengeBtn.addEventListener("click", async () => {
      const category = document.getElementById("new-challenge-category")?.value;
      const title = document.getElementById("new-challenge-title")?.value.trim();
      const brief = document.getElementById("new-challenge-brief")?.value.trim();
      const visual = document.getElementById("new-challenge-visual")?.value.trim();
      const keywords = document.getElementById("new-challenge-keywords")?.value.trim();
      const focus = document.getElementById("new-challenge-focus")?.value.trim();

      if (!category || !title || !brief) {
        showToast("Category, title, and brief are required.", "error");
        return;
      }

      try {
        const resp = await fetch("/api/challenges/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Code": state.adminToken
          },
          body: JSON.stringify({
            category,
            title,
            brief,
            visual_goals: visual,
            inspiration_keywords: keywords,
            evaluation_focus: focus,
            is_active: true
          })
        });
        const data = await resp.json();
        if (data.success) {
          playAudioTone("success");
          showToast(`Challenge "${title}" added and activated!`, "success");
          document.getElementById("new-challenge-title").value = "";
          document.getElementById("new-challenge-brief").value = "";
          document.getElementById("new-challenge-visual").value = "";
          document.getElementById("new-challenge-keywords").value = "";
          document.getElementById("new-challenge-focus").value = "";
          if (accContent) accContent.classList.add("hidden");
          loadAdminChallenges();
        } else {
          showToast(data.error || "Failed to add challenge.", "error");
        }
      } catch (e) {
        showToast("Error adding challenge.", "error");
      }
    });
  }

  const resetChallengesBtn = document.getElementById("reset-challenges-btn");
  if (resetChallengesBtn) {
    resetChallengesBtn.addEventListener("click", async () => {
      if (confirm("Reset challenge library to standard official challenge set?")) {
        playAudioTone("click");
        await fetch("/api/challenges/reset", {
          method: "POST",
          headers: { "X-Admin-Code": state.adminToken }
        });
        showToast("Challenge catalog reset to official defaults.", "info");
        loadAdminChallenges();
      }
    });
  }

  const resetCompBtn = document.getElementById("reset-comp-btn");
  if (resetCompBtn) {
    resetCompBtn.addEventListener("click", async () => {
      if (confirm("DANGER: Reset all participants, generations, and locked-in submissions?")) {
        playAudioTone("click");
        await fetch("/api/admin/reset", {
          method: "POST",
          headers: { "X-Admin-Code": state.adminToken }
        });
        try {
          localStorage.clear();
        } catch (e) { }
        showToast("Competition data reset.", "info");
        window.location.reload();
      }
    });
  }

  // Populate category dropdowns & initial stats
  async function initCategorySelects() {
    try {
      const resp = await fetch("/api/challenges");
      const data = await resp.json();
      const cats = data.categories || [];

      if (data.stats) {
        const homePlayersEl = document.getElementById("home-stat-players");
        if (homePlayersEl && (!state.compState || !state.compState.participant_count)) {
          homePlayersEl.textContent = `${data.stats.active || 16}+`;
        }
      }

      const selects = [
        document.getElementById("leaderboard-cat-filter"),
        document.getElementById("admin-cat-filter"),
        document.getElementById("new-challenge-category")
      ];

      selects.forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        const hasAll = sel.id !== "new-challenge-category";
        sel.innerHTML = hasAll ? '<option value="">All 8 Categories</option>' : "";
        cats.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
      });
    } catch (e) {
      console.error("Init categories error:", e);
    }
  }

  // Initialize
  initCategorySelects();
  checkSavedIdentity();
  updateCharCount();
  refreshCompetitionState();
  loadLeaderboard();
});
