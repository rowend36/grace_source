(function(global, anim) {
    'use strict';

    var _defaults = {
        edge: 'left',
        draggable: true,
        inDuration: 250,
        outDuration: 60,
        onOpenStart: null,
        onOpenEnd: null,
        onCloseStart: null,
        onCloseEnd: null,
        minWidthPush: 600,
        preventScrolling: true
    };
    var OVERLAY_OPACITY = 0.4;
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
         * Describes if Sidenav is being draggeed
         * @type {Boolean}
         */
        this.isDragged = false;

        // Window size variables for window resize checks
        this.lastWindowWidth = window.innerWidth;
        this.lastWindowHeight = window.innerHeight;

        this.dragTarget = $("#viewroot")[0];
        this._createOverlay();
        this._setupEventHandlers();
        this._setupClasses();
        this._updateType();
        Sidenav._sidenavs.push(this);
    }

    Sidenav.prototype = {
        "destroy": function destroy() {
            this._removeEventHandlers();
            this._overlay.parentNode.removeChild(this._overlay);
            this.el.Sidenav = undefined;
            this.el.style.transform = '';

            var index = Sidenav._sidenavs.indexOf(this);
            if (index >= 0) {
                Sidenav._sidenavs.splice(index, 1);
            }
        },
        "_updateType": function _updateType() {
            var isOverlay = !this.options.pushElements || window.innerWidth < this.options.minWidthPush;
            if (isOverlay == this.isOverlay) return false;
            this.close();
            if (isOverlay) {
                this.el.classList.remove('sidenav-push');
            } else {
                this.el.classList.add('sidenav-push');
            }
            this.isOverlay = isOverlay;
            return true;
        },
        "_createOverlay": function _createOverlay() {
            var overlay = document.createElement('div');
            overlay.classList.add('sidenav-overlay');
            document.body.appendChild(overlay);
            this._overlay = overlay;
        },
        "_setupEventHandlers": function _setupEventHandlers() {
            this._handleDragTargetStartBound = this._handleDragTargetStart.bind(this);
            this._handleDragTargetDragBound = this._handleDragTargetDrag.bind(this);
            this._handleDragTargetReleaseBound = this._handleDragTargetRelease.bind(this);
            this._handleCloseDragBound = this._handleCloseDrag.bind(this);
            this._handleCloseReleaseBound = this._handleCloseRelease.bind(this);
            this._closeBound = this.close.bind(this);

            this.dragTarget.addEventListener('touchstart', this._handleDragTargetStartBound);
            this.dragTarget.addEventListener('touchmove', this._handleDragTargetDragBound, true);
            this.dragTarget.addEventListener('touchend', this._handleDragTargetReleaseBound);
            this._overlay.addEventListener('touchmove', this._handleCloseDragBound);
            this._overlay.addEventListener('touchend', this._handleCloseReleaseBound);
            this._overlay.addEventListener('click', this._closeBound);

            // Add resize for push elements
            if (this.options.pushElements) {
                this._handleWindowResizeBound = this._handleWindowResize.bind(this);
                window.addEventListener('resize', this._handleWindowResizeBound);
            }
        },
        "_removeEventHandlers": function _removeEventHandlers() {
            this.dragTarget.removeEventListener('touchstart', this._handleDragTargetStartBound);
            this.dragTarget.removeEventListener('touchmove', this._handleDragTargetDragBound);
            this.dragTarget.removeEventListener('touchend', this._handleDragTargetReleaseBound);
            this._overlay.removeEventListener('touchmove', this._handleCloseDragBound);
            this._overlay.removeEventListener('touchend', this._handleCloseReleaseBound);
            this._overlay.removeEventListener('click', this._closeBound);

            // Remove resize for side nav push
            if (this._handleWindowResizeBound)
                window.removeEventListener('resize', this._handleWindowResizeBound);

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
            this._initialScrollTop = this.isOpen ? this.el.scrollTop : M.getDocumentScrollTop();
            this._verticallyScrolling = false;
            anim.remove(this.el);
            this.el.style.visibility = 'visible';
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
            e.stopPropagation();
        },

        /**
         * Handles Dragging of Sidenav
         * @param {Event} e
         */
        "_handleDragTargetStart": function _handleDragTargetStart(e) {
            if (!this.options.draggable || this.isOpen || this._verticallyScrolling) {
                return;
            }
            // If not being dragged, set initial drag start variables
            if (!this.isDragged) {
                this.percentOpen = 0;
                if (this.options.edge == 'right') {
                    if (e.targetTouches[0].clientX > this._width - 30) {
                        this._startDrag(e);
                    }
                } else if (e.targetTouches[0].clientX < 30)
                    this._startDrag(e);
            }
        },
        "_handleDragTargetDrag": function _handleDragTargetDrag(e) {
            // Check if draggable
            if (!this.isDragged || this.isOpen || this._verticallyScrolling) {
                return;
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
            this.el.style.transform = transformPrefix + "translateX(" + transformX + "px)";
            if (this.percentOpen > 0.2 && this.isOverlay) {
                this._overlay.style.display = 'block';
                this._overlay.style.opacity = this.percentOpen * OVERLAY_OPACITY;
            }
        },

        /**
         * Handle Drag Target Release
         */
        "_handleDragTargetRelease": function _handleDragTargetRelease() {
            if (this.isDragged) {
                if (this.percentOpen > 0.2) {
                    this.open();
                } else {
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
                if (!this.options.draggable || this._verticallyScrolling) {
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
                this._overlay.style.opacity = this.percentOpen * OVERLAY_OPACITY;
            }
        },

        /**
         * Handle Close Release
         */
        "_handleCloseRelease": function _handleCloseRelease() {
            if (this.isOpen && this.isDragged) {
                if (this.percentOpen > 0.8) {
                    this._animateIn();
                } else {
                    this.close();
                }

                this.isDragged = false;
                this._verticallyScrolling = false;
            }
        },

        /**
         * Handle Window Resize
         */
        "_handleWindowResize": function _handleWindowResize() {
            // Only handle horizontal resizes
            if (this.isOpen && this.lastWindowWidth !== window.innerWidth) {
                if (this._updateType()) {
                    this.open();
                }
            }
            this.lastWindowWidth = window.innerWidth;
            this.lastWindowHeight = window.innerHeight;
        },
        "_setupClasses": function _setupClasses() {
            if (this.options.edge === 'right') {
                this.el.classList.add('right-aligned');
            }
        },
        "_removeClasses": function _removeClasses() {
            this.el.classList.remove('right-aligned');
            this.el.classList.remove('sidenav-push');
        },
        "toggle": function toggle(el) {
            if (this.isOpen === true) {
                this.close(el);
            } else this.open(el);
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

            if (!this.isDragged || this.percentOpen != 1) {
                this._animateIn();
            }

        },
        "close": function close() {
            if (this.isOpen === false) {
                return;
            }

            this.isOpen = false;

            if (!this.isDragged || this.percentOpen != 0) {
                this._animateOut();
            } else {
                this._overlay.style.display = 'none';
            }
            // Run onCloseStart callback
            if (typeof this.options.onCloseStart === 'function') {
                this.options.onCloseStart.call(this, this.el);
            }
        },
        "_animateIn": function _animateIn() {
            this._animateSidenavIn();
            if (this.isOverlay)
                this._animateOverlayIn();
        },
        "_animateSidenavIn": function _animateSidenavIn() {
            var _this31 = this;

            var slideOutPercent = this.options.edge === 'left' ? -1 : 1;
            if (this.isDragged) {
                slideOutPercent = this.options.edge === 'left' ? slideOutPercent + this.percentOpen : slideOutPercent - this.percentOpen;
            } else this.el.style.visibility = 'visible';
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
            if (!this.isOverlay) {
                var elements = this.$el.parent().children('.sidenav-pushable').toArray();
                anim.remove(elements);
                var options = {
                    targets: elements,
                    duration: this.options.inDuration,
                    easing: 'easeOutQuad',
                };
                var width = this.$el.width();
                options[this.options.edge === 'left' ? 'marginLeft' : 'marginRight'] = [0, width + "px"];
                anim(options);
            }
        },
        "_animateOverlayIn": function _animateOverlayIn() {
            var start = 0;
            if (this.isDragged && this.percentOpen > 0.2) {
                start = this.percentOpen;
            } else {
                $(this._overlay).css({
                    display: 'block'
                });
            }

            anim.remove(this._overlay);
            anim({
                targets: this._overlay,
                opacity: [start, OVERLAY_OPACITY],
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
                    _this32.el.style.visibility = 'hidden';
                    // Run onOpenEnd callback
                    if (typeof _this32.options.onCloseEnd === 'function') {
                        _this32.options.onCloseEnd.call(_this32, _this32.el);
                    }
                }
            });
            if (!this.isOverlay) {
                var elements = this.$el.parent().children('.sidenav-pushable').toArray();
                anim.remove(elements);
                var options = {
                    targets: elements,
                    duration: this.options.outDuration,
                    easing: 'easeOutQuad',
                };
                var width = this.$el.width();
                options[this.options.edge === 'left' ? 'marginLeft' : 'marginRight'] = [(this.isDragged ? 1 : width) + "px", 0];
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