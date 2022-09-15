define(function(require,exports,module) {
    var expect = require('chai').expect;
    describe("Doc updateDoc", function() {
        var chars = "Abcdefghijklmnopqrstuvwxyz\n\r";

        function genRandomText(p) {
            var arr = new Array(5000+5000*p);
            for (var i = 0; i < 5000+5000*p; i++) {
                arr[i] = chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return arr.join("");
        }
        var Doc = require("grace/docs/document").Doc;
        var texts = [];
        function test() {
            var text = texts.pop();
            var doc = new Doc(text);
            var doc2 = new Doc(texts[texts.length-1]);
            doc.updateValue(doc2.getValue());
            expect(doc.getValue()).to.equal(doc2.getValue());
            doc.destroy();
            doc2.destroy();
        }
        for (var i = 0; i < 5; i++) {
            texts.push(genRandomText(i*2));
            it("should update value correctly length="+texts[i].length, test);
        }
        it("should copy line endings", function() {
            var text = "linux doc\nlinux doc";
            var text2 = "linux doc\r\nlinux doc";
            var doc = new Doc(text);
            doc.updateValue(text2);
            expect(doc.getNewLineCharacter()).to.equal("\r\n");
            doc.destroy();
        });
    });
});