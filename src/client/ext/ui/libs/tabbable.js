define(function(require,exports,module){
    var candidateSelectors = [
        'input',
        'select',
        'textarea',
        'a[href]',
        'button',
        '[tabindex]',
        'audio[controls]',
        'video[controls]',
        '[contenteditable]:not([contenteditable="false"])',
        'details>summary:first-of-type',
        'details',
    ];
    var candidateSelector = /* #__PURE__ */ candidateSelectors.join(',');

    var matches =
        typeof Element === 'undefined' ?
        function() {} :
        Element.prototype.matches ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.webkitMatchesSelector;

    function tabbable(el, options) {
        options = options || {};

        var regularTabbables = [];
        var orderedTabbables = [];

        var candidates = getCandidates(
            el,
            options.includeContainer,
            isNodeMatchingSelectorTabbable
        );

        candidates.forEach(function(candidate, i) {
            var candidateTabindex = getTabindex(candidate);
            if (candidateTabindex === 0) {
                regularTabbables.push(candidate);
            }
            else {
                orderedTabbables.push({
                    documentOrder: i,
                    tabIndex: candidateTabindex,
                    node: candidate,
                });
            }
        });

        var tabbableNodes = orderedTabbables
            .sort(sortOrderedTabbables)
            .map(function(a){return a.node})
            .concat(regularTabbables);

        return tabbableNodes;
    }

    function focusable(el, options) {
        options = options || {};

        var candidates = getCandidates(
            el,
            options.includeContainer,
            isNodeMatchingSelectorFocusable
        );

        return candidates;
    }

    function getCandidates(el, includeContainer, filter) {
        var candidates = Array.prototype.slice.apply(
            el.querySelectorAll(candidateSelector)
        );
        if (includeContainer && matches.call(el, candidateSelector)) {
            candidates.unshift(el);
        }
        candidates = candidates.filter(filter);
        return candidates;
    }

    function isNodeMatchingSelectorTabbable(node) {
        if (!isNodeMatchingSelectorFocusable(node) ||
            isNonTabbableRadio(node) ||
            getTabindex(node) < 0
        ) {
            return false;
        }
        return true;
    }

    function isTabbable(node) {
        if (!node) {
            throw new Error('No node provided');
        }
        if (matches.call(node, candidateSelector) === false) {
            return false;
        }
        return isNodeMatchingSelectorTabbable(node);
    }

    function isNodeMatchingSelectorFocusable(node) {
        if (
            node.disabled ||
            isHiddenInput(node) ||
            isHidden(node) ||
            /* For a details element with a summary, the summary element gets the focused  */
            isDetailsWithSummary(node)
        ) {
            return false;
        }
        return true;
    }

    var focusableCandidateSelector = /* #__PURE__ */ candidateSelectors
        .concat('iframe')
        .join(',');

    function isFocusable(node) {
        if (!node) {
            throw new Error('No node provided');
        }
        if (matches.call(node, focusableCandidateSelector) === false) {
            return false;
        }
        return isNodeMatchingSelectorFocusable(node);
    }

    function getTabindex(node) {
        var tabindexAttr = parseInt(node.getAttribute('tabindex'), 10);

        if (!isNaN(tabindexAttr)) {
            return tabindexAttr;
        }

        // Browsers do not return `tabIndex` correctly for contentEditable nodes;
        // so if they don't have a tabindex attribute specifically set, assume it's 0.
        if (isContentEditable(node)) {
            return 0;
        }

        // in Chrome, <details/>, <audio controls/> and <video controls/> elements get a default
        //  `tabIndex` of -1 when the 'tabindex' attribute isn't specified in the DOM,
        //  yet they are still part of the regular tab order; in FF, they get a default
        //  `tabIndex` of 0; since Chrome still puts those elements in the regular tab
        //  order, consider their tab index to be 0.
        if (
            (node.nodeName === 'AUDIO' ||
                node.nodeName === 'VIDEO' ||
                node.nodeName === 'DETAILS') &&
            node.getAttribute('tabindex') === null
        ) {
            return 0;
        }

        return node.tabIndex;
    }

    function sortOrderedTabbables(a, b) {
        return a.tabIndex === b.tabIndex ?
            a.documentOrder - b.documentOrder :
            a.tabIndex - b.tabIndex;
    }

    function isContentEditable(node) {
        return node.contentEditable === 'true';
    }

    function isInput(node) {
        return node.tagName === 'INPUT';
    }

    function isHiddenInput(node) {
        return isInput(node) && node.type === 'hidden';
    }

    function isDetailsWithSummary(node) {
        var r =
            node.tagName === 'DETAILS' &&
            Array.prototype.slice
            .apply(node.children)
            .some(function(child) {child.tagName === 'SUMMARY'});
        return r;
    }

    function isRadio(node) {
        return isInput(node) && node.type === 'radio';
    }

    function isNonTabbableRadio(node) {
        return isRadio(node) && !isTabbableRadio(node);
    }

    function getCheckedRadio(nodes, form) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].checked && nodes[i].form === form) {
                return nodes[i];
            }
        }
    }

    function isTabbableRadio(node) {
        if (!node.name) {
            return true;
        }
        var radioScope = node.form || node.ownerDocument;
        var radioSet = radioScope.querySelectorAll(
            'input[type="radio"][name="' + node.name + '"]'
        );
        var checked = getCheckedRadio(radioSet, node.form);
        return !checked || checked === node;
    }

    function isHidden(node) {
        if (getComputedStyle(node).visibility === 'hidden') return true;

        var isDirectSummary = node.matches('details>summary:first-of-type');
        var nodeUnderDetails = isDirectSummary ? node.parentElement : node;
        if (nodeUnderDetails.matches('details:not([open]) *')) {
            return true;
        }

        while (node) {
            if (getComputedStyle(node).display === 'none') return true;
            node = node.parentElement;
        }

        return false;
    }

    exports.tabbable = { tabbable:tabbable, focusable:focusable, isTabbable:isTabbable, isFocusable:isFocusable,isVisible:isNodeMatchingSelectorTabbable };
}); /*_EndDefine*/