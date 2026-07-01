/**
 * app.js
 * Entry point. Decides what to show on load:
 *   - No valid session -> login screen
 *   - Valid session     -> the matching role's app (Member / Reception / Admin)
 *
 * Also registers the service worker for offline/installable PWA support.
 */

var App = (function () {

  function boot() {
    var session = Session.get();
    if (!session) {
      Auth.renderLogin();
      return;
    }
    // Verify the token is still valid server-side before committing to a role UI.
    Api.call('whoAmI', {}).then(function (res) {
      if (!res.success) {
        Session.clear();
        Auth.renderLogin();
        return;
      }
      route(session);
    });
  }

  function route(session) {
    if (session.role === 'Member') { MemberApp.start(session); return; }
    if (session.role === 'Reception') { ReceptionApp.start(session); return; }
    if (session.role === 'Admin') { AdminApp.start(session); return; }
    Auth.renderLogin();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js').catch(function () {
          // Non-fatal: app still works online without the service worker.
        });
      });
    }
  }

  return { boot: boot, registerServiceWorker: registerServiceWorker };
})();

document.addEventListener('DOMContentLoaded', function () {
  App.registerServiceWorker();
  App.boot();
});
