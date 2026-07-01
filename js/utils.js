/**
 * utils.js
 * Small shared helpers: DOM creation, toasts, date/time formatting,
 * confirmation modal. Kept dependency-free (no frameworks).
 */

var UI = (function () {

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function toast(message, isError) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var node = el('<div class="toast">' + escapeHtml(message) + '</div>');
    if (isError) node.style.background = '#E15555';
    document.body.appendChild(node);
    setTimeout(function () { node.remove(); }, 3200);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str === undefined || str === null ? '' : str);
    return div.innerHTML;
  }

  function showLoading(container) {
    container.innerHTML = '<div style="padding:60px 0;"><div class="spinner"></div></div>';
  }

  function emptyState(icon, text) {
    return '<div class="empty-state"><div class="empty-icon">' + icon + '</div><p>' + escapeHtml(text) + '</p></div>';
  }

  /** Formats "2026-07-01" as "Wed, Jul 1". */
  function friendlyDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
  }

  function dayNum(dateStr) {
    return Number(dateStr.split('-')[2]);
  }
  function monthAbbr(dateStr) {
    var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return months[Number(dateStr.split('-')[1]) - 1];
  }

  /** Formats "18:00" as "6:00 PM". */
  function friendlyTime(timeStr) {
    var parts = timeStr.split(':').map(Number);
    var h = parts[0], m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (m < 10 ? '0' + m : m) + ' ' + ampm;
  }

  function friendlyDateTime(iso) {
    var d = new Date(iso);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  /** A bottom-sheet confirmation modal. Returns a Promise<boolean>. */
  function confirmModal(title, message, confirmLabel, danger) {
    return new Promise(function (resolve) {
      var backdrop = el(
        '<div class="modal-backdrop">' +
          '<div class="modal-sheet">' +
            '<h3>' + escapeHtml(title) + '</h3>' +
            '<p>' + escapeHtml(message) + '</p>' +
            '<div class="btn-row" style="margin-top:16px;">' +
              '<button class="btn btn-ghost" data-act="cancel">Cancel</button>' +
              '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-act="confirm">' + escapeHtml(confirmLabel || 'Confirm') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) { backdrop.remove(); resolve(false); }
      });
      backdrop.querySelector('[data-act="cancel"]').onclick = function () { backdrop.remove(); resolve(false); };
      backdrop.querySelector('[data-act="confirm"]').onclick = function () { backdrop.remove(); resolve(true); };
      document.body.appendChild(backdrop);
    });
  }

  /** Generic bottom-sheet for arbitrary form HTML. Returns the sheet element so the caller can wire up its own buttons. */
  function openSheet(innerHtml) {
    var backdrop = el('<div class="modal-backdrop"><div class="modal-sheet">' + innerHtml + '</div></div>');
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
    return backdrop;
  }

  return {
    el: el, toast: toast, escapeHtml: escapeHtml, showLoading: showLoading, emptyState: emptyState,
    friendlyDate: friendlyDate, friendlyTime: friendlyTime, friendlyDateTime: friendlyDateTime,
    dayNum: dayNum, monthAbbr: monthAbbr, confirmModal: confirmModal, openSheet: openSheet
  };
})();

/** Small inline SVG icon set, used where emoji/glyph fonts render inconsistently across devices. */
var ICONS = {
  logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>' +
    '<polyline points="16 17 21 12 16 7"></polyline>' +
    '<line x1="21" y1="12" x2="9" y2="12"></line>' +
    '</svg>',
  eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>' +
    '<circle cx="12" cy="12" r="3"></circle>' +
    '</svg>',
  eyeOff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 4.22-5.06"></path>' +
    '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>' +
    '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>' +
    '<line x1="1" y1="1" x2="23" y2="23"></line>' +
    '</svg>'
};

/**
 * Renders a labeled password field with a built-in show/hide eye toggle.
 * The toggle itself is wired up once, globally, via event delegation below
 * - no per-field setup needed wherever this is used.
 */
function passwordFieldHtml(id, labelText, autocomplete) {
  return '<div class="field">' +
    (labelText ? '<label>' + UI.escapeHtml(labelText) + '</label>' : '') +
    '<div class="password-wrap">' +
      '<input type="password" id="' + id + '" autocomplete="' + (autocomplete || 'new-password') + '">' +
      '<button type="button" class="pw-toggle" data-target="' + id + '" aria-label="Show password">' + ICONS.eye + '</button>' +
    '</div>' +
  '</div>';
}

document.addEventListener('click', function (e) {
  var btn = e.target.closest('.pw-toggle');
  if (!btn) return;
  var input = document.getElementById(btn.dataset.target);
  if (!input) return;
  var willShow = input.type === 'password';
  input.type = willShow ? 'text' : 'password';
  btn.innerHTML = willShow ? ICONS.eyeOff : ICONS.eye;
  btn.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
});
