//DatePicker
(function($) {
    'use strict';
    
    // Unique Random ID
    M.guid = function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }
        return function() {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };
    }();
    var _defaults = {
        // Close when date is selected
        autoClose: false,

        // the default output format for the input field value
        format: 'mmm dd, yyyy',

        // Used to create date object from current input string
        parse: null,

        // The initial date to view when first opened
        defaultDate: null,

        // Make the `defaultDate` the initial selected value
        setDefaultDate: false,

        disableWeekends: false,

        disableDayFn: null,

        // First day of week (0: Sunday, 1: Monday etc)
        firstDay: 0,

        // The earliest date that can be selected
        minDate: null,
        // Thelatest date that can be selected
        maxDate: null,

        // Number of years either side, or array of upper/lower range
        yearRange: 10,

        // used internally (don't config outside)
        minYear: 0,
        maxYear: 9999,
        minMonth: undefined,
        maxMonth: undefined,

        startRange: null,
        endRange: null,

        isRTL: false,

        // Render the month after year in the calendar title
        showMonthAfterYear: false,

        // Render days of the calendar grid that fall in the next or previous month
        showDaysInNextAndPreviousMonths: false,

        // Specify a DOM element to render the calendar in
        container: null,

        // Show clear button
        showClearBtn: false,

        // internationalization
        i18n: {
            cancel: 'Cancel',
            clear: 'Clear',
            done: 'Ok',
            previousMonth: '‹',
            nextMonth: '›',
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'
            ],
            monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
                'Oct', 'Nov', 'Dec'
            ],
            weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
                'Saturday'
            ],
            weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            weekdaysAbbrev: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
        },

        // events array
        events: [],

        // callback function
        onSelect: null,
        onOpen: null,
        onClose: null,
        onDraw: null
    };

    /**
     * @class
     *
     */

    var Datepicker = function(_Component15) {
        _inherits(Datepicker, _Component15);

        /**
         * Construct Datepicker instance and set up overlay
         * @constructor
         * @param {Element} el
         * @param {Object} options
         */
        function Datepicker(el, options) {
            _classCallCheck(this, Datepicker);

            var _this52 = _possibleConstructorReturn(this, (Datepicker.__proto__ || Object
                .getPrototypeOf(Datepicker)).call(this, Datepicker, el, options));

            _this52.el.M_Datepicker = _this52;

            _this52.options = $.extend({}, Datepicker.defaults, options);

            // make sure i18n defaults are not lost when only few i18n option properties are passed
            if (!!options && options.hasOwnProperty('i18n') && typeof options.i18n ===
                'object') {
                _this52.options.i18n = $.extend({}, Datepicker.defaults.i18n, options.i18n);
            }

            // Remove time component from minDate and maxDate options
            if (_this52.options.minDate) _this52.options.minDate.setHours(0, 0, 0, 0);
            if (_this52.options.maxDate) _this52.options.maxDate.setHours(0, 0, 0, 0);

            _this52.id = M.guid();

            _this52._setupVariables();
            _this52._insertHTMLIntoDOM();
            _this52._setupModal();

            _this52._setupEventHandlers();

            if (!_this52.options.defaultDate) {
                _this52.options.defaultDate = new Date(Date.parse(_this52.el.value));
            }

            var defDate = _this52.options.defaultDate;
            if (Datepicker._isDate(defDate)) {
                if (_this52.options.setDefaultDate) {
                    _this52.setDate(defDate, true);
                    _this52.setInputValue();
                } else {
                    _this52.gotoDate(defDate);
                }
            } else {
                _this52.gotoDate(new Date());
            }

            /**
             * Describes open/close state of datepicker
             * @type {Boolean}
             */
            _this52.isOpen = false;
            return _this52;
        }

        _createClass(Datepicker, [{
            key: "destroy",


            /**
             * Teardown component
             */
            value: function destroy() {
                this._removeEventHandlers();
                this.modal.destroy();
                $(this.modalEl).remove();
                this.destroySelects();
                this.el.M_Datepicker = undefined;
            }
        }, {
            key: "destroySelects",
            value: function destroySelects() {
                var oldYearSelect = this.calendarEl.querySelector(
                    '.orig-select-year');
                if (oldYearSelect) {
                    M.FormSelect.getInstance(oldYearSelect).destroy();
                }
                var oldMonthSelect = this.calendarEl.querySelector(
                    '.orig-select-month');
                if (oldMonthSelect) {
                    M.FormSelect.getInstance(oldMonthSelect).destroy();
                }
            }
        }, {
            key: "_insertHTMLIntoDOM",
            value: function _insertHTMLIntoDOM() {
                if (this.options.showClearBtn) {
                    $(this.clearBtn).css({
                        visibility: ''
                    });
                    this.clearBtn.innerHTML = this.options.i18n.clear;
                }

                this.doneBtn.innerHTML = this.options.i18n.done;
                this.cancelBtn.innerHTML = this.options.i18n.cancel;

                if (this.options.container) {
                    this.$modalEl.appendTo(this.options.container);
                } else {
                    this.$modalEl.insertBefore(this.el);
                }
            }
        }, {
            key: "_setupModal",
            value: function _setupModal() {
                var _this53 = this;

                this.modalEl.id = 'modal-' + this.id;
                this.modal = M.Modal.init(this.modalEl, {
                    onCloseEnd: function() {
                        _this53.isOpen = false;
                    }
                });
            }
        }, {
            key: "toString",
            value: function toString(format) {
                var _this54 = this;

                format = format || this.options.format;
                if (!Datepicker._isDate(this.date)) {
                    return '';
                }

                var formatArray = format.split(
                    /(d{1,4}|m{1,4}|y{4}|yy|!.)/g);
                var formattedDate = formatArray.map(function(label) {
                    if (_this54.formats[label]) {
                        return _this54.formats[label]();
                    }

                    return label;
                }).join('');
                return formattedDate;
            }
        }, {
            key: "setDate",
            value: function setDate(date, preventOnSelect) {
                if (!date) {
                    this.date = null;
                    this._renderDateDisplay();
                    return this.draw();
                }
                if (typeof date === 'string') {
                    date = new Date(Date.parse(date));
                }
                if (!Datepicker._isDate(date)) {
                    return;
                }

                var min = this.options.minDate,
                    max = this.options.maxDate;

                if (Datepicker._isDate(min) && date < min) {
                    date = min;
                } else if (Datepicker._isDate(max) && date > max) {
                    date = max;
                }

                this.date = new Date(date.getTime());

                this._renderDateDisplay();

                Datepicker._setToStartOfDay(this.date);
                this.gotoDate(this.date);

                if (!preventOnSelect && typeof this.options.onSelect ===
                    'function') {
                    this.options.onSelect.call(this, this.date);
                }
            }
        }, {
            key: "setInputValue",
            value: function setInputValue() {
                this.el.value = this.toString();
                this.$el.trigger('change', {
                    firedBy: this
                });
            }
        }, {
            key: "_renderDateDisplay",
            value: function _renderDateDisplay() {
                var displayDate = Datepicker._isDate(this.date) ? this
                    .date : new Date();
                var i18n = this.options.i18n;
                var day = i18n.weekdaysShort[displayDate.getDay()];
                var month = i18n.monthsShort[displayDate.getMonth()];
                var date = displayDate.getDate();
                this.yearTextEl.innerHTML = displayDate.getFullYear();
                this.dateTextEl.innerHTML = day + ", " + month + " " + date;
            }

            /**
             * change view to a specific date
             */

        }, {
            key: "gotoDate",
            value: function gotoDate(date) {
                var newCalendar = true;

                if (!Datepicker._isDate(date)) {
                    return;
                }

                if (this.calendars) {
                    var firstVisibleDate = new Date(this.calendars[0].year,
                            this.calendars[0].month, 1),
                        lastVisibleDate = new Date(this.calendars[this
                            .calendars.length - 1].year, this.calendars[
                            this.calendars.length - 1].month, 1),
                        visibleDate = date.getTime();
                    // get the end of the month
                    lastVisibleDate.setMonth(lastVisibleDate.getMonth() +
                    1);
                    lastVisibleDate.setDate(lastVisibleDate.getDate() - 1);
                    newCalendar = visibleDate < firstVisibleDate
                    .getTime() || lastVisibleDate.getTime() < visibleDate;
                }

                if (newCalendar) {
                    this.calendars = [{
                        month: date.getMonth(),
                        year: date.getFullYear()
                    }];
                }

                this.adjustCalendars();
            }
        }, {
            key: "adjustCalendars",
            value: function adjustCalendars() {
                this.calendars[0] = this.adjustCalendar(this.calendars[0]);
                this.draw();
            }
        }, {
            key: "adjustCalendar",
            value: function adjustCalendar(calendar) {
                if (calendar.month < 0) {
                    calendar.year -= Math.ceil(Math.abs(calendar.month) /
                        12);
                    calendar.month += 12;
                }
                if (calendar.month > 11) {
                    calendar.year += Math.floor(Math.abs(calendar.month) /
                        12);
                    calendar.month -= 12;
                }
                return calendar;
            }
        }, {
            key: "nextMonth",
            value: function nextMonth() {
                this.calendars[0].month++;
                this.adjustCalendars();
            }
        }, {
            key: "prevMonth",
            value: function prevMonth() {
                this.calendars[0].month--;
                this.adjustCalendars();
            }
        }, {
            key: "render",
            value: function render(year, month, randId) {
                var opts = this.options,
                    now = new Date(),
                    days = Datepicker._getDaysInMonth(year, month),
                    before = new Date(year, month, 1).getDay(),
                    data = [],
                    row = [];
                Datepicker._setToStartOfDay(now);
                if (opts.firstDay > 0) {
                    before -= opts.firstDay;
                    if (before < 0) {
                        before += 7;
                    }
                }
                var previousMonth = month === 0 ? 11 : month - 1,
                    nextMonth = month === 11 ? 0 : month + 1,
                    yearOfPreviousMonth = month === 0 ? year - 1 : year,
                    yearOfNextMonth = month === 11 ? year + 1 : year,
                    daysInPreviousMonth = Datepicker._getDaysInMonth(
                        yearOfPreviousMonth, previousMonth);
                var cells = days + before,
                    after = cells;
                while (after > 7) {
                    after -= 7;
                }
                cells += 7 - after;
                var isWeekSelected = false;
                for (var i = 0, r = 0; i < cells; i++) {
                    var day = new Date(year, month, 1 + (i - before)),
                        isSelected = Datepicker._isDate(this.date) ?
                        Datepicker._compareDates(day, this.date) : false,
                        isToday = Datepicker._compareDates(day, now),
                        hasEvent = opts.events.indexOf(day
                    .toDateString()) !== -1 ? true : false,
                        isEmpty = i < before || i >= days + before,
                        dayNumber = 1 + (i - before),
                        monthNumber = month,
                        yearNumber = year,
                        isStartRange = opts.startRange && Datepicker
                        ._compareDates(opts.startRange, day),
                        isEndRange = opts.endRange && Datepicker
                        ._compareDates(opts.endRange, day),
                        isInRange = opts.startRange && opts.endRange && opts
                        .startRange < day && day < opts.endRange,
                        isDisabled = opts.minDate && day < opts.minDate ||
                        opts.maxDate && day > opts.maxDate || opts
                        .disableWeekends && Datepicker._isWeekend(day) ||
                        opts.disableDayFn && opts.disableDayFn(day);

                    if (isEmpty) {
                        if (i < before) {
                            dayNumber = daysInPreviousMonth + dayNumber;
                            monthNumber = previousMonth;
                            yearNumber = yearOfPreviousMonth;
                        } else {
                            dayNumber = dayNumber - days;
                            monthNumber = nextMonth;
                            yearNumber = yearOfNextMonth;
                        }
                    }

                    var dayConfig = {
                        day: dayNumber,
                        month: monthNumber,
                        year: yearNumber,
                        hasEvent: hasEvent,
                        isSelected: isSelected,
                        isToday: isToday,
                        isDisabled: isDisabled,
                        isEmpty: isEmpty,
                        isStartRange: isStartRange,
                        isEndRange: isEndRange,
                        isInRange: isInRange,
                        showDaysInNextAndPreviousMonths: opts
                            .showDaysInNextAndPreviousMonths
                    };

                    row.push(this.renderDay(dayConfig));

                    if (++r === 7) {
                        data.push(this.renderRow(row, opts.isRTL,
                            isWeekSelected));
                        row = [];
                        r = 0;
                        isWeekSelected = false;
                    }
                }
                return this.renderTable(opts, data, randId);
            }
        }, {
            key: "renderDay",
            value: function renderDay(opts) {
                var arr = [];
                var ariaSelected = 'false';
                if (opts.isEmpty) {
                    if (opts.showDaysInNextAndPreviousMonths) {
                        arr.push('is-outside-current-month');
                        arr.push('is-selection-disabled');
                    } else {
                        return '<td class="is-empty"></td>';
                    }
                }
                if (opts.isDisabled) {
                    arr.push('is-disabled');
                }

                if (opts.isToday) {
                    arr.push('is-today');
                }
                if (opts.isSelected) {
                    arr.push('is-selected');
                    ariaSelected = 'true';
                }
                if (opts.hasEvent) {
                    arr.push('has-event');
                }
                if (opts.isInRange) {
                    arr.push('is-inrange');
                }
                if (opts.isStartRange) {
                    arr.push('is-startrange');
                }
                if (opts.isEndRange) {
                    arr.push('is-endrange');
                }
                return "<td data-day=\"" + opts.day + "\" class=\"" + arr
                    .join(' ') + "\" aria-selected=\"" + ariaSelected +
                    "\">" + (
                        "<button class=\"datepicker-day-button\" type=\"button\" data-year=\"" +
                        opts.year + "\" data-month=\"" + opts.month +
                        "\" data-day=\"" + opts.day + "\">" + opts.day +
                        "</button>") + '</td>';
            }
        }, {
            key: "renderRow",
            value: function renderRow(days, isRTL, isRowSelected) {
                return '<tr class="datepicker-row' + (isRowSelected ?
                    ' is-selected' : '') + '">' + (isRTL ? days
                .reverse() : days).join('') + '</tr>';
            }
        }, {
            key: "renderTable",
            value: function renderTable(opts, data, randId) {
                return '<div class="datepicker-table-wrapper"><table cellpadding="0" cellspacing="0" class="datepicker-table" role="grid" aria-labelledby="' +
                    randId + '">' + this.renderHead(opts) + this.renderBody(
                        data) + '</table></div>';
            }
        }, {
            key: "renderHead",
            value: function renderHead(opts) {
                var i = void 0,
                    arr = [];
                for (i = 0; i < 7; i++) {
                    arr.push("<th scope=\"col\"><abbr title=\"" + this
                        .renderDayName(opts, i) + "\">" + this
                        .renderDayName(opts, i, true) + "</abbr></th>");
                }
                return '<thead><tr>' + (opts.isRTL ? arr.reverse() : arr)
                    .join('') + '</tr></thead>';
            }
        }, {
            key: "renderBody",
            value: function renderBody(rows) {
                return '<tbody>' + rows.join('') + '</tbody>';
            }
        }, {
            key: "renderTitle",
            value: function renderTitle(instance, c, year, month, refYear,
                randId) {
                var i = void 0,
                    j = void 0,
                    arr = void 0,
                    opts = this.options,
                    isMinYear = year === opts.minYear,
                    isMaxYear = year === opts.maxYear,
                    html = '<div id="' + randId +
                    '" class="datepicker-controls" role="heading" aria-live="assertive">',
                    monthHtml = void 0,
                    yearHtml = void 0,
                    prev = true,
                    next = true;

                for (arr = [], i = 0; i < 12; i++) {
                    arr.push('<option value="' + (year === refYear ? i - c :
                            12 + i - c) + '"' + (i === month ?
                            ' selected="selected"' : '') + (isMinYear &&
                            i < opts.minMonth || isMaxYear && i > opts
                            .maxMonth ? 'disabled="disabled"' : '') +
                        '>' + opts.i18n.months[i] + '</option>');
                }

                monthHtml =
                    '<select class="datepicker-select orig-select-month" tabindex="-1">' +
                    arr.join('') + '</select>';

                if ($.isArray(opts.yearRange)) {
                    i = opts.yearRange[0];
                    j = opts.yearRange[1] + 1;
                } else {
                    i = year - opts.yearRange;
                    j = 1 + year + opts.yearRange;
                }

                for (arr = []; i < j && i <= opts.maxYear; i++) {
                    if (i >= opts.minYear) {
                        arr.push("<option value=\"" + i + "\" " + (i ===
                                year ? 'selected="selected"' : '') +
                            ">" + i + "</option>");
                    }
                }

                yearHtml =
                    "<select class=\"datepicker-select orig-select-year\" tabindex=\"-1\">" +
                    arr.join('') + "</select>";

                var leftArrow =
                    '<svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M15.41 16.09l-4.58-4.59 4.58-4.59L14 5.5l-6 6 6 6z"/><path d="M0-.5h24v24H0z" fill="none"/></svg>';
                html += "<button class=\"month-prev" + (prev ? '' :
                        ' is-disabled') + "\" type=\"button\">" +
                    leftArrow + "</button>";

                html += '<div class="selects-container">';
                if (opts.showMonthAfterYear) {
                    html += yearHtml + monthHtml;
                } else {
                    html += monthHtml + yearHtml;
                }
                html += '</div>';

                if (isMinYear && (month === 0 || opts.minMonth >= month)) {
                    prev = false;
                }

                if (isMaxYear && (month === 11 || opts.maxMonth <= month)) {
                    next = false;
                }

                var rightArrow =
                    '<svg fill="#000000" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z"/><path d="M0-.25h24v24H0z" fill="none"/></svg>';
                html += "<button class=\"month-next" + (next ? '' :
                        ' is-disabled') + "\" type=\"button\">" +
                    rightArrow + "</button>";

                return html += '</div>';
            }

            /**
             * refresh the HTML
             */

        }, {
            key: "draw",
            value: function draw(force) {
                if (!this.isOpen && !force) {
                    return;
                }
                var opts = this.options,
                    minYear = opts.minYear,
                    maxYear = opts.maxYear,
                    minMonth = opts.minMonth,
                    maxMonth = opts.maxMonth,
                    html = '',
                    randId = void 0;

                if (this._y <= minYear) {
                    this._y = minYear;
                    if (!isNaN(minMonth) && this._m < minMonth) {
                        this._m = minMonth;
                    }
                }
                if (this._y >= maxYear) {
                    this._y = maxYear;
                    if (!isNaN(maxMonth) && this._m > maxMonth) {
                        this._m = maxMonth;
                    }
                }

                randId = 'datepicker-title-' + Math.random().toString(36)
                    .replace(/[^a-z]+/g, '').substr(0, 2);

                for (var c = 0; c < 1; c++) {
                    this._renderDateDisplay();
                    html += this.renderTitle(this, c, this.calendars[c]
                        .year, this.calendars[c].month, this.calendars[
                            0].year, randId) + this.render(this
                        .calendars[c].year, this.calendars[c].month,
                        randId);
                }

                this.destroySelects();

                this.calendarEl.innerHTML = html;

                // Init Materialize Select
                var yearSelect = this.calendarEl.querySelector(
                    '.orig-select-year');
                var monthSelect = this.calendarEl.querySelector(
                    '.orig-select-month');
                M.FormSelect.init(yearSelect, {
                    classes: 'select-year',
                    dropdownOptions: {
                        container: document.body,
                        constrainWidth: false
                    }
                });
                M.FormSelect.init(monthSelect, {
                    classes: 'select-month',
                    dropdownOptions: {
                        container: document.body,
                        constrainWidth: false
                    }
                });

                // Add change handlers for select
                yearSelect.addEventListener('change', this._handleYearChange
                    .bind(this));
                monthSelect.addEventListener('change', this
                    ._handleMonthChange.bind(this));

                if (typeof this.options.onDraw === 'function') {
                    this.options.onDraw(this);
                }
            }

            /**
             * Setup Event Handlers
             */

        }, {
            key: "_setupEventHandlers",
            value: function _setupEventHandlers() {
                this._handleInputKeydownBound = this._handleInputKeydown
                    .bind(this);
                this._handleInputClickBound = this._handleInputClick.bind(
                    this);
                this._handleInputChangeBound = this._handleInputChange.bind(
                    this);
                this._handleCalendarClickBound = this._handleCalendarClick
                    .bind(this);
                this._finishSelectionBound = this._finishSelection.bind(
                    this);
                this._handleMonthChange = this._handleMonthChange.bind(
                this);
                this._closeBound = this.close.bind(this);

                this.el.addEventListener('click', this
                    ._handleInputClickBound);
                this.el.addEventListener('keydown', this
                    ._handleInputKeydownBound);
                this.el.addEventListener('change', this
                    ._handleInputChangeBound);
                this.calendarEl.addEventListener('click', this
                    ._handleCalendarClickBound);
                this.doneBtn.addEventListener('click', this
                    ._finishSelectionBound);
                this.cancelBtn.addEventListener('click', this._closeBound);

                if (this.options.showClearBtn) {
                    this._handleClearClickBound = this._handleClearClick
                        .bind(this);
                    this.clearBtn.addEventListener('click', this
                        ._handleClearClickBound);
                }
            }
        }, {
            key: "_setupVariables",
            value: function _setupVariables() {
                var _this55 = this;

                this.$modalEl = $(Datepicker._template);
                this.modalEl = this.$modalEl[0];

                this.calendarEl = this.modalEl.querySelector(
                    '.datepicker-calendar');

                this.yearTextEl = this.modalEl.querySelector('.year-text');
                this.dateTextEl = this.modalEl.querySelector('.date-text');
                if (this.options.showClearBtn) {
                    this.clearBtn = this.modalEl.querySelector(
                        '.datepicker-clear');
                }
                this.doneBtn = this.modalEl.querySelector(
                    '.datepicker-done');
                this.cancelBtn = this.modalEl.querySelector(
                    '.datepicker-cancel');

                this.formats = {
                    d: function() {
                        return _this55.date.getDate();
                    },
                    dd: function() {
                        var d = _this55.date.getDate();
                        return (d < 10 ? '0' : '') + d;
                    },
                    ddd: function() {
                        return _this55.options.i18n.weekdaysShort[
                            _this55.date.getDay()];
                    },
                    dddd: function() {
                        return _this55.options.i18n.weekdays[_this55
                            .date.getDay()];
                    },
                    m: function() {
                        return _this55.date.getMonth() + 1;
                    },
                    mm: function() {
                        var m = _this55.date.getMonth() + 1;
                        return (m < 10 ? '0' : '') + m;
                    },
                    mmm: function() {
                        return _this55.options.i18n.monthsShort[
                            _this55.date.getMonth()];
                    },
                    mmmm: function() {
                        return _this55.options.i18n.months[_this55
                            .date.getMonth()];
                    },
                    yy: function() {
                        return ('' + _this55.date.getFullYear())
                            .slice(2);
                    },
                    yyyy: function() {
                        return _this55.date.getFullYear();
                    }
                };
            }

            /**
             * Remove Event Handlers
             */

        }, {
            key: "_removeEventHandlers",
            value: function _removeEventHandlers() {
                this.el.removeEventListener('click', this
                    ._handleInputClickBound);
                this.el.removeEventListener('keydown', this
                    ._handleInputKeydownBound);
                this.el.removeEventListener('change', this
                    ._handleInputChangeBound);
                this.calendarEl.removeEventListener('click', this
                    ._handleCalendarClickBound);
            }
        }, {
            key: "_handleInputClick",
            value: function _handleInputClick() {
                this.open();
            }
        }, {
            key: "_handleInputKeydown",
            value: function _handleInputKeydown(e) {
                if (e.which === M.keys.ENTER) {
                    e.preventDefault();
                    this.open();
                }
            }
        }, {
            key: "_handleCalendarClick",
            value: function _handleCalendarClick(e) {
                if (!this.isOpen) {
                    return;
                }

                var $target = $(e.target);
                if (!$target.hasClass('is-disabled')) {
                    if ($target.hasClass('datepicker-day-button') && !
                        $target.hasClass('is-empty') && !$target.parent()
                        .hasClass('is-disabled')) {
                        this.setDate(new Date(e.target.getAttribute(
                                'data-year'), e.target.getAttribute(
                                'data-month'), e.target
                            .getAttribute('data-day')));
                        if (this.options.autoClose) {
                            this._finishSelection();
                        }
                    } else if ($target.closest('.month-prev').length) {
                        this.prevMonth();
                    } else if ($target.closest('.month-next').length) {
                        this.nextMonth();
                    }
                }
            }
        }, {
            key: "_handleClearClick",
            value: function _handleClearClick() {
                this.date = null;
                this.setInputValue();
                this.close();
            }
        }, {
            key: "_handleMonthChange",
            value: function _handleMonthChange(e) {
                this.gotoMonth(e.target.value);
            }
        }, {
            key: "_handleYearChange",
            value: function _handleYearChange(e) {
                this.gotoYear(e.target.value);
            }

            /**
             * change view to a specific month (zero-index, e.g. 0: January)
             */

        }, {
            key: "gotoMonth",
            value: function gotoMonth(month) {
                if (!isNaN(month)) {
                    this.calendars[0].month = parseInt(month, 10);
                    this.adjustCalendars();
                }
            }

            /**
             * change view to a specific full year (e.g. "2012")
             */

        }, {
            key: "gotoYear",
            value: function gotoYear(year) {
                if (!isNaN(year)) {
                    this.calendars[0].year = parseInt(year, 10);
                    this.adjustCalendars();
                }
            }
        }, {
            key: "_handleInputChange",
            value: function _handleInputChange(e) {
                var date = void 0;

                // Prevent change event from being fired when triggered by the plugin
                if (e.firedBy === this) {
                    return;
                }
                if (this.options.parse) {
                    date = this.options.parse(this.el.value, this.options
                        .format);
                } else {
                    date = new Date(Date.parse(this.el.value));
                }

                if (Datepicker._isDate(date)) {
                    this.setDate(date);
                }
            }
        }, {
            key: "renderDayName",
            value: function renderDayName(opts, day, abbr) {
                day += opts.firstDay;
                while (day >= 7) {
                    day -= 7;
                }
                return abbr ? opts.i18n.weekdaysAbbrev[day] : opts.i18n
                    .weekdays[day];
            }

            /**
             * Set input value to the selected date and close Datepicker
             */

        }, {
            key: "_finishSelection",
            value: function _finishSelection() {
                this.setInputValue();
                this.close();
            }

            /**
             * Open Datepicker
             */

        }, {
            key: "open",
            value: function open() {
                if (this.isOpen) {
                    return;
                }

                this.isOpen = true;
                if (typeof this.options.onOpen === 'function') {
                    this.options.onOpen.call(this);
                }
                this.draw();
                this.modal.open();
                return this;
            }

            /**
             * Close Datepicker
             */

        }, {
            key: "close",
            value: function close() {
                if (!this.isOpen) {
                    return;
                }

                this.isOpen = false;
                if (typeof this.options.onClose === 'function') {
                    this.options.onClose.call(this);
                }
                this.modal.close();
                return this;
            }
        }], [{
            key: "init",
            value: function init(els, options) {
                return _get(Datepicker.__proto__ || Object.getPrototypeOf(
                    Datepicker), "init", this).call(this, this, els,
                    options);
            }
        }, {
            key: "_isDate",
            value: function _isDate(obj) {
                return (/Date/.test(Object.prototype.toString.call(obj)) &&
                    !isNaN(obj.getTime()));
            }
        }, {
            key: "_isWeekend",
            value: function _isWeekend(date) {
                var day = date.getDay();
                return day === 0 || day === 6;
            }
        }, {
            key: "_setToStartOfDay",
            value: function _setToStartOfDay(date) {
                if (Datepicker._isDate(date)) date.setHours(0, 0, 0, 0);
            }
        }, {
            key: "_getDaysInMonth",
            value: function _getDaysInMonth(year, month) {
                return [31, Datepicker._isLeapYear(year) ? 29 : 28, 31, 30,
                    31, 30, 31, 31, 30, 31, 30, 31
                ][month];
            }
        }, {
            key: "_isLeapYear",
            value: function _isLeapYear(year) {
                // solution by Matti Virkkunen: http://stackoverflow.com/a/4881951
                return year % 4 === 0 && year % 100 !== 0 || year % 400 ===
                    0;
            }
        }, {
            key: "_compareDates",
            value: function _compareDates(a, b) {
                // weak date comparison (use setToStartOfDay(date) to ensure correct result)
                return a.getTime() === b.getTime();
            }
        }, {
            key: "_setToStartOfDay",
            value: function _setToStartOfDay(date) {
                if (Datepicker._isDate(date)) date.setHours(0, 0, 0, 0);
            }

            /**
             * Get Instance
             */

        }, {
            key: "getInstance",
            value: function getInstance(el) {
                var domElem = !!el.jquery ? el[0] : el;
                return domElem.M_Datepicker;
            }
        }, {
            key: "defaults",
            get: function() {
                return _defaults;
            }
        }]);

        return Datepicker;
    }(Component);

    Datepicker._template = ['<div class= "modal datepicker-modal">',
        '<div class="modal-content datepicker-container">',
        '<div class="datepicker-date-display">', '<span class="year-text"></span>',
        '<span class="date-text"></span>', '</div>',
        '<div class="datepicker-calendar-container">',
        '<div class="datepicker-calendar"></div>', '<div class="datepicker-footer">',
        '<button class="btn-flat datepicker-clear waves-effect" style="visibility: hidden;" type="button"></button>',
        '<div class="confirmation-btns">',
        '<button class="btn-flat datepicker-cancel waves-effect" type="button"></button>',
        '<button class="btn-flat datepicker-done waves-effect" type="button"></button>',
        '</div>', '</div>', '</div>', '</div>', '</div>'
    ].join('');

    M.Datepicker = Datepicker;

    if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Datepicker, 'datepicker', 'M_Datepicker');
    }
})(cash);
//TimePicker
;
(function($) {
    'use strict';

    var _defaults = {
        dialRadius: 135,
        outerRadius: 105,
        innerRadius: 70,
        tickRadius: 20,
        duration: 350,
        container: null,
        defaultTime: 'now', // default time, 'now' or '13:14' e.g.
        fromNow: 0, // Millisecond offset from the defaultTime
        showClearBtn: false,

        // internationalization
        i18n: {
            cancel: 'Cancel',
            clear: 'Clear',
            done: 'Ok'
        },

        autoClose: false, // auto close when minute is selected
        twelveHour: true, // change to 12 hour AM/PM clock from 24 hour
        vibrate: true, // vibrate the device when dragging clock hand

        // Callbacks
        onOpenStart: null,
        onOpenEnd: null,
        onCloseStart: null,
        onCloseEnd: null,
        onSelect: null
    };

    /**
     * @class
     *
     */

    var Timepicker = function(_Component16) {
        _inherits(Timepicker, _Component16);

        function Timepicker(el, options) {
            _classCallCheck(this, Timepicker);

            var _this56 = _possibleConstructorReturn(this, (Timepicker.__proto__ || Object
                .getPrototypeOf(Timepicker)).call(this, Timepicker, el, options));

            _this56.el.M_Timepicker = _this56;

            _this56.options = $.extend({}, Timepicker.defaults, options);

            _this56.id = M.guid();
            _this56._insertHTMLIntoDOM();
            _this56._setupModal();
            _this56._setupVariables();
            _this56._setupEventHandlers();

            _this56._clockSetup();
            _this56._pickerSetup();
            return _this56;
        }

        _createClass(Timepicker, [{
            key: "destroy",


            /**
             * Teardown component
             */
            value: function destroy() {
                this._removeEventHandlers();
                this.modal.destroy();
                $(this.modalEl).remove();
                this.el.M_Timepicker = undefined;
            }

            /**
             * Setup Event Handlers
             */

        }, {
            key: "_setupEventHandlers",
            value: function _setupEventHandlers() {
                this._handleInputKeydownBound = this._handleInputKeydown
                    .bind(this);
                this._handleInputClickBound = this._handleInputClick.bind(
                    this);
                this._handleClockClickStartBound = this
                    ._handleClockClickStart.bind(this);
                this._handleDocumentClickMoveBound = this
                    ._handleDocumentClickMove.bind(this);
                this._handleDocumentClickEndBound = this
                    ._handleDocumentClickEnd.bind(this);

                this.el.addEventListener('click', this
                    ._handleInputClickBound);
                this.el.addEventListener('keydown', this
                    ._handleInputKeydownBound);
                this.plate.addEventListener('mousedown', this
                    ._handleClockClickStartBound);
                this.plate.addEventListener('touchstart', this
                    ._handleClockClickStartBound);

                $(this.spanHours).on('click', this.showView.bind(this,
                    'hours'));
                $(this.spanMinutes).on('click', this.showView.bind(this,
                    'minutes'));
            }
        }, {
            key: "_removeEventHandlers",
            value: function _removeEventHandlers() {
                this.el.removeEventListener('click', this
                    ._handleInputClickBound);
                this.el.removeEventListener('keydown', this
                    ._handleInputKeydownBound);
            }
        }, {
            key: "_handleInputClick",
            value: function _handleInputClick() {
                this.open();
            }
        }, {
            key: "_handleInputKeydown",
            value: function _handleInputKeydown(e) {
                if (e.which === M.keys.ENTER) {
                    e.preventDefault();
                    this.open();
                }
            }
        }, {
            key: "_handleClockClickStart",
            value: function _handleClockClickStart(e) {
                e.preventDefault();
                var clockPlateBR = this.plate.getBoundingClientRect();
                var offset = {
                    x: clockPlateBR.left,
                    y: clockPlateBR.top
                };

                this.x0 = offset.x + this.options.dialRadius;
                this.y0 = offset.y + this.options.dialRadius;
                this.moved = false;
                var clickPos = Timepicker._Pos(e);
                this.dx = clickPos.x - this.x0;
                this.dy = clickPos.y - this.y0;

                // Set clock hands
                this.setHand(this.dx, this.dy, false);

                // Mousemove on document
                document.addEventListener('mousemove', this
                    ._handleDocumentClickMoveBound);
                document.addEventListener('touchmove', this
                    ._handleDocumentClickMoveBound);

                // Mouseup on document
                document.addEventListener('mouseup', this
                    ._handleDocumentClickEndBound);
                document.addEventListener('touchend', this
                    ._handleDocumentClickEndBound);
            }
        }, {
            key: "_handleDocumentClickMove",
            value: function _handleDocumentClickMove(e) {
                e.preventDefault();
                var clickPos = Timepicker._Pos(e);
                var x = clickPos.x - this.x0;
                var y = clickPos.y - this.y0;
                this.moved = true;
                this.setHand(x, y, false, true);
            }
        }, {
            key: "_handleDocumentClickEnd",
            value: function _handleDocumentClickEnd(e) {
                var _this57 = this;

                e.preventDefault();
                document.removeEventListener('mouseup', this
                    ._handleDocumentClickEndBound);
                document.removeEventListener('touchend', this
                    ._handleDocumentClickEndBound);
                var clickPos = Timepicker._Pos(e);
                var x = clickPos.x - this.x0;
                var y = clickPos.y - this.y0;
                if (this.moved && x === this.dx && y === this.dy) {
                    this.setHand(x, y);
                }

                if (this.currentView === 'hours') {
                    this.showView('minutes', this.options.duration / 2);
                } else if (this.options.autoClose) {
                    $(this.minutesView).addClass('timepicker-dial-out');
                    setTimeout(function() {
                        _this57.done();
                    }, this.options.duration / 2);
                }

                if (typeof this.options.onSelect === 'function') {
                    this.options.onSelect.call(this, this.hours, this
                        .minutes);
                }

                // Unbind mousemove event
                document.removeEventListener('mousemove', this
                    ._handleDocumentClickMoveBound);
                document.removeEventListener('touchmove', this
                    ._handleDocumentClickMoveBound);
            }
        }, {
            key: "_insertHTMLIntoDOM",
            value: function _insertHTMLIntoDOM() {
                this.$modalEl = $(Timepicker._template);
                this.modalEl = this.$modalEl[0];
                this.modalEl.id = 'modal-' + this.id;

                // Append popover to input by default
                var containerEl = document.querySelector(this.options
                    .container);
                if (this.options.container && !!containerEl) {
                    this.$modalEl.appendTo(containerEl);
                } else {
                    this.$modalEl.insertBefore(this.el);
                }
            }
        }, {
            key: "_setupModal",
            value: function _setupModal() {
                var _this58 = this;

                this.modal = M.Modal.init(this.modalEl, {
                    onOpenStart: this.options.onOpenStart,
                    onOpenEnd: this.options.onOpenEnd,
                    onCloseStart: this.options.onCloseStart,
                    onCloseEnd: function() {
                        if (typeof _this58.options
                            .onCloseEnd === 'function') {
                            _this58.options.onCloseEnd.call(
                                _this58);
                        }
                        _this58.isOpen = false;
                    }
                });
            }
        }, {
            key: "_setupVariables",
            value: function _setupVariables() {
                this.currentView = 'hours';
                this.vibrate = navigator.vibrate ? 'vibrate' : navigator
                    .webkitVibrate ? 'webkitVibrate' : null;

                this._canvas = this.modalEl.querySelector(
                    '.timepicker-canvas');
                this.plate = this.modalEl.querySelector(
                '.timepicker-plate');

                this.hoursView = this.modalEl.querySelector(
                    '.timepicker-hours');
                this.minutesView = this.modalEl.querySelector(
                    '.timepicker-minutes');
                this.spanHours = this.modalEl.querySelector(
                    '.timepicker-span-hours');
                this.spanMinutes = this.modalEl.querySelector(
                    '.timepicker-span-minutes');
                this.spanAmPm = this.modalEl.querySelector(
                    '.timepicker-span-am-pm');
                this.footer = this.modalEl.querySelector(
                    '.timepicker-footer');
                this.amOrPm = 'PM';
            }
        }, {
            key: "_pickerSetup",
            value: function _pickerSetup() {
                var $clearBtn = $(
                    "<button class=\"btn-flat timepicker-clear waves-effect\" style=\"visibility: hidden;\" type=\"button\" tabindex=\"" +
                    (this.options.twelveHour ? '3' : '1') + "\">" + this
                    .options.i18n.clear + "</button>").appendTo(this
                    .footer).on('click', this.clear.bind(this));
                if (this.options.showClearBtn) {
                    $clearBtn.css({
                        visibility: ''
                    });
                }

                var confirmationBtnsContainer = $(
                    '<div class="confirmation-btns"></div>');
                $('<button class="btn-flat timepicker-close waves-effect" type="button" tabindex="' +
                    (this.options.twelveHour ? '3' : '1') + '">' + this
                    .options.i18n.cancel + '</button>').appendTo(
                    confirmationBtnsContainer).on('click', this.close
                    .bind(this));
                $('<button class="btn-flat timepicker-close waves-effect" type="button" tabindex="' +
                    (this.options.twelveHour ? '3' : '1') + '">' + this
                    .options.i18n.done + '</button>').appendTo(
                    confirmationBtnsContainer).on('click', this.done
                    .bind(this));
                confirmationBtnsContainer.appendTo(this.footer);
            }
        }, {
            key: "_clockSetup",
            value: function _clockSetup() {
                if (this.options.twelveHour) {
                    this.$amBtn = $('<div class="am-btn">AM</div>');
                    this.$pmBtn = $('<div class="pm-btn">PM</div>');
                    this.$amBtn.on('click', this._handleAmPmClick.bind(
                        this)).appendTo(this.spanAmPm);
                    this.$pmBtn.on('click', this._handleAmPmClick.bind(
                        this)).appendTo(this.spanAmPm);
                }

                this._buildHoursView();
                this._buildMinutesView();
                this._buildSVGClock();
            }
        }, {
            key: "_buildSVGClock",
            value: function _buildSVGClock() {
                // Draw clock hands and others
                var dialRadius = this.options.dialRadius;
                var tickRadius = this.options.tickRadius;
                var diameter = dialRadius * 2;

                var svg = Timepicker._createSVGEl('svg');
                svg.setAttribute('class', 'timepicker-svg');
                svg.setAttribute('width', diameter);
                svg.setAttribute('height', diameter);
                var g = Timepicker._createSVGEl('g');
                g.setAttribute('transform', 'translate(' + dialRadius +
                    ',' + dialRadius + ')');
                var bearing = Timepicker._createSVGEl('circle');
                bearing.setAttribute('class', 'timepicker-canvas-bearing');
                bearing.setAttribute('cx', 0);
                bearing.setAttribute('cy', 0);
                bearing.setAttribute('r', 4);
                var hand = Timepicker._createSVGEl('line');
                hand.setAttribute('x1', 0);
                hand.setAttribute('y1', 0);
                var bg = Timepicker._createSVGEl('circle');
                bg.setAttribute('class', 'timepicker-canvas-bg');
                bg.setAttribute('r', tickRadius);
                g.appendChild(hand);
                g.appendChild(bg);
                g.appendChild(bearing);
                svg.appendChild(g);
                this._canvas.appendChild(svg);

                this.hand = hand;
                this.bg = bg;
                this.bearing = bearing;
                this.g = g;
            }
        }, {
            key: "_buildHoursView",
            value: function _buildHoursView() {
                var $tick = $('<div class="timepicker-tick"></div>');
                // Hours view
                if (this.options.twelveHour) {
                    for (var i = 1; i < 13; i += 1) {
                        var tick = $tick.clone();
                        var radian = i / 6 * Math.PI;
                        var radius = this.options.outerRadius;
                        tick.css({
                            left: this.options.dialRadius + Math
                                .sin(radian) * radius - this.options
                                .tickRadius + 'px',
                            top: this.options.dialRadius - Math.cos(
                                    radian) * radius - this.options
                                .tickRadius + 'px'
                        });
                        tick.html(i === 0 ? '00' : i);
                        this.hoursView.appendChild(tick[0]);
                        // tick.on(mousedownEvent, mousedown);
                    }
                } else {
                    for (var _i2 = 0; _i2 < 24; _i2 += 1) {
                        var _tick = $tick.clone();
                        var _radian = _i2 / 6 * Math.PI;
                        var inner = _i2 > 0 && _i2 < 13;
                        var _radius = inner ? this.options.innerRadius :
                            this.options.outerRadius;
                        _tick.css({
                            left: this.options.dialRadius + Math
                                .sin(_radian) * _radius - this
                                .options.tickRadius + 'px',
                            top: this.options.dialRadius - Math.cos(
                                    _radian) * _radius - this
                                .options.tickRadius + 'px'
                        });
                        _tick.html(_i2 === 0 ? '00' : _i2);
                        this.hoursView.appendChild(_tick[0]);
                        // tick.on(mousedownEvent, mousedown);
                    }
                }
            }
        }, {
            key: "_buildMinutesView",
            value: function _buildMinutesView() {
                var $tick = $('<div class="timepicker-tick"></div>');
                // Minutes view
                for (var i = 0; i < 60; i += 5) {
                    var tick = $tick.clone();
                    var radian = i / 30 * Math.PI;
                    tick.css({
                        left: this.options.dialRadius + Math.sin(
                                radian) * this.options.outerRadius -
                            this.options.tickRadius + 'px',
                        top: this.options.dialRadius - Math.cos(
                                radian) * this.options.outerRadius -
                            this.options.tickRadius + 'px'
                    });
                    tick.html(Timepicker._addLeadingZero(i));
                    this.minutesView.appendChild(tick[0]);
                }
            }
        }, {
            key: "_handleAmPmClick",
            value: function _handleAmPmClick(e) {
                var $btnClicked = $(e.target);
                this.amOrPm = $btnClicked.hasClass('am-btn') ? 'AM' : 'PM';
                this._updateAmPmView();
            }
        }, {
            key: "_updateAmPmView",
            value: function _updateAmPmView() {
                if (this.options.twelveHour) {
                    this.$amBtn.toggleClass('text-primary', this.amOrPm ===
                        'AM');
                    this.$pmBtn.toggleClass('text-primary', this.amOrPm ===
                        'PM');
                }
            }
        }, {
            key: "_updateTimeFromInput",
            value: function _updateTimeFromInput() {
                // Get the time
                var value = ((this.el.value || this.options.defaultTime ||
                    '') + '').split(':');
                if (this.options.twelveHour && !(typeof value[1] ===
                        'undefined')) {
                    if (value[1].toUpperCase().indexOf('AM') > 0) {
                        this.amOrPm = 'AM';
                    } else {
                        this.amOrPm = 'PM';
                    }
                    value[1] = value[1].replace('AM', '').replace('PM', '');
                }
                if (value[0] === 'now') {
                    var now = new Date(+new Date() + this.options.fromNow);
                    value = [now.getHours(), now.getMinutes()];
                    if (this.options.twelveHour) {
                        this.amOrPm = value[0] >= 12 && value[0] < 24 ?
                            'PM' : 'AM';
                    }
                }
                this.hours = +value[0] || 0;
                this.minutes = +value[1] || 0;
                this.spanHours.innerHTML = this.hours;
                this.spanMinutes.innerHTML = Timepicker._addLeadingZero(this
                    .minutes);

                this._updateAmPmView();
            }
        }, {
            key: "showView",
            value: function showView(view, delay) {
                if (view === 'minutes' && $(this.hoursView).css(
                        'visibility') === 'visible') {
                    // raiseCallback(this.options.beforeHourSelect);
                }
                var isHours = view === 'hours',
                    nextView = isHours ? this.hoursView : this.minutesView,
                    hideView = isHours ? this.minutesView : this.hoursView;
                this.currentView = view;

                $(this.spanHours).toggleClass('text-primary', isHours);
                $(this.spanMinutes).toggleClass('text-primary', !isHours);

                // Transition view
                hideView.classList.add('timepicker-dial-out');
                $(nextView).css('visibility', 'visible').removeClass(
                    'timepicker-dial-out');

                // Reset clock hand
                this.resetClock(delay);

                // After transitions ended
                clearTimeout(this.toggleViewTimer);
                this.toggleViewTimer = setTimeout(function() {
                    $(hideView).css('visibility', 'hidden');
                }, this.options.duration);
            }
        }, {
            key: "resetClock",
            value: function resetClock(delay) {
                var view = this.currentView,
                    value = this[view],
                    isHours = view === 'hours',
                    unit = Math.PI / (isHours ? 6 : 30),
                    radian = value * unit,
                    radius = isHours && value > 0 && value < 13 ? this
                    .options.innerRadius : this.options.outerRadius,
                    x = Math.sin(radian) * radius,
                    y = -Math.cos(radian) * radius,
                    self = this;

                if (delay) {
                    $(this.canvas).addClass('timepicker-canvas-out');
                    setTimeout(function() {
                        $(self.canvas).removeClass(
                            'timepicker-canvas-out');
                        self.setHand(x, y);
                    }, delay);
                } else {
                    this.setHand(x, y);
                }
            }
        }, {
            key: "setHand",
            value: function setHand(x, y, roundBy5) {
                var _this59 = this;

                var radian = Math.atan2(x, -y),
                    isHours = this.currentView === 'hours',
                    unit = Math.PI / (isHours || roundBy5 ? 6 : 30),
                    z = Math.sqrt(x * x + y * y),
                    inner = isHours && z < (this.options.outerRadius + this
                        .options.innerRadius) / 2,
                    radius = inner ? this.options.innerRadius : this.options
                    .outerRadius;

                if (this.options.twelveHour) {
                    radius = this.options.outerRadius;
                }

                // Radian should in range [0, 2PI]
                if (radian < 0) {
                    radian = Math.PI * 2 + radian;
                }

                // Get the round value
                var value = Math.round(radian / unit);

                // Get the round radian
                radian = value * unit;

                // Correct the hours or minutes
                if (this.options.twelveHour) {
                    if (isHours) {
                        if (value === 0) value = 12;
                    } else {
                        if (roundBy5) value *= 5;
                        if (value === 60) value = 0;
                    }
                } else {
                    if (isHours) {
                        if (value === 12) {
                            value = 0;
                        }
                        value = inner ? value === 0 ? 12 : value : value ===
                            0 ? 0 : value + 12;
                    } else {
                        if (roundBy5) {
                            value *= 5;
                        }
                        if (value === 60) {
                            value = 0;
                        }
                    }
                }

                // Once hours or minutes changed, vibrate the device
                if (this[this.currentView] !== value) {
                    if (this.vibrate && this.options.vibrate) {
                        // Do not vibrate too frequently
                        if (!this.vibrateTimer) {
                            navigator[this.vibrate](10);
                            this.vibrateTimer = setTimeout(function() {
                                _this59.vibrateTimer = null;
                            }, 100);
                        }
                    }
                }

                this[this.currentView] = value;
                if (isHours) {
                    this['spanHours'].innerHTML = value;
                } else {
                    this['spanMinutes'].innerHTML = Timepicker
                        ._addLeadingZero(value);
                }

                // Set clock hand and others' position
                var cx1 = Math.sin(radian) * (radius - this.options
                        .tickRadius),
                    cy1 = -Math.cos(radian) * (radius - this.options
                        .tickRadius),
                    cx2 = Math.sin(radian) * radius,
                    cy2 = -Math.cos(radian) * radius;
                this.hand.setAttribute('x2', cx1);
                this.hand.setAttribute('y2', cy1);
                this.bg.setAttribute('cx', cx2);
                this.bg.setAttribute('cy', cy2);
            }
        }, {
            key: "open",
            value: function open() {
                if (this.isOpen) {
                    return;
                }

                this.isOpen = true;
                this._updateTimeFromInput();
                this.showView('hours');

                this.modal.open();
            }
        }, {
            key: "close",
            value: function close() {
                if (!this.isOpen) {
                    return;
                }

                this.isOpen = false;
                this.modal.close();
            }

            /**
             * Finish timepicker selection.
             */

        }, {
            key: "done",
            value: function done(e, clearValue) {
                // Set input value
                var last = this.el.value;
                var value = clearValue ? '' : Timepicker._addLeadingZero(
                    this.hours) + ':' + Timepicker._addLeadingZero(this
                    .minutes);
                this.time = value;
                if (!clearValue && this.options.twelveHour) {
                    value = value + " " + this.amOrPm;
                }
                this.el.value = value;

                // Trigger change event
                if (value !== last) {
                    this.$el.trigger('change');
                }

                this.close();
                this.el.focus();
            }
        }, {
            key: "clear",
            value: function clear() {
                this.done(null, true);
            }
        }], [{
            key: "init",
            value: function init(els, options) {
                return _get(Timepicker.__proto__ || Object.getPrototypeOf(
                    Timepicker), "init", this).call(this, this, els,
                    options);
            }
        }, {
            key: "_addLeadingZero",
            value: function _addLeadingZero(num) {
                return (num < 10 ? '0' : '') + num;
            }
        }, {
            key: "_createSVGEl",
            value: function _createSVGEl(name) {
                var svgNS = 'http://www.w3.org/2000/svg';
                return document.createElementNS(svgNS, name);
            }

            /**
             * @typedef {Object} Point
             * @property {number} x The X Coordinate
             * @property {number} y The Y Coordinate
             */

            /**
             * Get x position of mouse or touch event
             * @param {Event} e
             * @return {Point} x and y location
             */

        }, {
            key: "_Pos",
            value: function _Pos(e) {
                if (e.targetTouches && e.targetTouches.length >= 1) {
                    return {
                        x: e.targetTouches[0].clientX,
                        y: e.targetTouches[0].clientY
                    };
                }
                // mouse event
                return {
                    x: e.clientX,
                    y: e.clientY
                };
            }

            /**
             * Get Instance
             */

        }, {
            key: "getInstance",
            value: function getInstance(el) {
                var domElem = !!el.jquery ? el[0] : el;
                return domElem.M_Timepicker;
            }
        }, {
            key: "defaults",
            get: function() {
                return _defaults;
            }
        }]);

        return Timepicker;
    }(Component);

    Timepicker._template = ['<div class= "modal timepicker-modal">',
        '<div class="modal-content timepicker-container">',
        '<div class="timepicker-digital-display">',
        '<div class="timepicker-text-container">',
        '<div class="timepicker-display-column">',
        '<span class="timepicker-span-hours text-primary"></span>', ':',
        '<span class="timepicker-span-minutes"></span>', '</div>',
        '<div class="timepicker-display-column timepicker-display-am-pm">',
        '<div class="timepicker-span-am-pm"></div>', '</div>', '</div>', '</div>',
        '<div class="timepicker-analog-display">', '<div class="timepicker-plate">',
        '<div class="timepicker-canvas"></div>',
        '<div class="timepicker-dial timepicker-hours"></div>',
        '<div class="timepicker-dial timepicker-minutes timepicker-dial-out"></div>',
        '</div>', '<div class="timepicker-footer"></div>', '</div>', '</div>', '</div>'
    ].join('');

    M.Timepicker = Timepicker;

    if (M.jQueryLoaded) {
        M.initializeJqueryWrapper(Timepicker, 'timepicker', 'M_Timepicker');
    }
})($);