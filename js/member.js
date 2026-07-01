/**
 * member.js
 * Everything a logged-in Member sees: upcoming classes for their branch,
 * the seat map + booking flow, booking history with cancellation, and a
 * simple profile screen. Navigation is a bottom tab bar per the spec.
 */

var MemberApp = (function () {
  var session;
  var currentTab = 'classes';

  function start(s) {
    session = s;
    renderShell();
    goTo('classes');
  }

  function renderShell() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="topbar">' +
        '<div class="brand">' +
          '<div class="brand-mark"><img src="' + (window.ALTIUS_CONFIG.LOGO_URL || 'icons/logo.png') + '" alt="Altius Gym"></div>' +
          '<div><h1>Altius Booking</h1><span class="role-tag">' + UI.escapeHtml(session.branch) + ' Member</span></div>' +
        '</div>' +
        '<button class="icon-btn" id="logout-btn" title="Log out">' + ICONS.logout + '</button>' +
      '</div>' +
      '<div class="offline-banner" id="offline-banner">No internet connection — showing the last loaded data.</div>' +
      '<main id="main"></main>' +
      '<nav class="bottom-nav">' +
        navItem('classes', '📅', 'Classes') +
        navItem('history', '🎟️', 'My Bookings') +
        navItem('profile', '👤', 'Profile') +
      '</nav>';

    document.getElementById('logout-btn').addEventListener('click', Auth.logout);
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.addEventListener('click', function () { goTo(item.dataset.tab); });
    });

    window.addEventListener('online', updateOfflineBanner);
    window.addEventListener('offline', updateOfflineBanner);
    updateOfflineBanner();
  }

  function updateOfflineBanner() {
    var banner = document.getElementById('offline-banner');
    if (!banner) return;
    banner.classList.toggle('show', !navigator.onLine);
  }

  function navItem(tab, icon, label) {
    return '<div class="nav-item ' + (tab === currentTab ? 'active' : '') + '" data-tab="' + tab + '">' +
      '<span class="nav-icon">' + icon + '</span><span>' + label + '</span></div>';
  }

  function goTo(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('active', item.dataset.tab === tab);
    });
    var main = document.getElementById('main');
    UI.showLoading(main);
    if (tab === 'classes') renderClasses(main);
    if (tab === 'history') renderHistory(main);
    if (tab === 'profile') renderProfile(main);
  }

  // --- Classes tab -----------------------------------------------------

  function renderClasses(main) {
    Api.call('listUpcomingClasses', {}).then(function (res) {
      if (!res.success) { main.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var classes = res.data.classes;
      if (!classes.length) {
        main.innerHTML = UI.emptyState('📅', 'No upcoming classes are scheduled for your branch yet.');
        return;
      }
      main.innerHTML = '<div class="section-title">Upcoming Classes</div>' +
        classes.map(function (c) {
          return classCardHtml(c);
        }).join('');

      main.querySelectorAll('.class-card').forEach(function (card) {
        card.addEventListener('click', function () { openClass(card.dataset.classId); });
      });
    });
  }

  function classCardHtml(c) {
    var badge = c.bookingState === 'OPEN' ? '<span class="badge badge-open">Open</span>' :
                c.bookingState === 'NOT_OPEN' ? '<span class="badge badge-soon">Opens soon</span>' :
                '<span class="badge badge-closed">Closed</span>';
    var typeBadge = c.classType === 'Spin'
      ? '<span class="badge" style="background:#E9F1FB;color:var(--sky-600);">Spin</span>'
      : '<span class="badge" style="background:#E6F7ED;color:var(--success);">Group</span>';
    return '<div class="card class-card" data-class-id="' + c.classId + '">' +
      '<div class="class-date-badge"><span class="day">' + UI.dayNum(c.date) + '</span><span class="mon">' + UI.monthAbbr(c.date) + '</span></div>' +
      '<div class="class-info">' +
        '<div class="class-time">' + UI.friendlyTime(c.time) + ' ' + typeBadge + '</div>' +
        '<div class="class-meta">' + c.branch + ' · ' + c.availableSeats + ' / ' + c.capacity + ' seats left</div>' +
      '</div>' +
      badge +
    '</div>';
  }

  function openClass(classId) {
    var main = document.getElementById('main');
    UI.showLoading(main);
    Api.call('getSeatMap', { classId: classId }).then(function (res) {
      if (!res.success) { UI.toast(res.error, true); goTo('classes'); return; }
      var meta = res.data;
      main.innerHTML =
        '<button class="icon-btn" id="back-btn" style="margin-bottom:10px;">←</button>' +
        '<div class="card">' +
          '<div class="card-row"><strong>' + meta.branch + '</strong>' + statusBadgeForWindow(meta) + '</div>' +
          '<p>' + UI.friendlyDate(meta.date) + ' · ' + UI.friendlyTime(meta.time) + '</p>' +
        '</div>' +
        '<div id="seatmap-host"></div>';

      document.getElementById('back-btn').addEventListener('click', function () { goTo('classes'); });

      var now = new Date();
      var bookingOpen = now >= new Date(meta.bookingOpensAt) && now <= new Date(meta.bookingClosesAt);
      var alreadyHasSeat = meta.seats.some(function (s) { return s.state === 'yours'; });

      var host = document.getElementById('seatmap-host');
      if (!bookingOpen) {
        var msg = now < new Date(meta.bookingOpensAt) ? 'Booking has not opened yet.' : 'Booking has closed for this class.';
        host.innerHTML = UI.emptyState('🔒', msg);
        SeatMap.render(host, meta, meta.seats, true);
      } else if (alreadyHasSeat) {
        host.innerHTML = '<p class="helper-text" style="text-align:center;margin-bottom:10px;">You already have a seat for this class — see "My Bookings" to cancel.</p>';
        var roHost = document.createElement('div');
        host.appendChild(roHost);
        SeatMap.render(roHost, meta, meta.seats, true);
      } else {
        SeatMap.render(host, meta, meta.seats, false, function (seat) {
          confirmBooking(classId, seat, meta);
        });
      }
    });
  }

  function statusBadgeForWindow(meta) {
    var now = new Date();
    if (now < new Date(meta.bookingOpensAt)) return '<span class="badge badge-soon">Opens soon</span>';
    if (now > new Date(meta.bookingClosesAt)) return '<span class="badge badge-closed">Closed</span>';
    return '<span class="badge badge-open">Open</span>';
  }

  function confirmBooking(classId, seat, meta) {
    UI.confirmModal(
      'Confirm Booking',
      'Book seat ' + seat + ' for ' + UI.friendlyDate(meta.date) + ' at ' + UI.friendlyTime(meta.time) + '?',
      'Confirm Booking'
    ).then(function (confirmed) {
      if (!confirmed) return;
      Api.call('bookSeat', { classId: classId, seat: seat }).then(function (res) {
        if (!res.success) { UI.toast(res.error, true); openClass(classId); return; }
        showBookingSuccess(res.data);
      });
    });
  }

  function showBookingSuccess(booking) {
    var main = document.getElementById('main');
    main.innerHTML =
      '<div class="ticket">' +
        '<div class="ticket-label">Booking Successful</div>' +
        '<div class="ticket-seat">Seat ' + UI.escapeHtml(booking.seat) + '</div>' +
        '<div class="ticket-grid">' +
          '<div><span>Branch</span><b>' + UI.escapeHtml(booking.branch) + '</b></div>' +
          '<div><span>Date</span><b>' + UI.friendlyDate(booking.date) + '</b></div>' +
          '<div><span>Time</span><b>' + UI.friendlyTime(booking.time) + '</b></div>' +
          '<div><span>Booking ID</span><b>' + UI.escapeHtml(booking.bookingId) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-primary" style="margin-top:16px;" id="done-btn">Done</button>';
    document.getElementById('done-btn').addEventListener('click', function () { goTo('classes'); });
  }

  // --- History tab -------------------------------------------------------

  function renderHistory(main) {
    Api.call('getMyBookingHistory', {}).then(function (res) {
      if (!res.success) { main.innerHTML = UI.emptyState('⚠️', res.error); return; }
      var history = res.data.history;
      if (!history.length) {
        main.innerHTML = UI.emptyState('🎟️', 'You have not booked any classes yet.');
        return;
      }
      main.innerHTML = '<div class="section-title">My Bookings</div>' +
        history.map(function (b) { return historyCardHtml(b); }).join('');

      main.querySelectorAll('[data-cancel-id]').forEach(function (btn) {
        btn.addEventListener('click', function () { cancelBooking(btn.dataset.cancelId); });
      });
    });
  }

  function historyCardHtml(b) {
    var canCancel = b.status === 'Confirmed' && new Date(b.date + 'T00:00:00') >= new Date(new Date().toDateString());
    return '<div class="card">' +
      '<div class="card-row"><strong>' + UI.friendlyDate(b.date) + ' · ' + UI.friendlyTime(b.time) + '</strong>' +
        '<span class="status-pill status-' + b.status + '">' + b.status + '</span></div>' +
      '<p>' + b.branch + ' — Seat ' + UI.escapeHtml(b.seat) + '</p>' +
      (canCancel ? '<button class="btn btn-danger btn-sm" data-cancel-id="' + b.bookingId + '">Cancel Booking</button>' : '') +
    '</div>';
  }

  function cancelBooking(bookingId) {
    UI.confirmModal('Cancel Booking', 'Your seat will be released immediately. This cannot be undone.', 'Cancel Booking', true)
      .then(function (confirmed) {
        if (!confirmed) return;
        Api.call('cancelBooking', { bookingId: bookingId }).then(function (res) {
          if (!res.success) { UI.toast(res.error, true); return; }
          UI.toast('Booking cancelled.');
          goTo('history');
        });
      });
  }

  // --- Profile tab ---------------------------------------------------------

  function renderProfile(main) {
    main.innerHTML =
      '<div class="section-title">Profile</div>' +
      '<div class="card">' +
        '<div class="card-row"><span>App Member ID</span><strong>' + UI.escapeHtml(session.refId) + '</strong></div>' +
        (session.gymId ? '<div class="card-row"><span>Gym ID</span><strong>' + UI.escapeHtml(session.gymId) + '</strong></div>' : '') +
        '<div class="card-row"><span>Name</span><strong>' + UI.escapeHtml(session.fullName) + '</strong></div>' +
        '<div class="card-row"><span>Branch</span><strong>' + UI.escapeHtml(session.branch) + '</strong></div>' +
      '</div>' +
      '<button class="btn btn-primary" id="change-password-btn" style="margin-bottom:10px;">Change Password</button>' +
      '<button class="btn btn-ghost" id="profile-logout-btn">Log Out</button>';
    document.getElementById('change-password-btn').addEventListener('click', openChangePasswordSheet);
    document.getElementById('profile-logout-btn').addEventListener('click', Auth.logout);
  }

  function openChangePasswordSheet() {
    var sheet = UI.openSheet(
      '<h3>Change Password</h3>' +
      passwordFieldHtml('cp-old', 'Current Password', 'current-password') +
      passwordFieldHtml('cp-new', 'New Password (at least 6 characters)') +
      '<div id="cp-error"></div>' +
      '<button class="btn btn-primary" id="cp-submit">Update Password</button>'
    );
    sheet.querySelector('#cp-submit').addEventListener('click', function () {
      var payload = {
        oldPassword: sheet.querySelector('#cp-old').value,
        newPassword: sheet.querySelector('#cp-new').value
      };
      Api.call('changeOwnPassword', payload).then(function (res) {
        if (!res.success) { sheet.querySelector('#cp-error').innerHTML = '<p class="error-text">' + UI.escapeHtml(res.error) + '</p>'; return; }
        sheet.remove();
        UI.toast('Password updated.');
      });
    });
  }

  return { start: start };
})();
