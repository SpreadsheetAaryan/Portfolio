(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Real refraction needs SVG filters inside backdrop-filter, which only Chromium renders.
  // It is also the most expensive effect, so desktop only.
  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  if (finePointer && brands.some((b) => /Chromium/.test(b.brand))) root.classList.add('lg-refract');

  // Let the ambient light and goal pulse rest when nobody is interacting.
  let idleTimer;
  const wake = () => {
    root.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => root.classList.add('is-idle'), 12000);
  };
  ['pointermove', 'scroll', 'keydown', 'touchstart'].forEach((t) => addEventListener(t, wake, { passive: true }));
  wake();

  if (reduceMotion || !finePointer) return;

  // Batch pointer work into one write per frame.
  const raf = (fn) => {
    let queued = false, args;
    return (...a) => {
      args = a;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; fn(...args); });
    };
  };

  /* ---------- Rim light and glare follow the pointer ---------- */
  const lit = document.querySelectorAll('.feature, .paper, .nav__inner');
  document.addEventListener('pointermove', raf((e) => {
    const rects = [...lit].map((el) => el.getBoundingClientRect()); // all reads first
    lit.forEach((el, i) => {
      const r = rects[i];
      if (e.clientY < r.top - 300 || e.clientY > r.bottom + 300) return;
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }), { passive: true });

  /* ---------- The 3D board leans gently with the pointer ---------- */
  const board = document.getElementById('gridworld');
  const hero = document.querySelector('.hero');
  if (board && hero) {
    // Write the transform itself: changing a custom property would restyle all 81 cells.
    hero.addEventListener('pointermove', raf((e) => {
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      board.style.transform = `rotateX(${(54 - py * 4).toFixed(2)}deg) rotateZ(${(38 + px * 6).toFixed(2)}deg)`;
    }));
    hero.addEventListener('pointerleave', () => { board.style.transform = ''; });
  }

  /* ---------- Magnetic buttons with a light that tracks the pointer ---------- */
  document.querySelectorAll('.btn').forEach((btn) => {
    btn.addEventListener('pointermove', raf((e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      btn.style.setProperty('--bx', `${x}px`);
      btn.style.setProperty('--by', `${y}px`);
      btn.style.translate = `${((x / r.width - 0.5) * 6).toFixed(1)}px ${((y / r.height - 0.5) * 6).toFixed(1)}px`;
    }));
    btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
  });
})();
