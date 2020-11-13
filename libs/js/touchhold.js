
(function() {
    $.fn.longTap = function(options) {
        var timeout, ev;
        options = $.extend({
            delay: 750,
            onRelease: null
        }, options);

        var eventType = {
            mousedown: 'ontouchstart' in window ? 'touchstart' : 'mousedown',
            mouseup: 'ontouchend' in window ? 'touchend' : 'mouseup',
            mousemove: 'ontouchmove' in window ? 'touchmove' : 'mousemove'
        };

        function release() {
            options.onRelease && options.onRelease.call(this, ev);
        }
        return this.each(function() {
            $(this).on("scroll.longtap",function(a) {
                if (timeout){
                    clearTimeout(timeout);
                    $(this).data('timeout.longtap', (timeout = null));
                }

            });
            $(this).on(eventType.mousedown + '.longtap', function(e) {
                    //$(this).data('touchstart', +new Date);
                    ev = e;
                    e.stopPropagation();
                    $(this).data('timeout.longtap',(timeout = setTimeout(release, options.delay)));

                })
                .on(eventType.mousemove + '.longtap', function() {
                    //$(this).data('touchstart', +new Date);
                    if (timeout)
                        clearTimeout(timeout)

                })
                .on(eventType.mouseup + '.longtap', function(e) {
                    if (timeout)
                        clearTimeout(timeout);

                    //var now = +new Date,
                    //then = $(this).data('touchstart');
                    //(now - then) >= options.delay && (now-then)<2000 &&  release();

                });
        });
    };
})(jQuery);