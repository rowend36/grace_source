 b = {
    getTokens: function () {
        return [
            {
                type: "black",
                value: {
                    length: 3,
                },
            },
            {
                type: "yellow",
                value: {
                    length: 3,
                },
            },
            {
                type: "red",
                value: {
                    length: 3,
                },
            },
            {
                type: "black",
                value: {
                    length: 3,
                },
            },
            {
                type: "yellow",
                value: {
                    length: 3,
                },
            },
            {
                type: "red",
                value: {
                    length: 3,
                },
            },
        ];
    },
};
var c = [
    {
        type: "blue",
        value: "h",
    },
    {
        type: "yellow",
        value: "abcdefghijklmnopqrstuvwxyz",
    },
    {
        type: "white",
        value: " there",
    },
];
var log = function (a) {
    document.write("</br>--" + JSON.stringify(a));
};
window.onerror = function (error, file, line, ch) {
    log(error + " at " + line + "," + ch);
    var stack = new Error().stack.split("\n");
    log(stack.splice(2, Infinity).join("\n"));
};
var abs = new OverlayTokenizer(b, [
    {start: {row: 5, column: 3}, end: {row: 5, column: 13}},
]);
log(abs.multiplex(5, c));
