/**
 * api.js
 * Thin wrapper around fetch() for talking to the Apps Script backend.
 *
 * Sends requests as POST with Content-Type: text/plain;charset=utf-8.
 * This is deliberate: Apps Script Web Apps cannot answer a CORS preflight
 * (OPTIONS) request, so by using a "simple request" content type we avoid
 * triggering one altogether, while still sending a JSON-encoded body that
 * doPost() parses with JSON.parse(e.postData.contents).
 */

var Api = (function () {

  function getToken() {
    return localStorage.getItem('altius_token');
  }

  function call(action, data) {
    var url = window.ALTIUS_CONFIG.API_URL;
    if (!url || url.indexOf('PASTE_YOUR') === 0) {
      return Promise.resolve(apiFail('The app is not yet connected to a backend. Set API_URL in js/config.js.'));
    }
    var body = JSON.stringify({ action: action, token: getToken(), data: data || {} });

    if (!navigator.onLine) {
      return Promise.resolve(apiFail('No internet connection.', 'OFFLINE'));
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body
    })
      .then(function (res) { return res.json(); })
      .catch(function () {
        return apiFail('Something went wrong. Please try again.', 'NETWORK_ERROR');
      })
      .then(function (json) {
        if (json && json.error === 'SESSION_EXPIRED') {
          Session.clear();
        }
        if (json && json.code === 'SESSION_EXPIRED') {
          Session.clear();
        }
        return json;
      });
  }

  function apiFail(message, code) {
    return { success: false, error: message, code: code || 'ERROR' };
  }

  /** Triggers a browser download of a CSV string (legacy/plain-text exports). */
  function downloadCsv(filename, content) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /** Triggers a browser download of base64-encoded binary bytes (used for .xlsx exports). */
  function downloadXlsxBase64(filename, base64, mimeType) {
    var byteChars = atob(base64);
    var byteNumbers = new Array(byteChars.length);
    for (var i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    var byteArray = new Uint8Array(byteNumbers);
    var blob = new Blob([byteArray], { type: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  return { call: call, downloadCsv: downloadCsv, downloadXlsxBase64: downloadXlsxBase64 };
})();

/** Session storage helpers (separate from Api so other modules can use them without circular deps). */
var Session = (function () {
  function save(session) {
    localStorage.setItem('altius_token',    session.token);
    localStorage.setItem('altius_role',     session.role);
    localStorage.setItem('altius_refId',    session.refId);
    localStorage.setItem('altius_branch',   session.branch || '');
    localStorage.setItem('altius_fullName', session.fullName || '');
    localStorage.setItem('altius_gymId',    session.gymId || '');
  }
  function clear() {
    ['altius_token', 'altius_role', 'altius_refId', 'altius_branch', 'altius_fullName', 'altius_gymId']
      .forEach(function (k) { localStorage.removeItem(k); });
  }
  function get() {
    var token = localStorage.getItem('altius_token');
    if (!token) return null;
    return {
      token:    token,
      role:     localStorage.getItem('altius_role'),
      refId:    localStorage.getItem('altius_refId'),
      branch:   localStorage.getItem('altius_branch'),
      fullName: localStorage.getItem('altius_fullName'),
      gymId:    localStorage.getItem('altius_gymId') || ''
    };
  }
  return { save: save, clear: clear, get: get };
})();
