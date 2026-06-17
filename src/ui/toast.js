// Tiny transient notification stack (top-centre of the screen).
export function createToaster(root) {
  const wrap = document.createElement('div');
  wrap.className = 'toasts';
  root.appendChild(wrap);

  function toast(msg, type = 'info', ms = 3200) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = msg;
    wrap.appendChild(el);
    // force reflow so the entrance transition runs
    void el.offsetWidth;
    el.classList.add('toast--in');
    setTimeout(() => {
      el.classList.remove('toast--in');
      el.classList.add('toast--out');
      setTimeout(() => el.remove(), 450);
    }, ms);
  }

  return { toast };
}
