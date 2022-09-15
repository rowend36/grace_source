define(function (require, exports, module) {
  'use strict';
  var Schema = require('grace/core/schema');
  exports.printSchema = function (schema, indent) {
    schema = Schema.parse(schema);
    var lines = print(schema, indent, [], '');
    return lines
      .map(function (line) {
        return line.join('');
      })
      .join('\n');
  };
  function print(schema, indent, objs, initialIndent) {
    indent = indent || '  ';
    var tags = [];
    var lines = [[]];
    function eof() {
      lines.push((tags = [initialIndent]));
    }
    function addAll(m) {
      m.shift().forEach(add);
      m.forEach(function (line) {
        lines.push(line);
      });
    }
    function add(e) {
      tags.push(e);
    }

    switch (schema && schema.constructor) {
      case Schema.XObject:
        add('{');
        if (schema.schemas && objs.indexOf(schema) < 0) {
          objs.push(schema);
          eof();
          for (var i in schema.schemas) {
            indent();
            add(i);
            if (schema.schemas[i].isOptional) add('?');
            add(': ');
            addAll(print(schema.schemas[i], indent, initialIndent + indent));
            eof();
          }
          objs.pop();
        } else add(schema.name || '...');
        add('}');
        break;
      case Schema.XArray:
        add('[');
        if (objs.indexOf(schema) < 0) {
          objs.push(schema);
          addAll(print(schema.schema, indent, initialIndent));
          objs.pop();
        } else add('...');
        add(']');
        break;
      case Schema.XOneOf:
        for (var j in schema.schemas) {
          if (j !== '0') add(' | ');
          addAll(print(schema.schemas[j], indent, initialIndent));
        }
        break;
      case Schema.XMap:
        add('Map<');
        if (objs.indexOf(schema) < 0) {
          objs.push(schema);
          addAll(print(schema.keys));
          add(', ');
          addAll(print(schema.values));
          objs.pop();
        } else add('...');
        add('>');
        break;
      case Schema.XValidIf:
        if (schema.name.indexOf(' ') > -1) {
          add('"');
          add(schema.name);
          add('"');
        } else add(schema.name);
        break;
      case Schema.XEnum:
        addAll([schema.values]);
        break;
      default:
        add((schema && schema.name) || 'any');
    }
    return lines;
  }
});