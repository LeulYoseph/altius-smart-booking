/**
 * admin.js
 * Full Admin console: dashboard summary, recurring schedule management,
 * member management (including delete), Reception account management,
 * booking views + export, and system Settings (seat layout, branches,
 * gym name, booking open/close defaults).
 */

var AdminApp = (function () {
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
        '<div class="brand"><div class="brand-mark"><img src="' + (window.ALTIUS_CONFIG.LOGO_URL || 'icons/logo.png') + '" alt="Altius Gym"></div><div><h1>Altius Booking</h1><span class="role-tag">Admin</span></div></div>' +
        '<button class="icon-btn" id="logout-btn" title="Log out">' + ICONS.logout + '</button>' +
      '</div>' +
      '<main id="main"></main>' +
      '<nav class="bottom-nav">' +
        navItem('dashboard', '🏠', 'Home') +
        navItem('schedules', '🗓️', 'Schedules') +
        navItem('members', '🔍', 'Members') +
        navItem('bookings', '🎟️', 'Bookings') +
        navItem('settings', '⚙️', 'Settings') +
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
    if (tab === 'schedules') renderSchedules(main);
    if (tab === 'members') renderMembers(main);
    if (tab === 'bookings') renderBookings(main);
    if (tab === 'settings') renderSettings(main);
  }

  function statCard(value, label) {
    return '<div class="stat-card"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>';
  }

  // --- Dashboard -------------------------------------------------------------

  function renderDashboard(main) {
    Api.call('getAdminDashboard', {}).then(function (res) {
      if (!res.success) { main.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var d = res.data;
      main.innerHTML =
        '<div class="section-title">Overview</div>' +
        '<div class="stat-grid">' +
          statCard(d.totalMembers, 'Total Members') +
          statCard(d.todaysClassesCount, "Today's Classes") +
          statCard(d.todaysBookingsCount, "Today's Bookings") +
          statCard(d.upcomingClasses.length, 'Upcoming Sessions') +
        '</div>' +
        '<div class="section-title">Upcoming Classes</div>' +
        (d.upcomingClasses.length ? d.upcomingClasses.map(function (c) {
          return '<div class="card card-row"><span>' + UI.friendlyDate(c.date) + ' · ' + UI.friendlyTime(c.time) + '</span><strong>' + c.branch + '</strong></div>';
        }).join('') : UI.emptyState('🗓️', 'No upcoming classes. Create a schedule to get started.')) +
        '<button class="btn btn-primary" id="goto-schedules" style="margin-top:10px;">Manage Schedules</button>' +
        '<button class="btn btn-accent" id="export-quick" style="margin-top:10px;">Export Today\'s Bookings</button>';

      document.getElementById('goto-schedules').addEventListener('click', function () { goTo('schedules'); });
      document.getElementById('export-quick').addEventListener('click', function () {
        Api.call('exportBookings', { mode: 'today' }).then(handleExportResult);
      });
    });
  }

  function handleExportResult(res) {
    if (!res.success) { UI.toast(res.error, true); return; }
    Api.downloadXlsxBase64(res.data.filename, res.data.base64, res.data.mimeType);
    UI.toast('Export downloaded.');
  }

  // --- Schedules ---------------------------------------------------------

  function renderSchedules(main) {
    main.innerHTML =
      '<button class="btn btn-primary" id="new-schedule-btn" style="margin-bottom:10px;">＋ New Recurring Schedule</button>' +
      '<button class="btn btn-ghost" id="generate-classes-btn" style="margin-bottom:14px;">↻ Generate Classes Now</button>' +
      '<div id="schedule-list"></div>';
    document.getElementById('new-schedule-btn').addEventListener('click', function () { openScheduleSheet(null); });
    document.getElementById('generate-classes-btn').addEventListener('click', function () {
      Api.call('generateClasses', {}).then(function (res) {
        if (!res.success) { UI.toast(res.error, true); return; }
        UI.toast(res.data.created + ' new class session(s) created.');
      });
    });
    loadSchedules();
  }

  function loadSchedules() {
    var list = document.getElementById('schedule-list');
    Api.call('listSchedules', {}).then(function (res) {
      if (!res.success) { list.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var schedules = res.data.schedules;
      if (!schedules.length) { list.innerHTML = UI.emptyState('🗓️', 'No recurring schedules yet.'); return; }
      list.innerHTML = schedules.map(function (s) {
        var layoutInfo = s.classType === 'Spin'
          ? 'Spin · 11 front + 13 back = 24 bikes'
          : 'Group · ' + s.rows + '×' + s.cols + ' = ' + (s.rows * s.cols) + ' seats';
        return '<div class="card">' +
          '<div class="card-row"><strong>' + s.branch + ' · ' + UI.friendlyTime(s.time) + '</strong>' +
            '<span class="status-pill status-' + s.status + '">' + s.status + '</span></div>' +
          '<p>' + s.days.join(', ') + '</p>' +
          '<p class="helper-text">' + layoutInfo + ' · Opens ' + s.openHoursBefore + 'h before · Closes ' + s.closeMinsBefore + 'm before</p>' +
          '<div class="btn-row">' +
            '<button class="btn btn-ghost btn-sm" data-edit="' + s.scheduleId + '">Edit</button>' +
            '<button class="btn btn-danger btn-sm" data-delete="' + s.scheduleId + '">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');
      list.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { openScheduleSheet(schedules.filter(function (s) { return s.scheduleId === b.dataset.edit; })[0]); }); });
      list.querySelectorAll('[data-delete]').forEach(function (b) {
        b.addEventListener('click', function () {
          UI.confirmModal('Delete Schedule', 'Future classes from this schedule that have no bookings will be cancelled. Continue?', 'Delete', true).then(function (confirmed) {
            if (!confirmed) return;
            Api.call('deleteSchedule', { scheduleId: b.dataset.delete }).then(function (res) {
              if (!res.success) { UI.toast(res.error, true); return; }
              UI.toast('Schedule deleted.');
              loadSchedules();
            });
          });
        });
      });
    });
  }

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function openScheduleSheet(schedule) {
    var selectedDays = schedule ? schedule.days : [];
    var classType    = schedule ? (schedule.classType || 'Group') : 'Group';
    var isEdit       = !!schedule;
    var sheet = UI.openSheet(
      '<h3>' + (isEdit ? 'Edit Schedule' : 'New Recurring Schedule') + '</h3>' +
      '<div class="field"><label>Branch</label><select id="sc-branch">' +
        branches.map(function (b) { return '<option value="' + b + '" ' + (schedule && schedule.branch === b ? 'selected' : '') + '>' + b + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Class Type</label>' +
        '<div class="chip-group" id="sc-type">' +
          '<div class="chip ' + (classType === 'Group' ? 'selected' : '') + '" data-type="Group">Group Class</div>' +
          '<div class="chip ' + (classType === 'Spin'  ? 'selected' : '') + '" data-type="Spin">Spin Class</div>' +
        '</div>' +
      '</div>' +
      '<div id="sc-grid-fields">' + gridFieldsHtml(schedule) + '</div>' +
      '<div class="field"><label>Days</label><div class="chip-group" id="sc-days">' +
        WEEKDAYS.map(function (d) { return '<div class="chip ' + (selectedDays.indexOf(d) !== -1 ? 'selected' : '') + '" data-day="' + d + '">' + d.slice(0, 3) + '</div>'; }).join('') +
      '</div></div>' +
      '<div class="field"><label>Time</label><input type="time" id="sc-time" value="' + (schedule ? schedule.time : '18:00') + '"></div>' +
      '<div class="field"><label>Booking Opens (hours before)</label><input type="number" id="sc-open" value="' + (schedule ? schedule.openHoursBefore : 24) + '"></div>' +
      '<div class="field"><label>Booking Closes (minutes before)</label><input type="number" id="sc-close" value="' + (schedule ? schedule.closeMinsBefore : 30) + '"></div>' +
      '<div id="sc-error"></div>' +
      '<button class="btn btn-primary" id="sc-submit">' + (isEdit ? 'Save Changes' : 'Create Schedule') + '</button>'
    );

    // Day chips
    sheet.querySelectorAll('#sc-days .chip').forEach(function (chip) {
      chip.addEventListener('click', function () { chip.classList.toggle('selected'); });
    });

    // Class type chips — switch grid field visibility
    sheet.querySelectorAll('#sc-type .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        sheet.querySelectorAll('#sc-type .chip').forEach(function (c) { c.classList.remove('selected'); });
        chip.classList.add('selected');
        var isSpin = chip.dataset.type === 'Spin';
        sheet.querySelector('#sc-grid-fields').innerHTML = isSpin
          ? '<p class="helper-text" style="margin-bottom:8px;">Spin class: fixed layout — 11 front + 13 back = 24 bikes, numbered 1–24.</p>'
          : gridFieldsHtml(null);
      });
    });

    // Handle initial state if Spin is pre-selected
    if (classType === 'Spin') {
      sheet.querySelector('#sc-grid-fields').innerHTML = '<p class="helper-text" style="margin-bottom:8px;">Spin class: fixed layout — 10 × 2 = 24 bikes, numbered 1–24.</p>';
    }

    sheet.querySelector('#sc-submit').addEventListener('click', function () {
      var typeChip = sheet.querySelector('#sc-type .chip.selected');
      var cType = typeChip ? (typeChip.dataset.type || 'Group') : 'Group';
      var days = Array.prototype.slice.call(sheet.querySelectorAll('#sc-days .chip.selected'))
        .map(function (c) { return c.dataset.day; })
        .filter(Boolean);

      var errorBox = sheet.querySelector('#sc-error');

      if (!days.length) {
        errorBox.innerHTML = '<p class="error-text">Please select at least one day.</p>';
        return;
      }

      var payload = {
        branch:          sheet.querySelector('#sc-branch').value,
        classType:       cType,
        days:            days,
        time:            sheet.querySelector('#sc-time').value,
        openHoursBefore: Number(sheet.querySelector('#sc-open').value) || 24,
        closeMinsBefore: Number(sheet.querySelector('#sc-close').value) || 30
      };

      if (cType === 'Group') {
        var rowsInput = sheet.querySelector('#sc-rows');
        var colsInput = sheet.querySelector('#sc-cols');
        var rows = rowsInput ? (parseInt(rowsInput.value, 10) || 8) : 8;
        var cols = colsInput ? (parseInt(colsInput.value, 10) || 8) : 8;
        if (rows < 1 || cols < 1) {
          errorBox.innerHTML = '<p class="error-text">Rows and columns must be at least 1.</p>';
          return;
        }
        payload.rows = rows;
        payload.cols = cols;
      }

      if (isEdit) payload.scheduleId = schedule.scheduleId;
      var action = isEdit ? 'editSchedule' : 'createSchedule';
      var btn = sheet.querySelector('#sc-submit');
      btn.disabled = true; btn.textContent = isEdit ? 'Saving…' : 'Creating…';

      Api.call(action, payload).then(function (res) {
        btn.disabled = false; btn.textContent = isEdit ? 'Save Changes' : 'Create Schedule';
        if (!res.success) {
          errorBox.innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>';
          return;
        }
        sheet.remove();
        UI.toast(isEdit ? 'Schedule updated.' : 'Schedule created.');
        loadSchedules();
      });
    });
  }

  function gridFieldsHtml(schedule) {
    return '<div class="field"><label>Rows</label><input type="number" id="sc-rows" value="' + (schedule ? schedule.rows || 8 : 8) + '" min="1" max="26"></div>' +
           '<div class="field"><label>Columns</label><input type="number" id="sc-cols" value="' + (schedule ? schedule.cols || 8 : 8) + '" min="1" max="20"></div>' +
           '<p class="helper-text">Total seats = rows × columns (e.g. 6 × 10 = 60 seats).</p>';
  }

  // --- Members (Admin: full CRUD incl. delete) --------------------------

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
      results.querySelectorAll('[data-delete]').forEach(function (b) { b.addEventListener('click', function () { deleteMember(b.dataset.delete); }); });
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
        '<button class="btn btn-danger btn-sm" data-delete="' + m.memberId + '">Delete</button>' +
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

  function deleteMember(memberId) {
    UI.confirmModal('Delete Member', 'This permanently removes ' + memberId + ' from the system. Continue?', 'Delete', true).then(function (confirmed) {
      if (!confirmed) return;
      Api.call('deleteMember', { memberId: memberId }).then(function (res) {
        if (!res.success) { UI.toast(res.error, true); return; }
        UI.toast('Member deleted.');
        runMemberSearch(document.getElementById('member-search').value);
      });
    });
  }

  function openRegisterMemberSheet() {
    var sheet = UI.openSheet(
      '<h3>Register Member</h3>' +
      '<div class="field"><label>Full Name</label><input id="rm-name"></div>' +
      '<div class="field"><label>Phone Number</label><input id="rm-phone" type="tel"></div>' +
      '<div class="field"><label>Gym ID (optional — their physical membership card number)</label><input id="rm-gymid" placeholder="e.g. SAG001"></div>' +
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
      '<div class="field"><label>Gym ID</label><input id="em-gymid" value="' + UI.escapeHtml(member.gymId || '') + '" placeholder="e.g. SAG001"></div>' +
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
        phone:    sheet.querySelector('#em-phone').value.trim(),
        gymId:    sheet.querySelector('#em-gymid').value.trim(),
        branch:   sheet.querySelector('#em-branch').value
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
        '<div class="field"><label>Filter by branch</label><select id="bk-branch"><option value="">All Branches</option>' +
          branches.map(function (b) { return '<option value="' + b + '">' + b + '</option>'; }).join('') +
        '</select></div>' +
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
    document.getElementById('bk-branch').addEventListener('change', applyBookingFilters);
    document.getElementById('bk-class').addEventListener('change', applyBookingFilters);
    document.getElementById('bk-today').addEventListener('click', function () {
      document.getElementById('bk-date').value = new Date().toISOString().slice(0, 10);
      applyBookingFilters();
    });
    document.getElementById('bk-clear').addEventListener('click', function () {
      document.getElementById('bk-date').value = '';
      document.getElementById('bk-branch').value = '';
      document.getElementById('bk-class').value = '';
      applyBookingFilters();
    });
    document.getElementById('export-today').addEventListener('click', function () {
      Api.call('exportBookings', { mode: 'today' }).then(handleExportResult);
    });
    document.getElementById('export-filtered').addEventListener('click', function () {
      var date = document.getElementById('bk-date').value;
      var branch = document.getElementById('bk-branch').value;
      var classId = document.getElementById('bk-class').value;
      // A specific class/session takes priority - it's the most precise filter available.
      if (classId) Api.call('exportBookings', { mode: 'byClass', classId: classId }).then(handleExportResult);
      else if (date) Api.call('exportBookings', { mode: 'byDate', date: date }).then(handleExportResult);
      else if (branch) Api.call('exportBookings', { mode: 'byBranch', branch: branch }).then(handleExportResult);
      else UI.toast('Pick a class, date, or branch first to export.', true);
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
      branch: document.getElementById('bk-branch').value,
      classId: document.getElementById('bk-class').value
    });
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

  // --- Settings (incl. Reception account management) ------------------------

  function renderSettings(main) {
    Api.call('getAdminSettings', {}).then(function (res) {
      if (!res.success) { main.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var s = res.data;
      main.innerHTML =
        '<div class="section-title">Gym Settings</div>' +
        '<div class="card">' +
          '<div class="field"><label>Gym Name</label><input id="st-gymname" value="' + UI.escapeHtml(s.gymName) + '"></div>' +
          '<div class="field"><label>Branch Names (comma-separated)</label><input id="st-branches" value="' + s.branches.join(', ') + '"></div>' +
          '<div class="field"><label>Default Capacity</label><input type="number" id="st-capacity" value="' + s.defaultCapacity + '"></div>' +
          '<div class="field"><label>Default Booking Opens (hours before)</label><input type="number" id="st-open" value="' + s.defaultOpenHoursBefore + '"></div>' +
          '<div class="field"><label>Default Booking Closes (minutes before)</label><input type="number" id="st-close" value="' + s.defaultCloseMinsBefore + '"></div>' +
          '<div class="field"><label>Seat Rows (comma-separated letters)</label><input id="st-rows" value="' + s.seatLayout.rows.join(',') + '"></div>' +
          '<div class="field"><label>Seat Columns Per Row</label><input id="st-cols" value="' + s.seatLayout.cols.length + '"></div>' +
          '<div id="st-error"></div>' +
          '<button class="btn btn-primary" id="st-save">Save Settings</button>' +
        '</div>' +
        '<div class="section-title">Reception &amp; Admin Accounts</div>' +
        '<button class="btn btn-primary" id="new-staff-btn" style="margin-bottom:10px;">＋ Create Account</button>' +
        '<div id="staff-list"></div>' +
        '<button class="btn btn-ghost" id="change-pw-btn" style="margin-top:14px;">Change My Password</button>';

      document.getElementById('st-save').addEventListener('click', function () {
        var cols = [];
        var colCount = Number(document.getElementById('st-cols').value) || 8;
        for (var i = 1; i <= colCount; i++) cols.push(i);
        var payload = {
          gymName: document.getElementById('st-gymname').value.trim(),
          branches: document.getElementById('st-branches').value.split(',').map(function (b) { return b.trim(); }).filter(Boolean),
          defaultCapacity: Number(document.getElementById('st-capacity').value),
          defaultOpenHoursBefore: Number(document.getElementById('st-open').value),
          defaultCloseMinsBefore: Number(document.getElementById('st-close').value),
          seatLayout: { rows: document.getElementById('st-rows').value.split(',').map(function (r) { return r.trim().toUpperCase(); }).filter(Boolean), cols: cols }
        };
        Api.call('updateSettings', payload).then(function (res) {
          if (!res.success) { document.getElementById('st-error').innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>'; return; }
          UI.toast('Settings saved.');
          branches = res.data.branches;
        });
      });

      document.getElementById('new-staff-btn').addEventListener('click', openCreateStaffSheet);
      document.getElementById('change-pw-btn').addEventListener('click', openChangePasswordSheet);
      loadStaffList();
    });
  }

  function loadStaffList() {
    var list = document.getElementById('staff-list');
    Api.call('listStaffAccounts', {}).then(function (res) {
      if (!res.success) { list.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var staff = res.data.staff;
      list.innerHTML = staff.map(function (a) {
        var nextStatus = a.status === 'Active' ? 'Inactive' : 'Active';
        return '<div class="card">' +
          '<div class="card-row"><strong>' + UI.escapeHtml(a.fullName) + '</strong><span class="status-pill status-' + a.status + '">' + a.status + '</span></div>' +
          '<p>@' + UI.escapeHtml(a.username) + ' · ' + a.role + '</p>' +
          '<div class="btn-row">' +
            '<button class="btn btn-ghost btn-sm" data-reset="' + a.username + '">Reset Password</button>' +
            '<button class="btn btn-sm ' + (a.status === 'Active' ? 'btn-danger' : 'btn-primary') + '" data-toggle="' + a.username + '" data-status="' + nextStatus + '">' +
              (a.status === 'Active' ? 'Deactivate' : 'Activate') +
            '</button>' +
          '</div>' +
        '</div>';
      }).join('');
      list.querySelectorAll('[data-toggle]').forEach(function (b) {
        b.addEventListener('click', function () {
          Api.call('setStaffStatus', { username: b.dataset.toggle, status: b.dataset.status }).then(function (res) {
            if (!res.success) { UI.toast(res.error, true); return; }
            UI.toast('Account updated.');
            loadStaffList();
          });
        });
      });
      list.querySelectorAll('[data-reset]').forEach(function (b) {
        b.addEventListener('click', function () { openResetPasswordSheet(b.dataset.reset); });
      });
    });
  }

  function openCreateStaffSheet() {
    var sheet = UI.openSheet(
      '<h3>Create Reception / Admin Account</h3>' +
      '<div class="field"><label>Full Name</label><input id="ns-name"></div>' +
      '<div class="field"><label>Username</label><input id="ns-username"></div>' +
      passwordFieldHtml('ns-password', 'Password') +
      '<div class="field"><label>Role</label><select id="ns-role"><option value="Reception">Reception</option><option value="Admin">Admin</option></select></div>' +
      '<div id="ns-error"></div>' +
      '<button class="btn btn-primary" id="ns-submit">Create Account</button>'
    );
    sheet.querySelector('#ns-submit').addEventListener('click', function () {
      var payload = {
        fullName: sheet.querySelector('#ns-name').value.trim(),
        username: sheet.querySelector('#ns-username').value.trim(),
        password: sheet.querySelector('#ns-password').value,
        role: sheet.querySelector('#ns-role').value
      };
      Api.call('createStaffAccount', payload).then(function (res) {
        if (!res.success) { sheet.querySelector('#ns-error').innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>'; return; }
        sheet.remove();
        UI.toast('Account created.');
        loadStaffList();
      });
    });
  }

  function openResetPasswordSheet(username) {
    var sheet = UI.openSheet(
      '<h3>Reset Password — @' + UI.escapeHtml(username) + '</h3>' +
      passwordFieldHtml('rp-password', 'New Password') +
      '<div id="rp-error"></div>' +
      '<button class="btn btn-primary" id="rp-submit">Reset Password</button>'
    );
    sheet.querySelector('#rp-submit').addEventListener('click', function () {
      Api.call('resetStaffPassword', { username: username, newPassword: sheet.querySelector('#rp-password').value }).then(function (res) {
        if (!res.success) { sheet.querySelector('#rp-error').innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>'; return; }
        sheet.remove();
        UI.toast('Password reset.');
      });
    });
  }

  function openChangePasswordSheet() {
    var sheet = UI.openSheet(
      '<h3>Change My Password</h3>' +
      passwordFieldHtml('cp-old', 'Current Password', 'current-password') +
      passwordFieldHtml('cp-new', 'New Password') +
      '<div id="cp-error"></div>' +
      '<button class="btn btn-primary" id="cp-submit">Update Password</button>'
    );
    sheet.querySelector('#cp-submit').addEventListener('click', function () {
      Api.call('changeOwnPassword', { oldPassword: sheet.querySelector('#cp-old').value, newPassword: sheet.querySelector('#cp-new').value }).then(function (res) {
        if (!res.success) { sheet.querySelector('#cp-error').innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>'; return; }
        sheet.remove();
        UI.toast('Password updated.');
      });
    });
  }

  return { start: start };
})();
