/* ============================================================
   TANK BATTLE IPAS - Kelas 3 SD
   Duel 2 pemain di satu layar (siap GitHub Pages / offline)
   ============================================================ */

const LEVEL_HINT = {
    mudah: "Soal fakta sederhana untuk pemanasan.",
    sedang: "Soal latihan sehari-hari yang menantang.",
    sulit: "Soal untuk berpikir dan menerapkan pengetahuan."
};

const config = {
    level: "sedang",
    count: 10,
    timerDuration: 30000,
    penalty: true,
    p1Image: "assets/tank1.png",
    p2Image: "assets/tank2.png",
    soundOn: true
};

const DAMAGE = 20;
const SELF_DAMAGE = 10;
const TANK_CHOICES = ["assets/tank1.png", "assets/tank2.png"];

let deck = [];
let deckIndex = 0;
let pending = 0;

const gameState = {
    p1: { hp: 100, prevHp: 100, locked: false, timerId: null, startTime: 0, lastTick: 99, benar: 0, salah: 0 },
    p2: { hp: 100, prevHp: 100, locked: false, timerId: null, startTime: 0, lastTick: 99, benar: 0, salah: 0 },
    isPlaying: false
};

/* ---------------- util ---------------- */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function prepareQuestion(item) {
    let options = shuffle(item.o);
    let answerIndex = options.indexOf(item.k);
    if (answerIndex === -1) {
        options = shuffle([...options, item.k]);
        answerIndex = options.indexOf(item.k);
    }
    return { text: item.q, options: options, answerIndex: answerIndex };
}

function buildDeck() {
    const pool = QUESTION_BANK[config.level] || QUESTION_BANK.sedang;
    const picked = shuffle(pool).slice(0, Math.min(config.count, pool.length));
    deck = picked.map(prepareQuestion);
    deckIndex = 0;
}

function nextQuestion() {
    if (deckIndex >= deck.length) return null;
    return deck[deckIndex++];
}

function renderOrFinish(playerStr) {
    if (!gameState.isPlaying) return;
    if (deckIndex < deck.length) { renderQuestion(playerStr); return; }
    if (pending <= 0) finishByDeck();
}

/* ---------------- audio ---------------- */
let audioCtx = null;

function ensureAudio() {
    try {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) {
                console.warn("[audio] WebAudio tidak didukung browser ini");
                return null;
            }
            audioCtx = new AC();
        }
        if (audioCtx.state !== "running" && typeof audioCtx.resume === "function") {
            const p = audioCtx.resume();
            if (p && typeof p.catch === "function") p.catch(function () {});
        }
        return audioCtx;
    } catch (e) {
        console.warn("[audio] gagal inisialisasi:", e);
        return null;
    }
}

/* unlock audio pada interaksi pertama (kebijakan autoplay browser) */
["pointerdown", "mousedown", "touchstart", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, function unlock() {
        const c = ensureAudio();
        if (c && c.state === "running") {
            ["pointerdown", "mousedown", "touchstart", "keydown"].forEach(function (e2) {
                document.removeEventListener(e2, unlock, true);
            });
        }
    }, { once: false, capture: true, passive: true });
});

function playSound(type) {
    if (!config.soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;

    if (type === "shoot") {
        osc.type = "square";
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.40, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now); osc.stop(now + 0.12);
    } else if (type === "explosion") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else if (type === "correct") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1100, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === "wrong") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.25);
        gain.gain.setValueAtTime(0.30, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
    } else if (type === "hit") {
        osc.type = "square";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.4);
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
    } else if (type === "tick") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(1150, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now); osc.stop(now + 0.07);
    } else if (type === "alarm") {
        osc.type = "square";
        osc.frequency.setValueAtTime(720, now);
        osc.frequency.setValueAtTime(500, now + 0.12);
        osc.frequency.setValueAtTime(720, now + 0.24);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.start(now); osc.stop(now + 0.38);
    } else if (type === "win") {
        osc.type = "triangle";
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            osc.frequency.setValueAtTime(f, now + i * 0.15);
        });
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
        gain.gain.setValueAtTime(0.35, now + 0.55);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc.start(now); osc.stop(now + 0.85);
    } else {
        osc.frequency.setValueAtTime(420, now);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    }
    } catch (e) {
        console.warn("[audio] gagal memutar suara '" + type + "':", e);
    }
}

