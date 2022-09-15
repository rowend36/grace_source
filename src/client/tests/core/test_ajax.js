define(function (require, exports, module) {
    var expect = require('chai').expect;
    var ajax = require('grace/core/ajax').from(module);
    var override = require('override');
    var revert = require('revert');
    describe('ajax', function () {
        var numOpened;
        before(function () {
            numOpened = 0;
            var c = override(
                XMLHttpRequest.prototype,
                'setRequestHeader',
                function (a, b) {
                    (this.headers || (this.headers = {}))[a] = b;
                    c.apply(this, arguments);
                }
            );
            var d = override(XMLHttpRequest.prototype, 'send', function (a) {
                this.body = a;
                d.apply(this, arguments);
            });
            var e = override(
                XMLHttpRequest.prototype,
                'open',
                function (a, b, c) {
                    this.method = a;
                    this.url = b;
                    this.async = c;
                    this.nthOpened = numOpened++;
                    e.apply(this, arguments);
                }
            );
        });
        after(function () {
            revert(XMLHttpRequest.prototype, 'setRequestHeader');
            revert(XMLHttpRequest.prototype, 'send');
            revert(XMLHttpRequest.prototype, 'open');
        });
        it('should work', function () {
            return ajax('../fixtures/8mb.html');
        });

        it('should catch 404s', function () {
            return ajax('../fixtures/404.html').then(
                function () {
                    throw new Error('Should fail');
                },
                function (e) {
                    expect(e).to.have.property('target');
                    expect(e.target.status).to.be.oneOf([404, 0]);
                }
            );
        });

        it('should have responseTypes', function () {
            return ajax('../fixtures/8mb.html', {
                responseType: 'text',
            }).then(function (req) {
                expect(req.response).to.be.a('string');
            });
        });
        it('should use headers', function () {
            return ajax('../fixtures/8mb.html', {
                headers: {
                    '1Last-Modified': Date.now(),
                },
            }).then(function (req) {
                expect(req.headers).to.be.an.instanceOf(Object);
                expect(req.headers).to.haveOwnProperty('1Last-Modified');
            });
        });
        it('should use headers for formdata', function () {
            return ajax('../fixtures/8mb.html', {
                body: new FormData(),
                headers: {
                    '1Last-Modified': Date.now(),
                },
            }).then(function (req) {
                expect(req.headers).to.be.an.instanceOf(Object);
                expect(req.headers).to.haveOwnProperty('1Last-Modified');
            });
        });
        it('should use encode post params', function () {
            return ajax('../fixtures/8mb.html', {
                data: {
                    a: 'hi',
                    b: {
                        c: 'hello',
                    },
                },
                method: 'POST',
            }).then(function (req) {
                expect(req.body).to.equal('a=hi&b%5Bc%5D=hello');
            });
        });

        it('should use encode post params as plaintext', function () {
            return ajax('../fixtures/8mb.html', {
                data: {
                    a: 'hi',
                    b: {
                        c: 'hello',
                    },
                },
                dataType: 'text/plain',
                method: 'HEAD',
            }).then(function (req) {
                expect(req.body).to.equal('a=hi\r\nb[c]=hello');
            });
        });

        it('should use encode post params as formdata', function () {
            return ajax('../fixtures/8mb.html', {
                data: {
                    a: 'hi',
                    b: {
                        c: 'hello',
                    },
                },
                dataType: 'multipart/form-data',
                method: 'HEAD',
            }).then(function (req) {
                expect(req.body).to.be.instanceOf(ArrayBuffer);
            });
        });

        it('should use encode get params', function () {
            return ajax('../fixtures/8mb.html', {
                data: {
                    a: 'hi',
                    b: {
                        c: 'hello',
                    },
                },
            }).then(function (req) {
                expect(req.body).to.be.undefined;
                var d = new URL(window.origin + '/' + req.url);
                expect(d.search).to.equal('?a=hi&b%5Bc%5D=hello');
            });
        });
        it('should use add timestamp', function () {
            return Promise.all([
                ajax('../fixtures/8mb.html', {
                    addTimestamp: true,
                }),
                ajax('../fixtures/8mb.html', {
                    addTimestamp: true,
                }),
            ]).then(function (all) {
                expect(all[0].url).to.not.equal(all[1].url);
            });
        });
        it('should retry thrice', function () {
            var b = numOpened;
            return ajax('http://testing.please_never_exist', {
                addTimestamp: true,
                method: 'POST',
                retryCount: 2,
            }).catch(function () {
                expect(numOpened).to.equal(b + 3);
            });
        });
    });
});