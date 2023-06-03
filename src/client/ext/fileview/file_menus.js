define(function (require, exports, module) {
  var Fileviews = require('./fileviews').Fileviews;
  var Dropdown = require('grace/ui/dropdown').Dropdown;
  var FileUtils = require('grace/core/file_utils').FileUtils;
  var DefaultMenuItems = {
    'folder-dropdown': {
      '!save-as': 'Save As',
      'open-folder': {
        caption: 'Open',
      },
      'new-folder': 'New Folder',
      '!new-item': 'New File',
      'rename-folder': {
        caption: 'Rename',
      },
      'delete-folder': 'Delete',
      'copy-file': 'Copy',
      'cut-file': 'Cut',
      '!paste-file': {
        sortIndex: -1,
        caption: 'Paste',
      },
      'show-info': 'Info',
      'mark-file': 'Mark Multiple',
      'new-tab': {
        caption: 'Open in new tab',
      },
      'open-project': {
        caption: 'Open As Project Folder',
      },
      '!update': [
        function (self, update) {
          update(
            'paste-file',
            Fileviews.activeFileBrowser.clipboard.data
              ? self['!paste-file']
              : null
          );
          update(
            'new-item',
            Fileviews.inSaveMode() ? self['!save-as'] : self['!new-item']
          );
        },
      ],
    },
    'file-dropdown': {
      'open-item': 'Open',
      'rename-file': 'Rename',
      'delete-file': 'Delete',
      'copy-file': 'Copy',
      'cut-file': 'Cut',
      '!paste-file': {
        caption: 'Paste',
      },
      'show-info': 'Info',
      'mark-file': 'Mark Multiple',
      '!update': [
        function (self, update) {
          update(
            'paste-file',
            Fileviews.activeFileBrowser.clipboard.data
              ? self['!paste-file']
              : null
          );
        },
      ],
    },
    'header-dropdown': {
      '!save-as': 'Save As',
      '!paste-file': {
        caption: 'Paste',
      },
      '!new-item': 'New File',
      'new-folder': 'New Folder',
      'filter-files': 'Filter',
      'reload-browser': 'Reload',
      'open-project': 'Open As Project Folder',
      'show-current-doc': {
        caption: 'Show Current File',
        sortIndex: 100,
      },
      '!add-bookmark': 'Add To Bookmarks',
      '!remove-bookmark': 'Remove From Bookmarks',

      'new-browser': 'Add Storage',
      'delete-browser': 'Close Storage',
      'toggle-info': 'Show File Info',
      '!update': [
        function (self, update) {
          var bookmarked =
            FileUtils.getBookmarks().indexOf(
              Fileviews.activeFileBrowser.rootDir
            ) > -1;
          update('add-bookmark', bookmarked ? null : self['!add-bookmark']);
          update(
            'remove-bookmark',
            !bookmarked ? null : self['!remove-bookmark']
          );
          update(
            'paste-file',
            Fileviews.activeFileBrowser.clipboard.data
              ? self['!paste-file']
              : null
          );
          update(
            'new-item',
            Fileviews.inSaveMode() ? self['!save-as'] : self['!new-item']
          );
          update(
            'toggle-info',
            Fileviews.activeFileBrowser.showFileInfo
              ? 'Hide File Info'
              : 'Show File Info'
          );
          update(
            'toggle-info',
            Fileviews.activeFileBrowser.showFileInfo
              ? 'Hide File Info'
              : 'Show File Info'
          );
          update(
            'open-tree',
            Fileviews.activeFileBrowser.isTree ? 'View As List' : 'View As Tree'
          );
        },
      ],
    },
  };
  (function () {
    //Add ordering
    for (var i in DefaultMenuItems) {
      var o = 1;
      for (var j in DefaultMenuItems[i]) {
        if (typeof DefaultMenuItems[i][j] == 'string') {
          DefaultMenuItems[i][j] = {
            caption: DefaultMenuItems[i][j],
          };
        }
        DefaultMenuItems[i][j].sortIndex = DefaultMenuItems[i][j].sortIndex || o++;
      }
    }
  })();
  //Add menu items for NestedViews
  (function (m) {
    Object.assign(m, {
      'nested-header-dropdown': Object.create(m['header-dropdown']),
      'nested-folder-dropdown': {
        'fold-opts': {
          caption: 'Fold...',
          sortIndex: 50,
          subTree: {
            'expand-all': {
              caption: 'Unfold Children',
              sortIndex: 50,
            },
            'fold-all': {
              caption: 'Fold Children',
              sortIndex: 50,
            },
            '!fold-parent': {
              caption: 'Fold Parent',
              sortIndex: 50,
            },
            '!update': [
              function (self, update) {
                update(
                  'fold-parent',
                  Fileviews.activeFileBrowser.getParent()
                    ? self['!fold-parent']
                    : null
                );
              },
            ],
          },
        },
        'reload-browser': 'Reload Folder',
        '!select-all': {
          caption: 'Select All',
          sortIndex: 51, //Miss react
        },
        '!clear-select': {
          caption: 'Cancel Selection',
          sortIndex: 51,
        },
        '!update': [
          function (self, update) {
            var browser = Fileviews.activeFileBrowser;
            if (browser.selected && browser.isTree) {
              browser = browser.nestedViews[browser.selected];
            }
            update(
              'clear-select',
              browser && browser.inSelectMode ? self['!clear-select'] : null
            );
            update(
              'select-all',
              browser && browser.inSelectMode ? self['!select-all'] : null
            );
          },
        ],
      },
      'nested-file-dropdown': {
        'fold-parent': {
          caption: 'Fold Parent',
          sortIndex: 50,
        },
      },
      'child-folder-dropdown': Object.create(m['folder-dropdown']),
      'child-file-dropdown': Object.create(m['file-dropdown']),
    });
    Dropdown.assign(m['child-folder-dropdown'], m['nested-folder-dropdown']);
    Dropdown.assign(m['nested-header-dropdown'], m['nested-folder-dropdown']);
    Dropdown.assign(m['child-file-dropdown'], m['nested-file-dropdown']);
  })(DefaultMenuItems);
  
  //Add menu items for project root.
  DefaultMenuItems['project-dropdown'] = Object.assign(
    DefaultMenuItems['nested-folder-dropdown'],
    DefaultMenuItems['folder-dropdown']
  );
  exports.fileMenus = DefaultMenuItems;
});