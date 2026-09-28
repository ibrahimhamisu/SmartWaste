// fontsize.js
// Stores the user's preferred font size (small/medium/large) and applies it
// site-wide by scaling the root font-size (everything else uses rem, so it scales too).

const FONT_SIZES = { small: '14px', medium: '16px', large: '19px' };

function applyStoredFontSize() {
  const size = localStorage.getItem('sw_fontsize') || 'medium';
  document.documentElement.style.setProperty('--base-font-size', FONT_SIZES[size] || FONT_SIZES.medium);
  return size;
}

function setFontSize(size) {
  if (!FONT_SIZES[size]) size = 'medium';
  localStorage.setItem('sw_fontsize', size);
  applyStoredFontSize();
}

applyStoredFontSize();
