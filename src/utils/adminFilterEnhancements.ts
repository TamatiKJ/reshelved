let activeUserFilter: 'all' | 'admin' = 'all';

const STYLE_ID = 'admin-filter-enhancements-style';

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .admin-link-filter-bar {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      gap: 0 !important;
      margin-bottom: 0.75rem !important;
      font-size: 14px !important;
      line-height: 20px !important;
    }

    .admin-link-filter-bar button,
    .admin-link-filter-bar [role="button"] {
      cursor: pointer !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      padding: 0 !important;
      box-shadow: none !important;
      color: #44403c !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      line-height: 20px !important;
      transition: color 150ms ease !important;
    }

    .admin-link-filter-bar button:hover,
    .admin-link-filter-bar [role="button"]:hover,
    .admin-link-filter-bar [data-active="true"] {
      color: #1665CC !important;
    }

    .admin-link-filter-bar .admin-filter-count,
    .admin-link-filter-bar button span,
    .admin-link-filter-bar [role="button"] span {
      color: #a8a29e !important;
      font-weight: 600 !important;
    }

    .admin-link-filter-bar .admin-filter-separator {
      margin: 0 10px !important;
      color: #d6d3d1 !important;
      font-weight: 600 !important;
    }
  `;
  document.head.appendChild(style);
};

const getPanelByTitle = (title: string) => {
  const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>('h3'));
  return headings.find((heading) => heading.textContent?.trim().toLowerCase().startsWith(title.toLowerCase()))?.closest('section') as HTMLElement | null;
};

const addSeparators = (container: HTMLElement) => {
  Array.from(container.querySelectorAll('.admin-filter-separator')).forEach((item) => item.remove());
  const items = Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]')).filter((item) => item.textContent?.trim());

  items.forEach((item, index) => {
    if (index === items.length - 1) return;
    const separator = document.createElement('span');
    separator.className = 'admin-filter-separator';
    separator.textContent = '|';
    item.insertAdjacentElement('afterend', separator);
  });
};

const normalizeStatusFilterBar = (panelTitle: string) => {
  const panel = getPanelByTitle(panelTitle);
  if (!panel) return;

  const filterContainer = Array.from(panel.querySelectorAll<HTMLElement>('div')).find((element) => {
    const text = element.textContent || '';
    const buttons = element.querySelectorAll('button');
    return buttons.length >= 2 && (text.includes('All') || text.includes('Active') || text.includes('Published'));
  });

  if (!filterContainer) return;
  filterContainer.classList.add('admin-link-filter-bar');

  Array.from(filterContainer.querySelectorAll<HTMLButtonElement>('button')).forEach((button) => {
    const isActive = button.className.includes('text-[#1665CC]') || button.className.includes('bg-[#1665CC]') || button.getAttribute('aria-current') === 'true';
    button.dataset.active = String(isActive);
  });

  addSeparators(filterContainer);
};

const getUsersPanel = () => getPanelByTitle('Users');

const applyUserRoleFilter = () => {
  const panel = getUsersPanel();
  if (!panel) return;

  const rows = Array.from(panel.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td'));
    const roleText = cells[3]?.textContent?.trim().toLowerCase() || '';
    row.style.display = activeUserFilter === 'admin' && !roleText.includes('admin') ? 'none' : '';
  });
};

const normalizeUserFilterBar = () => {
  const panel = getUsersPanel();
  if (!panel) return;

  const legacyFilter = Array.from(panel.querySelectorAll<HTMLElement>('div')).find((element) => {
    const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
    return text.includes('All') && text.includes('Admins') && element.querySelectorAll('span').length >= 2;
  });

  if (!legacyFilter) return;
  legacyFilter.classList.add('admin-link-filter-bar');

  const allItem = Array.from(legacyFilter.querySelectorAll<HTMLElement>('span')).find((item) => item.textContent?.trim().startsWith('All'));
  const adminItem = Array.from(legacyFilter.querySelectorAll<HTMLElement>('span')).find((item) => item.textContent?.trim().startsWith('Admins'));

  [allItem, adminItem].forEach((item) => {
    if (!item) return;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
  });

  if (allItem) allItem.dataset.active = String(activeUserFilter === 'all');
  if (adminItem) adminItem.dataset.active = String(activeUserFilter === 'admin');

  if (legacyFilter.dataset.userFilterBound !== 'true') {
    legacyFilter.dataset.userFilterBound = 'true';
    legacyFilter.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const item = target.closest<HTMLElement>('[role="button"]');
      if (!item) return;

      activeUserFilter = item.textContent?.trim().startsWith('Admins') ? 'admin' : 'all';
      normalizeUserFilterBar();
      applyUserRoleFilter();
    });

    legacyFilter.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target as HTMLElement;
      if (target.getAttribute('role') !== 'button') return;
      event.preventDefault();
      target.click();
    });
  }

  addSeparators(legacyFilter);
  applyUserRoleFilter();
};

const enhanceAdminFilters = () => {
  ensureStyles();
  normalizeStatusFilterBar('Listings');
  normalizeStatusFilterBar('All Posts');
  normalizeUserFilterBar();
};

export const enableAdminFilterEnhancements = () => {
  if (typeof window === 'undefined') return;
  enhanceAdminFilters();
  new MutationObserver(enhanceAdminFilters).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
};
