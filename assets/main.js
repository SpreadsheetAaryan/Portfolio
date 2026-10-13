(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme ---------- */
  const themeBtn = document.getElementById('theme-toggle');
  const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
  const syncTheme = () => {
    const now = currentTheme();
    themeBtn.setAttribute('aria-label', `Switch to ${now === 'dark' ? 'light' : 'dark'} theme`);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', now === 'dark' ? '#0f1318' : '#f4f6f8');
  };
  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (next === 'light') root.dataset.theme = 'light';
    else delete root.dataset.theme;
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncTheme();
  });
  syncTheme();

  /* ---------- Nav: scrolled state, mobile menu, scroll-spy ---------- */
  const nav = document.querySelector('.nav');
  const menuBtn = document.getElementById('menu-toggle');
  const links = document.getElementById('nav-links');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    links.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close section menu' : 'Open section menu');
  };
  menuBtn.addEventListener('click', () => setMenu(!links.classList.contains('is-open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !links.classList.contains('is-open')) return;
    setMenu(false);
    menuBtn.focus();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav')) setMenu(false);
  });

  const navLinks = [...links.querySelectorAll('a')];
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = () => {
    const y = window.scrollY + window.innerHeight * 0.35;
    let active = null;
    for (const s of sections) if (s.offsetTop <= y) active = s;
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) active = sections[sections.length - 1];
    navLinks.forEach((a) => a.classList.toggle('is-active', active && a.getAttribute('href') === '#' + active.id));
  };
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);
  spy();

  /* ---------- Research bars: grow once when visible ---------- */
  const paper = document.querySelector('.paper');
  if (paper) {
    if (!reduceMotion && 'IntersectionObserver' in window) {
      paper.classList.add('is-pending');
      const io = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) { paper.classList.remove('is-pending'); io.disconnect(); }
      }, { threshold: 0.25 });
      io.observe(paper);
    }
  }

  /* ---------- Case studies ---------- */
  const dialog = document.getElementById('study');
  const body = document.getElementById('study-body');
  const kicker = document.getElementById('study-kicker');
  const closeBtn = document.getElementById('study-close');
  const KICKERS = { corro: 'Case study', assistant: 'Case study', drone: 'Case study', dlf: 'Case study' };
  let opener = null;
  let pushedEntry = false; // true when this page added the #hash entry we're showing
  let fromDeepLink = false;

  const openStudy = (id, { push = true } = {}) => {
    const tpl = document.getElementById('tpl-' + id);
    if (!tpl || !dialog.showModal) return false;
    body.replaceChildren(tpl.content.cloneNode(true));
    const badge = document.querySelector(`.feature[data-project="${id}"] .badge`);
    kicker.textContent = badge ? badge.textContent : KICKERS[id] || '';
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    body.parentElement.scrollTop = 0;
    document.body.classList.add('has-modal');
    if (push && location.hash !== '#' + id) {
      history.pushState({ study: id }, '', '#' + id);
      pushedEntry = true;
    }
    return true;
  };

  const finishClose = () => {
    dialog.classList.remove('is-closing');
    if (dialog.open) dialog.close();
    document.body.classList.remove('has-modal');
    if (opener) {
      // After a deep link the button is off-screen, so let focus scroll to it.
      opener.focus({ preventScroll: !fromDeepLink });
      opener = null;
    }
    fromDeepLink = false;
  };

  const closeStudy = ({ fromHistory = false } = {}) => {
    if (!dialog.open) return;
    if (!fromHistory && /^#(corro|assistant|drone|dlf)$/.test(location.hash)) {
      if (pushedEntry) history.back(); // popstate will call closeStudy again; dialog is already closing
      else history.replaceState(null, '', location.pathname + location.search);
    }
    pushedEntry = false;
    if (dialog.classList.contains('is-closing')) return;
    if (reduceMotion) return finishClose();
    dialog.classList.add('is-closing');
    setTimeout(finishClose, 190);
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open]');
    if (btn) { opener = btn; fromDeepLink = false; openStudy(btn.dataset.open); }
  });
  closeBtn.addEventListener('click', () => closeStudy());
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeStudy(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeStudy(); });

  const fromHash = () => {
    const id = location.hash.slice(1);
    if (document.getElementById('tpl-' + id)) {
      opener = document.querySelector(`[data-open="${id}"]`);
      fromDeepLink = !dialog.open;
      openStudy(id, { push: false });
    } else closeStudy({ fromHistory: true });
  };
  window.addEventListener('popstate', fromHash);
  if (location.hash) fromHash();

  /* ---------- Gridworld value iteration ---------- */
  const board = document.getElementById('gridworld');
  const figure = board && board.closest('.grid-demo');
  if (!board) return;

  const N = 9;
  const GAMMA = 0.86;
  const WALLS = new Set([
    '1,3', '2,3', '3,3', '4,3',
    '6,1', '6,2', '6,3',
    '4,5', '4,6', '4,7',
    '1,6', '2,6',
    '7,5', '7,6',
  ]);
  const ACTIONS = [[0, 1, 0], [1, 0, 90], [0, -1, 180], [-1, 0, 270]]; // dr, dc, rotation
  let goal = [1, 7];
  let V = new Float64Array(N * N);
  let timer = null;
  const idx = (r, c) => r * N + c;
  const isWall = (r, c) => WALLS.has(r + ',' + c);
  const inside = (r, c) => r >= 0 && c >= 0 && r < N && c < N && !isWall(r, c);

  const cells = [];
  const arrowSVG = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cell' + (isWall(r, c) ? ' cell--wall' : '');
      el.dataset.r = r; el.dataset.c = c;
      el.tabIndex = -1;
      el.setAttribute('role', 'gridcell');
      if (isWall(r, c)) { el.disabled = true; el.setAttribute('aria-label', 'Wall'); }
      else el.innerHTML = arrowSVG;
      board.appendChild(el);
      cells.push(el);
    }
  }
  let focusIdx = idx(0, 0);
  cells[focusIdx].tabIndex = 0;

  const label = (r, c) => {
    const el = cells[idx(r, c)];
    if (isWall(r, c)) return;
    const isGoal = r === goal[0] && c === goal[1];
    el.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}${isGoal ? ', goal' : `, value ${V[idx(r, c)].toFixed(2)}`}`);
  };

  const sweep = () => {
    const next = new Float64Array(N * N);
    let delta = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (isWall(r, c)) continue;
        if (r === goal[0] && c === goal[1]) {
          next[idx(r, c)] = 1;
          delta = Math.max(delta, 1 - V[idx(r, c)]);
          continue;
        }
        let best = 0;
        for (const [dr, dc] of ACTIONS) {
          const nr = r + dr, nc = c + dc;
          const v = inside(nr, nc) ? GAMMA * V[idx(nr, nc)] : GAMMA * V[idx(r, c)];
          if (v > best) best = v;
        }
        next[idx(r, c)] = best;
        delta = Math.max(delta, Math.abs(best - V[idx(r, c)]));
      }
    }
    V = next;
    return delta;
  };

  const policyAngle = (r, c) => {
    let best = -1, angle = 0;
    for (const [dr, dc, rot] of ACTIONS) {
      const nr = r + dr, nc = c + dc;
      if (!inside(nr, nc)) continue;
      if (V[idx(nr, nc)] > best + 1e-9) { best = V[idx(nr, nc)]; angle = rot; }
    }
    return best > 0 ? angle : null;
  };

  const paint = (settled) => {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (isWall(r, c)) continue;
        const el = cells[idx(r, c)];
        const v = V[idx(r, c)];
        const isGoal = r === goal[0] && c === goal[1];
        el.classList.toggle('cell--goal', isGoal);
        // Lift low values so the far edge of the gradient stays visible.
        el.style.setProperty('--v', isGoal ? 1 : (v * 0.92).toFixed(3));
        el.classList.toggle('is-hi', v > 0.6);
        const arrow = el.querySelector('.arrow');
        if (arrow) {
          const a = settled && !isGoal ? policyAngle(r, c) : null;
          arrow.style.transform = a === null ? '' : `rotate(${a}deg)`;
          arrow.style.visibility = a === null ? 'hidden' : 'visible';
        }
        if (settled) label(r, c);
      }
    }
    figure.classList.toggle('is-settled', settled);
  };

  const status = document.getElementById('grid-status');
  const agent = document.createElement('div');
  agent.className = 'agent';
  agent.style.opacity = '0';
  board.appendChild(agent);
  let walkTimer = null;

  const clearPath = () => cells.forEach((el) => el.classList.remove('on-path'));

  // Greedy path from the open cell farthest from the goal.
  const greedyPath = () => {
    let start = null, low = Infinity;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = V[idx(r, c)];
      if (!isWall(r, c) && v > 0 && v < low) { low = v; start = [r, c]; }
    }
    const path = [];
    let cur = start;
    while (cur && path.length < N * N) {
      path.push(cur);
      if (cur[0] === goal[0] && cur[1] === goal[1]) break;
      let best = null, bv = -1;
      for (const [dr, dc] of ACTIONS) {
        const nr = cur[0] + dr, nc = cur[1] + dc;
        if (inside(nr, nc) && V[idx(nr, nc)] > bv + 1e-9) { bv = V[idx(nr, nc)]; best = [nr, nc]; }
      }
      cur = best;
    }
    return path;
  };

  const placeAgent = ([r, c]) => {
    const el = cells[idx(r, c)];
    agent.style.setProperty('--cs', el.offsetWidth + 'px');
    agent.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
  };

  const walk = () => {
    const path = greedyPath();
    if (!path.length) return;
    status.textContent = `Goal at row ${goal[0] + 1}, column ${goal[1] + 1}. Shortest route from the farthest square takes ${path.length - 1} steps.`;
    if (reduceMotion) {
      path.forEach(([r, c]) => cells[idx(r, c)].classList.add('on-path'));
      return;
    }
    agent.style.transition = 'none';
    placeAgent(path[0]);
    agent.offsetWidth; // commit start position before animating
    agent.style.transition = '';
    agent.style.opacity = '1';
    let i = 0;
    const step = () => {
      const [r, c] = path[i];
      placeAgent(path[i]);
      cells[idx(r, c)].classList.add('on-path');
      i += 1;
      if (i < path.length) walkTimer = setTimeout(step, 200);
      else walkTimer = setTimeout(() => { agent.style.opacity = '0'; }, 900);
    };
    step();
  };

  const run = () => {
    clearTimeout(timer);
    clearTimeout(walkTimer);
    clearPath();
    agent.style.opacity = '0';
    V = new Float64Array(N * N);
    figure.classList.remove('is-settled');
    if (reduceMotion) {
      while (sweep() > 1e-6);
      paint(true);
      walk();
      return;
    }
    paint(false);
    const step = () => {
      const delta = sweep();
      if (delta < 1e-6) { paint(true); setTimeout(walk, 350); return; }
      paint(false);
      timer = setTimeout(step, 85);
    };
    timer = setTimeout(step, 85);
  };

  window.addEventListener('resize', () => { if (agent.style.opacity === '1') agent.style.opacity = '0'; });

  board.addEventListener('click', (e) => {
    const el = e.target.closest('.cell');
    if (!el || el.disabled) return;
    const r = +el.dataset.r, c = +el.dataset.c;
    if (r === goal[0] && c === goal[1]) return;
    goal = [r, c];
    run();
  });

  // Roving focus: arrow keys move between cells, Enter or Space sets the goal.
  board.addEventListener('keydown', (e) => {
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (!moves[e.key]) return;
    e.preventDefault();
    let r = Math.floor(focusIdx / N), c = focusIdx % N;
    const [dr, dc] = moves[e.key];
    do { r += dr; c += dc; } while (r >= 0 && c >= 0 && r < N && c < N && isWall(r, c));
    if (r < 0 || c < 0 || r >= N || c >= N) return;
    cells[focusIdx].tabIndex = -1;
    focusIdx = idx(r, c);
    cells[focusIdx].tabIndex = 0;
    cells[focusIdx].focus();
  });

  paint(false);
  // Start once the board is on screen (on phones it sits below the fold), after the hero fades in.
  if (reduceMotion || !('IntersectionObserver' in window)) run();
  else {
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      seen.disconnect();
      setTimeout(run, 500);
    }, { threshold: 0.5 });
    seen.observe(board);
  }
})();