function toggleSound() {
    config.soundOn = !config.soundOn;
    document.getElementById("btn-sound").textContent = config.soundOn ? "🔊" : "🔇";
    playSound("click");
}

function testSound() {
    const status = document.getElementById("sound-status");
    const prev = config.soundOn;
    config.soundOn = true;

    const ctx = ensureAudio();
    if (!ctx) {
        if (status) {
            status.className = "sound-status bad";
            status.textContent = "Browser ini tidak mendukung suara.";
        }
        config.soundOn = prev;
        return;
    }

    playSound("correct");
    setTimeout(() => playSound("hit"), 450);
    setTimeout(() => playSound("tick"), 900);

    if (status) {
        if (ctx.state === "running") {
            status.className = "sound-status ok";
            status.textContent = "Suara aktif ✓ (jika tetap sunyi, cek volume perangkat/browser)";
        } else {
            status.className = "sound-status bad";
            status.textContent = "Status audio: " + ctx.state + " - klik sekali lagi di layar ini";
        }
    }

    setTimeout(() => { config.soundOn = prev; }, 1400);
}

/* ---------------- settings UI ---------------- */
function toggleSettings(show) {
    document.getElementById("settings-modal").style.display = show ? "flex" : "none";
    if (show) { initTankSelectors(); playSound("click"); }
}

function setActiveIn(container, btn) {
    container.querySelectorAll(".opt-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

function initMenuChoices() {
    document.querySelectorAll(".level-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setActiveIn(document.getElementById("level-options"), btn);
            config.level = btn.dataset.level;
            document.getElementById("level-hint").textContent = LEVEL_HINT[config.level];
            playSound("click");
        });
    });

    document.querySelectorAll(".count-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setActiveIn(document.getElementById("count-options"), btn);
            config.count = parseInt(btn.dataset.count, 10);
            playSound("click");
        });
    });

    document.querySelectorAll(".timer-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setActiveIn(document.getElementById("timer-options"), btn);
            config.timerDuration = parseInt(btn.dataset.time, 10) * 1000;
            playSound("click");
        });
    });

    document.querySelectorAll(".penalty-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setActiveIn(document.getElementById("penalty-options"), btn);
            config.penalty = btn.dataset.penalty === "true";
            playSound("click");
        });
    });
}

function setTankCharacter(player, url, btn) {
    const container = document.querySelector(player === "p1" ? ".tank-select-p1" : ".tank-select-p2");
    container.querySelectorAll(".char-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (player === "p1") config.p1Image = url;
    else config.p2Image = url;
    playSound("click");
}

function handleFileUpload(player, input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const dataUrl = e.target.result;
        if (player === "p1") config.p1Image = dataUrl;
        else config.p2Image = dataUrl;

        const parentBtn = input.parentElement;
        const icon = parentBtn.querySelector(".upload-label");
        if (icon) icon.style.display = "none";

        let img = parentBtn.querySelector("img");
        if (!img) {
            img = document.createElement("img");
            parentBtn.appendChild(img);
        }
        img.src = dataUrl;

        const container = document.querySelector(player === "p1" ? ".tank-select-p1" : ".tank-select-p2");
        container.querySelectorAll(".char-btn").forEach(b => b.classList.remove("active"));
        parentBtn.classList.add("active");
    };
    reader.readAsDataURL(input.files[0]);
}

