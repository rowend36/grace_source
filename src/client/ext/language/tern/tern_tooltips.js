define(function (require, exports, module) {
  'use strict';
  var htmlEncode = require('grace/core/utils').Utils.htmlEncode;
  var debug = console;
  var cls = 'Ace-Tern-';
  var MAX_TYPE_LENGTH = 10;
  function parseFnType(text) {
    if (text.substring(0, 2) !== 'fn') return null; //not a function
    if (text.indexOf('(') === -1) return null;

    var args = [],
      pos = 3;

    function skipMatching(upto) {
      var depth = 0,
        start = pos;
      for (;;) {
        var next = text.charAt(pos);
        if (upto.test(next) && !depth) return text.slice(start, pos);
        if (/[{\[\(]/.test(next)) ++depth;
        else if (/[}\]\)]/.test(next)) --depth;
        ++pos;
      }
    }
    if (text.charAt(pos) != ')')
      for (;;) {
        var name = text.slice(pos).match(/^([^, \(\[\{]+): /);
        if (name) {
          pos += name[0].length;
          name = name[1];
        }
        args.push({
          name: name,
          type: skipMatching(/[\),]/),
        });
        if (text.charAt(pos) == ')') break;
        pos += 2;
      }

    var rettype = text.slice(pos).match(/^\) -> (.*)$/);
    return {
      args: args,
      rettype: rettype && rettype[1],
    };
  }

  function parseJsDocParams(ts, str) {
    if (!str) return [];
    str = str.replace(/@param/gi, '@param'); //make sure all param tags are lowercase
    var params = [];
    while (str.indexOf('@param') !== -1) {
      str = str.substring(str.indexOf('@param') + 6); //starting after first param match
      var nextTagStart = str.indexOf('@'); //split on next param (will break if @symbol inside of param, like a link... dont have to time fullproof right now)

      var paramStr = nextTagStart === -1 ? str : str.substring(0, nextTagStart);
      var thisParam = {
        name: '',
        parentName: '',
        type: '',
        description: '',
        optional: false,
        defaultValue: '',
      };
      var re = /\s{[^}]{1,50}}\s/;
      var m;
      while ((m = re.exec(paramStr)) !== null) {
        if (m.index === re.lastIndex) {
          re.lastIndex++;
        }
        thisParam.type = m[0];
        paramStr = paramStr.replace(thisParam.type, '').trim(); //remove type from param string
        thisParam.type = thisParam.type
          .replace('{', '')
          .replace('}', '')
          .replace(' ', '')
          .trim(); //remove brackets and spaces
      }
      paramStr = paramStr.trim(); //we now have a single param string starting after the type, next string should be the parameter name
      if (paramStr.substring(0, 1) === '[') {
        thisParam.optional = true;
        var endBracketIdx = paramStr.indexOf(']');
        if (endBracketIdx === -1) {
          debug.error(
            "failed to parse parameter name; Found starting '[' but missing closing ']'"
          );
          continue; //go to next
        }
        var nameStr = paramStr.substring(0, endBracketIdx + 1);
        paramStr = paramStr.replace(nameStr, '').trim(); //remove name portion from param str
        nameStr = nameStr.replace('[', '').replace(']', ''); //remove brackets
        if (nameStr.indexOf('=') !== -1) {
          var defaultValue = nameStr.substring(nameStr.indexOf('=') + 1);
          if (defaultValue.trim() === '') {
            thisParam.defaultValue = 'undefined';
          } else {
            thisParam.defaultValue = defaultValue.trim();
          }
          thisParam.name = nameStr.substring(0, nameStr.indexOf('=')).trim(); //set name
        } else {
          thisParam.name = nameStr.trim();
        }
      } else {
        //not optional
        var nextSpace = paramStr.indexOf(' ');
        if (nextSpace !== -1) {
          thisParam.name = paramStr.substring(0, nextSpace);
          paramStr = paramStr.substring(nextSpace).trim(); //remove name portion from param str
        } else {
          //no more spaces left, next portion of string must be name and there is no description
          thisParam.name = paramStr;
          paramStr = '';
        }
      }
      var nameDotIdx = thisParam.name.indexOf('.');
      if (nameDotIdx !== -1) {
        thisParam.parentName = thisParam.name.substring(0, nameDotIdx);
        thisParam.name = thisParam.name.substring(nameDotIdx + 1);
      }
      paramStr = paramStr.trim();
      if (paramStr.length > 0) {
        thisParam.description = paramStr.replace('-', '').trim(); //optional hiphen specified before start of description
      }
      thisParam.name = htmlEncode(thisParam.name);
      thisParam.parentName = htmlEncode(thisParam.parentName);
      thisParam.description = htmlEncode(thisParam.description);
      thisParam.type = htmlEncode(thisParam.type);
      thisParam.defaultValue = htmlEncode(thisParam.defaultValue);
      params.push(thisParam);
    }
    return params;
  }
  function createToken(value, type) {
    return wrapToken(htmlEncode(value), type);
  }
  function wrapToken(value, type) {
    return (
      '<span class="' +
      htmlEncode(type ? cls + type.replace('"', '\\"') : '') +
      '">' +
      value +
      '</span>'
    );
  }
  function printFunction(fnName, fnArgs, activeArg, params) {
    var truncateType = function (type) {
      if (type.length > MAX_TYPE_LENGTH) {
        type =
          type[0] === '{'
            ? '{...}'
            : (type[0] === '['
                ? '[...]'
                : type.slice(0, 2) === 'fn'
                ? 'fn(...)'
                : type);
      }
      return type;
    };
    var getParam = function (arg, getChildren) {
      if (params === null) return null;
      if (!arg.name) return null;
      var children = [];
      for (var i = 0; i < params.length; i++) {
        if (getChildren === true) {
          if (
            params[i].parentName.toLowerCase().trim() ===
            arg.name.toLowerCase().trim()
          ) {
            children.push(params[i]);
          }
        } else {
          if (
            params[i].name.toLowerCase().trim() ===
            arg.name.toLowerCase().trim()
          ) {
            return params[i];
          }
        }
      }
      if (getChildren === true) return children;
      return null;
    };
    var getParamDetailedName = function (param) {
      var name = param.name;
      if (param.optional === true) {
        if (param.defaultValue) {
          name = '[' + name + '=' + param.defaultValue + ']';
        } else {
          name = '[' + name + ']';
        }
      }
      return name;
    };
    var useDetailedArgHints =
      params.length === 0 || !isNaN(parseInt(activeArg));
    var typeStr = '';
    typeStr += htmlEncode(fnName || 'fn');
    typeStr += '(';
    var activeParam = null,
      activeParamChildren = []; //one ore more child params for multiple object properties

    for (var i = 0; i < fnArgs.args.length; i++) {
      var paramStr = '';
      var isCurrent = i === activeArg;
      // {name,type}
      var arg = fnArgs.args[i];
      var name = arg.name || '?';
      if (name.length > 1 && name.substring(name.length - 1) === '?') {
        name = name.substring(0, name.length - 1);
        arg.name = name; //update the arg var with proper name for use below
      }

      if (!useDetailedArgHints) {
        paramStr += createToken(name);
      } else {
        var param = getParam(arg, false);
        var children = getParam(arg, true);
        var type = arg.type;
        var optional = false;
        var defaultValue = '';
        if (param !== null) {
          name = param.name;
          if (param.type) {
            type = param.type;
          }
          if (isCurrent) {
            activeParam = param;
          }
          optional = param.optional;
          defaultValue = param.defaultValue.trim();
        }
        if (children && children.length > 0) {
          //Almost always breaks MAX_TYPE_LENGTH check
          if (isCurrent) {
            activeParamChildren = children;
          }
          type = '{';
          for (var c = 0; c < children.length; c++) {
            type += children[c].name;
            if (c + 1 !== children.length && children.length > 1) type += ', ';
          }
          type += '}';
        }
        paramStr += createToken(
          name || '?',
          isCurrent ? 'farg-current' : 'farg'
        );
        paramStr += ': ';
        if (type.length) paramStr += createToken(truncateType(type), 'type');
        if (defaultValue !== '') {
          paramStr += createToken(defaultValue, 'jsdoc-param-defaultValue');
        }
        if (optional) {
          paramStr = wrapToken(
            createToken('[', 'jsdoc-param-optionalBracket') +
              paramStr +
              createToken('[', 'jsdoc-param-optionalBracket'),
            'jsdoc-param-optionalWrapper'
          );
        }
      }
      if (i > 0) paramStr = ', ' + paramStr;
      typeStr += paramStr;
    }

    typeStr += ')';
    if (fnArgs.rettype) {
      typeStr +=
        ' -> ' +
        createToken(
          truncateType(fnArgs.rettype),
          useDetailedArgHints ? 'type' : null
        );
    }
    typeStr = wrapToken(
      typeStr,
      useDetailedArgHints ? 'typeHeader' : 'typeHeader-simple'
    ); //outer wrapper
    if (useDetailedArgHints) {
      if (activeParam && activeParam.description) {
        typeStr +=
          '<div class="' +
          cls +
          'farg-current-description">' +
          createToken(activeParam.name + ': ', 'farg-current-name') +
          activeParam.description +
          '</div>';
      }
      if (activeParamChildren && activeParamChildren.length > 0) {
        for (var j = 0; j < activeParamChildren.length; j++) {
          var childType = activeParamChildren[j].type
            ? createToken(activeParamChildren[j].type, 'type')
            : '';
          typeStr +=
            '<div class="' +
            cls +
            'farg-current-description">' +
            truncateType(childType) +
            createToken(
              getParamDetailedName(activeParamChildren[j]) + ': ',
              'farg-current-name'
            ) +
            activeParamChildren[j].description +
            '</div>';
        }
      }
    }
    return typeStr;
  }
  function printDocumentation(doc, params) {
    var replaceParams = function (str, params) {
      if (params.length === 0) {
        return str;
      }
      str = str.replace(/@param/gi, '@param'); //make sure all param tags are lowercase
      var beforeParams = str.substring(0, str.indexOf('@param'));
      while (str.indexOf('@param') !== -1) {
        str = str.substring(str.indexOf('@param') + 6); //starting after first param match
      }
      var afterParams;
      if (str.indexOf('@') !== -1) {
        afterParams = str.substring(str.indexOf('@')); //start at next tag that is not a param
      } else {
        afterParams = ''; //@param was likely the last tag, trim remaining as its likely the end of a param description
      }
      var paramStr = '';
      for (var i = 0; i < params.length; i++) {
        paramStr += '<div>';
        if (params[i].parentName.trim() === '') {
          paramStr += ' ' + createToken('@param', 'jsdoc-tag');
        } else {
          //dont show param tag for child param
          paramStr += wrapToken('&nbsp;', 'jsdoc-tag-param-child');
        }
        paramStr +=
          params[i].type.trim() === ''
            ? ''
            : createToken(' {' + params[i].type + '}', 'type');

        if (params[i].name.trim() !== '') {
          var name = params[i].name.trim();
          if (params[i].parentName.trim() !== '') {
            name = params[i].parentName.trim() + '.' + name;
          }
          var pName = createToken(name, 'jsdoc-param-name');
          if (params[i].defaultValue.trim() !== '') {
            pName += createToken(
              '= ' + params[i].defaultValue,
              'jsdoc-param-defaultValue'
            );
          }
          if (params[i].optional) {
            pName = wrapToken(
              createToken('[', 'jsdoc-param-optionalBracket') +
                pName +
                createToken('[', 'jsdoc-param-optionalBracket'),
              'jsdoc-param-optionalWrapper'
            );
          }
          paramStr += pName;
        }
        if (params[i].description.trim() !== '')
          paramStr += createToken(
            params[i].description,
            'jsdoc-param-description'
          );
        paramStr += '</div>';
      }
      if (paramStr !== '') {
        str = wrapToken(paramStr, 'jsdoc-param-wrapper') + str;
      }

      return beforeParams + str;
    };
    var highlighTags = function (str) {
      //add white space for regex
      str = (' ' + str + ' ').replace(/ ?@\w{1,50}\s ?/gi, function (match) {
        return createToken(' ' + match.trim(), 'jsdoc-tag');
      });
      return str.trim();
    };
    var highlightTypes = function (str) {
      str = ' ' + str + ' '; //add white space for regex
      str = (' ' + str + ' ').replace(/\s{[^}]{1,50}}\s/g, function (match) {
        return createToken(' ' + match.trim(), 'type');
      });
      return str.trim();
    };
    var createLinks = function (str) {
      var re = /\b(https?:\/\/)([^\s<>"`{}|\^\[\]\\]+)/gi;
      str = str.replace(re, function (match, protocol, address) {
        return (
          '<a class="' +
          cls +
          'tooltip-link" href="' +
          match +
          '" target="_blank">' +
          htmlEncode(address) +
          ' </a>'
        );
      });
      return str;
    };

    doc = htmlEncode(doc.trim());
    if (doc.substring(0, 1) === '*') {
      doc = doc.substring(1); //tern leaves this for jsDoc as they start with /**, not exactly sure why...
      doc = replaceParams(doc, params);
      doc = highlighTags(doc);
      doc = highlightTypes(doc);
    }
    doc = createLinks(doc);
    return doc;

    /*if (data.url) {
          tip.appendChild(document.createTextNode(" "));
          var link = elt("a", null, "[docs]");
          link.target = "_blank";
          link.href = data.url;
          tip.appendChild(link);
      }
      if (data.origin) {
          tip.appendChild(elt("div", null, elt("em", null, "source: " + data.origin)));
      }*/
  }
  function customDataTip(data, activeArg) {
    var html = [];
    var d = data.doc;
    var params = data.params || parseJsDocParams(d); //parse params
    var fnArgs = data.fnArgs
      ? data.fnArgs
      : data.type
      ? parseFnType(data.type)
      : null; //will be null if parseFnType detects that this is not a function
    if (fnArgs) {
      html.push(
        printFunction(data.exprName || data.name, fnArgs, activeArg, params)
      );
    } else {
      if (!data.type && !data.doc) return '';
      if (data.type) html.push(createToken(data.type), '<br/>');
    }
    if (isNaN(parseInt(activeArg))) {
      if (data.doc) html.push(printDocumentation(data.doc, params));
    }
    return html.join('');
  }
  exports.parseFnType = parseFnType;
  exports.parseJsDocParams = parseJsDocParams;
  exports.customDataTip = customDataTip;
});