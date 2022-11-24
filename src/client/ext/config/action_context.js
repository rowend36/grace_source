define(function (require, exports, module) {
    'use strict';
    var Actions = require('grace/core/actions').Actions;
    var Configs = require('./configs').Configs;
    var Context = require('./context').Context;
    //@override
    Actions.checkContext = function (context) {
        var node = {};
        node['[' + context + ']'] = {};
        var ast = Configs.$parseRules(node)[0];
        return ast ? execute(ast.rule) : false;
    };

    function execute(rule) {
        if (!rule) return false;
        if (rule.op === 'not') return !execute(rule.val);
        if (rule.op === 'or') return rule.val.some(execute);
        else if (rule.op == 'and')
            return rule.val.filter(execute).length === rule.val.length;
        else {
            return Context.COMPARE(
                rule.op,
                rule.val,
                Context.getContext(rule.ctx),
                {},
                rule.ctx
            );
        }
    }
});