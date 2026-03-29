/* ================================================================
   KS TECH — NEURAL CONSTELLATION BACKGROUND
   Canvas 2D interactive particle network with:
   - Multi-layer depth nodes (Cyan / Violet / Indigo)
   - Pulsing connection lines
   - Fluid data-wave overlay
   - Cursor super-glow repulsion field
   - Micro-event data-burst clusters
   - Responsive density scaling
   ================================================================ */

(function () {
    'use strict';

    /* ========== CONFIGURATION ========== */
    const CONFIG = {
        // — Palette (Dark Tech) —
        COLORS: {
            BG:       '#07070d',
            DEEP:     '#0e0e18',
            CYAN:     { r: 14,  g: 165, b: 233 },
            INDIGO:   { r: 99,  g: 102, b: 241 },
            VIOLET:   { r: 139, g: 92,  b: 246 },
        },

        // — Layer definitions (front → back) —
        LAYERS: [
            { depth: 1.0,  speed: 0.35, radius: 2.8, opacity: 0.92, blur: 0,   color: 'CYAN'   },
            { depth: 0.7,  speed: 0.25, radius: 2.2, opacity: 0.55, blur: 0,   color: 'CYAN'   },
            { depth: 0.45, speed: 0.15, radius: 1.8, opacity: 0.32, blur: 1.5, color: 'INDIGO' },
            { depth: 0.25, speed: 0.08, radius: 1.4, opacity: 0.18, blur: 3,   color: 'VIOLET' },
        ],

        // — Node density (per 1000px²) —
        DENSITY_DESKTOP: 0.055,
        DENSITY_MOBILE:  0.028,

        // — Connections —
        CONNECTION_DISTANCE: 160,
        CONNECTION_OPACITY:  0.12,
        LINE_WIDTH:          0.6,

        // — Cursor interaction —
        CURSOR_RADIUS:       220,
        CURSOR_REPEL_FORCE:  0.025,
        CURSOR_GLOW_RADIUS:  300,

        // — Data-wave —
        WAVE_AMPLITUDE:  40,
        WAVE_FREQUENCY:  0.003,
        WAVE_SPEED:      0.0008,
        WAVE_PANELS:     6,

        // — Micro-events —
        BURST_INTERVAL_MIN: 3000,
        BURST_INTERVAL_MAX: 8000,
        BURST_DURATION:     600,
        BURST_RADIUS:       100,
    };

    /* ========== STATE ========== */
    let canvas, ctx;
    let width, height, dpr;
    let nodes = [];
    let mouse = { x: -9999, y: -9999, active: false };
    let time = 0;
    let cursorHue = 0; // for Cyan↔Violet alternation
    let nextBurstTime = 0;
    let activeBursts = [];
    let animId;

    /* ========== HELPERS ========== */
    function rgba(c, a) {
        return `rgba(${c.r},${c.g},${c.b},${a})`;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function dist(ax, ay, bx, by) {
        const dx = ax - bx, dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function isMobile() {
        return window.innerWidth <= 768;
    }

    function lerpColor(c1, c2, t) {
        return {
            r: Math.round(lerp(c1.r, c2.r, t)),
            g: Math.round(lerp(c1.g, c2.g, t)),
            b: Math.round(lerp(c1.b, c2.b, t)),
        };
    }

    /* ========== NODE CLASS ========== */
    class Node {
        constructor(layerIndex) {
            const layer = CONFIG.LAYERS[layerIndex];
            this.layerIndex = layerIndex;
            this.depth = layer.depth;
            this.baseRadius = layer.radius;
            this.opacity = layer.opacity;
            this.blur = layer.blur;
            this.colorKey = layer.color;

            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * layer.speed;
            this.vy = (Math.random() - 0.5) * layer.speed;

            // Slight oscillation
            this.oscAmp = Math.random() * 8 + 2;
            this.oscFreq = Math.random() * 0.002 + 0.001;
            this.oscOffset = Math.random() * Math.PI * 2;

            // Pulse phase
            this.pulsePhase = Math.random() * Math.PI * 2;
            this.pulseSpeed = Math.random() * 0.003 + 0.001;

            // Glow intensity (boosted by cursor / bursts)
            this.glowIntensity = 0;
        }

        update(dt) {
            // Oscillation
            this.x += this.vx + Math.sin(time * this.oscFreq + this.oscOffset) * 0.15;
            this.y += this.vy + Math.cos(time * this.oscFreq * 0.7 + this.oscOffset) * 0.1;

            // Wrap around edges
            if (this.x < -20) this.x = width + 20;
            if (this.x > width + 20) this.x = -20;
            if (this.y < -20) this.y = height + 20;
            if (this.y > height + 20) this.y = -20;

            // Cursor repulsion (only front layers)
            if (mouse.active && this.depth > 0.4) {
                const d = dist(this.x, this.y, mouse.x, mouse.y);
                if (d < CONFIG.CURSOR_RADIUS && d > 0) {
                    const force = (1 - d / CONFIG.CURSOR_RADIUS) * CONFIG.CURSOR_REPEL_FORCE * this.depth;
                    const angle = Math.atan2(this.y - mouse.y, this.x - mouse.x);
                    this.vx += Math.cos(angle) * force;
                    this.vy += Math.sin(angle) * force;

                    // Boost glow near cursor
                    this.glowIntensity = Math.max(this.glowIntensity, (1 - d / CONFIG.CURSOR_RADIUS) * 1.5);
                }
            }

            // Friction
            this.vx *= 0.997;
            this.vy *= 0.997;

            // Pulse
            this.pulsePhase += this.pulseSpeed;

            // Decay glow
            this.glowIntensity *= 0.96;

            // Burst check
            for (const burst of activeBursts) {
                const d = dist(this.x, this.y, burst.x, burst.y);
                if (d < CONFIG.BURST_RADIUS) {
                    const progress = burst.elapsed / burst.duration;
                    const intensity = Math.sin(progress * Math.PI) * (1 - d / CONFIG.BURST_RADIUS);
                    this.glowIntensity = Math.max(this.glowIntensity, intensity * 2);
                }
            }
        }

        draw() {
            const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
            const radius = this.baseRadius * pulse * (1 + this.glowIntensity * 0.8);
            const baseColor = CONFIG.COLORS[this.colorKey];
            const alpha = this.opacity * pulse;

            // Apply blur for distant layers
            if (this.blur > 0) {
                ctx.filter = `blur(${this.blur}px)`;
            }

            // Outer glow
            if (this.glowIntensity > 0.1 || this.depth > 0.8) {
                const glowRadius = radius * (3 + this.glowIntensity * 6);
                const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
                const glowAlpha = (0.08 + this.glowIntensity * 0.3) * alpha;
                grad.addColorStop(0, rgba(baseColor, glowAlpha));
                grad.addColorStop(1, rgba(baseColor, 0));
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
                ctx.fill();
            }

            // Core dot
            ctx.fillStyle = rgba(baseColor, alpha + this.glowIntensity * 0.5);
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Bright center
            if (this.depth > 0.6) {
                ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, (0.6 + this.glowIntensity) * alpha * 0.4);
                ctx.beginPath();
                ctx.arc(this.x, this.y, radius * 0.35, 0, Math.PI * 2);
                ctx.fill();
            }

            if (this.blur > 0) {
                ctx.filter = 'none';
            }
        }
    }

    /* ========== INITIALIZATION ========== */
    function init() {
        if (isMobile()) {
            document.body.style.background = 'linear-gradient(135deg, #07070d 0%, #0e0e18 100%)';
            const bg = document.getElementById('neural-bg');
            if (bg) bg.style.display = 'none';
            return;
        }

        canvas = document.getElementById('neural-bg');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        resize();
        createNodes();
        bindEvents();
        scheduleNextBurst();
        loop(performance.now());
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createNodes() {
        nodes = [];
        if (isMobile()) return;

        const density = CONFIG.DENSITY_DESKTOP;
        const area = width * height / 1000;
        let total = Math.floor(area * density);
        
        if (total > 70) total = 70; // Cap at 70 for 60 FPS performance

        CONFIG.LAYERS.forEach((layer, i) => {
            // Distribute nodes across layers (more in back, fewer in front)
            const weight = [0.2, 0.25, 0.3, 0.25][i] || 0.25;
            const count = Math.floor(total * weight);
            for (let j = 0; j < count; j++) {
                nodes.push(new Node(i));
            }
        });
    }

    /* ========== EVENTS ========== */
    function bindEvents() {
        // Mouse — track globally across the whole page
        document.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            mouse.active = true;
        });
        document.addEventListener('mouseleave', () => {
            mouse.active = false;
        });

        // Touch
        document.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            mouse.x = touch.clientX;
            mouse.y = touch.clientY;
            mouse.active = true;
        }, { passive: true });
        document.addEventListener('touchend', () => {
            mouse.active = false;
        });

        // Resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                resize();
                createNodes();
            }, 200);
        });
    }

    /* ========== MICRO-BURSTS ========== */
    function scheduleNextBurst() {
        nextBurstTime = time + CONFIG.BURST_INTERVAL_MIN +
            Math.random() * (CONFIG.BURST_INTERVAL_MAX - CONFIG.BURST_INTERVAL_MIN);
    }

    function updateBursts(dt) {
        // Spawn new burst
        if (time >= nextBurstTime) {
            activeBursts.push({
                x: Math.random() * width,
                y: Math.random() * height,
                elapsed: 0,
                duration: CONFIG.BURST_DURATION,
            });
            scheduleNextBurst();
        }

        // Update existing
        for (let i = activeBursts.length - 1; i >= 0; i--) {
            activeBursts[i].elapsed += dt;
            if (activeBursts[i].elapsed >= activeBursts[i].duration) {
                activeBursts.splice(i, 1);
            }
        }
    }

    /* ========== DRAW CONNECTIONS ========== */
    function drawConnections() {
        const maxDist = CONFIG.CONNECTION_DISTANCE;
        const maxDist2 = maxDist * maxDist;

        // Only connect front 2 layers (performance)
        const connectable = nodes.filter(n => n.depth > 0.5);

        for (let i = 0; i < connectable.length; i++) {
            const a = connectable[i];
            for (let j = i + 1; j < connectable.length; j++) {
                const b = connectable[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;

                if (d2 < maxDist2) {
                    const d = Math.sqrt(d2);
                    const alpha = (1 - d / maxDist) * CONFIG.CONNECTION_OPACITY;

                    // Pulse the line
                    const pulse = Math.sin(time * 0.002 + (a.pulsePhase + b.pulsePhase) * 0.5) * 0.3 + 0.7;
                    const finalAlpha = alpha * pulse;

                    // Boost connections near cursor
                    let boost = 0;
                    if (mouse.active) {
                        const midX = (a.x + b.x) / 2;
                        const midY = (a.y + b.y) / 2;
                        const mDist = dist(midX, midY, mouse.x, mouse.y);
                        if (mDist < CONFIG.CURSOR_GLOW_RADIUS) {
                            boost = (1 - mDist / CONFIG.CURSOR_GLOW_RADIUS) * 0.4;
                        }
                    }

                    // Boost connections in bursts
                    for (const burst of activeBursts) {
                        const midX = (a.x + b.x) / 2;
                        const midY = (a.y + b.y) / 2;
                        const bDist = dist(midX, midY, burst.x, burst.y);
                        if (bDist < CONFIG.BURST_RADIUS) {
                            const progress = Math.sin((burst.elapsed / burst.duration) * Math.PI);
                            boost = Math.max(boost, progress * (1 - bDist / CONFIG.BURST_RADIUS) * 0.6);
                        }
                    }

                    // Color interpolation between nodes
                    const colorA = CONFIG.COLORS[a.colorKey];
                    const colorB = CONFIG.COLORS[b.colorKey];
                    const lineColor = lerpColor(colorA, colorB, 0.5);

                    ctx.strokeStyle = rgba(lineColor, finalAlpha + boost);
                    ctx.lineWidth = CONFIG.LINE_WIDTH + boost * 1.5;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }
    }

    /* ========== DATA WAVE ========== */
    function drawDataWave() {
        const waveY = height * 0.55;
        const panels = CONFIG.WAVE_PANELS;
        const panelWidth = width / panels;

        for (let i = 0; i < panels; i++) {
            const x = i * panelWidth;
            const phase = time * CONFIG.WAVE_SPEED + i * 0.8;
            const yOff = Math.sin(phase) * CONFIG.WAVE_AMPLITUDE;
            const yOff2 = Math.cos(phase * 0.7 + 1) * CONFIG.WAVE_AMPLITUDE * 0.6;
            const panelHeight = 60 + Math.sin(phase * 0.5) * 20;

            // Glassmorphism panel
            ctx.save();
            ctx.globalAlpha = 0.025 + Math.sin(phase) * 0.01;
            ctx.fillStyle = `rgba(255,255,255,0.06)`;

            // Rounded rectangle path
            const rx = x + 8;
            const ry = waveY + yOff + yOff2;
            const rw = panelWidth - 16;
            const rh = panelHeight;
            const r = 12;

            ctx.beginPath();
            ctx.moveTo(rx + r, ry);
            ctx.lineTo(rx + rw - r, ry);
            ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
            ctx.lineTo(rx + rw, ry + rh - r);
            ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
            ctx.lineTo(rx + r, ry + rh);
            ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
            ctx.lineTo(rx, ry + r);
            ctx.quadraticCurveTo(rx, ry, rx + r, ry);
            ctx.closePath();
            ctx.fill();

            // Border
            ctx.strokeStyle = `rgba(255,255,255,0.04)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        }

        // Flowing particle trail along the wave
        const trailCount = isMobile() ? 15 : 30;
        for (let i = 0; i < trailCount; i++) {
            const t = (time * 0.0003 + i / trailCount) % 1;
            const tx = t * width;
            const ty = waveY + Math.sin(t * Math.PI * 4 + time * CONFIG.WAVE_SPEED) * CONFIG.WAVE_AMPLITUDE;

            const size = 1.2 + Math.sin(t * Math.PI * 2 + time * 0.003) * 0.6;
            const alpha = 0.15 + Math.sin(t * Math.PI) * 0.2;

            // Alternate Cyan / Violet
            const color = i % 2 === 0 ? CONFIG.COLORS.CYAN : CONFIG.COLORS.VIOLET;

            // Glow
            const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, size * 6);
            grad.addColorStop(0, rgba(color, alpha * 0.5));
            grad.addColorStop(1, rgba(color, 0));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(tx, ty, size * 6, 0, Math.PI * 2);
            ctx.fill();

            // Dot
            ctx.fillStyle = rgba(color, alpha);
            ctx.beginPath();
            ctx.arc(tx, ty, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* ========== CURSOR SUPER-GLOW ========== */
    function drawCursorGlow() {
        if (!mouse.active) return;

        // Slowly alternate hue between Cyan ↔ Violet
        cursorHue += 0.005;
        const t = (Math.sin(cursorHue) + 1) / 2;
        const color = lerpColor(CONFIG.COLORS.CYAN, CONFIG.COLORS.VIOLET, t);

        // Large ambient glow
        const grad = ctx.createRadialGradient(
            mouse.x, mouse.y, 0,
            mouse.x, mouse.y, CONFIG.CURSOR_GLOW_RADIUS
        );
        grad.addColorStop(0, rgba(color, 0.12));
        grad.addColorStop(0.4, rgba(color, 0.04));
        grad.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, CONFIG.CURSOR_GLOW_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright core
        const coreGrad = ctx.createRadialGradient(
            mouse.x, mouse.y, 0,
            mouse.x, mouse.y, 40
        );
        coreGrad.addColorStop(0, rgba({ r: 255, g: 255, b: 255 }, 0.06));
        coreGrad.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 40, 0, Math.PI * 2);
        ctx.fill();
    }

    /* ========== AMBIENT NEBULA ========== */
    function drawNebula() {
        // Deep ambient color blobs — very subtle
        const blobs = [
            { x: width * 0.2, y: height * 0.25, r: width * 0.35, color: CONFIG.COLORS.CYAN,   a: 0.03 },
            { x: width * 0.75, y: height * 0.7,  r: width * 0.3,  color: CONFIG.COLORS.INDIGO, a: 0.025 },
            { x: width * 0.5,  y: height * 0.5,  r: width * 0.4,  color: CONFIG.COLORS.VIOLET, a: 0.015 },
        ];

        for (const blob of blobs) {
            // Breathe
            const breathe = 1 + Math.sin(time * 0.0005 + blob.x * 0.01) * 0.1;
            const r = blob.r * breathe;

            const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, r);
            grad.addColorStop(0, rgba(blob.color, blob.a));
            grad.addColorStop(1, rgba(blob.color, 0));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(blob.x, blob.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* ========== BURST FLASH ========== */
    function drawBursts() {
        for (const burst of activeBursts) {
            const progress = burst.elapsed / burst.duration;
            const intensity = Math.sin(progress * Math.PI);
            const expandRadius = CONFIG.BURST_RADIUS * (0.5 + progress * 0.5);

            const grad = ctx.createRadialGradient(
                burst.x, burst.y, 0,
                burst.x, burst.y, expandRadius
            );
            grad.addColorStop(0, rgba(CONFIG.COLORS.CYAN, intensity * 0.2));
            grad.addColorStop(0.5, rgba(CONFIG.COLORS.CYAN, intensity * 0.06));
            grad.addColorStop(1, rgba(CONFIG.COLORS.CYAN, 0));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(burst.x, burst.y, expandRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* ========== VIGNETTE ========== */
    function drawVignette() {
        const grad = ctx.createRadialGradient(
            width / 2, height / 2, height * 0.3,
            width / 2, height / 2, Math.max(width, height) * 0.8
        );
        grad.addColorStop(0, 'rgba(7,7,13,0)');
        grad.addColorStop(1, 'rgba(7,7,13,0.5)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    /* ========== MAIN LOOP ========== */
    function loop(timestamp) {
        const dt = Math.min(timestamp - (loop.lastTime || timestamp), 32);
        loop.lastTime = timestamp;
        time += dt;

        // Clear (transparent — body bg shows through)
        ctx.clearRect(0, 0, width, height);

        // Layers (back to front)
        drawNebula();
        drawDataWave();

        // Update bursts
        updateBursts(dt);
        drawBursts();

        // Update nodes
        for (const node of nodes) {
            node.update(dt);
        }

        // Draw connections (behind nodes)
        drawConnections();

        // Draw nodes sorted by depth (back first)
        const sorted = nodes.slice().sort((a, b) => a.depth - b.depth);
        for (const node of sorted) {
            node.draw();
        }

        // Cursor glow on top
        drawCursorGlow();

        animId = requestAnimationFrame(loop);
    }

    /* ========== LIFECYCLE ========== */
    function destroy() {
        if (animId) cancelAnimationFrame(animId);
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', destroy);

})();
