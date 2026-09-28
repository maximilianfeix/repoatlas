export function parseRepository(value) {
  if (typeof value !== 'string') throw new Error('Enter a repository URL or owner/repository.');
  const inputValue = value.trim();
  let path = inputValue;
  if (/^github\.com\//i.test(inputValue)) path = `https://${inputValue}`;
  if (/^https?:\/\//i.test(path)) {
    let url;
    try { url = new URL(path); } catch { throw new Error('Enter a valid GitHub repository URL.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || url.search || url.hash) {
      throw new Error('Use a repository URL from github.com.');
    }
    path = url.pathname;
  }
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== 2) throw new Error('Paste a repository URL or enter owner/repository.');
  const [owner, rawName] = parts;
  const name = rawName.replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name) || name === '.' || name === '..') {
    throw new Error('That does not look like a GitHub owner/repository.');
  }
  return { owner, name };
}

export function createCommand(value) {
  const { owner, name } = parseRepository(value);
  return `npx --yes --package=github:maximilianfeix/repoatlas#v2.16.0 -- repoatlas-cli 'https://github.com/${owner}/${name}' -o '${name}-architecture.html'`;
}

if (typeof document !== 'undefined') {
  const themeButton = document.querySelector('#theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeButton) {
    let savedTheme;
    try { savedTheme = localStorage.getItem('repoatlas-theme'); } catch { /* Storage can be unavailable in restricted browsers. */ }
    const initialTheme = savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const setTheme = theme => {
      document.documentElement.dataset.theme = theme;
      themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
      themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      themeButton.querySelector('.toggle-knob').textContent = theme === 'dark' ? '☀' : '☾';
      if (themeMeta) themeMeta.content = theme === 'dark' ? '#111113' : '#efefec';
    };
    setTheme(initialTheme);
    themeButton.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
      try { localStorage.setItem('repoatlas-theme', nextTheme); } catch { /* The current page theme still changes. */ }
    });
  }

  const form = document.querySelector('#repo-command-form');
  const input = document.querySelector('#repo-url');
  const preview = document.querySelector('#command-preview');
  const command = document.querySelector('#command-text');
  const status = document.querySelector('#command-status');
  const copy = document.querySelector('#copy-command');

  function updateCommand() {
    try {
      command.textContent = createCommand(input.value);
      input.removeAttribute('aria-invalid');
      preview.hidden = false;
      status.textContent = 'Ready. Copy the command and run it in your terminal.';
      copy.disabled = false;
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      preview.hidden = true;
      copy.disabled = true;
      status.textContent = error instanceof Error ? error.message : 'Could not build the command.';
    }
  }

  form.addEventListener('submit', event => { event.preventDefault(); updateCommand(); });
  document.querySelectorAll('[data-repo]').forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.dataset.repo;
      updateCommand();
      input.focus();
    });
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(command.textContent);
      status.textContent = 'Copied. Paste it into your terminal to create the map.';
    } catch {
      status.textContent = 'Select the command above and copy it into your terminal.';
    }
  });
  updateCommand();
}
