/**
 * seatmap.js
 * Renders the interactive seat grid for a class and drives the booking
 * confirmation flow for members. Reused as a read-only view for
 * Admin/Reception (no selection, just an occupancy snapshot) by passing
 * readOnly = true.
 */

var SeatMap = (function () {

  function render(container, classMeta, seats, readOnly, onBook) {
    var isSpin = classMeta.classType === 'Spin';
    var cols   = isSpin ? 12 : (classMeta.cols || inferColumnCount(seats));
    var stageLabel = isSpin ? 'INSTRUCTOR / FRONT' : 'FRONT OF ROOM / INSTRUCTOR';

    var html =
      '<div class="seat-map-wrap">' +
        '<div class="seat-map-stage">' + stageLabel + '</div>' +
        (isSpin ? renderSpinGrid(seats) : renderGroupGrid(seats, cols)) +
        '<div class="seat-legend">' +
          legendItem('var(--sky-50)', 'Available') +
          legendItem('var(--booked)', 'Booked') +
          (readOnly ? '' : legendItem('var(--sun-500)', 'Selected')) +
          legendItem('var(--sky-600)', 'Yours') +
        '</div>' +
      '</div>' +
      (readOnly ? '' : '<div id="seat-action-area" style="margin-top:14px;"></div>');

    container.innerHTML = html;
    if (readOnly) return;

    var selectedSeat = null;
    var grid = container.querySelector('.seat-grid, .spin-grid');
    grid.addEventListener('click', function (e) {
      var node = e.target.closest('.seat');
      if (!node) return;
      if (node.classList.contains('booked') || node.classList.contains('yours')) return;

      if (selectedSeat && selectedSeat !== node) {
        selectedSeat.classList.remove('selected');
        selectedSeat.classList.add('available');
      }
      if (node.classList.contains('selected')) {
        node.classList.remove('selected');
        node.classList.add('available');
        selectedSeat = null;
      } else {
        node.classList.remove('available');
        node.classList.add('selected');
        selectedSeat = node;
      }
      renderActionArea(container, classMeta, selectedSeat ? selectedSeat.dataset.seat : null, onBook);
    });

    renderActionArea(container, classMeta, null, onBook);
  }

  /** Group class: standard rectangular letter+number grid */
  function renderGroupGrid(seats, cols) {
    return '<div class="seat-grid" style="grid-template-columns: repeat(' + cols + ', 30px);">' +
      seats.map(function (s) {
        return '<div class="seat ' + s.state + '" data-seat="' + s.seat + '" title="' + s.seat + '">' + s.seat + '</div>';
      }).join('') +
    '</div>';
  }

  /**
   * Spin class: 10 cols x 2 rows = 20 visible cells but bikes are numbered
   * 1-24. We render two rows of 12 (total 24). Each cell shows just the
   * number. Styled slightly differently (circular) to feel like bike symbols.
   */
  function renderSpinGrid(seats) {
    // 11 front (bikes 1-11) + 13 back (bikes 12-24)
    // Each row is displayed RIGHT-TO-LEFT: far right = lowest number
    // Front row displayed: 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
    // Back row displayed:  24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12
    var row1 = seats.slice(0, 11).slice().reverse();
    var row2 = seats.slice(11, 24).slice().reverse();
    function renderRow(rowSeats) {
      return rowSeats.map(function (s) {
        return '<div class="seat spin-seat ' + s.state + '" data-seat="' + s.seat + '" title="Bike ' + s.seat + '">' + s.seat + '</div>';
      }).join('');
    }
    return '<div class="spin-grid">' +
      '<p class="helper-text" style="text-align:center;margin-bottom:6px;font-size:11px;font-weight:700;letter-spacing:.08em;">FRONT ROW — 11 bikes (right=1, left=11)</p>' +
      '<div class="spin-row">' + renderRow(row1) + '</div>' +
      '<p class="helper-text" style="text-align:center;margin:8px 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;">BACK ROW — 13 bikes (right=12, left=24)</p>' +
      '<div class="spin-row">' + renderRow(row2) + '</div>' +
    '</div>';
  }

  function legendItem(color, label) {
    return '<div class="legend-item"><span class="legend-dot" style="background:' + color + '"></span>' + label + '</div>';
  }

  function inferColumnCount(seats) {
    if (!seats.length) return 8;
    var firstRowLetter = seats[0].seat.charAt(0);
    var count = 0;
    for (var i = 0; i < seats.length; i++) {
      if (seats[i].seat.charAt(0) !== firstRowLetter) break;
      count++;
    }
    return Math.min(count || 8, 12);
  }

  function renderActionArea(container, classMeta, seat, onBook) {
    var area = container.querySelector('#seat-action-area');
    if (!area) return;
    var label = classMeta.classType === 'Spin' ? 'Bike' : 'Seat';
    if (!seat) {
      area.innerHTML = '<p class="helper-text" style="text-align:center;">Tap an available ' + label.toLowerCase() + ' to select it.</p>';
      return;
    }
    area.innerHTML =
      '<div class="card">' +
        '<div class="card-row"><span>Selected ' + label + '</span><strong>' + UI.escapeHtml(seat) + '</strong></div>' +
        '<div class="card-row"><span>Date</span><strong>' + UI.friendlyDate(classMeta.date) + '</strong></div>' +
        '<div class="card-row"><span>Time</span><strong>' + UI.friendlyTime(classMeta.time) + '</strong></div>' +
        '<button class="btn btn-primary" style="margin-top:14px;" id="confirm-booking-btn">Confirm Booking</button>' +
      '</div>';
    document.getElementById('confirm-booking-btn').addEventListener('click', function () {
      onBook(seat);
    });
  }

  return { render: render };
})();
