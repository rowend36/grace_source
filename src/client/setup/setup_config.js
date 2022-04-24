define(function(require,exports,module){
    var Env = window.Env;
    
    require("../core/config").Config.registerAll({
        tabletView: window.innerWidth > 720,
        disableOptimizedFileBrowser: false,
        disableBackButtonTabSwitch: false,
        backButtonDelay: "700ms",
        enableFloatingRunButton: "auto",
        enableSplits: window.innerHeight > 700,
        autoHideTabs: "landscape",
        enableGit: true,
        enableTouchKeyboardFeatures: !Env.isHardwareKeyboard,
        inactiveFileDelay: "5min",
        projectConfigFile: "grace.json",
    });
    require("../core/config").Config.registerValues({
        disableOptimizedFileBrowser: "On some devices, this feature has been known to cause scrolling defects. Set to true to disable. Requires restart.",
        tabletView: "Optimize view for wide screens",
        autoHideTabs: {
            doc: "Automatically hide tabs when keyboard is visible. Set to false to disable.",
            values: [
                "always",
                ["viewport", "hide on small viewport"],
                ["landscape", "hide when in landscape"],
                "landscape_small",
                "auto",
                "never",
            ],
        },
        projectConfigFile: "The filepath to the user's configuration file relative to project folder or as an absolute path. Multiple comma separated files are allowed",
        enableFloatingRunButton: {
            default: "auto",
            values: ["true", "small", "center", "auto", false],
        },
        backButtonDelay: {
            type: "time"
        },
        inactiveFileDelay: {
            doc: "How long after saving is necessary for a file to be considered inactive for 'Close inactive tabs' menu option",
            type: "time"
        }
    });
    
});