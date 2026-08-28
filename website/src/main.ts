import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import 'timelinr-element';
import '../../styles/timelinr.css';
import './styles/site.css';

import { initPlayground, renderSnippetInto } from './playground.js';
import { initCopyButtons } from './copy.js';



const playgroundMount = document.querySelector<HTMLElement>('#playground-timeline');
const playgroundControls = document.querySelector<HTMLFormElement>('#playground-controls');
if (playgroundMount && playgroundControls) {
  // The static markup in index.html is the no-JS fallback; once the playground
  // is live the snippet mirrors whatever the user has configured.
  const codeSample = document.querySelector<HTMLElement>('#code-sample code');
  initPlayground(
    playgroundMount,
    playgroundControls,
    codeSample ? renderSnippetInto(codeSample) : undefined,
  );
}

initCopyButtons(document);

// Theme toggle: the boot script in <head> set the initial data-theme;
// flipping it here only persists the user's explicit choice.
const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle');
if (themeToggle) {
  const root = document.documentElement;
  themeToggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  themeToggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('tl-theme', next);
    themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
  });
}
