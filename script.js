(function () {
  const timerEl = document.getElementById('timer');
  const startStopBtn = document.getElementById('startStopBtn');
  const resetBtn = document.getElementById('resetBtn');
  const announcementEl = document.getElementById('announcement');
  const minutesSelect = document.getElementById('minutes');
  const interviewerInput = document.getElementById('interviewer');
  const respondentInput = document.getElementById('respondent');
  const swapBtn = document.getElementById('swapBtn');
  const interviewerDropdown = document.getElementById('interviewerDropdown');
  const respondentDropdown = document.getElementById('respondentDropdown');
  const manageBtn = document.getElementById('manageBtn');
  const managePanel = document.getElementById('managePanel');
  const playerListEl = document.getElementById('playerList');
  const closePanelBtn = document.getElementById('closePanelBtn');
  const autoLargeCheckbox = document.getElementById('autoLargeDisplay');
  const timerClickHint = document.getElementById('timerClickHint');

  const STORAGE_KEY = 'yesNoGame_savedNames';
  const PREF_AUTO_LARGE = 'yesNoGame_autoLargeDisplay';

  // --- Saved names ---
  function loadNames() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveName(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const names = loadNames();
    if (!names.includes(trimmed)) {
      names.push(trimmed);
      names.sort((a, b) => a.localeCompare(b));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
      updateManageButton();
    }
  }

  function removeName(name) {
    let names = loadNames();
    names = names.filter(function (n) { return n !== name; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
    populatePlayerList();
    updateManageButton();
  }

  function openDropdown(dropdownEl, inputEl) {
    closeAllDropdowns();
    const names = loadNames();
    dropdownEl.innerHTML = '';
    if (names.length === 0) {
      const li = document.createElement('li');
      li.className = 'no-names';
      li.textContent = 'No saved names';
      dropdownEl.appendChild(li);
    } else {
      names.forEach(function (name) {
        const li = document.createElement('li');
        li.textContent = name;
        li.addEventListener('mousedown', function (e) {
          e.preventDefault();
          inputEl.value = name;
          closeAllDropdowns();
          updateSwapButton();
        });
        dropdownEl.appendChild(li);
      });
    }
    dropdownEl.classList.remove('hidden');
  }

  function closeAllDropdowns() {
    interviewerDropdown.classList.add('hidden');
    respondentDropdown.classList.add('hidden');
  }

  function populatePlayerList() {
    const names = loadNames();
    playerListEl.innerHTML = '';
    if (names.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-msg';
      li.textContent = 'No saved players yet.';
      playerListEl.appendChild(li);
      return;
    }
    names.forEach(function (name) {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.className = 'player-name';
      span.textContent = name;
      const btn = document.createElement('button');
      btn.className = 'btn-delete';
      btn.title = 'Remove ' + name;
      btn.innerHTML = '&#x2715;';
      btn.addEventListener('click', function () {
        if (confirm('Remove ' + name + '?')) removeName(name);
      });
      li.appendChild(span);
      li.appendChild(btn);
      playerListEl.appendChild(li);
    });
  }

  function updateManageButton() {
    manageBtn.classList.toggle('hidden', loadNames().length === 0);
  }

  let totalSeconds = 0;
  let remainingSeconds = 0;
  let intervalId = null;
  let running = false;

  // --- Audio via Web Audio API ---
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playTone(frequency, duration, type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function playStartSound() {
    playTone(523, 0.15, 'square');
    setTimeout(() => playTone(659, 0.15, 'square'), 120);
    setTimeout(() => playTone(784, 0.25, 'square'), 240);
  }

  function playStopSound() {
    playTone(400, 0.25, 'sawtooth');
    setTimeout(() => playTone(300, 0.35, 'sawtooth'), 200);
  }

  function playWinSound() {
    playTone(523, 0.15, 'square');
    setTimeout(() => playTone(659, 0.15, 'square'), 150);
    setTimeout(() => playTone(784, 0.15, 'square'), 300);
    setTimeout(() => playTone(1047, 0.4, 'square'), 450);
  }

  // --- Timer display ---
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return String(m) + ':' + String(s).padStart(2, '0');
  }

  // --- Fullscreen timer overlay ---
  let overlayEl = null;
  let overlayTimerEl = null;
  let overlayStopBtn = null;

  function showOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.className = 'timer-overlay';
    overlayEl.tabIndex = 0;

    const rolesEl = document.createElement('div');
    rolesEl.className = 'overlay-roles';
    const iName = interviewerInput.value.trim() || 'Interviewer';
    const rName = respondentInput.value.trim() || 'Respondent';
    rolesEl.textContent = iName + '  vs  ' + rName;

    overlayTimerEl = document.createElement('div');
    overlayTimerEl.className = 'timer-big';

    overlayStopBtn = document.createElement('button');
    overlayStopBtn.className = 'btn btn-stop overlay-stop-btn';
    overlayStopBtn.textContent = 'Stop';
    overlayStopBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      endGame(true);
    });

    const hint = document.createElement('div');
    hint.className = 'timer-hint';
    hint.textContent = 'Click or press Escape to close';

    let overlayStartBtn = null;

    overlayEl.appendChild(rolesEl);
    overlayEl.appendChild(overlayTimerEl);
    if (running) {
      overlayEl.appendChild(overlayStopBtn);
    } else {
      overlayStartBtn = document.createElement('button');
      overlayStartBtn.className = 'btn btn-start overlay-stop-btn';
      overlayStartBtn.textContent = 'Start';
      overlayStartBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        autoLargeCheckbox.checked = true;
        localStorage.setItem(PREF_AUTO_LARGE, '1');
        hideOverlay();
        startTimer();
      });
      overlayEl.appendChild(overlayStartBtn);
    }
    overlayEl.appendChild(hint);
    document.body.appendChild(overlayEl);

    // Focus the overlay so Escape works immediately
    overlayEl.focus();

    overlayEl.addEventListener('click', function (e) {
      if (e.target !== overlayStopBtn && e.target !== overlayStartBtn) hideOverlay();
    });

    overlayEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hideOverlay();
      }
    });

    updateDisplay();
  }

  function hideOverlay() {
    if (!overlayEl) return;
    overlayEl.remove();
    overlayEl = null;
    overlayTimerEl = null;
    overlayStopBtn = null;
  }

  function updateDisplay() {
    const text = formatTime(remainingSeconds);
    timerEl.textContent = text;
    timerEl.classList.remove('warning', 'danger');
    if (running) {
      if (remainingSeconds <= 10) {
        timerEl.classList.add('danger');
      } else if (remainingSeconds <= 30) {
        timerEl.classList.add('warning');
      }
    }
    if (overlayTimerEl) {
      overlayTimerEl.textContent = text;
      overlayTimerEl.classList.remove('warning', 'danger');
      if (running) {
        if (remainingSeconds <= 10) {
          overlayTimerEl.classList.add('danger');
        } else if (remainingSeconds <= 30) {
          overlayTimerEl.classList.add('warning');
        }
      }
    }
  }

  function setConfiguredTime() {
    totalSeconds = parseInt(minutesSelect.value, 10) * 60;
    remainingSeconds = totalSeconds;
    updateDisplay();
  }

  // --- Swap button visibility ---
  function updateSwapButton() {
    const hasName = interviewerInput.value.trim() || respondentInput.value.trim();
    swapBtn.classList.toggle('hidden', !hasName);
  }

  function swapNames() {
    const temp = interviewerInput.value;
    interviewerInput.value = respondentInput.value;
    respondentInput.value = temp;
  }

  // --- Game flow ---
  function startTimer() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playStartSound();

    saveName(interviewerInput.value);
    saveName(respondentInput.value);

    running = true;
    startStopBtn.textContent = 'Stop';
    startStopBtn.classList.remove('btn-start');
    startStopBtn.classList.add('btn-stop');
    minutesSelect.disabled = true;
    interviewerInput.disabled = true;
    respondentInput.disabled = true;
    document.querySelectorAll('.dropdown-toggle').forEach(function (b) { b.disabled = true; });
    closeAllDropdowns();
    swapBtn.classList.add('hidden');
    timerClickHint.classList.add('hidden');

    if (autoLargeCheckbox.checked) {
      showOverlay();
    }

    intervalId = setInterval(function () {
      remainingSeconds--;
      updateDisplay();
      if (remainingSeconds <= 0) {
        endGame(false);
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(intervalId);
    intervalId = null;
    running = false;
  }

  function endGame(stoppedByInterviewer) {
    stopTimer();
    startStopBtn.classList.add('hidden');

    let winnerName;
    let winnerClass;

    if (stoppedByInterviewer) {
      playStopSound();
      winnerName = interviewerInput.value.trim() || 'Interviewer';
      winnerClass = 'winner-interviewer';
    } else {
      playWinSound();
      winnerName = respondentInput.value.trim() || 'Respondent';
      winnerClass = 'winner-respondent';
    }

    announcementEl.textContent = winnerName + ' wins!';
    announcementEl.className = 'announcement ' + winnerClass;
    resetBtn.classList.remove('hidden');

    if (overlayEl) {
      // Remove the stop button if present
      overlayStopBtn?.remove();

      const overlayAnnouncement = document.createElement('div');
      overlayAnnouncement.className = 'overlay-announcement ' + winnerClass;
      overlayAnnouncement.textContent = winnerName + ' wins!';

      const overlayResetBtn = document.createElement('button');
      overlayResetBtn.className = 'btn btn-reset overlay-stop-btn';
      overlayResetBtn.textContent = 'Play Again';
      overlayResetBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        hideOverlay();
        resetGame();
      });

      // Hide the hint text and insert after the timer
      const hintEl = overlayEl.querySelector('.timer-hint');
      if (hintEl) hintEl.classList.add('hidden');
      overlayTimerEl.after(overlayAnnouncement);
      overlayAnnouncement.after(overlayResetBtn);
    } else {
      hideOverlay();
    }
  }

  function resetGame() {
    stopTimer();
    interviewerInput.disabled = false;
    respondentInput.disabled = false;
    document.querySelectorAll('.dropdown-toggle').forEach(function (b) { b.disabled = false; });
    minutesSelect.disabled = false;
    startStopBtn.textContent = 'Start';
    startStopBtn.classList.remove('btn-stop', 'hidden');
    startStopBtn.classList.add('btn-start');
    announcementEl.className = 'announcement hidden';
    announcementEl.textContent = '';
    resetBtn.classList.add('hidden');
    setConfiguredTime();
    updateSwapButton();
    timerClickHint.classList.remove('hidden');
  }

  // --- Event listeners ---
  timerEl.addEventListener('click', showOverlay);

  document.querySelectorAll('.dropdown-toggle').forEach(function (btn) {
    const inputId = btn.dataset.for;
    const inputEl = document.getElementById(inputId);
    const dropdownEl = document.getElementById(inputId + 'Dropdown');
    btn.addEventListener('click', function () {
      if (dropdownEl.classList.contains('hidden')) {
        openDropdown(dropdownEl, inputEl);
      } else {
        closeAllDropdowns();
      }
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.input-with-dropdown')) {
      closeAllDropdowns();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });

  interviewerInput.addEventListener('input', updateSwapButton);
  respondentInput.addEventListener('input', updateSwapButton);
  swapBtn.addEventListener('click', swapNames);

  startStopBtn.addEventListener('click', function () {
    if (!running) {
      startTimer();
    } else {
      endGame(true);
    }
  });

  resetBtn.addEventListener('click', resetGame);

  manageBtn.addEventListener('click', function () {
    populatePlayerList();
    managePanel.classList.remove('hidden');
    manageBtn.classList.add('hidden');
  });

  closePanelBtn.addEventListener('click', function () {
    managePanel.classList.add('hidden');
    updateManageButton();
  });

  minutesSelect.addEventListener('change', setConfiguredTime);

  autoLargeCheckbox.addEventListener('change', function () {
    localStorage.setItem(PREF_AUTO_LARGE, autoLargeCheckbox.checked ? '1' : '0');
  });

  // Init
  autoLargeCheckbox.checked = localStorage.getItem(PREF_AUTO_LARGE) === '1';
  updateManageButton();
  setConfiguredTime();
})();
