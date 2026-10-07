// ====================================================================
// CLOUDY BUDGET - TOAST NOTIFICATION COMPONENT
// ====================================================================

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast({ text, icon = '✨', onUndo = null, duration = 3500 }) {
  const cont = ensureContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';

  const iconSpan = document.createElement('span');
  iconSpan.style.fontSize = '1.25rem';
  iconSpan.textContent = icon;
  toast.appendChild(iconSpan);

  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  toast.appendChild(textSpan);

  if (onUndo) {
    const undoBtn = document.createElement('button');
    undoBtn.className = 'toast-action';
    undoBtn.textContent = 'Undo';
    undoBtn.onclick = () => {
      onUndo();
      removeToast();
    };
    toast.appendChild(undoBtn);
  }

  cont.appendChild(toast);

  function removeToast() {
    toast.style.transition = 'opacity 0.25s, transform 0.25s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 260);
  }

  const timer = setTimeout(removeToast, duration);
}
