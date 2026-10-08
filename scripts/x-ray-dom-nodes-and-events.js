(function analyzeInSetuEnvironment() {
    console.log("🔍 Running inSetu X-Ray...");

    const tagCounts = {};
    const listenerCounts = {};
    const componentListeners = {};
    let totalNodes = 0;
    let totalListeners = 0;

    function walk(node, hostName = 'Document') {
        totalNodes++;

        // Track node types
        const tag = node.tagName ? node.tagName.toLowerCase() : 'text_node';
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;

        let currentHost = hostName;
        if (node.tagName && node.tagName.includes('-')) {
            currentHost = node.tagName.toLowerCase();
        }

        // Track event listeners using Chrome's native DevTools API
        if (typeof getEventListeners === 'function' && node.tagName) {
            const listeners = getEventListeners(node);
            let nodeListenerCount = 0;
            
            for (const type in listeners) {
                const count = listeners[type].length;
                nodeListenerCount += count;
                totalListeners += count;
                listenerCounts[type] = (listenerCounts[type] || 0) + count;
            }

            if (nodeListenerCount > 0) {
                componentListeners[currentHost] = (componentListeners[currentHost] || 0) + nodeListenerCount;
            }
        }

        if (node.shadowRoot) {
            node.shadowRoot.childNodes.forEach(child => walk(child, currentHost));
        }
        node.childNodes.forEach(child => walk(child, currentHost));
    }

    walk(document);

    console.log(`\n📊 TOP DOM NODES (Total: ${totalNodes})`);
    console.table(Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 15)
        .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {}));

    if (typeof getEventListeners === 'function') {
        console.log(`\n🎧 TOP EVENT TYPES (Total: ${totalListeners})`);
        console.table(Object.entries(listenerCounts)
            .sort((a, b) => b[1] - a[1]).slice(0, 15)
            .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {}));

        console.log(`\n🎯 HEAVIEST LISTENER HOSTS`);
        console.table(Object.entries(componentListeners)
            .sort((a, b) => b[1] - a[1]).slice(0, 15)
            .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {}));
    } else {
        console.warn("Event listener analysis requires running this script directly in the Chrome DevTools console.");
    }
})();