define(function(require,exports,module) {
    var expect = require('chai').expect;
    describe("FileUtils", function() {
        describe("normalize", function() {
            it("should resolve relative paths", function() {
                expect(require("grace/core/file_utils").FileUtils.normalize("/sdcard/../io")).to.equal("/io");
            });
            it("should keep trailing slashes", function() {
                expect(require("grace/core/file_utils").FileUtils.normalize("/sdcard///hi/../")).to.equal(
                    "/sdcard/");
            });
        });
    });
});