function initTankSelectors() {
    const build = (containerClass, playerStr) => {
        const container = document.querySelector(containerClass);
        container.innerHTML = "";
        const current = playerStr === "p1" ? config.p1Image : config.p2Image;

        TANK_CHOICES.forEach(url => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "char-btn" + (current === url ? " active" : "");
            btn.onclick = function () { setTankCharacter(playerStr, url, this); };
            const img = document.createElement("img");
            img.src = url;
            img.alt = "Tank";
            btn.appendChild(img);
            container.appendChild(btn);
        });

        const uploadBtn = document.createElement("button");
        uploadBtn.type = "button";
        uploadBtn.className = "char-btn" + (current.startsWith("data:") ? " active" : "");
        uploadBtn.title = "Upload Gambar Sendiri";
        const icon = document.createElement("span");
        icon.className = "upload-label";
        icon.textContent = "📤";
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = function () { handleFileUpload(playerStr, this); };
        uploadBtn.appendChild(icon);
        uploadBtn.appendChild(input);
        if (current.startsWith("data:")) {
            icon.style.display = "none";
            const img = document.createElement("img");
            img.src = current;
            uploadBtn.appendChild(img);
        }
        container.appendChild(uploadBtn);
    };

    build(".tank-select-p1", "p1");
    build(".tank-select-p2", "p2");
}

/* ---------------- fullscreen ---------------- */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    playSound("click");
}

/* ---------------- flow permainan ---------------- */
function startCountdownFlow() {
    playSound("click");
    document.getElementById("menu-screen").style.display = "none";
    document.getElementById("winner-display").style.display = "none";
    document.getElementById("countdown-screen").style.display = "flex";

    let count = 3;
    const text = document.getElementById("countdown-text");
    text.textContent = count;
    playSound("tick");

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            text.textContent = count;
            playSound("tick");
        } else {
            clearInterval(interval);
            playSound("correct");
            document.getElementById("countdown-screen").style.display = "none";
            startGame();
        }
    }, 1000);
}

function startGame() {
    document.getElementById("game-screen").style.display = "flex";

    const img1 = document.querySelector("#tank-p1 img");
    img1.src = config.p1Image;
    img1.classList.remove("tank-flip", "tint-red");

    const img2 = document.querySelector("#tank-p2 img");
    img2.src = config.p2Image;
    img2.classList.add("tank-flip");

    gameState.p1 = { hp: 100, prevHp: 100, locked: false, timerId: null, startTime: 0, lastTick: 99, benar: 0, salah: 0 };
    gameState.p2 = { hp: 100, prevHp: 100, locked: false, timerId: null, startTime: 0, lastTick: 99, benar: 0, salah: 0 };
    gameState.isPlaying = true;

    updateHealth("p1");
    updateHealth("p2");
    updateScore("p1");
    updateScore("p2");

    buildDeck();
    pending = 0;
    renderQuestion("p1");
    renderQuestion("p2");
}

function backToMenu() {
    gameState.isPlaying = false;
    stopTimer("p1");
    stopTimer("p2");
    clearConfetti();
    document.getElementById("game-screen").style.display = "none";
    document.getElementById("winner-display").style.display = "none";
    document.getElementById("countdown-screen").style.display = "none";
    document.getElementById("menu-screen").style.display = "flex";
    playSound("click");
}

function restartGame() {
    clearConfetti();
    document.getElementById("winner-display").style.display = "none";
    startCountdownFlow();
}

/* ---------------- soal ---------------- */
function renderQuestion(playerStr) {
    if (!gameState.isPlaying) return;
    const item = nextQuestion();
    if (!item) { finishByDeck(); return; }
    pending++;

    document.getElementById("q-text-" + playerStr).textContent = item.text;

    const container = document.getElementById("options-" + playerStr);
    container.innerHTML = "";
    container.className = "options-container " + (item.options.length < 4 ? "col-layout" : "grid-layout");

    const baseClass = playerStr === "p1" ? "opt-blue" : "opt-red";

    item.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "answer-btn " + baseClass;
        btn.textContent = opt;
        btn.onclick = () => handleAnswer(playerStr, idx, item.answerIndex, container);
        container.appendChild(btn);
    });

    gameState[playerStr].locked = false;
    startTimer(playerStr);
}

function lockButtons(container) {
    container.querySelectorAll(".answer-btn").forEach(b => { b.disabled = true; });
}

