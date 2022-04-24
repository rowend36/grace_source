define(function(require, exports, module) {
    var appEvents = require("../core/events").AppEvents;
    require("grace/ext/character_bar/setup_character_bar");
    var b = performance.now();
    appEvents.on("documentsLoaded", function() {
        require(["../ext/index"], function() {
            appEvents.triggerForever("fullyLoaded");
            console.debug("Extensions: " + (performance
                .now() - b));
        });
    });
});