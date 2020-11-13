(function(global, anim) {
    'use strict';

    var _defaults = {
        edge: 'left',
        draggable: true,
        inDuration: 250,
        outDuration: 200,
        onOpenStart: null,
        onOpenEnd: null,
        onCloseStart: null,
        onCloseEnd: null,
        minWidthFixed: 992,
        minWidthPush: 600,
        preventScrolling: true
    };

    /**
     * Construct Sidenav instance and set up overlay
     * @constructor
     * @param {Element} el
     * @param {Object} options
     */
    function Sidenav(el, options) {
        if (!this) return new Sidenav(el, options);
        this.el = el[0];
        this.$el = el;
        this.el.Sidenav = this;
        this.id = this.$el.attr('id');

        /**
         * Options for the Sidenav
         * @member Sidenav#options
         * @prop {String} [edge='left'] - Side of screen on which Sidenav appears
         * @prop {Boolean} [draggable=true] - Allow swipe gestures to open/close Sidenav
         * @prop {Number} [inDuration=250] - Length in ms of enter transition
         * @prop {Number} [outDuration=200] - Length in ms of exit transition
         * @prop {Function} onOpenStart - Function called when sidenav starts entering
         * @prop {Function} onOpenEnd - Function called when sidenav finishes entering
         * @prop {Function} onCloseStart - Function called when sidenav starts exiting
         * @prop {Function} onCloseEnd - Function called when sidenav finishes exiting
         */
        this.options = $.extend({}, Sidenav.defaults, options);

        /**
         * Describes open/close state of Sidenav
         * @type {Boolean}
         */
        this.isOpen = false;
        
        /**
         * Describes if Sidenav is fixed
         * @type {Boolean}
         */
        this.isFixed = this.el.classList.contains('sidenav-fixed');

        /**
         * Describes if Sidenav is being draggeed
         * @type {Boolean}
         */
        this.isDragged = false;

        // Window size variables for window resize checks
        this.lastWindowWidth = window.innerWidth;
        this.lastWindowHeight = window.innerHeight;

        this._createOverlay();
        this._createDragTarget();
        this._setupEventHandlers();
        this._setupClasses();
        this._setupFixed();
        if(this._isCurrentlyPush()){
            this.el.classList.add('sidenav-push')
        }
        Sidenav._sidenavs.push(this);
    }

    Sidenav.prototype = {
        "destroy": function destroy() {
            this._removeEventHandlers();
            this._overlay.parentNode.removeChild(this._overlay);
            this.dragTarget.parentNode.removeChild(this.dragTarget);
            this.el.Sidenav = undefined;
            this.el.style.transform = '';

            var index = Sidenav._sidenavs.indexOf(this);
            if (index >= 0) {
                Sidenav._sidenavs.splice(index, 1);
            }
        },
        "_createOverlay": function _createOverlay() {
            var overlay = document.createElement('div');
            this._closeBound = this.close.bind(this);
            overlay.classList.add('sidenav-overlay');

            overlay.addEventListener('click', this._closeBound);

            document.body.appendChild(overlay);
            this._overlay = overlay;
        },
        "_setupEventHandlers": function _setupEventHandlers() {
            if (Sidenav._sidenavs.length === 0) {
                document.body.addEventListener('click', this._handleTriggerClick);
            }

            this._handleDragTargetDragBound = this._handleDragTargetDrag.bind(this);
            this._handleDragTargetReleaseBound = this._handleDragTargetRelease.bind(this);
            this._handleCloseDragBound = this._handleCloseDrag.bind(this);
            this._handleCloseReleaseBound = this._handleCloseRelease.bind(this);
            this._handleCloseTriggerClickBound = this._handleCloseTriggerClick.bind(this);

            this.dragTarget.addEventListener('touchmove', this._handleDragTargetDragBound);
            this.dragTarget.addEventListener('touchend', this._handleDragTargetReleaseBound);
            this._overlay.addEventListener('touchmove', this._handleCloseDragBound);
            this._overlay.addEventListener('touchend', this._handleCloseReleaseBound);
            this.el.addEventListener('touchmove', this._handleCloseDragBound);
            this.el.addEventListener('touchend', this._handleCloseReleaseBound);
            this.el.addEventListener('click', this._handleCloseTriggerClickBound);

            // Add resize for side nav fixed
            if (this.isFixed) {
                this._handleWindowResizeBound = this._handleWindowResize.bind(this);
                window.addEventListener('resize', this._handleWindowResizeBound);
            }
        },
        "_removeEventHandlers": function _removeEventHandlers() {
            if (Sidenav._sidenavs.length === 1) {
                document.body.removeEventListener('click', this._handleTriggerClick);
            }

            this.dragTarget.removeEventListener('touchmove', this._handleDragTargetDragBound);
            this.dragTarget.removeEventListener('touchend', this._handleDragTargetReleaseBound);
            this._overlay.removeEventListener('touchmove', this._handleCloseDragBound);
            this._overlay.removeEventListener('touchend', this._handleCloseReleaseBound);
            this.el.removeEventListener('touchmove', this._handleCloseDragBound);
            this.el.removeEventListener('touchend', this._handleCloseReleaseBound);
            this.el.removeEventListener('click', this._handleCloseTriggerClickBound);

            // Remove resize for side nav fixed
            if (this.isFixed) {
                window.removeEventListener('resize', this._handleWindowResizeBound);
            }
        },

        /**
         * Handle Trigger Click
         * @param {Event} e
         */

        "_handleTriggerClick": function _handleTriggerClick(e) {
            var $trigger = $(e.target).closest('.sidenav-trigger');
            if (e.target && $trigger.length) {
                var sidenavId = M.getIdFromTrigger($trigger[0]);

                var sidenavInstance = document.getElementById(sidenavId).Sidenav;
                if (sidenavInstance) {
                    sidenavInstance.toggle($trigger);
                }
                e.preventDefault();
            }
        },

        /**
         * Set variables needed at the beggining of drag
         * and stop any current transition.
         * @param {Event} e
         */
        "_startDrag": function _startDrag(e) {
            var clientX = e.targetTouches[0].clientX;
            this.isDragged = true;
            this._startingXpos = clientX;
            this._xPos = this._startingXpos;
            this._time = Date.now();
            this._width = this.el.getBoundingClientRect().width;
            if(!this._isCurrentlyPush())
                this._overlay.style.display = 'block';
            this._initialScrollTop = this.isOpen ? this.el.scrollTop : M.getDocumentScrollTop();
            this._verticallyScrolling = false;
            anim.remove(this.el);
            anim.remove(this._overlay);
        },

        /**
         * Set variables needed at each drag move update tick
         * @param {Event} e
         */
        "_dragMoveUpdate": function _dragMoveUpdate(e) {
            var clientX = e.targetTouches[0].clientX;
            var currentScrollTop = this.isOpen ? this.el.scrollTop : M.getDocumentScrollTop();
            this.deltaX = Math.abs(this._xPos - clientX);
            this._xPos = clientX;
            this.velocityX = this.deltaX / (Date.now() - this._time);
            this._time = Date.now();
            if (this._initialScrollTop !== currentScrollTop) {
                this._verticallyScrolling = true;
            }
        },

        /**
         * Handles Dragging of Sidenav
         * @param {Event} e
         */
        "_handleDragTargetDrag": function _handleDragTargetDrag(e) {
            // Check if draggable
            if (!this.options.draggable || this._isCurrentlyFixed() || this._verticallyScrolling) {
                return;
            }

            // If not being dragged, set initial drag start variables
            if (!this.isDragged) {
                this._startDrag(e);
            }

            // Run touchmove updates
            this._dragMoveUpdate(e);

            // Calculate raw deltaX
            var totalDeltaX = this._xPos - this._startingXpos;

            // dragDirection is the attempted user drag direction
            var dragDirection = totalDeltaX > 0 ? 'right' : 'left';

            // Don't allow totalDeltaX to exceed Sidenav width or be dragged in the opposite direction
            totalDeltaX = Math.min(this._width, Math.abs(totalDeltaX));
            if (this.options.edge === dragDirection) {
                totalDeltaX = 0;
            }

            /**
             * transformX is the drag displacement
             * transformPrefix is the initial transform placement
             * Invert values if Sidenav is right edge
             */
            var transformX = totalDeltaX;
            var transformPrefix = 'translateX(-100%)';
            if (this.options.edge === 'right') {
                transformPrefix = 'translateX(100%)';
                transformX = -transformX;
            }

            // Calculate open/close percentage of sidenav, with open = 1 and close = 0
            this.percentOpen = Math.min(1, totalDeltaX / this._width);

            // Set transform and opacity styles
            this.el.style.transform = transformPrefix + " translateX(" + transformX + "px)";
            if(!this._isCurrentlyPush())
                this._overlay.style.opacity = this.percentOpen;
        },

        /**
         * Handle Drag Target Release
         */
        "_handleDragTargetRelease": function _handleDragTargetRelease() {
            if (this.isDragged) {
                if (this.percentOpen > 0.2) {
                    this.open();
                }
                else {
                    this._animateOut();
                }

                this.isDragged = false;
                this._verticallyScrolling = false;
            }
        },

        /**
         * Handle Close Drag
         * @param {Event} e
         */
        "_handleCloseDrag": function _handleCloseDrag(e) {
            if (this.isOpen) {
                // Check if draggable
                if (!this.options.draggable || this._isCurrentlyFixed() || this._verticallyScrolling) {
                    return;
                }

                // If not being dragged, set initial drag start variables
                if (!this.isDragged) {
                    this._startDrag(e);
                }

                // Run touchmove updates
                this._dragMoveUpdate(e);

                // Calculate raw deltaX
                var totalDeltaX = this._xPos - this._startingXpos;

                // dragDirection is the attempted user drag direction
                var dragDirection = totalDeltaX > 0 ? 'right' : 'left';

                // Don't allow totalDeltaX to exceed Sidenav width or be dragged in the opposite direction
                totalDeltaX = Math.min(this._width, Math.abs(totalDeltaX));
                if (this.options.edge !== dragDirection) {
                    totalDeltaX = 0;
                }

                var transformX = -totalDeltaX;
                if (this.options.edge === 'right') {
                    transformX = -transformX;
                }

                // Calculate open/close percentage of sidenav, with open = 1 and close = 0
                this.percentOpen = Math.min(1, 1 - totalDeltaX / this._width);

                // Set transform and opacity styles
                this.el.style.transform = "translateX(" + transformX + "px)";
                this._overlay.style.opacity = this.percentOpen;
            }
        },

        /**
         * Handle Close Release
         */
        "_handleCloseRelease": function _handleCloseRelease() {
            if (this.isOpen && this.isDragged) {
                if (this.percentOpen > 0.8) {
                    this._animateIn();
                }
                else {
                    this.close();
                }

                this.isDragged = false;
                this._verticallyScrolling = false;
            }
        },

        /**
         * Handles closing of Sidenav when element with class .sidenav-close
         */
        "_handleCloseTriggerClick": function _handleCloseTriggerClick(e) {
            var $closeTrigger = $(e.target).closest('.sidenav-close');
            if ($closeTrigger.length && !this._isCurrentlyFixed()) {
                this.close();
            }
        },

        /**
         * Handle Window Resize
         */
        "_handleWindowResize": function _handleWindowResize() {
            // Only handle horizontal resizes
            if (this.lastWindowWidth !== window.innerWidth) {
                if (window.innerWidth > 992) {
                    this.open();
                }
                else {
                    this.close();
                }
            }

            this.lastWindowWidth = window.innerWidth;
            this.lastWindowHeight = window.innerHeight;
        },
        "_setupClasses": function _setupClasses() {
            if (this.options.edge === 'right') {
                this.el.classList.add('right-aligned');
                this.dragTarget.classList.add('right-aligned');
            }
        },
        "_removeClasses": function _removeClasses() {
            this.el.classList.remove('right-aligned');
            this.dragTarget.classList.remove('right-aligned');
        },
        "_setupFixed": function _setupFixed() {
            if (this._isCurrentlyFixed()) {
                this.open();
            }
        },
        "_isCurrentlyFixed": function _isCurrentlyFixed() {
            return this.isFixed && window.innerWidth > this.options.minWidthFixed;
        },
        "_isCurrentlyPush": function _isCurrentlyPush() {
            return this.options.pushElements && window.innerWidth > this.options.minWidthPush;
        },
        "_createDragTarget": function _createDragTarget() {
            var dragTarget = document.createElement('div');
            dragTarget.classList.add('drag-target');
            document.body.appendChild(dragTarget);
            this.dragTarget = dragTarget;
        },
        "_preventBodyScrolling": function _preventBodyScrolling() {
            var body = document.body;
            body.style.overflow = 'hidden';
        },
        "_enableBodyScrolling": function _enableBodyScrolling() {
            var body = document.body;
            body.style.overflow = '';
        },
        "toggle": function toggle(el) {
            if (this.isOpen === true) {
                this.close(el);
            }
            else this.open(el);
        },
        "open": function open() {
            if (this.isOpen === true) {
                return;
            }

            this.isOpen = true;

            // Run onOpenStart callback
            if (typeof this.options.onOpenStart === 'function') {
                this.options.onOpenStart.call(this, this.el);
            }

            // Handle fixed Sidenav
            if (this._isCurrentlyFixed()) {
                anim.remove(this.el);
                anim({
                    targets: this.el,
                    translateX: 0,
                    duration: 0,
                    easing: 'easeOutQuad'
                });
                this._enableBodyScrolling();
                this._overlay.style.display = 'none';

                // Handle non-fixed Sidenav
            }
            else {
                if (this.options.preventScrolling) {
                    this._preventBodyScrolling();
                }

                if (!this.isDragged || this.percentOpen != 1) {
                    this._animateIn();
                }
            }
        },
        "close": function close() {
            if (this.isOpen === false) {
                return;
            }

            this.isOpen = false;

            // Run onCloseStart callback
            if (typeof this.options.onCloseStart === 'function') {
                this.options.onCloseStart.call(this, this.el);
            }

            // Handle fixed Sidenav
            if (this._isCurrentlyFixed()) {
                var transformX = this.options.edge === 'left' ? '-105%' : '105%';
                this.el.style.transform = "translateX(" + transformX + ")";

                // Handle non-fixed Sidenav
            }
            else {
                this._enableBodyScrolling();

                if (!this.isDragged || this.percentOpen != 0) {
                    this._animateOut();
                }
                else {
                    this._overlay.style.display = 'none';
                }
            }
        },
        "_animateIn": function _animateIn() {
            this._animateSidenavIn();
            if(!this._isCurrentlyPush())
                this._animateOverlayIn();
        },
        "_animateSidenavIn": function _animateSidenavIn() {
            var _this31 = this;

            var slideOutPercent = this.options.edge === 'left' ? -1 : 1;
            if (this.isDragged) {
                slideOutPercent = this.options.edge === 'left' ? slideOutPercent + this.percentOpen : slideOutPercent - this.percentOpen;
            }

            anim.remove(this.el);
            anim({
                targets: this.el,
                translateX: [slideOutPercent * 100 + "%", 0],
                duration: this.options.inDuration,
                easing: 'easeOutQuad',
                complete: function() {
                    // Run onOpenEnd callback
                    if (typeof _this31.options.onOpenEnd === 'function') {
                        _this31.options.onOpenEnd.call(_this31, _this31.el);
                    }
                }
            });
            if(this._isCurrentlyPush()){
                var elements = this.$el.parent().children('.sidenav-pushable').toArray();
                //anim.remove(elements);
                var options = {
                    targets: elements,
                    duration: this.options.inDuration,
                    easing: 'easeOutQuad',
                };
                var width = this.$el.width();
                options[this.options.edge==='left'?'marginLeft':'marginRight']=[0, width + "px"];
                anim(options);
            }
        },
        "_animateOverlayIn": function _animateOverlayIn() {
            var start = 0;
            if (this.isDragged) {
                start = this.percentOpen;
            }
            else {
                $(this._overlay).css({
                    display: 'block'
                });
            }

            anim.remove(this._overlay);
            anim({
                targets: this._overlay,
                opacity: [start, 1],
                duration: this.options.inDuration,
                easing: 'easeOutQuad'
            });
        },
        "_animateOut": function _animateOut() {
            this._animateSidenavOut();
            this._animateOverlayOut();
        },
        "_animateSidenavOut": function _animateSidenavOut() {
            var _this32 = this;

            var endPercent = this.options.edge === 'left' ? -1 : 1;
            var slideOutPercent = 0;
            if (this.isDragged) {
                slideOutPercent = this.options.edge === 'left' ? endPercent + this.percentOpen : endPercent - this.percentOpen;
            }

            anim.remove(this.el);
            anim({
                targets: this.el,
                translateX: [slideOutPercent * 100 + "%", endPercent * 105 + "%"],
                duration: this.options.outDuration,
                easing: 'easeOutQuad',
                complete: function() {
                    // Run onOpenEnd callback
                    if (typeof _this32.options.onCloseEnd === 'function') {
                        _this32.options.onCloseEnd.call(_this32, _this32.el);
                    }
                }
            });
            if(this._isCurrentlyPush()){
                var elements = this.$el.parent().children('.sidenav-pushable').toArray();
                //anim.remove(elements);
                var options = {
                    targets: elements,
                    duration: this.options.outDuration,
                    easing: 'easeOutQuad',
                };
                var width = this.$el.width();
                options[this.options.edge==='left'?'marginLeft':'marginRight']=[ width + "px",1];
                anim(options);
            }
        },
        "_animateOverlayOut": function _animateOverlayOut() {
            var _this33 = this;

            anim.remove(this._overlay);
            anim({
                targets: this._overlay,
                opacity: 0,
                duration: this.options.outDuration,
                easing: 'easeOutQuad',
                complete: function() {
                    $(_this33._overlay).css('display', 'none');
                }
            });
        }
    }

    function getInstance(el) {
        var domElem = !!el.jquery ? el[0] : el;
        return domElem.Sidenav;
    }
    Sidenav.getInstance = getInstance;
    Sidenav.defaults = _defaults;

    /**
     * @static
     * @memberof Sidenav
     * @type {Array.<Sidenav>}
     */


    Sidenav._sidenavs = [];

    global.Sidenav = Sidenav;
})(window, M.anime);