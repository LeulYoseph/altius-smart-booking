/**
 * reception.js
 * Reception role: register/edit/activate/deactivate members, search,
 * view bookings, and export reports. Reception cannot touch schedules
 * or settings (enforced server-side too, but the UI simply never shows
 * those screens for this role).
 */

var ReceptionApp = (function () {
  var session;
  var currentTab = 'dashboard';
  var branches = ['Summit', 'Tafo'];

  function start(s) {
    session = s;
    Api.call('getPublicSettings', {}).then(function (res) {
      if (res.success) branches = res.data.branches;
      renderShell();
      goTo('dashboard');
    });
  }

  function renderShell() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="topbar">' +
        '<div class="brand"><div class="brand-mark"><img src="' + (window.ALTIUS_CONFIG.LOGO_URL || 'icons/logo.png') + '" alt="Altius Gym"></div><div><h1>Altius Booking</h1><span class="role-tag">Reception</span></div></div>' +
        '<button class="icon-btn" id="logout-btn" title="Log out">' + ICONS.logout + '</button>' +
      '</div>' +
      '<main id="main"></main>' +
      '<nav class="bottom-nav">' +
        navItem('dashboard', '🏠', 'Home') +
        navItem('members', '🔍', 'Members') +
        navItem('bookings', '🎟️', 'Bookings') +
      '</nav>';
    document.getElementById('logout-btn').addEventListener('click', Auth.logout);
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.addEventListener('click', function () { goTo(item.dataset.tab); });
    });
  }

  function navItem(tab, icon, label) {
    return '<div class="nav-item ' + (tab === currentTab ? 'active' : '') + '" data-tab="' + tab + '">' +
      '<span class="nav-icon">' + icon + '</span><span>' + label + '</span></div>';
  }

  function goTo(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(function (item) { item.classList.toggle('active', item.dataset.tab === tab); });
    var main = document.getElementById('main');
    UI.showLoading(main);
    if (tab === 'dashboard') renderDashboard(main);
    if (tab === 'members') renderMembers(main);
    if (tab === 'bookings') renderBookings(main);
  }

  // --- Dashboard ---------------------------------------------------------

  function renderDashboard(main) {
    Api.call('getReceptionDashboard', {}).then(function (res) {
      if (!res.success) { main.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var d = res.data;
      main.innerHTML =
        '<div class="section-title">Overview</div>' +
        '<div class="stat-grid">' +
          statCard(d.totalMembers, 'Total Members') +
          statCard(d.activeMembers, 'Active Members') +
          statCard(d.todaysBookingsCount, "Today's Bookings") +
        '</div>' +
        '<div class="section-title">Quick Actions</div>' +
        '<button class="btn btn-primary" id="quick-register" style="margin-bottom:10px;">＋ Register Member</button>' +
        '<button class="btn btn-ghost" id="quick-search">🔍 Search Members</button>';
      document.getElementById('quick-register').addEventListener('click', openRegisterMemberSheet);
      document.getElementById('quick-search').addEventListener('click', function () { goTo('members'); });
    });
  }

  function statCard(value, label) {
    return '<div class="stat-card"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>';
  }

  // --- Members -------------------------------------------------------------

  function renderMembers(main) {
    main.innerHTML =
      '<div class="search-bar"><span class="search-icon">🔍</span><input id="member-search" placeholder="Search by name, ID, or phone"></div>' +
      '<button class="btn btn-primary" id="register-btn" style="margin-bottom:14px;">＋ Register New Member</button>' +
      '<div id="member-results"></div>';

    document.getElementById('register-btn').addEventListener('click', openRegisterMemberSheet);
    var input = document.getElementById('member-search');
    input.addEventListener('input', debounce(function () { runMemberSearch(input.value); }, 300));
    runMemberSearch('');
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); var args = arguments; t = setTimeout(function () { fn.apply(null, args); }, ms); };
  }

  function runMemberSearch(query) {
    var results = document.getElementById('member-results');
    Api.call('searchMembers', { query: query }).then(function (res) {
      if (!res.success) { results.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var members = res.data.members;
      if (!members.length) { results.innerHTML = UI.emptyState('🔍', 'No members found.'); return; }
      results.innerHTML = members.map(memberCardHtml).join('');
      results.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { openEditMemberSheet(b.dataset.edit, members); }); });
      results.querySelectorAll('[data-toggle]').forEach(function (b) { b.addEventListener('click', function () { toggleMemberStatus(b.dataset.toggle, b.dataset.status); }); });
      results.querySelectorAll('[data-resetpw]').forEach(function (b) { b.addEventListener('click', function () { openResetMemberPasswordSheet(b.dataset.resetpw); }); });
    });
  }

  function memberCardHtml(m) {
    var nextStatus = m.status === 'Active' ? 'Inactive' : 'Active';
    return '<div class="card">' +
      '<div class="card-row"><strong>' + UI.escapeHtml(m.fullName) + '</strong><span class="status-pill status-' + m.status + '">' + m.status + '</span></div>' +
      '<p>' + m.memberId + (m.gymId ? ' · Gym ID: ' + UI.escapeHtml(m.gymId) : '') + ' · ' + UI.escapeHtml(m.phone) + ' · ' + m.branch + '</p>' +
      '<div class="btn-row">' +
        '<button class="btn btn-ghost btn-sm" data-edit="' + m.memberId + '">Edit</button>' +
        '<button class="btn btn-ghost btn-sm" data-resetpw="' + m.memberId + '">Reset Password</button>' +
        '<button class="btn btn-sm ' + (m.status === 'Active' ? 'btn-danger' : 'btn-primary') + '" data-toggle="' + m.memberId + '" data-status="' + nextStatus + '">' +
          (m.status === 'Active' ? 'Deactivate' : 'Activate') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function openResetMemberPasswordSheet(memberId) {
    var sheet = UI.openSheet(
      '<h3>Reset Password — ' + UI.escapeHtml(memberId) + '</h3>' +
      passwordFieldHtml('rmp-password', 'New Password (at least 6 characters)') +
      '<div id="rmp-error"></div>' +
      '<button class="btn btn-primary" id="rmp-submit">Reset Password</button>'
    );
    sheet.querySelector('#rmp-submit').addEventListener('click', function () {
      Api.call('resetMemberPassword', { memberId: memberId, newPassword: sheet.querySelector('#rmp-password').value }).then(function (res) {
        if (!res.success) { sheet.querySelector('#rmp-error').innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>'; return; }
        sheet.remove();
        UI.toast('Password reset.');
      });
    });
  }

  function toggleMemberStatus(memberId, status) {
    Api.call('setMemberStatus', { memberId: memberId, status: status }).then(function (res) {
      if (!res.success) { UI.toast(res.error, true); return; }
      UI.toast('Member ' + (status === 'Active' ? 'activated' : 'deactivated') + '.');
      runMemberSearch(document.getElementById('member-search').value);
    });
  }

  function openRegisterMemberSheet() {
    var sheet = UI.openSheet(
      '<h3>Register Member</h3>' +
      '<div class="field"><label>Full Name</label><input id="rm-name"></div>' +
      '<div class="field"><label>Phone Number</label><input id="rm-phone" type="tel"></div>' +
      '<div class="field"><label>Gym ID (optional — their physical membership card number)</label><input id="rm-gymid" placeholder="e.g. GYM001"></div>' +
      '<div class="field"><label>Branch</label><select id="rm-branch">' +
        branches.map(function (b) { return '<option value="' + b + '">' + b + '</option>'; }).join('') +
      '</select></div>' +
      passwordFieldHtml('rm-password', 'Password (at least 6 characters)') +
      '<p class="helper-text">The member will use this password to log in. They can change it themselves afterward.</p>' +
      '<div id="rm-error"></div>' +
      '<button class="btn btn-primary" id="rm-submit">Register</button>'
    );
    sheet.querySelector('#rm-submit').addEventListener('click', function () {
      var payload = {
        fullName: sheet.querySelector('#rm-name').value.trim(),
        phone:    sheet.querySelector('#rm-phone').value.trim(),
        gymId:    sheet.querySelector('#rm-gymid').value.trim(),
        branch:   sheet.querySelector('#rm-branch').value,
        password: sheet.querySelector('#rm-password').value
      };
      Api.call('registerMember', payload).then(function (res) {
        if (!res.success) { sheet.querySelector('#rm-error').innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>'; return; }
        sheet.remove();
        UI.toast('Member registered: ' + res.data.memberId);
        if (currentTab === 'members') runMemberSearch(document.getElementById('member-search').value);
        else goTo('dashboard');
      });
    });
  }

  function openEditMemberSheet(memberId, members) {
    var member = members.filter(function (m) { return m.memberId === memberId; })[0];
    if (!member) return;
    var sheet = UI.openSheet(
      '<h3>Edit Member</h3>' +
      '<div class="field"><label>Full Name</label><input id="em-name" value="' + UI.escapeHtml(member.fullName) + '"></div>' +
      '<div class="field"><label>Phone Number</label><input id="em-phone" value="' + UI.escapeHtml(member.phone) + '"></div>' +
      '<div class="field"><label>Branch</label><select id="em-branch">' +
        branches.map(function (b) { return '<option value="' + b + '" ' + (b === member.branch ? 'selected' : '') + '>' + b + '</option>'; }).join('') +
      '</select></div>' +
      '<div id="em-error"></div>' +
      '<button class="btn btn-primary" id="em-submit">Save Changes</button>'
    );
    sheet.querySelector('#em-submit').addEventListener('click', function () {
      var payload = {
        memberId: memberId,
        fullName: sheet.querySelector('#em-name').value.trim(),
        phone: sheet.querySelector('#em-phone').value.trim(),
        branch: sheet.querySelector('#em-branch').value
      };
      Api.call('editMember', payload).then(function (res) {
        if (!res.success) { sheet.querySelector('#em-error').innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>'; return; }
        sheet.remove();
        UI.toast('Member updated.');
        runMemberSearch(document.getElementById('member-search').value);
      });
    });
  }

  // --- Bookings + export ----------------------------------------------------

  function renderBookings(main) {
    main.innerHTML =
      '<div class="card">' +
        '<div class="field"><label>Filter by date</label><input type="date" id="bk-date"></div>' +
        '<div class="field"><label>Filter by class / session</label><select id="bk-class"><option value="">All Classes</option></select></div>' +
        '<div class="btn-row">' +
          '<button class="btn btn-ghost btn-sm" id="bk-today">Today</button>' +
          '<button class="btn btn-ghost btn-sm" id="bk-clear">Clear Filters</button>' +
        '</div>' +
      '</div>' +
      '<div class="btn-row" style="margin-bottom:14px;">' +
        '<button class="btn btn-accent btn-sm" id="export-today">Export Today</button>' +
        '<button class="btn btn-accent btn-sm" id="export-filtered">Export Filtered</button>' +
      '</div>' +
      '<div id="bookings-results"></div>';

    document.getElementById('bk-date').addEventListener('change', applyBookingFilters);
    document.getElementById('bk-class').addEventListener('change', applyBookingFilters);
    document.getElementById('bk-today').addEventListener('click', function () {
      document.getElementById('bk-date').value = new Date().toISOString().slice(0, 10);
      applyBookingFilters();
    });
    document.getElementById('bk-clear').addEventListener('click', function () {
      document.getElementById('bk-date').value = '';
      document.getElementById('bk-class').value = '';
      applyBookingFilters();
    });
    document.getElementById('export-today').addEventListener('click', function () {
      Api.call('exportBookings', { mode: 'today' }).then(handleExportResult);
    });
    document.getElementById('export-filtered').addEventListener('click', function () {
      var date = document.getElementById('bk-date').value;
      var classId = document.getElementById('bk-class').value;
      // A specific class/session takes priority - it's the most precise filter available.
      if (classId) Api.call('exportBookings', { mode: 'byClass', classId: classId }).then(handleExportResult);
      else if (date) Api.call('exportBookings', { mode: 'byDate', date: date }).then(handleExportResult);
      else UI.toast('Pick a class or a date first to export.', true);
    });

    loadClassFilterOptions();
    applyBookingFilters();
  }

  function loadClassFilterOptions() {
    var select = document.getElementById('bk-class');
    Api.call('listUpcomingClasses', {}).then(function (res) {
      if (!res.success || !select) return;
      var current = select.value;
      select.innerHTML = '<option value="">All Classes</option>' +
        res.data.classes.map(function (c) {
          return '<option value="' + c.classId + '">' + c.branch + ' · ' + UI.friendlyDate(c.date) + ' · ' + UI.friendlyTime(c.time) + ' (' + c.availableSeats + '/' + c.capacity + ' open)</option>';
        }).join('');
      select.value = current;
    });
  }

  function applyBookingFilters() {
    runBookingsQuery({
      date: document.getElementById('bk-date').value,
      classId: document.getElementById('bk-class').value
    });
  }

  function handleExportResult(res) {
    if (!res.success) { UI.toast(res.error, true); return; }
    Api.downloadXlsxBase64(res.data.filename, res.data.base64, res.data.mimeType);
    UI.toast('Export downloaded.');
  }

  function runBookingsQuery(filters) {
    var results = document.getElementById('bookings-results');
    results.innerHTML = '<div class="spinner"></div>';
    Api.call('viewAllBookings', filters).then(function (res) {
      if (!res.success) { results.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var bookings = res.data.bookings;
      if (!bookings.length) { results.innerHTML = UI.emptyState('🎟️', 'No bookings found.'); return; }
      results.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
        '<th>Member</th><th>Branch</th><th>Date</th><th>Time</th><th>Seat</th><th>Status</th>' +
        '</tr></thead><tbody>' +
        bookings.map(function (b) {
          return '<tr><td>' + UI.escapeHtml(b.memberName) + '<br><span class="helper-text">' + b.memberId + '</span></td>' +
            '<td>' + b.branch + '</td><td>' + b.date + '</td><td>' + UI.friendlyTime(b.time) + '</td>' +
            '<td>' + b.seat + '</td><td><span class="status-pill status-' + b.status + '">' + b.status + '</span></td></tr>';
        }).join('') +
        '</tbody></table></div>';
    });
  }

  return { start: start };
})();
