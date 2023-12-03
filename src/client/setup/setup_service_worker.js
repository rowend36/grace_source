define(function (require, exports, module) {
    // Register the service worker
    if ("serviceWorker" in navigator) {
        // Wait for the 'load' event to not block other work
        window.addEventListener("load", function () {
            // Try to register the service worker.
            // Capture the registration for later use, if needed
            console.log("Registering service worker");
            navigator.serviceWorker
                .register("/service-worker.js")
                .then(function (reg) {
                    console.log("Service worker registered! 😎", reg);
                })
                .catch(function (err) {
                    console.log("😥 Service worker registration failed: ", err);
                });
        });
    }
});