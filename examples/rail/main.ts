import { Timelinr } from '../../src';

const root = document.getElementById('timeline')!;
const timelinr = new Timelinr(root, { arrowKeys: true });

root.addEventListener('timelinr:change', () => {
  document.title = `timelinr — rail (${timelinr.index + 1}/${timelinr.count})`;
});