/* ---------------- timer ---------------- */
function startTimer(playerStr) {
    stopTimer(playerStr);
    const bar = document.getElementById("timer-bar-" + playerStr);

    if (config.timerDuration === 0) {
        bar.style.width = "100%";
        bar.style.background = "#22c55e";
        return;
    }

    gameState[playerStr].startTime = Date.now();
    gameState[playerStr].lastTick = 99;
    bar.style.width = "100%";
    bar.style.background = "#22c55e";

    const loop = () => {
        if (!gameState.isPlaying || gameState[playerStr].locked) return;
        const elapsed = Date.now() - gameState[playerStr].startTime;
        const remaining = Math.max(0, config.timerDuration - elapsed);
        const pct = (remaining / config.timerDuration) * 100;

        bar.style.width = pct + "%";
        bar.style.background = pct < 30 ? "#ef4444" : (pct < 60 ? "#eab308" : "#22c55e");

        const secLeft = Math.ceil(remaining / 1000);
        if (secLeft <= 5 && secLeft > 0 && secLeft !== gameState[playerStr].lastTick) {
            gameState[playerStr].lastTick = secLeft;
            playSound("tick");
        }

        if (remaining <= 0) {
            handleTimeout(playerStr);
        } else {
            gameState[playerStr].timerId = requestAnimationFrame(loop);
        }
    };
    gameState[playerStr].timerId = requestAnimationFrame(loop);
}

function stopTimer(playerStr) {
    if (gameState[playerStr].timerId) {
        cancelAnimationFrame(gameState[playerStr].timerId);
        gameState[playerStr].timerId = null;
    }
}

/* ---------------- jawaban ---------------- */
function handleAnswer(playerStr, selectedIdx, correctIdx, container) {
    if (!gameState.isPlaying || gameState[playerStr].locked) return;

    stopTimer(playerStr);
    gameState[playerStr].locked = true;
    lockButtons(container);

    const buttons = container.querySelectorAll(".answer-btn");
    const correct = selectedIdx === correctIdx;

    if (correct) {
        if (buttons[correctIdx]) buttons[correctIdx].classList.add("correct");
        gameState[playerStr].benar++;
        updateScore(playerStr);
        playSound("correct");
        setTimeout(() => shootProjectile(playerStr, playerStr === "p1" ? "p2" : "p1"), 350);
    } else {
        if (buttons[selectedIdx]) buttons[selectedIdx].classList.add("wrong");
        if (buttons[correctIdx]) buttons[correctIdx].classList.add("correct");
        gameState[playerStr].salah++;
        updateScore(playerStr);
        playSound("wrong");
        setTimeout(() => {
            if (config.penalty) {
                selfDamage(playerStr);
            } else {
                shakeAndAdvance(playerStr, document.getElementById("tank-" + playerStr));
            }
        }, 700);
    }
}

function handleTimeout(playerStr) {
    if (gameState[playerStr].locked) return;
    gameState[playerStr].locked = true;
    stopTimer(playerStr);
    gameState[playerStr].salah++;
    updateScore(playerStr);
    playSound("alarm");

    const container = document.getElementById("options-" + playerStr);
    lockButtons(container);

    setTimeout(() => {
        if (config.penalty) {
            selfDamage(playerStr);
        } else {
            shakeAndAdvance(playerStr, container);
        }
    }, 500);
}

function shakeAndAdvance(playerStr, elem) {
    if (!gameState.isPlaying) return;
    elem.classList.add("shake-element");
    setTimeout(() => {
        elem.classList.remove("shake-element");
        advance(playerStr);
    }, 500);
}

function advance(playerStr) {
    if (!gameState.isPlaying) return;
    pending = Math.max(0, pending - 1);
    renderOrFinish(playerStr);
}

/* ---------------- serangan ---------------- */
function isZoneFlipped(elem) {
    const zone = elem && elem.closest ? elem.closest(".player-zone") : null;
    if (!zone) return false;
    try {
        const t = getComputedStyle(zone).transform;
        if (!t || t === "none") return false;
        return new DOMMatrixReadOnly(t).a < 0;
    } catch (e) {
        return false;
    }
}

