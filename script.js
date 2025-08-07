document.addEventListener('DOMContentLoaded', () => {
  const maxTime = 3;
  const holdSpacing = 45;
  const holdCount = 5;
  const frameDuration = 1000 / 24;

  // DOM references
  const canvas = document.getElementById('climber');
  const ctx = canvas.getContext('2d');
  const holdsContainer = document.getElementById('holds');
  const scoreElem = document.getElementById('score');
  const timerInner = document.getElementById('timer-inner');
  const overlay = document.getElementById('overlay');
  const finalScoreElem = document.getElementById('final-score');
  const restartBtn = document.getElementById('restart-btn');
  const leftBtn = document.getElementById('left-btn');
  const rightBtn = document.getElementById('right-btn');
  const layers = [
    document.getElementById('layer1'),
    document.getElementById('layer2'),
    document.getElementById('layer3'),
    document.getElementById('layer4')
  ];

  // Determine day or night
  let isDay = (new Date()).getHours() >= 6 && (new Date()).getHours() < 18;
  document.body.classList.add(isDay ? 'day' : 'night');

  let spriteSheet = new Image();
  let animations = {
    idle: [],
    reach: [],
    pull: [],
    slip: [],
    fall: []
  };
  let currentAnim = {
    frames: [],
    index: 0,
    time: 0,
    loop: false,
    flip: false,
    onComplete: null
  };
  let holdList = [];
  let side = 'left';
  let score = 0;
  let timeRemaining = maxTime;
  let state = 'loading';
  let canInput = false;
  let lastTimestamp;
  let animationId;
  const parallaxOffsets = [0, 0, 0, 0];
  const parallaxSpeeds = [-0.02, -0.04, -0.08, -0.12]; // px per ms

  function createHold(sideValue) {
    const shapes = ['small', 'medium', 'large', 'round'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const colors = ['#b9a58c', '#c0b197', '#a9977c', '#9d8b75', '#af9b84'];
    const elem = document.createElement('div');
    elem.classList.add('hold', shape);
    elem.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    return { side: sideValue, element: elem };
  }

  function addNewHold() {
    const newSide = Math.random() < 0.5 ? 'left' : 'right';
    const hold = createHold(newSide);
    holdList.push(hold);
    holdsContainer.appendChild(hold.element);
  }

  function repositionHolds() {
    for (let i = 0; i < holdList.length; i++) {
      const hold = holdList[i];
      const el = hold.element;
      el.style.bottom = (i * holdSpacing) + 'px';
      if (hold.side === 'left') {
        el.style.left = '0';
        el.style.right = '';
      } else {
        el.style.right = '0';
        el.style.left = '';
      }
    }
  }

  function setupInitialHolds() {
    holdsContainer.innerHTML = '';
    holdList = [];
    const firstHold = createHold(side);
    holdList.push(firstHold);
    holdsContainer.appendChild(firstHold.element);
    for (let i = 1; i < holdCount; i++) {
      addNewHold();
    }
    repositionHolds();
  }

  function updateScore() {
    scoreElem.textContent = String(score);
  }

  function updateTimerBar() {
    const ratio = Math.max(0, timeRemaining / maxTime);
    timerInner.style.width = (ratio * 100) + '%';
    const hue = Math.max(0, ratio * 120);
    timerInner.style.backgroundColor = `hsl(${hue},80%,50%)`;
  }

  function playAnimation(name, loop, flip, onComplete) {
    currentAnim.frames = animations[name];
    currentAnim.index = 0;
    currentAnim.time = 0;
    currentAnim.loop = loop;
    currentAnim.flip = flip;
    currentAnim.onComplete = onComplete || null;
  }

  function updateAnimation(dt) {
    if (!currentAnim.frames || currentAnim.frames.length === 0) return;
    currentAnim.time += dt;
    while (currentAnim.time >= frameDuration) {
      currentAnim.time -= frameDuration;
      currentAnim.index++;
      if (currentAnim.index >= currentAnim.frames.length) {
        if (currentAnim.loop) {
          currentAnim.index = 0;
        } else {
          const cb = currentAnim.onComplete;
          currentAnim.onComplete = null;
          if (cb) cb();
          return;
        }
      }
    }
  }

  function drawFrame(frame, flip) {
    const fw = frame.sw;
    const fh = frame.sh;
    const scale = Math.min(canvas.width / fw, canvas.height / fh);
    const dw = fw * scale;
    const dh = fh * scale;
    const dx = (canvas.width - dw) / 2;
    const dy = canvas.height - dh;
    ctx.save();
    if (flip) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(spriteSheet, frame.sx, frame.sy, frame.sw, frame.sh,
        canvas.width - dx - dw, dy, dw, dh);
    } else {
      ctx.drawImage(spriteSheet, frame.sx, frame.sy, frame.sw, frame.sh,
        dx, dy, dw, dh);
    }
    ctx.restore();
  }

  function drawClimber() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!currentAnim.frames || currentAnim.frames.length === 0) return;
    const frame = currentAnim.frames[Math.floor(currentAnim.index)];
    drawFrame(frame, currentAnim.flip);
  }

  function handleInput(inputSide) {
    if (!canInput || state !== 'playing') return;
    const bottomHold = holdList[0];
    if (!bottomHold) return;
    if (inputSide === bottomHold.side) {
      onCorrect(inputSide);
    } else {
      onIncorrect();
    }
  }

  function onCorrect(selectedSide) {
    canInput = false;
    score++;
    updateScore();
    timeRemaining = maxTime;
    side = selectedSide;
    const removed = holdList.shift();
    if (removed && removed.element.parentNode === holdsContainer) {
      holdsContainer.removeChild(removed.element);
    }
    addNewHold();
    repositionHolds();
    const flip = selectedSide === 'right';
    playAnimation('reach', false, flip, () => {
      playAnimation('pull', false, flip, () => {
        playAnimation('idle', true, flip, () => {
          canInput = true;
        });
      });
    });
  }

  function onIncorrect() {
    if (state !== 'playing') return;
    canInput = false;
    const flip = (side === 'right');
    state = 'failing';
    playAnimation('slip', false, flip, () => {
      playAnimation('fall', false, flip, () => {
        showGameOver();
      });
    });
  }

  function showGameOver() {
    state = 'gameover';
    finalScoreElem.textContent = String(score);
    overlay.style.display = 'flex';
  }

  function toggleDayNight() {
    isDay = !isDay;
    document.body.classList.toggle('day', isDay);
    document.body.classList.toggle('night', !isDay);
  }

  function updateParallax(dt) {
    for (let i = 0; i < layers.length; i++) {
      parallaxOffsets[i] += parallaxSpeeds[i] * dt;
      layers[i].style.backgroundPosition = `${parallaxOffsets[i]}px 0px`;
    }
  }

  function gameLoop(timestamp) {
    if (lastTimestamp === undefined) lastTimestamp = timestamp;
    const dt = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    updateParallax(dt);

    if (state === 'playing') {
      timeRemaining -= dt / 1000;
      if (timeRemaining <= 0) {
        timeRemaining = 0;
        updateTimerBar();
        onIncorrect();
      } else {
        updateTimerBar();
      }
    } else if (state === 'failing') {
      updateTimerBar();
    }

    updateAnimation(dt);
    drawClimber();

    if (state !== 'gameover') {
      animationId = requestAnimationFrame(gameLoop);
    }
  }

  function startGame() {
    state = 'playing';
    score = 0;
    timeRemaining = maxTime;
    updateScore();
    updateTimerBar();
    overlay.style.display = 'none';
    side = 'left';
    setupInitialHolds();
    playAnimation('idle', true, false, null);
    canInput = true;
    for (let i = 0; i < parallaxOffsets.length; i++) {
      parallaxOffsets[i] = 0;
    }
    lastTimestamp = undefined;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
  }

  function buildAnimations() {
    const sheetCols = 24;
    const sheetRows = 5;
    const frameW = spriteSheet.width / sheetCols;
    const frameH = spriteSheet.height / sheetRows;
    animations.idle = [];
    animations.reach = [];
    animations.pull = [];
    animations.slip = [];
    animations.fall = [];
    for (let col = 0; col < sheetCols; col++) {
      animations.idle.push({ sx: col * frameW, sy: 0 * frameH, sw: frameW, sh: frameH });
      animations.reach.push({ sx: col * frameW, sy: 1 * frameH, sw: frameW, sh: frameH });
      animations.pull.push({ sx: col * frameW, sy: 2 * frameH, sw: frameW, sh: frameH });
      animations.slip.push({ sx: col * frameW, sy: 3 * frameH, sw: frameW, sh: frameH });
      animations.fall.push({ sx: col * frameW, sy: 4 * frameH, sw: frameW, sh: frameH });
    }
  }

  // Event listeners for controls
  leftBtn.addEventListener('click', () => handleInput('left'));
  rightBtn.addEventListener('click', () => handleInput('right'));
  restartBtn.addEventListener('click', () => {
    startGame();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      handleInput('left');
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      handleInput('right');
    } else if (e.key === 't' || e.key === 'T') {
      toggleDayNight();
    }
  });

  spriteSheet.onload = () => {
    buildAnimations();
    startGame();
  };
  spriteSheet.src = 'climber_sprite_sheet.png';
});
