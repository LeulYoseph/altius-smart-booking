/**
 * auth.js
 * Renders the login screen (with Member / Staff tabs) and handles the
 * login + logout flows. On success, hands off to App.boot() to render
 * the correct dashboard for the resulting role.
 */

var Auth = (function () {

  function renderLogin() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="login-screen">' +
        '<div class="login-hero">' +
          '<div class="brand-mark"><img src="' + (window.ALTIUS_CONFIG.LOGO_URL || 'icons/logo.png') + '" alt="Altius Gym"></div>' +
          '<h1>Altius Booking</h1>' +
          '<p>Book your class seat in seconds.</p>' +
        '</div>' +
        '<div class="login-tabs">' +
          '<div class="login-tab active" data-tab="member">Member</div>' +
          '<div class="login-tab" data-tab="staff">Reception / Admin</div>' +
        '</div>' +
        '<div id="login-pane"></div>' +
      '</div>';

    var tabs = app.querySelectorAll('.login-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        renderPane(tab.dataset.tab);
      });
    });
    renderPane('member');
  }

  function renderPane(which) {
    var pane = document.getElementById('login-pane');
    if (which === 'member') {
      pane.innerHTML =
        '<div class="card">' +
          '<div class="field">' +
            '<label>Gym ID, phone number, or full name</label>' +
            '<input id="member-identifier" type="text" placeholder="e.g. SAG 001, 0911000002, or Helen Bekele" autocomplete="username">' +
          '</div>' +
          '<div class="field">' +
            '<label>Password</label>' +
            '<div class="password-wrap">' +
              '<input id="member-password" type="password" autocomplete="current-password">' +
              '<button type="button" class="pw-toggle" data-target="member-password" aria-label="Show password">' + ICONS.eye + '</button>' +
            '</div>' +
          '</div>' +
          '<div id="member-login-error"></div>' +
          '<button class="btn btn-primary" id="member-login-btn">Log In</button>' +
        '</div>';
      document.getElementById('member-login-btn').addEventListener('click', doMemberLogin);
      document.getElementById('member-identifier').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doMemberLogin();
      });
      document.getElementById('member-password').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doMemberLogin();
      });
    } else {
      pane.innerHTML =
        '<div class="card">' +
          '<div class="field">' +
            '<label>Username</label>' +
            '<input id="staff-username" type="text" autocomplete="username">' +
          '</div>' +
          '<div class="field">' +
            '<label>Password</label>' +
            '<div class="password-wrap">' +
              '<input id="staff-password" type="password" autocomplete="current-password">' +
              '<button type="button" class="pw-toggle" data-target="staff-password" aria-label="Show password">' + ICONS.eye + '</button>' +
            '</div>' +
          '</div>' +
          '<div id="staff-login-error"></div>' +
          '<button class="btn btn-primary" id="staff-login-btn">Log In</button>' +
        '</div>';
      document.getElementById('staff-login-btn').addEventListener('click', doStaffLogin);
      document.getElementById('staff-password').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doStaffLogin();
      });
    }
  }

  function doMemberLogin() {
    var identifier = document.getElementById('member-identifier').value.trim();
    var password = document.getElementById('member-password').value;
    var errorBox = document.getElementById('member-login-error');
    errorBox.innerHTML = '';
    if (!identifier || !password) {
      errorBox.innerHTML = '<p class="error-text">Please enter your name/phone number and password.</p>';
      return;
    }
    var btn = document.getElementById('member-login-btn');
    btn.disabled = true; btn.textContent = 'Logging in…';
    Api.call('memberLogin', { identifier: identifier, password: password }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Log In';
      if (!res.success) {
        errorBox.innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>';
        return;
      }
      Session.save(res.data.session);
      App.boot();
    });
  }

  function doStaffLogin() {
    var username = document.getElementById('staff-username').value.trim();
    var password = document.getElementById('staff-password').value;
    var errorBox = document.getElementById('staff-login-error');
    errorBox.innerHTML = '';
    if (!username || !password) {
      errorBox.innerHTML = '<p class="error-text">Please enter both username and password.</p>';
      return;
    }
    var btn = document.getElementById('staff-login-btn');
    btn.disabled = true; btn.textContent = 'Logging in…';
    Api.call('staffLogin', { username: username, password: password }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Log In';
      if (!res.success) {
        errorBox.innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>';
        return;
      }
      Session.save(res.data.session);
      App.boot();
    });
  }

  function logout() {
    var token = Session.get() ? Session.get().token : null;
    Api.call('logout', {}).then(function () {
      Session.clear();
      renderLogin();
    });
    // Clear immediately too, in case the network call is slow/offline.
    if (token) { Session.clear(); }
  }

  return { renderLogin: renderLogin, logout: logout };
})();
