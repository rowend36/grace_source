define(function (require, exports, module) {
    require('css!../libs/css/coding-fonts.css');
    var fonts = [
        'Anonymous Pro',
        'Courier Prime',
        {
            name: 'Fira Code',
            types: ['Regular', 'Bold'],
            formats: ['woff', 'woff2', 'ttf'],
        },
        'Hack',
        {
            name: 'Inconsolata',
            types: ['Regular', 'Bold'],
        },
        'JetBrains Mono',
        {
            name: 'Roboto Mono',
            types: ['Regular', 'Bold'],
        },
        {
            name: 'PT Mono',
            types: ['Regular'],
        },
        'Source Code Pro',
        'Ubuntu Mono',
        {
            name: 'Nova Mono',
            types: ['Regular'],
        },
    ];
    require('../core/config').Config.registerAll(null, 'editor');
    require('../core/config').Config.registerInfo(
        {
            fontFamily:
                'Font used by the editor and search results. Availability of fonts varies with device but the following are guaranteed to be available ' +
                fonts
                    .map(function (e) {
                        return e.name || e;
                    })
                    .join(', ') +
                '.\n',
        },
        'editor'
    );
});
