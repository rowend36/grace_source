define(function (require, exports, module) {
  var Dropdown = require('../ui/dropdown').Dropdown;
  var moreItems = {};

  var menuItems = {
    more: {
      icon: 'more_vert',
      caption: 'More',
      subTree: moreItems,
      sortIndex: 10000,
    },
  };
  var menu = (exports.MainMenu = new Dropdown());
  menu.setData(menuItems);
  function addUpdateFuncs(menu, updateFuncs) {
    if (!Array.isArray(updateFuncs)) updateFuncs = [updateFuncs];
    Array.prototype.push.apply(
      menu['!update'] || (menu['!update'] = []),
      updateFuncs
    );
  }
  menu.addOption = function (optionId, option, showAsMore) {
    if (optionId == '!update') {
      if (!showAsMore) {
        addUpdateFuncs(menuItems, option);
      }
      if (showAsMore || showAsMore === undefined) {
        addUpdateFuncs(moreItems, option);
      }
    } else {
      var target;
      if (menuItems[optionId]) {
        target = menuItems;
      } else if (moreItems[optionId]) {
        target = moreItems;
      } else {
        target = menuItems;
        if (showAsMore === undefined) {
          showAsMore =
            Object.keys(menuItems).filter(function (e) {
              return e !== '!changed' && e !== '!update' && !menuItems['!' + e];
            }).length > 6;
        }
        if (showAsMore) {
          target = moreItems;
        }
      }
      target[optionId] = option;
    }
    menu.setData();
  };
  menu.extendOption = function (optionId, option, others) {
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
  menu.removeOption = function (optionId) {
    if (menuItems[optionId]) delete menuItems[optionId];
    if (menuItems.others[optionId]) {
      delete menuItems.others[optionId];
    }
    menu.setData(menuItems);
  };
}); /*_EndDefine*/