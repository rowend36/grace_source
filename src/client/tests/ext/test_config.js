define(function (require, exports, module) {
  'use strict';
  var expect = require('chai').expect;

  // var Utils = require('grace/core/utils').Utils;
  var Config = require('grace/core/config').Config;
  var Configs = require('grace/ext/config/configs').Configs;
  require('grace/ext/config/context'); //needed for contexts

  /**
   * TODO:
   * 1. Stop nested namespaces from colliding with keys
   */
  describe('EditConfig', function () {
    var testConfig;
    before(function () {
      testConfig = Config.registerAll(
        {
          name: '',
          arr: [''],
          nums: [],
          status: true,
          deep: {a: 'b', b: {a: ''}},
        },
        'test'
      );
      Config.registerInfo({nums: {type: 'array<number>'}}, 'test');
    });
    afterEach(function () {
      Config.setHandler('test', null);
      var rules = Config.allConfigs._triggers.rules;
      Config.configureObj(
        '_triggers.rules',
        rules.filter(function (e) {
          return e.rule.ctx ? !e.rule.ctx.startsWith('test.') : !e.options.test;
        })
      );
    });
    after(function () {
      for (var i in testConfig) {
        Config.unregister(i, 'test');
      }
      for (i in testConfig.deep) {
        Config.unregister(i, 'test.deep');
      }
      for (i in testConfig.deep.b) {
        Config.unregister(i, 'test.deep.b');
      }
    });
    function check(data, result) {
      return expect(Configs.save(data));
    }
    it('should save configuration', function () {
      Configs.save({
        'test.name': 'wow',
      });
      expect(testConfig.name).to.equal('wow');
    });
    it('should extend strings', function () {
      Configs.save({
        'test.name': 'hello',
        'test.name+': 'hi',
      });
      expect(testConfig.name).to.equal('hello, hi');
    });
    it('should modify arrays', function () {
      Configs.save({
        'test.arr': ['xup', 'afar'],
        'test.arr+': ['hi'],
        'test.arr-': ['afar'],
      });
      expect(testConfig.arr).to.have.members(['xup', 'hi']);
    });
    it('should modify arrays', function () {
      Configs.save({
        test: {
          arr: ['hello'],
        },
        'test.arr+': ['hi'],
        'test.arr': ['xup', 'afar'],
        'test.arr-': ['afar'],
      });
      expect(testConfig.arr).to.have.members(['xup']);
    });
    it('should handle deep sets', function () {
      check({
        'test.deep.b.a': 'test', //deep set
        'test.deep.a.b': 'test2', //wrong type
      }).to.equal(false);
      //Refused bad update
      expect(Config.allConfigs.test.deep.a).to.equal('b');
      //Deep set test.name.b
      expect(Config.allConfigs.test.deep.b).to.deep.equal({a: 'test'});
    });
    it('should use handlers', function () {
      Config.registerInfo({status: {type: 'boolean|[on,off]'}}, 'test');
      Config.setHandler('test', {
        update: function (data, current, path) {
          if (typeof data.status === 'string') {
            data.status = data.status === 'on';
          }
          for (var i in data) {
            Config.configure(path + '.' + i, data[i]);
          }
        },
      });
      check({
        'test.status': false,
        '': {'test.status': 'on'},
        test: {
          status: 'unknown', //ignored wrong type
        },
      }).to.equal(false);
      expect(testConfig.status).to.equal(true);
    });
    it('should parse rules', function () {
      check({
        'test.status': false,
        'test.name': 'Test is disabled',
        '[test.status]': {
          'test.name': 'Test is enabled',
        },
      }).to.equal(true);
      expect(Config.allConfigs._triggers.rules.length).to.be.greaterThan(0);
      expect(testConfig.name).to.equal('Test is disabled');
      Config.configure('status', true, 'test', true);
      expect(testConfig.name).to.equal('Test is enabled');
    });
    it('should handle boolean logic', function () {
      Configs.save({
        test: {
          nums: [],
          '[!null].nums': [0],
          '[test.status && ((test.name))].nums+': [1],
          '[ ( test.status) && !test.name].nums+': [2],
          '[ (test.status || test.name ) ].nums+': [3],
          '[ (!test.status && (test.name=Hi || !test.name) )].nums+': [4],
          '[!(!!test.status && test.name)||test.status&&!test.name].nums+': [5],
        },
      });
      [
        [true, 'true', [0, 1, 3]],
        [true, '', [0, 2, 3, 5]],
        [false, 'Hi', [0, 3, 4, 5]],
        [false, 'true', [0, 3, 5]],
      ].forEach(function (a) {
        Configs.save({
          'test.status': a[0],
          'test.name': a[1],
        });
        expect(testConfig.nums).to.have.members(a[2]);
      });
    });
    it('should handle infinite loops', function () {
      check({
        'test.status': false,
        '[test.status]': {
          'test.status': false,
        },
      }).to.equal(true); //Potential loop

      check({
        'test.status': true,
      }).to.equal(false); //Triggers loop
      expect(testConfig.status).to.equal(false);

      check({
        '_triggers.rules-': Configs.$parseRules({
          '[test.status]': {
            'test.status': false,
          },
        }),
      }).to.equal(true); //Remove cause
      check({
        'test.status': true,
      }).to.equal(true); //Works now
      expect(testConfig.status).to.equal(true);

      //Complex ripple case
      check({
        'test.name': 'initial',
        'test[test.status]': {
          name: '',
          '[!test.name].name': 'Hello', //A typical mistake for setting default values.
          '[test.name=Hello].name': 'Hi', //ripple 1
          '[test.name=Hi].status': false, //ripple 2
        },
      }).to.equal(false);
      //Could also use Context.refresh
      check({
        'test.status': false,
      }).to.equal(true);
      check({
        'test.status': true,
        'test[test.name=Hi]': {
          name: 'Hi', //Save the result value
          status: false,
        },
      }).to.equal(true);
      expect(testConfig.name).to.equal('Hi');
      expect(testConfig.status).to.equal(false);
    });
  });
});