// theme.js
// Stores the dark/light choice in localStorage and applies it on every page.

function applyStoredTheme() {
  const theme = localStorage.getItem('sw_theme') || 'light';
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  return theme;
}

function setTheme(theme) {
  localStorage.setItem('sw_theme', theme);
  applyStoredTheme();
}

function toggleTheme(isDark) {
  setTheme(isDark ? 'dark' : 'light');
}

// Run immediately (before the page finishes loading) to avoid a flash of the wrong theme
applyStoredTheme();
