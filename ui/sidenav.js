(function(global, anim) {
    'use strict';
    var _defaults = {
        edge: 'left',
        draggable: true,
        inDuration: 200,
        outDuration: 100,
        dragTargetWidth: 30,
        onOpenStart: null, //always called once before opening
        onOpenEnd: null,
        onCloseStart: null, //always called once before closing
        onCloseEnd: null,
        minWidthPush: 800,
        preventScrolling: true
    };
    //onOpenStart [-> onOpenEnd] -> onCloseStart [-> OnCloseEnd] -> onOpenStart
    var OVERLAY_OPACITY = 0.4;
    /**
     * Construct Sidenav instance and set up overlay
     * @constructor
     * @param {Element} el
     * @param {Object} options
     */
    var PHASED_OUT = 0, //!isOpen && !isDragged
        DRAGGING_IN = 1, //!isOpen && isDraged
        PHASING_IN = 2, //isOpen && !isDragged
        PHASED_IN = 3, //isOpen && !isDragged
        DRAGGING_OUT = 4, //!isOpen && isDragged
        PHASING_OUT = 5; //!isOpen && !isDragged
    // var states = [
    //     'PHASED_OUT',
    //     'DRAGGING_IN',
    //     'PHASING_IN',
    //     'PHASED_IN',
    //     'DRAGGING_OUT',
    //     'PHASING_OUT',
    // ];
    //TODO add mouse events , possibly use drag events
    var ensureState = function(state, recover) {
        if (this.$state === state) {
            recover && this[recover]();
        }
        throw 'Error invalid State ' + states[state];
    };

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
        this.$state = PHASED_OUT;
        // Window size variables for window resize checks
        this.lastWindowWidth = window.innerWidth;
        this.lastWindowHeight = window.innerHeight;
        this._dragTarget = $(".content")[0];
        this._createOverlay();
        this._setupEventHandlers();
        this._setupClasses();
        this._updateType();
        Sidenav._sidenavs.push(this);
    }
    Sidenav.prototype = {
        "isNot": ensureState,
        // "destroy": function destroy() {
        //     //TODO
        //     this.close();
        //     anim.remove(this.el);
        //     this._removeEventHandlers();
        //     this._overlay.parentNode.removeChild(this._overlay);
        //     this.el.Sidenav = undefined;
        //     this.el.style.transform = '';
        //     var index = Sidenav._sidenavs.indexOf(this);
        //     if (index >= 0) {
        //         Sidenav._sidenavs.splice(index, 1);
        //     }
        // },
        "_onWindowResize": function _onWindowResize() {
            // Only handle horizontal resizes
            var wasOpen = this.$state !== PHASED_OUT && this.$state !== PHASING_OUT;
            if (this._updateType() && wasOpen) {
                this.open();
            }
            this.lastWindowWidth = window.innerWidth;
            this.lastWindowHeight = window.innerHeight;
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
            this.$onStartDragOpen = this._onStartDragOpen.bind(this);
            this.$onDragOpen = this._onDragOpen.bind(this);
            this.$onReleaseDragOpen = this._onReleaseDragOpen.bind(this);
            this.$onStartDragClose = this._onStartDragClose.bind(this);
            this.$onDragClose = this._onDragClose.bind(this);
            this.$onReleaseDragClose = this._onReleaseDragClose.bind(this);
            this.$close = this.close.bind(this);
            this._dragTarget.addEventListener('touchstart', this.$onStartDragOpen);
            this._dragTarget.addEventListener('touchmove', this.$onDragOpen, true);
            this._dragTarget.addEventListener('touchend', this.$onReleaseDragOpen);
            this._dragTarget.addEventListener("touchstart", this.$onStartDragClose);
            this._dragTarget.addEventListener("touchmove", this.$onDragClose);
            this._dragTarget.addEventListener("touchend", this.$onReleaseDragClose);
            this._overlay.addEventListener('touchstart', this.$onStartDragClose);
            this._overlay.addEventListener('touchmove', this.$onDragClose);
            this._overlay.addEventListener('touchend', this.$onReleaseDragClose);
            this._overlay.addEventListener('click', this.$close);
            // Add resize for push elements
            if (this.options.pushElements) {
                this.$onWindowResize = this._onWindowResize.bind(this);
                window.addEventListener('resize', this.$onWindowResize);
            }
        },
        "_removeEventHandlers": function _removeEventHandlers() {
            //16 bloody events
            this._dragTarget.removeEventListener('touchstart', this.$onStartDragOpen);
            this._dragTarget.removeEventListener('touchmove', this.$onDragOpen, true);
            this._dragTarget.removeEventListener('touchend', this.$onReleaseDragOpen);
            this._dragTarget.removeEventListener("touchstart", this.$onStartDragClose);
            this._dragTarget.removeEventListener("touchmove", this.$onDragClose);
            this._dragTarget.removeEventListener("touchend", this.$onReleaseDragClose);
            this._overlay.removeEventListener('touchstart', this.$onStartDragClose);
            this._overlay.removeEventListener('touchmove', this.$onDragClose);
            this._overlay.removeEventListener('touchend', this.$onReleaseDragClose);
            this._overlay.removeEventListener('click', this.$close);
            // Remove resize for side nav push
            if (this.$onWindowResize) window.removeEventListener('resize', this.$onWindowResize);
        },
        /**
         * Set variables needed at the beggining of drag
         * and stop any current transition.
         * @param {Event} e
         */
        "_startDrag": function _startDrag(e) {
            var clientX = e.targetTouches[0].clientX;
            this._startingXpos = clientX;
            this._xPos = this._startingXpos;
            this._time = Date.now();
            this._width = this.el.clientWidth;
            this._initialScrollTop = this.isOpen ? this.el.scrollTop : M.getDocumentScrollTop();
            this._verticallyScrolling = false;
            anim.remove(this.el);
            this.el.style.visibility = 'visible';
            anim.remove(this._overlay);
            e.stopPropagation();
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
        "_onStartDragOpen": function _onStartDragOpen(e) {
            if (!this.options.draggable || this.$state !== PHASED_OUT || this._verticallyScrolling) {
                return;
            }
            // If not being dragged, set initial drag start variables
            this.percentOpen = 0;
            if (this.options.edge == 'right') {
                if (e.targetTouches[0].clientX > window.innerWidth - this.options.dragTargetWidth) {
                    this._startDrag(e);
                    this.$state = DRAGGING_IN;
                }
            } else if (e.targetTouches[0].clientX < this.options.dragTargetWidth) {
                this._startDrag(e);
                this.$state = DRAGGING_IN;
            }
        },
        "_onDragOpen": function _onDragOpen(e) {
            // Check if draggable
            if (this.$state !== DRAGGING_IN || this._verticallyScrolling) {
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
            if (!this.isOverlay) {
                if (this.options.edge === 'right') {
                    transformX = -transformX;
                }
                this.options.pushElements.css(this.options.edge == 'right' ? "margin-right" : "margin-left", transformX + "px");
            } else if (this.percentOpen > 0.2) {
                this._overlay.style.display = 'block';
                this._overlay.style.opacity = this.percentOpen * OVERLAY_OPACITY;
            }
        },
        /**
         * Handle Drag Target Release
         */
        "_onReleaseDragOpen": function _onReleaseDragOpen(e) {
            if (this.$state == DRAGGING_IN) {
                if (this.percentOpen > 0.2) {
                    this.open();
                } else {
                    this.$state = PHASING_OUT;
                    this._animateOut(true);
                }
                this._verticallyScrolling = false;
            }
        },
        "_onStartDragClose": function _onStartDragClose(e) {
            if (!this.options.draggable || this.$state !== PHASED_IN || this._verticallyScrolling) {
                return;
            }
            e.stopPropagation();
            // If not being dragged, set initial drag start variables
            this.percentOpen = 1;
            var distanceFromEdge;
            if (e.target == this._overlay) {
                this._startDrag(e);
                this.$state = DRAGGING_OUT;
                return;
            }
            if (this.options.edge == 'right') {
                distanceFromEdge = (window.innerWidth - e.targetTouches[0].clientX) - this._width;
            } else {
                distanceFromEdge = e.targetTouches[0].clientX - this._width;
            }
            if (distanceFromEdge > -this.options.dragTargetWidth && distanceFromEdge < this.options.dragTargetWidth) {
                this._startDrag(e);
                this.$state = DRAGGING_OUT;
            }
        },
        /**
         * Handle Close Drag
         * @param {Event} e
         */
        "_onDragClose": function _onDragClose(e) {
            // Check if draggable
            if (this.$state != DRAGGING_OUT || this._verticallyScrolling) {
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
            if (!this.isOverlay) {
                if (this.options.edge == 'right') {
                    transformX = -transformX;
                }
                this.options.pushElements.css(this.options.edge == 'right' ? "margin-right" : "margin-left", this._width + transformX + "px");
            } else this._overlay.style.opacity = this.percentOpen * OVERLAY_OPACITY;
        },
        /**
         * Handle Close Release
         */
        "_onReleaseDragClose": function _onReleaseDragClose() {
            if (this.$state == DRAGGING_OUT) {
                if (this.percentOpen < 0.8) {
                    this.close();
                } else {
                    this.$state = PHASING_IN;
                    this._animateIn(true);
                }
                this._verticallyScrolling = false;
            }
        },
        /**
         * Handle Window Resize
         */
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
                this.close();
            } else this.open();
        },
        "open": function open() {
            //ADD most common case first
            if (this.$state == PHASED_OUT || this.$state === DRAGGING_OUT) {
                //valid states
            } else if (this.$state === PHASING_OUT) {
                anim.remove(this.el);
                if (!this.isOverlay) {
                    anim.remove(this.options.pushElements.toArray());
                } else {
                    anim.remove(this._overlay);
                    //It should not have phased out but just in case
                    this._overlay.style.display = 'block';
                }
                this.$state = PHASED_OUT;
            } else if (this.$state === PHASED_IN || this.$state === PHASING_IN) {
                return;
            }
            if (this.$state === PHASED_OUT) {
                this.percentOpen = 0;
            }
            this.isOpen = true;
            this.$state = PHASING_IN;
            // Run onOpenStart callback
            if (typeof this.options.onOpenStart === 'function') {
                this.options.onOpenStart.call(this, this.el);
            }
            if (this.percentOpen != 1) {
                this._animateIn();
            } else {
                this.$state = PHASED_IN;
                if (typeof this.options.onOpenEnd === 'function') {
                    this.options.onOpenEnd.call(this, this.el);
                }
            }
        },
        "close": function close(ev) {
            if (this.$state == PHASED_IN || this.$state === DRAGGING_IN) {} else if (this.$state === PHASING_IN) {
                anim.remove(this.el);
                if (!this.isOverlay) {
                    anim.remove(this.options.pushElements.toArray());
                }
                this.$state = PHASED_IN;
            } else if (this.$state === PHASED_OUT || this.$state === PHASING_OUT) {
                if(!ev){
                    return;
                }//Invalid state recovery
                else{
                    this.percentOpen = 0;
                    anim.remove(this.el);
                    anim.remove(this._overlay);
                    console.error('Sidenav invalid state');
                }
            }
            if (this.$state === PHASED_IN) {
                this.percentOpen = 1;
            }
            this.isOpen = false;
            this.$state = PHASING_OUT;
            // Run onCloseStart callback
            if (typeof this.options.onCloseStart === 'function') {
                this.options.onCloseStart.call(this, this.el);
            }
            if (this.percentOpen != 0) {
                this._animateOut();
            } else {
                this._overlay.style.display = 'none';
                this.el.style.visibility = 'hidden';
                this.$state = PHASED_OUT;
                if (typeof this.options.onCloseEnd === 'function') {
                    this.options.onCloseEnd.call(this, this.el);
                }
            }
        },
        "_animateIn": function _animateIn(wasOpen) {
            this._animateSidenavIn(wasOpen);
            if (this.isOverlay) this._animateOverlayIn();
        },
        "_animateSidenavIn": function _animateSidenavIn(wasOpen) {
            var _this31 = this;
            var slideOutPercent = this.options.edge === 'left' ? -1 : 1;
            slideOutPercent = this.options.edge === 'left' ? slideOutPercent + this.percentOpen : slideOutPercent - this.percentOpen;
            if (this.percentOpen === 0) this.el.style.visibility = 'visible';
            //TODO remove the next line and see what happens
            anim.remove(this.el);
            anim({
                targets: this.el,
                translateX: [slideOutPercent * 100 + "%", 0],
                duration: this.options.inDuration,
                easing: 'easeOutQuad',
                complete: function() {
                    _this31.$state = PHASED_IN;
                    // Run onOpenEnd callback
                    if (!wasOpen && typeof _this31.options.onOpenEnd === 'function') {
                        _this31.options.onOpenEnd.call(_this31, _this31.el);
                    }
                }
            });
            if (!this.isOverlay) {
                var elements = this.options.pushElements.toArray();
                anim.remove(elements);
                var options = {
                    targets: elements,
                    duration: this.options.inDuration,
                    easing: 'easeOutQuad',
                };
                var width = this.el.clientWidth;
                options[this.options.edge === 'left' ? 'marginLeft' : 'marginRight'] = [
                    this.percentOpen * width + "px", width + "px"
                ];
                anim(options);
            }
        },
        "_animateOverlayIn": function _animateOverlayIn() {
            var start = 0;
            if (this.percentOpen > 0.2) {
                start = this.percentOpen;
            } else {
                $(this._overlay).css({
                    display: 'block'
                });
            }
            anim.remove(this._overlay);
            anim({
                targets: this._overlay,
                opacity: [start * OVERLAY_OPACITY, OVERLAY_OPACITY],
                duration: this.options.inDuration,
                easing: 'easeOutQuad'
            });
        },
        "_animateOut": function _animateOut(wasClosed) {
            this._animateSidenavOut(wasClosed);
            if (this.isOverlay) this._animateOverlayOut();
        },
        "_animateSidenavOut": function _animateSidenavOut(wasClosed) {
            var _this32 = this;
            var endPercent = this.options.edge === 'left' ? -1 : 1;
            var slideOutPercent = this.options.edge === 'left' ? endPercent + this.percentOpen : endPercent - this.percentOpen;
            anim.remove(this.el);
            anim({
                targets: this.el,
                translateX: [slideOutPercent * 100 + "%", endPercent * 105 + "%"],
                duration: this.options.outDuration,
                easing: 'easeOutQuad',
                complete: function() {
                    _this32.$state = PHASED_OUT;
                    _this32.el.style.visibility = 'hidden';
                    // Run onCloseEnd callback
                    if (!wasClosed && typeof _this32.options.onCloseEnd === 'function') {
                        _this32.options.onCloseEnd.call(_this32, _this32.el);
                    }
                }
            });
            if (!this.isOverlay) {
                var elements = this.options.pushElements.toArray();
                anim.remove(elements);
                var options = {
                    targets: elements,
                    duration: this.options.outDuration,
                    easing: 'easeOutQuad',
                };
                var width = this.$el.width();
                options[this.options.edge === 'left' ? 'marginLeft' : 'marginRight'] = [
                    (this.percentOpen * width) + "px", 0
                ];
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
    };
    // (function() {
    //     for (var i in this) {
    //         if(!/_startDrag|dragMoveUpdate/.test(i))
    //         this[i] = (function(func) {
    //             return function() {
    //                 console.log(func.name+"-->"+states[this.$state]);
    //                 func.apply(this, arguments);
    //                 console.log(func.name+"<--"+states[this.$state]);
    //             };
    //         })(this[i]);
    //     }
    // }).call(Sidenav.prototype);
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