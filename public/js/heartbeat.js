// Lightweight learning heartbeat sender.
// Usage: initLearningHeartbeat({ apiBase: '/learning/events', userId, courseId, getProgress, getActiveMs })

(function() {
    let intervalId = null;
    let sessionId = Math.random().toString(36).slice(2);
    let lastBeat = Date.now();

    function visible() {
        return document.visibilityState === 'visible';
    }

    async function postJSON(url, body) {
        try {
            await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } catch (_) {
            // ignore network errors for heartbeat
        }
    }

    window.initLearningHeartbeat = function initLearningHeartbeat(opts) {
        const { apiBase, userId, courseId, getProgress } = opts;
        if (!apiBase || !userId || !courseId) return;

        function beat(type) {
            const now = Date.now();
            const delta = Math.max(0, now - lastBeat);
            lastBeat = now;
            const payload = {
                userId,
                courseId,
                type,
                sessionId,
                activeMs: visible() ? delta : 0,
                progressPercentage: typeof getProgress === 'function' ? getProgress() : undefined
            };
            // Use relative URL to work in both development and production
            postJSON('/api/learning/events', payload);
        }

        // initial start
        beat('start');

        // 15s heartbeat
        intervalId = setInterval(() => beat('heartbeat'), 15000);

        document.addEventListener('visibilitychange', () => {
            beat(visible() ? 'resume' : 'pause');
        });

        window.addEventListener('beforeunload', () => {
            beat('end');
            if (intervalId) clearInterval(intervalId);
        });
    };
})();