function shootProjectile(attacker, defender) {
    if (!gameState.isPlaying) return;
    playSound("shoot");

    const startElem = document.getElementById("tank-" + attacker);
    const targetElem = document.getElementById("tank-" + defender);
    const proj = document.getElementById("proj-" + attacker);
    const flash = document.getElementById("flash-" + attacker);

    flash.classList.remove("hidden");
    setTimeout(() => flash.classList.add("hidden"), 150);

    startElem.classList.add("firing");
    setTimeout(() => startElem.classList.remove("firing"), 380);

    const startRect = startElem.getBoundingClientRect();
    const targetRect = targetElem.getBoundingClientRect();

    const flipped = isZoneFlipped(startElem);
    const muzzleRight = (attacker === "p1") !== flipped;
    const startX = muzzleRight ? startRect.right - 50 : startRect.left + 25;
    const startY = startRect.top + 35;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    proj.style.left = startX + "px";
    proj.style.top = startY + "px";
    proj.style.display = "block";
    proj.style.transition = "none";
    void proj.offsetWidth;

    proj.style.transition = "top 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94), left 1.1s linear";
    proj.style.left = endX + "px";
    proj.style.top = endY + "px";

    setTimeout(() => {
        proj.style.display = "none";
        if (!gameState.isPlaying) return;
        createExplosion(defender);
        applyDamage(defender, DAMAGE);
        advance(attacker);
    }, 1150);
}

function selfDamage(playerStr) {
    if (!gameState.isPlaying) return;
    const tank = document.getElementById("tank-" + playerStr);
    tank.classList.add("shake-element");
    playSound("explosion");

    spawnDamageText(tank, "-" + SELF_DAMAGE);

    const smoke = document.getElementById("smoke-" + playerStr);
    smoke.classList.remove("hidden");

    setTimeout(() => {
        tank.classList.remove("shake-element");
        smoke.classList.add("hidden");
        applyDamage(playerStr, SELF_DAMAGE);
        advance(playerStr);
    }, 700);
}

function spawnDamageText(elem, text) {
    const rect = elem.getBoundingClientRect();
    const dmg = document.createElement("div");
    dmg.className = "damage-text" + (isZoneFlipped(elem) ? " dmg-flip" : "");
    dmg.textContent = text;
    dmg.style.left = (rect.left + rect.width / 2 - 22 + (Math.random() * 44 - 22)) + "px";
    dmg.style.top = (rect.top - 10) + "px";
    document.body.appendChild(dmg);
    setTimeout(() => dmg.remove(), 1100);
}

function createExplosion(target) {
    playSound("hit");
    const tank = document.getElementById("tank-" + target);
    const zone = document.getElementById(target + "-zone");
    tank.classList.add("shake-element");

    if (zone) {
        zone.classList.remove("zone-flash");
        void zone.offsetWidth;
        zone.classList.add("zone-flash");
    }

    const boom = document.createElement("div");
    boom.className = "explosion-effect";
    boom.textContent = "💥";
    tank.appendChild(boom);
    spawnDamageText(tank, "-" + DAMAGE);

    setTimeout(() => {
        tank.classList.remove("shake-element");
        if (zone) zone.classList.remove("zone-flash");
        boom.remove();
    }, 600);
}

/* ---------------- HP & skor ---------------- */
function applyDamage(target, amount) {
    if (!gameState.isPlaying) return;
    gameState[target].hp = Math.max(0, gameState[target].hp - amount);
    updateHealth(target);

    if (gameState[target].hp <= 0) {
        endGame(target === "p1" ? "p2" : "p1");
    }
}

