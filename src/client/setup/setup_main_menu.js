define(function(require,exports,module) {
  var Dropdown = require("../ui/dropdown").Dropdown;
  var moreItems = {

  };

  var menuItems = {
    'more': {
      icon: "more_vert",
      caption: "More",
      subTree: moreItems,
      sortIndex: 10000,
    }
  };
  var menu = exports.MainMenu = new Dropdown();
  menu.setData(menuItems);
  menu.addOption = function(optionId, option, showAsMore) {
    if (optionId == "!update") {
      if (!showAsMore) {
        Array.prototype.push.apply((menuItems[optionId] || (menuItems[optionId] = [])), option);
      }
      if (showAsMore || showAsMore === undefined) {
        Array.prototype.push.apply((moreItems[optionId] || (moreItems[optionId] = [])), option);
      }
    } else if (menuItems[optionId]) {
      menuItems[optionId] = option;
    } else if (moreItems[optionId]) {
      moreItems[optionId] = option;
    } else {
      var items = menuItems;
      if (showAsMore === undefined) {
        showAsMore = Object.keys(menuItems).filter(function(e) {
          return e !== "!changed" && e !== '!update' && !menuItems["!" + e];
        }).length>6;
      }
      if (showAsMore) {
        items = moreItems;
      }
      items[optionId] = option;
    }
    menu.setData();
  };
  menu.extendOption = function(optionId, option, others) {
    var extension = {};
    extension[optionId] = option;
    if (menuItems[optionId]) {
      Dropdown.assign(menuItems, extension);
      menu.setData();
    } else if (moreItems[optionId]) {
      Dropdown.assign(moreItems, extension);
      menu.setData();
    } else menu.addOption(optionId, option, others);
  };
  menu.removeOption = function(optionId) {
    if (menuItems[optionId])
      delete menuItems[optionId];
    if (menuItems.others[optionId]) {
      delete menuItems.others[optionId];
    }
    menu.setData(menuItems);
  };
  
}); /*_EndDefine*/