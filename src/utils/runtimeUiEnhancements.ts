const RANGE_SELECTOR = 'input[type="range"]';
const PROFILE_LOGIN_BUTTON_SELECTOR = '[data-login-contact-button="true"]';

const normalizeBackButtonLabels = () => {
  document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    if ((button.textContent || '').trim() === '← Browse listings') {
      button.textContent = '← Back';
    }
  });
};

const appendPublicProfileLoginContactButton = () => {
  if (!window.location.pathname.startsWith('/user/')) return;
  if (document.querySelector(PROFILE_LOGIN_BUTTON_SELECTOR)) return;
  if (document.querySelector('button i.la-comment')) return;
  if (document.querySelector('nav.mt-5')) return;

  const profileCard = document.querySelector<HTMLElement>('aside .flex.flex-col.items-center.text-center');
  if (!profileCard) return;

  const button = document.createElement('a');
  button.href = '/login';
  button.dataset.loginContactButton = 'true';
  button.className = 'mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#FF5F57] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#e84f48]';
  button.innerHTML = '<i class="las la-comment text-lg"></i>Log in to Contact';
  profileCard.appendChild(button);
};

const paintRange = (range: HTMLInputElement) => {
  const min = Number(range.min || 0);
  const max = Number(range.max || 100);
  const value = Number(range.value || min);
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  range.style.background = `linear-gradient(90deg, #1665CC 0%, #1665CC ${percent}%, #e7e5e4 ${percent}%, #e7e5e4 100%)`;
};

const paintAllRanges = () => {
  document.querySelectorAll<HTMLInputElement>(RANGE_SELECTOR).forEach(paintRange);
};

const runRuntimeUiEnhancements = () => {
  normalizeBackButtonLabels();
  appendPublicProfileLoginContactButton();
  paintAllRanges();
};

export const initializeRuntimeUiEnhancements = () => {
  runRuntimeUiEnhancements();

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches(RANGE_SELECTOR)) paintRange(target);
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches(RANGE_SELECTOR)) paintRange(target);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>('button');
    if (button && (button.textContent || '').trim() === 'Reset') {
      window.setTimeout(paintAllRanges, 0);
      window.setTimeout(paintAllRanges, 60);
    }
  }, true);

  new MutationObserver(runRuntimeUiEnhancements).observe(document.body, { childList: true, subtree: true });
};
