define(function (require, exports, module) {
    var Schema = require('grace/core/schema').Schema;
    require('grace/ext/parse_schema');
    var expect = require('chai').expect;
    var tests = [
        [
            'not anything',
            '!<>',
            ['anything', false, 9, false, 98, false, {}, false, [], false],
        ],
        [
            'plain',
            '!<object|array>',
            ['pop', true, {}, false, [], false, true, true],
        ],
        [
            'objects',
            {
                name: '?string',
            },
            [
                {
                    name: 9,
                },
                false,
                {
                    noname: 9,
                },
                true,
                {
                    name: 'hello',
                },
                true,
                null,
                false,
                [],
                true, //treated as object
            ],
        ],
        [
            'array<string|number>',
            ['string|number'],
            [[9, '6kf', {}], false, [], true, [7, '78'], true],
        ],
        [
            'array<string|number>2',
            'array<<string|number>>',
            [[9, '6kf', {}], false, [], true, [7, '78'], true],
        ],
        [
            'one of',
            new Schema.XOneOf(
                [
                    {
                        baby: 'number',
                    },
                    {
                        boy: 'string',
                        //This wierd looking egyptian symbol
                        //matches non-existent props,
                        //Perhaps, I should document it
                        baby: '?!<>',
                    },
                ].map(Schema.parse)
            ),
            [
                {
                    baby: 1,
                },
                true,
                {
                    boy: 'hi',
                },
                true,
                {
                    baby: 1,
                    boy: 'hi',
                },
                true,
                {
                    baby: '3',
                    boy: 'hello',
                },
                false,
                {},
                false,
            ],
        ],
        [
            'wierd use of enum as xoneof',
            '[hello|there,you get me|fulul]',
            [
                'hello',
                false,
                'hello|there',
                true,
                'HELLO|THERE',
                false,
                'you',
                false,
            ],
        ],
        [
            'custom, a schema for schemas',
            new Schema.XValidIf(function (e) {
                try {
                    return Schema.parse(e);
                } catch (e) {}
            }, 'schema'),
            ['<kop>', false, '[kop]', true, '{jipp}', false, 'time|url', true],
        ],
    ];
    var TITLE = 0;
    var SCHEMA = 1;
    var CASES = 2;
    describe('SchemaTest', function () {
        tests.forEach(function (test) {
            var schema = Schema.parse(test[SCHEMA]);
            describe(test[TITLE], function () {
                function tester(error, actual) {
                    return function () {
                        if (actual) expect(error).to.not.be.ok;
                        else expect(error).to.be.ok;
                    };
                }
                for (var i = 0; i < test[CASES].length; i += 2) {
                    var error = schema.validate(test[CASES][i]);
                    it(
                        JSON.stringify(test[CASES][i]) +
                            ' should ' +
                            (test[CASES][i + 1] ? 'pass' : 'fail'),
                        tester(error, test[CASES][i + 1])
                    );
                }
            });
        });
    });
});