function updateHealth(playerStr) {
    const hp = gameState[playerStr].hp;
    const prevHp = gameState[playerStr].prevHp !== undefined ? gameState[playerStr].prevHp : 100;
    const bar = document.getElementById("hp-" + playerStr);
    bar.style.width = hp + "%";
    bar.style.background = hp > 50 ? "#22c55e" : (hp > 20 ? "#eab308" : "#ef4444");

    const isLow = hp > 0 && hp <= 30;
    bar.classList.toggle("low-hp", isLow);
    if (isLow && prevHp > 30) playSound("alarm");
    gameState[playerStr].prevHp = hp;
}

function updateScore(playerStr) {
    const s = gameState[playerStr];
    document.getElementById("score-" + playerStr).textContent = "Benar: " + s.benar;
}

/* ---------------- akhir permainan ---------------- */
function finishByDeck() {
    if (!gameState.isPlaying) return;

    const p1 = gameState.p1, p2 = gameState.p2;
    if (p1.hp !== p2.hp) {
        endGame(p1.hp > p2.hp ? "p1" : "p2");
    } else if (p1.benar !== p2.benar) {
        endGame(p1.benar > p2.benar ? "p1" : "p2");
    } else {
        endGame("seri");
    }
}

function spawnConfetti() {
    clearConfetti();
    const holder = document.getElementById("winner-display");
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#06b6d4"];
    for (let i = 0; i < 70; i++) {
        const c = document.createElement("div");
        c.className = "confetti";
        c.style.left = (Math.random() * 100) + "%";
        c.style.background = colors[i % colors.length];
        c.style.width = (7 + Math.random() * 7) + "px";
        c.style.height = (12 + Math.random() * 10) + "px";
        c.style.animationDuration = (2.6 + Math.random() * 2.6) + "s";
        c.style.animationDelay = (Math.random() * 1.2) + "s";
        holder.appendChild(c);
    }
}

function clearConfetti() {
    document.querySelectorAll(".confetti").forEach(e => e.remove());
}

function endGame(winnerStr) {
    if (!gameState.isPlaying) return;
    gameState.isPlaying = false;
    stopTimer("p1");
    stopTimer("p2");

    const winText = document.getElementById("winner-text");
    const winSub = document.getElementById("winner-sub");
    const emoji = document.querySelector(".winner-emoji");

    document.getElementById("stat-p1").textContent =
        gameState.p1.benar + " benar / " + gameState.p1.salah + " salah (HP " + gameState.p1.hp + ")";
    document.getElementById("stat-p2").textContent =
        gameState.p2.benar + " benar / " + gameState.p2.salah + " salah (HP " + gameState.p2.hp + ")";

    if (winnerStr === "p1") {
        winText.textContent = "TIM BIRU (P1) MENANG!";
        winText.style.color = "#1d4ed8";
        winSub.textContent = "P1 berhasil menghancurkan tank P2";
        emoji.textContent = "🏆";
    } else if (winnerStr === "p2") {
        winText.textContent = "TIM MERAH (P2) MENANG!";
        winText.style.color = "#b91c1c";
        winSub.textContent = "P2 berhasil menghancurkan tank P1";
        emoji.textContent = "🏆";
    } else {
        winText.textContent = "PERMAINAN SERI!";
        winText.style.color = "#0f172a";
        winSub.textContent = "Kekuatan kedua tim seimbang";
        emoji.textContent = "🤝";
    }

    document.getElementById("winner-display").style.display = "flex";
    spawnConfetti();
    playSound(winnerStr === "seri" ? "correct" : "win");
}

/* ---------------- inisialisasi ---------------- */
window.addEventListener("load", () => {
    initMenuChoices();
    initTankSelectors();

    document.getElementById("btn-start-game").addEventListener("click", startCountdownFlow);
    document.getElementById("btn-sound").addEventListener("click", toggleSound);

    const badge = document.getElementById("status-text");
    badge.textContent = "Mode Lokal - " + (QUESTION_BANK[config.level] || []).length + " soal siap!";

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
        badge.textContent = "Mode Lokal (suara tidak didukung browser)";
        const st = document.getElementById("sound-status");
        if (st) { st.className = "sound-status bad"; st.textContent = "Browser ini tidak mendukung suara."; }
    }
});
