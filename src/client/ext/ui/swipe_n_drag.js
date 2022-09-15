define(function(require, exports, module) {
    /*globals $*/
    var SidenavTabs = require("grace/setup/setup_sideview")
        .SideViewTabs;
    var DocsTab = require("grace/setup/setup_tab_host").DocsTab;
    var Hammer = require("./libs/hammer.min");
    var swipeDetector = new Hammer($(
        "#side-menu")[0], {
        inputClass: Hammer
            .TouchMouseInput,
        recognizers: [
            [
                Hammer.Swipe,
                {
                    threshold: 3.0,
                    direction: Hammer
                        .DIRECTION_HORIZONTAL,
                },
            ],
        ],
    });
    var canScrollLeft = true,
        canScrollRight = true;
    swipeDetector.on("hammer.input", function(
        ev) {
        if (ev.isFirst) {
            canScrollLeft = false,
                canScrollRight = false;
            var elt = ev.target;
            if (elt.tagName == "INPUT")
                return swipeDetector
                    .stop();
            elt = elt.parentElement;
            if (
                (elt &&
                    elt.parentElement &&
                    elt.parentElement
                    .id == "selector"
                ) ||
                elt.id == "selector"
            ) {
                return swipeDetector
                    .stop();
            }
            var el = ev.target;
            do {
                var style;
                style = window
                    .getComputedStyle(
                        el);
                var isScrollable = el
                    .scrollWidth > el
                    .clientWidth && (
                        style
                        .overflow ==
                        "scroll" ||
                        style
                        .overflow ==
                        "auto" ||
                        style
                        .overflowX ==
                        "scroll" ||
                        style
                        .overflowX ==
                        "auto");
                if (isScrollable) {
                    //Really small views should never be the objects of a swipe
                    if (el
                        .clientHeight <
                        150) {
                        return swipeDetector
                            .stop();
                    } else {
                        if (
                            el
                            .scrollWidth -
                            el
                            .scrollLeft >
                            el
                            .offsetWidth
                        )
                            canScrollRight =
                            true;
                        if (el
                            .scrollLeft >
                            0)
                            canScrollLeft =
                            true;
                    }
                }
                el = el.parentElement;
            }
            while (el);
        }
        if (canScrollLeft && ev
            .velocityX > 0) {
            return swipeDetector.stop();
        } else if (canScrollRight && ev
            .velocityX < 0) {
            return swipeDetector.stop();
        }
    });

    function go(direction) {
        var active = SidenavTabs.indexOf(SidenavTabs.active) +
            direction;
        if (active > -1 && active < SidenavTabs
            .numTabs()) {
            SidenavTabs.setActive(SidenavTabs.tabs[active], true);
        }
    }
    swipeDetector.on("swipeleft", go.bind(null, 1));
    swipeDetector.on("swiperight", go.bind(null, -1));
    var MobileDragDrop = require("./libs/mobile-drag");
    var scrollBehaviour = require("./libs/scroll-behaviour");
    MobileDragDrop.polyfill({
        holdToDrag: 650,
        noDebug: true,
        tryFindDraggableTarget: function(
            event) {
            var el = event.target;
            do {
                if (
                    el
                    .getAttribute &&
                    el.getAttribute(
                        "draggable"
                    ) === "true"
                ) {
                    return el;
                }
            } while ((el = el
                    .parentNode) &&
                el !== document.body
            );
        },
        dragImageTranslateOverride: scrollBehaviour
            .scrollBehaviourDragImageTranslateOverride,
    });
    var dragTabs = require("./libs/drag-tabs");
    var dragger = new dragTabs.DragTabs($(
        "#menu")[0], {
        selectors: {
            tab: ".tab",
        },
    });
    dragger.on("end", function(e) {
        if (e.newIndex !== undefined) {
            DocsTab.moveTab(
                e.newIndex,
                e.dragTab
                .getAttribute(
                    "data-tab")
            );
        }
    });
    /*dragger.on('drag', function(e) {
          //show drag intent
      });*/
    var listDragger = new dragTabs.DragList($(
        "#opendocs")[0], {
        selectors: {
            tab: ".file-item",
        },
    });
    listDragger.on("drag", function(e) {
        if (e.newIndex !== undefined) {
            DocsTab.moveTab(
                e.newIndex,
                e.dragTab
                .getAttribute(
                    "data-file")
            );
        }
    });
});