define(function (require, exports, module) {
    /*globals $*/
    var OverlayTokenizer = require('./overlay_tokenizer').OverlayTokenizer;

    function RangeRenderer(session) {
        this.session = session;
        this.config = {
            characterWidth: 7.21,
            lineHeight: 17,
            gutterPadding: 10,
            fontSize: 15,
            padding: 0,
            width: /*align-left with 0*/ 0,
            themeClass: '',
        };
    }
    (function () {
        var Text = require('ace!layer/text').Text;
        var renderer = new Text({
            appendChild: function () {},
        });
        this.Text = renderer;
        this.clipText = '...';
        this.Clip = function (start, tokens, clipText, end, nomodify) {
            if (nomodify) tokens = [].concat(tokens);
            var i = 0;
            var char = 0;
            if (start > clipText.length) {
                for (i in tokens) {
                    char += tokens[i].value.length;
                    if (char > start) {
                        tokens[i] = {
                            type: tokens[i].type,
                            value:
                                clipText +
                                tokens[i].value.substring(
                                    -char + start + tokens[i].value.length
                                ),
                        };
                        break;
                    }
                }
            }
            if (end) {
                var a = i;
                for (i++; char < start + end && i < tokens.length; i++) {
                    char += tokens[i].value.length;
                }
                if (char > start + end) {
                    tokens[i - 1] = {
                        type: tokens[i - 1].type,
                        value: tokens[i - 1].value.substring(
                            0,
                            -char + start + end + tokens[i - 1].value.length
                        ),
                    };
                }
                return tokens.slice(a, i);
            } else return i ? tokens.slice(i) : tokens;
        };
        this.Marker = new OverlayTokenizer(
            {
                token: [
                    {
                        type: 'selection search-selection',
                        value: {
                            length: 100000,
                        },
                    },
                ],
                getTokens: function (/*row*/) {
                    return this.token;
                },
            },
            null
        );
        this.render = function (ranges, session, config, parent, maxLine) {
            config = config || this.config;
            session = session || this.session;
            if (!parent) {
                parent = document.createElement('div');
                parent.style.width = '100%';
                parent.className = config.themeClass;
                parent.style.fontSize = config.fontSize + 'px';
            }
            $(parent).addClass('range_renderer');
            this.Marker.ranges = ranges;
            var select = this.Marker.overlay.bind(this.Marker);
            var clipper = this.Clip;
            var clipText = this.clipText;
            var size = 0;
            var start = 0;
            var range;
            var renderer = this.Text;
            var dummy = Object.create(session);
            dummy.getTokens = function (row) {
                var tokens = session.getTokens(row);
                tokens = select(row, tokens, range);
                return clipper(start, tokens, clipText, cw * 1.5, true);
            };
            renderer.setSession(dummy);

            var cw = config.width / config.characterWidth;
            var max_line = maxLine || ranges[ranges.length - 1].end.row;
            var gutterW = ('' + (max_line + 1)).length;
            cw -= gutterW;
            renderer.config = config;
            for (var rangeId in ranges) {
                range = ranges[rangeId];
                var isSingleLine = range.start.row == range.end.row;
                var line = session.getLine(range.start.row);
                size =
                    (isSingleLine ? range.end.column : line.length) -
                    range.start.column;
                var free_space = cw - size;
                if (isSingleLine) {
                    var m = free_space / 2;
                    var endSpace = Math.min(m, line.length - range.end.column);
                    free_space = free_space - endSpace;
                }
                free_space = Math.ceil(free_space);
                start =
                    range.start.column -
                    Math.max(0, free_space - this.clipText.length);
                var lineEl = document.createElement('div');
                lineEl.className = 'ace_line ace_marker-layer';
                var gutter = (range.start.row + 1 + '              ').substring(
                    0,
                    gutterW
                );
                var gutterEl = document.createElement('span');
                gutterEl.appendChild(document.createTextNode(gutter));
                gutterEl.setAttribute('id', 'line-number');
                gutterEl.style.position = 'static';
                lineEl.appendChild(gutterEl);
                lineEl.style.lineHeight = config.lineHeight + 'px';
                lineEl.style.padding = config.padding + 'px';
                renderer.$renderLine(lineEl, range.start.row, false);

                parent.appendChild(lineEl);
                if (isSingleLine) continue;
                start = 0;
                gutter = '>          '.substring(0, gutterW);
                for (var i = range.start.row + 1; i <= range.end.row; i++) {
                    lineEl = document.createElement('div');
                    lineEl.style.lineHeight = lineEl.style.height =
                        config.lineHeight + 'px';
                    lineEl.style.padding = config.padding + 'px';
                    gutterEl = document.createElement('span');
                    gutterEl.appendChild(document.createTextNode(gutter));
                    gutterEl.setAttribute('id', 'line-number');
                    lineEl.appendChild(gutterEl);
                    gutterEl.style.position = 'static';
                    lineEl.appendChild(gutterEl);

                    lineEl.className = 'ace_line ace_marker-layer';
                    renderer.$renderLine(lineEl, i, false);
                    parent.appendChild(lineEl);
                }
            }
            renderer.setSession(null);
            return parent;
        };
        this.renderPlain = function (ranges, session, config, parent, maxLine) {
            config = config || this.config;
            session = session || this.session;
            if (!parent) {
                parent = document.createElement('div');
                parent.style.width = '100%';
                parent.className = config.themeClass;
                parent.style.fontSize = config.fontSize + 'px';
            }
            parent.className += ' range_renderer';
            var safe = function (text) {
                return text.replace(/[^\u0020-\u00ff]/g, '?');
            };
            var cw = parent.clientWidth;
            var max_line = maxLine || ranges[ranges.length - 1].end.row;
            var gutterW = ('' + (max_line + 1)).length;
            cw -= gutterW;
            parent = $(parent);
            for (var rangeId in ranges) {
                var range = ranges[rangeId];
                var lines = session.getLines(range.start.row, range.end.row);
                parent.append(
                    "<div><span id='line-number'></span><span id='start'></span><span class='red-text' id ='result'></span><span id='end'></span></div>"
                );
                var element = parent.children().last();
                element
                    .children('#line-number')
                    .text('' + (range.start.row + 1));
                var rw;
                var elRes = element.children('#result')[0];
                var result;
                if (lines.length == 1) {
                    result = lines[0].substring(
                        range.start.column,
                        range.end.column
                    );
                    $(elRes).text(safe(result));
                    rw =
                        elRes.getBoundingClientRect().right -
                        elRes.getBoundingClientRect().left;
                } else {
                    result = lines[0].substring(range.start.column);
                    elRes.appendChild(document.createTextNode(safe(result)));
                    $(elRes).append(document.createTextNode('&nbsp;'));
                    rw =
                        elRes.getBoundingClientRect().right -
                        elRes.getBoundingClientRect().left;
                    elRes.appendChild(document.createElement('br'));
                    $(elRes).append(document.createTextNode('&nbsp;&rdsh;'));
                    for (var i = 1; i < lines.length - 1; i++) {
                        elRes.appendChild(
                            document.createTextNode(safe(lines[i]))
                        );
                        $(elRes).append(document.createTextNode('&nbsp;'));
                        elRes.appendChild(document.createElement('br'));
                        $(elRes).append(
                            document.createTextNode('&nbsp;&rdsh;')
                        );
                    }
                    elRes.appendChild(
                        document.createTextNode(
                            lines[i].substring(0, range.end.column)
                        )
                    );
                }

                var start = lines[0].substring(0, range.start.column);
                var free_space = Math.floor((cw - rw) / (rw / result.length));
                var s = 0,
                    m = free_space / 2;
                var end = lines[lines.length - 1].substring(range.end.column);
                s = Math.min(
                    start.length,
                    Math.max(m, free_space - end.length - 1)
                );
                start = start.substring(start.length - s);
                element.children('#start').text(safe(start));
                parent.children().last().children('#end').text(safe(end));
                parent.addClass('ace_editor');
                parent.children().addClass('ace_line');
                parent.children().css('line-height', config.lineHeight + 'px');
                parent.children().css('height', config.lineHeight + 'px');
                parent.children().css('padding', config.padding + 'px');
            }
            return parent[0];
        };
    }.apply(RangeRenderer.prototype));
    exports.RangeRenderer = RangeRenderer;
}); /*_EndDefine*/