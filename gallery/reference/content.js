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
  function dateTime(content) {
    const panel = node('div', 'reference-datetime-panel');
    const groups = [
      ['reference-dt-gb reference-dt-gb-date pt-groupbox', 'Current Date'],
      ['reference-dt-gb reference-dt-gb-time pt-groupbox', 'Current Time'],
      ['reference-dt-gb reference-dt-gb-zone pt-groupbox', 'Time Zone'],
      ['reference-dt-gb reference-dt-gb-net pt-groupbox', 'Use a Network Time Server']
    ];
    for (const [cls, title] of groups) {
      const fs = node('fieldset', cls);
      const lg = node('legend', cls.includes('gb-net') ? 'reference-dt-legend-net' : '', title);
      fs.append(lg);
      panel.append(fs);
    }
    const mkField = (cls, val, label) => {
      const inp = node('input', `reference-dt-field ${cls} pt-field`);
      inp.type = 'text';
      inp.readOnly = true;
      inp.tabIndex = -1;
      inp.value = val;
      inp.setAttribute('aria-label', label);
      return inp;
    };
    panel.append(
      mkField('reference-dt-field-date', '11/23/2026', 'Current Date'),
      node('span', 'reference-dt-stepper reference-dt-stepper-date'),
      mkField('reference-dt-field-time', '2:36:51 PM', 'Current Time'),
      node('span', 'reference-dt-stepper reference-dt-stepper-time')
    );
    const buttons = [
      ['reference-dt-btn-date', 'Date Formats...', false],
      ['reference-dt-btn-time', 'Time Formats...', false],
      ['reference-dt-btn-zone', 'Set Time Zone...', false],
      ['reference-dt-btn-server', 'Server Options...', true],
      ['reference-dt-btn-clock', 'Clock Options...', false]
    ];
    for (const [cls, label, disabled] of buttons) {
      const btn = node('button', `reference-dt-btn ${cls} pt-btn`, label);
      btn.type = 'button';
      btn.tabIndex = -1;
      btn.disabled = disabled;
      panel.append(btn);
    }
    const checks = [
      ['reference-dt-chk-auto', 'Set Daylight-Saving Time Automatically', true, false, 'reference-dt-lbl-auto'],
      ['reference-dt-chk-dst', 'Daylight-Saving Time is in effect', false, true, 'reference-dt-lbl-dst'],
      ['reference-dt-chk-net', '', false, false, '']
    ];
    for (const [cls, text, checked, disabled, lblCls] of checks) {
      const chk = node('input', `reference-dt-chk ${cls} pt-checkbox`);
      chk.type = 'checkbox';
      chk.tabIndex = -1;
      chk.checked = checked;
      chk.disabled = disabled;
      chk.setAttribute('aria-label', text || 'Use a Network Time Server');
      panel.append(chk);
      if (text) panel.append(node('span', `reference-dt-label ${lblCls}`, text));
    }
    panel.append(
      node('span', 'reference-dt-text reference-dt-zone-note', 'Montréal is a city in the current\ntime zone.'),
      node('span', 'reference-dt-text reference-dt-net-1', 'Time server: Apple Americas/...'),
      node('span', 'reference-dt-text reference-dt-net-2', 'Clock has not been synchronized.'),
      node('span', 'reference-dt-label reference-dt-mb-hdr', 'Menu Bar Clock')
    );
    for (const [cls, label, checked, lblCls] of [
      ['reference-dt-rad-on', 'On', true, 'reference-dt-rad-lbl-on'],
      ['reference-dt-rad-off', 'Off', false, 'reference-dt-rad-lbl-off']
    ]) {
      const rad = node('input', `reference-dt-rad ${cls} pt-radio`);
      rad.type = 'radio';
      rad.name = 'dt-mb-clock';
      rad.tabIndex = -1;
      rad.checked = checked;
      rad.setAttribute('aria-label', label);
      panel.append(rad, node('span', `reference-dt-label ${lblCls}`, label));
    }
    const help = node('span', 'reference-help reference-dt-help pt-btn', '?');
    help.setAttribute('role', 'img');
    help.setAttribute('aria-label', 'Help');
    panel.append(help);
    content.append(panel);
  }
  window.renderReferenceContent = function (windowElement, sample) {
    windowElement.querySelector('.reference-content')?.remove();
    const content = node('div', 'reference-content');
    const win = sample.window ?? '';
    const kind = (win === 'finder' || String(sample.id).startsWith('finder'))
      ? 'finder'
      : (win === 'date-time' || String(sample.id).startsWith('date-time'))
        ? 'date-time'
        : 'appearance';
    content.dataset.content = kind;
    windowElement.append(content);
    if (kind === 'finder') finder(content, sample);
    else if (kind === 'date-time') dateTime(content);
    else appearance(content);
  };
}());
