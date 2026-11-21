/* Historical fixture contents: real text and DOM, deliberately outside the tab order. */
(function () {
  'use strict';
  const tabs = ['Themes', 'Appearance', 'Fonts', 'Desktop', 'Sound', 'Options'];
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  function finder(content, sample) {
    const scrolling = sample.state === 'scrollbars';
    const info = node('div', 'reference-finder-info', scrolling ? '1 item, 54.4 MB available' : '0 items, 54.4 MB available');
    const pane = node('div', 'reference-finder-pane pt-well');
    pane.setAttribute('role', 'region');
    pane.setAttribute('aria-label', 'Empty platinum folder');
    content.append(info, pane);
    for (const direction of ['vertical', 'horizontal']) {
      const scroll = node('div', `reference-scroll reference-scroll-${direction}`);
      scroll.setAttribute('aria-hidden', 'true');
      const track = node('span', 'reference-scroll-track');
      if (scrolling) track.append(node('span', 'reference-scroll-thumb'));
      scroll.append(track);
      for (const end of ['back', 'forward']) scroll.append(node('span', `reference-scroll-arrow reference-scroll-${end}`));
      content.append(scroll);
    }
    const grip = node('span', 'reference-resize');
    grip.setAttribute('aria-hidden', 'true');
    for (let ridge = 0; ridge < 3; ridge++) grip.append(node('span', 'reference-resize-ridge'));
    content.append(grip);
  }
  function appearance(content) {
    const panel = node('div', 'reference-appearance-panel');
    const tablist = node('div', 'reference-tabs');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'Appearance settings (historical still)');
    for (const [index, text] of tabs.entries()) {
      const tab = node('span', `reference-tab reference-tab-${index}`, text);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(index === 1));
      tablist.append(tab);
    }
    const body = node('div', 'reference-appearance-body pt-well');
    body.setAttribute('role', 'tabpanel');
    body.setAttribute('aria-label', 'Appearance');
    const fields = [
      ['Appearance:', 'Apple platinum', 'for the overall look of menus, icons, windows, and controls'],
      ['Highlight Color:', 'Purple', 'for selected text'],
      ['Variation:', 'Lavender', 'for menus and controls']
    ];
    for (const [index, [label, value, hint]] of fields.entries()) {
      const row = node('div', `reference-setting reference-setting-${index}`);
      const caption = node('span', 'reference-setting-label', label);
      const popup = node('span', 'reference-popup pt-select');
      popup.setAttribute('role', 'img');
      popup.setAttribute('aria-label', `${label} ${value}`);
      if (index) popup.append(node('span', `reference-swatch reference-swatch-${index}`));
      popup.append(node('span', 'reference-popup-value', value), node('span', 'reference-popup-arrows'));
      row.append(caption, popup, node('span', 'reference-setting-hint', hint));
      body.append(row);
    }
    const help = node('span', 'reference-help pt-btn', '?');
    help.setAttribute('role', 'img');
    help.setAttribute('aria-label', 'Help');
    body.append(help);
    const menu = node('div', 'reference-appearance-menu pt-menu');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Appearance theme menu');
    const item = node('span', 'reference-menu-item', 'Apple platinum');
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', 'true');
    menu.append(item);
    body.append(menu);
    panel.append(tablist, body);
    content.append(panel);
  }
  window.renderReferenceContent = function (windowElement, sample) {
    windowElement.querySelector('.reference-content')?.remove();
    const content = node('div', 'reference-content');
    const kind = sample.window === 'finder' || String(sample.id).startsWith('finder') ? 'finder' : 'appearance';
    content.dataset.content = kind;
    windowElement.append(content);
    if (kind === 'finder') finder(content, sample);
    else appearance(content);
  };
}());
