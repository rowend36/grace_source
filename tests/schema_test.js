_Define(function(global) {
    var Schema = global.Schema;
    var tests = [
        [
            "not anything",
            "!<>",
            ["anything",
                false,
                9,
                false,
                98,
                false,
                {},
                false,
                [],
                false
            ]
        ],
        [
            "plain",
            "!<object|array>",
            ["pop",
                true,
                {},
                false, [], false,
                true, true
            ]
        ],
        [
            'objects',
            {
                name: '?string'
            },
            [{
                    name: 9
                },
                false,
                {
                    noname: 9
                },
                true,
                {
                    name: 'hello'
                },
                true,
                null, false,
                [], true //treated as object
            ]
        ],
        [
            'array<string|number>',
            [
                'string|number'
            ],
            [
                [9, '6kf', {}],
                false,
                [], true,
                [7, '78'], true
            ]
        ],
        [
            'array<string|number>2',
            'array<<string|number>>',
            [
                [9, '6kf', {}],
                false,
                [], true,
                [7, '78'], true
            ]
        ],
        [
            'complexer',
            new Schema.XOneOf([{
                "baby": 'number'
            }, {
                "boy": 'string',
                //This wierd looking egyptian symbol 
                //matches non-existent props,
                //Perhaps, I should document it
                'baby': '?!<>'
            }].map(Schema.parse)),
            [{
                'baby': 1
            }, true, {
                'boy': 'hi'
            }, true, {
                'baby': 1,
                'boy': 'hi'
            }, true, {
                'baby': '3',
                boy: 'hello'
            }, false, {}, false]
        ],
        [
            'bruce almighty',
            '[hello|there,you get me|fulul]',
            [
                'hello', false,
                'hello|there', true,
                'HELLO|THERE', false,
                'you', false
            ]
        ],
        ['custom, a schema for schemas',
            new Schema.XInvalidIf(function(e) {
                try {
                    Schema.parse(e);
                } catch (e) {
                    return e.toString();
                }
                return false;
            }),
            ['<kop>', false,
                '[kop]', true,
                '{jipp}', false,
                'time|url', true
            ]
        ]
    ];
    tests.forEach(function(test) {
        var schema = Schema.parse(test[1]);
        console.log(test[0]);
        for (var i = 0; i < test[2].length; i += 2) {
            var error = schema.invalid(test[2][i]);
            var result = test[2][i + 1];
            if (result && error || (!result && !error)) {
                console.log(error);
                console.error('Failed test #' + i++);
                break;
            } else {
                //console.log('passed');
            }
        }
    });
});
_Define = Grace.Utils.noop;