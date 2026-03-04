// Simple slideshow controller
document.addEventListener('DOMContentLoaded', function () {
    // remove the temporary class that disables transitions so animations
    // resume after the initial paint and we avoid the page fade-in effect
    try { document.documentElement.classList.remove('no-transitions'); } catch (e) {}
    const slides = document.querySelectorAll('.hero .slide');
    let idx = 0;
    function ensureBg(slide) {
        try {
            if (slide.dataset && slide.dataset.bg && !slide.dataset.bgLoaded) {
                const src = slide.dataset.bg;
                const img = new Image();
                img.src = src;
                img.onload = function () {
                    slide.style.backgroundImage = "url('" + src + "')";
                    slide.dataset.bgLoaded = '1';
                };
                // If image fails, still mark as attempted to avoid retry loops
                img.onerror = function () { slide.dataset.bgLoaded = '1'; };
            }
        } catch (e) { /* ignore */ }
    }

    // Lazy-load background images for any element with `data-bg`
    ;(function(){
        if (!('IntersectionObserver' in window)) return;
        const loadBg = (el)=>{
            if (!el || el.dataset.bgLoaded) return;
            const src = el.dataset.bg;
            if (!src) return;
            const img = new Image();
            img.onload = ()=>{
                el.style.backgroundImage = `url('${src}')`;
                el.dataset.bgLoaded = 'true';
            };
            img.src = src;
        };

        const io = new IntersectionObserver((entries, obs)=>{
            entries.forEach(entry=>{
                if (entry.isIntersecting) {
                    loadBg(entry.target);
                    obs.unobserve(entry.target);
                }
            });
        },{rootMargin: '200px'});

        document.querySelectorAll('[data-bg]').forEach(el=>{
            // if already has inline style (fallback) skip observing
            if (el.dataset.bgLoaded) return;
            // if element is already visible, load immediately
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight + 200 && rect.bottom > -200) {
                loadBg(el);
            } else {
                io.observe(el);
            }
        });
    })();

    function show(i) {
        slides.forEach((s, si) => {
            if (si === i) ensureBg(s);
            s.classList.toggle('active', si === i);
        });
    }

    // ensure the first slide's background is requested immediately
    show(0);
    // Hero slideshow interval set to 10s per user request
    setInterval(() => { idx = (idx + 1) % slides.length; show(idx); }, 10000);

    // --- Initialize any feature carousels on the page ---
    (function () {
        const carousels = document.querySelectorAll('.feature-carousel');
        if (!carousels.length) return;

        carousels.forEach(carousel => {
            const featureSlides = Array.from(carousel.querySelectorAll('.feature-slide'));
            const indicatorsRoots = Array.from(carousel.querySelectorAll('.feature-carousel-indicators'));
            // host element that may contain caption/controls (usually the surrounding <figure>)
            const host = (carousel.closest && carousel.closest('figure')) || carousel.parentElement || document;
            if (!featureSlides.length || !indicatorsRoots.length) return;

            let current = 0;
            let timer = null;
            const interval = 10000; // 10s per slide

            // build indicators for each indicators container (clear first to avoid duplicates)
            const buttonsSets = indicatorsRoots.map(root => {
                root.innerHTML = '';
                return featureSlides.map((s, i) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
                    b.dataset.index = String(i);
                    b.addEventListener('click', () => { go(i); restartTimer(); });
                    root.appendChild(b);
                    return b;
                });
            });

            // No explicit prev/next buttons for this carousel; navigation handled
            // via indicators and automatic timer.

            function render(index) {
                featureSlides.forEach((s, si) => s.classList.toggle('active', si === index));
                // Update all indicator sets
                buttonsSets.forEach(btns => btns.forEach((b, bi) => b.classList.toggle('active', bi === index)));
                current = index;

                // Update optional caption element (shows name under image) and description.
                // Caption/description may be siblings of the carousel (e.g., placed under the figure),
                // so search on the closest containing element rather than only inside `carousel`.
                try {
                    const host = (carousel.closest && carousel.closest('figure')) || carousel.parentElement || document;
                    const captionEl = host.querySelector('.carousel-caption');
                    const descEl = host.querySelector('.carousel-description');
                    const activeSlide = featureSlides[index];
                    const name = activeSlide && (activeSlide.dataset.name || activeSlide.getAttribute('aria-label') || (activeSlide.querySelector && activeSlide.querySelector('img') ? activeSlide.querySelector('img').alt : ''));
                    const desc = activeSlide && (activeSlide.dataset.description || (activeSlide.querySelector && activeSlide.querySelector('.sr-only') ? activeSlide.querySelector('.sr-only').textContent : ''));
                    if (captionEl) captionEl.textContent = name || '';
                    if (descEl) descEl.textContent = desc || '';
                } catch (e) { /* ignore caption/description updates if anything goes wrong */ }
            }

            function next() { render((current + 1) % featureSlides.length); }
            function go(i) { render(((i % featureSlides.length) + featureSlides.length) % featureSlides.length); }

            // carousel controls removed — manual prev/next buttons not present

            function isMobileView() {
                return window.innerWidth <= 600;
            }

            function restartTimer() {
                if (timer) clearInterval(timer);
                // only auto-rotate on larger screens; mobile users swipe
                if (!isMobileView()) {
                    timer = setInterval(next, interval);
                }
            }

            // pause on hover for better UX (desktop only)
            carousel.addEventListener('pointerenter', () => { if (timer) clearInterval(timer); });
            carousel.addEventListener('pointerleave', () => { restartTimer(); });

            // swipe support for touch devices
            let touchStartX = 0;
            carousel.addEventListener('touchstart', e => {
                touchStartX = e.touches[0].clientX;
            });
            carousel.addEventListener('touchend', e => {
                const dx = e.changedTouches[0].clientX - touchStartX;
                if (Math.abs(dx) > 40) {
                    if (dx < 0) go(current + 1);
                    else go(current - 1);
                }
            });

            // keyboard: allow left/right keys when indicators are focused
            carousel.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') { go(current - 1); restartTimer(); }
                if (e.key === 'ArrowRight') { go(current + 1); restartTimer(); }
            });

            // initialize
            render(0);

            // If this carousel is inside the #about section, defer auto-rotation
            // until the section is fully in view (i.e. effectively the only
            // section visible). Otherwise start immediately.
            const aboutSection = document.getElementById('about');
            const isInAbout = aboutSection && aboutSection.contains(carousel);

            if (!isInAbout) {
                restartTimer();
            } else {
                // pause (no timer started yet) and observe the about section
                let started = false;

                const ctrl = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        // Use intersectionRatio for visibility. Start when >=75%, pause when <50%.
                        const ratio = (typeof entry.intersectionRatio === 'number') ? entry.intersectionRatio : 0;

                        if (ratio >= 0.75 && !started) {
                            restartTimer();
                            started = true;
                        } else if (ratio < 0.5 && started) {
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            started = false;
                        }
                    });
                }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

                ctrl.observe(aboutSection);
            }
        });
    })();

    // Mobile-only: trigger #about slide animation when the user scrolls onto the section
    (function () {
        if (window.innerWidth > 700) return; // only for phones
        const about = document.getElementById('about');
        if (!about) return;

        // Wait until the user has scrolled (to avoid auto-playing on load)
        let userHasScrolled = false;
        function markScrolled() {
            userHasScrolled = true;
            window.removeEventListener('scroll', markScrolled);
        }
        window.addEventListener('scroll', markScrolled, { passive: true });

        // Add the mobile-animate class only when the section intersects and
        // the user has started scrolling.
        const io = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!userHasScrolled) return;
                if (entry.isIntersecting) {
                    about.classList.add('mobile-animate');
                    obs.unobserve(about);
                }
            });
        }, { threshold: 0.25 });

        io.observe(about);
    })();

    // Ensure the hero-cards element is moved out of the hero and placed
    // directly after the hero on small screens so it does not overlap the
    // hero content or the fixed header. On larger viewports restore the
    // original DOM position (inside the hero) so desktop layout remains.
    (function () {
        const cards = document.querySelector('.hero-cards');
        const hero = document.querySelector('#hero');
        if (!cards || !hero) return;

        // Remember the original place so we can restore it later
        const originalParent = cards.parentNode;
        const originalNext = cards.nextSibling; // may be null

        const breakpoint = 600;

        function relocate() {
            const isMobile = window.innerWidth <= breakpoint;
            if (isMobile) {
                // If cards are still inside hero, move them after the hero
                if (cards.parentNode === hero) {
                    hero.parentNode.insertBefore(cards, hero.nextSibling);
                }
                // Clear any inline positioning leftover
                cards.style.position = '';
                cards.style.top = '';
                cards.style.left = '';
                cards.style.transform = '';
                cards.style.width = '';
                cards.style.zIndex = '';
            } else {
                // Restore to original location if it's not already there
                if (cards.parentNode !== originalParent) {
                    if (originalNext) originalParent.insertBefore(cards, originalNext);
                    else originalParent.appendChild(cards);
                }
            }
        }

        let tRel;
        window.addEventListener('resize', function () { clearTimeout(tRel); tRel = setTimeout(relocate, 120); });
        // Run on load after a short delay so images/layout have settled
        setTimeout(relocate, 140);
    })();

    // Give brief active feedback for the 'Join us' outline button (doesn't persist)
    const joinBtn = document.querySelector('.btn-join');
    if (joinBtn) {
        // on pointerdown show the active state immediately for tactile feedback
        joinBtn.addEventListener('pointerdown', function () { this.classList.add('active'); });
        // remove active state shortly after click so it doesn't persist across pages
        joinBtn.addEventListener('click', function () {
            const el = this;
            setTimeout(() => el.classList.remove('active'), 450);
        });
        // also remove on blur for keyboard users
        joinBtn.addEventListener('blur', function () { this.classList.remove('active'); });
    }

    // Provide short-lived active feedback for card buttons (learn more / watch now)
    const cardBtns = document.querySelectorAll('.card-btn');
    if (cardBtns.length) {
        cardBtns.forEach(btn => {
            // immediate feedback on pointerdown
            btn.addEventListener('pointerdown', function () { this.classList.add('active'); });

            // remove active state shortly after click so it doesn't remain when navigating
            btn.addEventListener('click', function () {
                const el = this;
                setTimeout(() => el.classList.remove('active'), 450);
            });

            // keyboard support: add active on keydown (Enter/Space) and remove on keyup/blur
            btn.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') this.classList.add('active');
            });
            btn.addEventListener('keyup', function () { this.classList.remove('active'); });
            btn.addEventListener('blur', function () { this.classList.remove('active'); });
        });
    }

    // Add touch-specific active class to ensure the white sweep is shown and
    // text turns black reliably on mobile devices (some browsers don't honor :active).
    if (cardBtns.length) {
        cardBtns.forEach(btn => {
            btn.addEventListener('touchstart', function (e) {
                this.classList.add('touch-active');
            }, { passive: true });

            btn.addEventListener('touchend', function (e) {
                const el = this;
                // keep the state briefly so the sweep is visible
                setTimeout(() => el.classList.remove('touch-active'), 420);
            }, { passive: true });

            // pointerup fallback for devices/browsers that use pointer events
            btn.addEventListener('pointerup', function () {
                const el = this;
                setTimeout(() => el.classList.remove('touch-active'), 320);
            });
        });
    }

    // scroll-triggered animations for the "about" feature sections
    // Behaviour: animations run on scroll, and if the page loads with the
    // section already visible we trigger the animation immediately and
    // ensure the elements do not vanish after a refresh on desktop.
    (function () {
        const first = document.querySelector('.feature.indicators-right.slide-left');
        const second = document.querySelector('.feature.reverse.slide-right');
        if (!first && !second) return;

        // don't run animations until the user has interacted with the page by scrolling
        let userHasScrolled = false;
        function markScrolled() {
            userHasScrolled = true;
            window.removeEventListener('scroll', markScrolled);
        }
        window.addEventListener('scroll', markScrolled, { passive: true });

        function isMobileView() { return window.innerWidth <= 700; }

        function isElementInViewport(el) {
            if (!el || !el.getBoundingClientRect) return false;
            const rect = el.getBoundingClientRect();
            return (rect.top < (window.innerHeight || document.documentElement.clientHeight)) && (rect.bottom > 0);
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const el = entry.target;
                const persist = el.classList.contains('persist-visible');

                // If the element was present on load and marked to persist, treat it as intersecting
                if (!userHasScrolled && !persist && !entry.isIntersecting) return;

                if (entry.isIntersecting || persist) {
                    el.classList.remove('out-view');
                    el.classList.add('in-view');

                    if (el === first && second) {
                        if (isMobileView()) {
                            second.classList.remove('in-view');
                        } else {
                            setTimeout(() => second.classList.add('in-view'), 1200);
                        }
                    }

                    if (el === second && first && isMobileView()) {
                        first.classList.remove('in-view');
                    }
                } else {
                    // leaving viewport: on desktop/tablet remove in-view and add out-view
                    // unless the element was explicitly marked to persist (loaded visible)
                    if (!isMobileView()) {
                        if (!el.classList.contains('persist-visible')) {
                            el.classList.remove('in-view');
                            el.classList.add('out-view');
                        }
                    } else {
                        // Mobile: keep visible
                    }
                }
            });
        }, { threshold: 0.35, rootMargin: '0px 0px -60px 0px' });

        if (first) observer.observe(first);
        if (second) observer.observe(second);

        // If the page loaded with the section already visible, trigger animation immediately
        try {
            if (isElementInViewport(first)) {
                userHasScrolled = true;
                first.classList.add('persist-visible');
                first.classList.add('in-view');
                if (second) {
                    if (isMobileView()) {
                        second.classList.remove('in-view');
                    } else {
                        setTimeout(() => second.classList.add('in-view'), 1200);
                    }
                }
            } else if (isElementInViewport(second)) {
                userHasScrolled = true;
                second.classList.add('persist-visible');
                second.classList.add('in-view');
                if (first && isMobileView()) first.classList.remove('in-view');
            }
        } catch (e) { /* ignore DOM timing issues */ }
    })();

        // One-time slide-in for the Latest Message text (`.video-info`)
        // Trigger only when the entire `#latest-message` section is fully visible
        (function () {
            const section = document.getElementById('latest-message');
            const el = section && section.querySelector('.video-info');
            if (!section || !el) return;

            let didAnimate = false;

            const io = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (didAnimate) return;

                    // On small screens require only partial visibility (50%) so
                    // the animation can run when the section is visible enough
                    // within the phone viewport. On larger screens require the
                    // whole section to be inside the viewport.
                    const isMobile = window.innerWidth <= 700;

                    // bounding rect check for full visibility
                    const rect = entry.boundingClientRect || section.getBoundingClientRect();
                    const fullyVisible = rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);

                    // intersectionRatio fallback (observer thresholds include 0.5)
                    const mostlyVisible = (typeof entry.intersectionRatio === 'number') ? entry.intersectionRatio >= 0.5 : false;

                    const shouldAnimate = entry.isIntersecting && (isMobile ? mostlyVisible : fullyVisible);

                    if (shouldAnimate) {
                        didAnimate = true;
                        el.classList.add('slide-in');

                        const onEnd = () => {
                            el.classList.add('animated-in');
                            el.removeEventListener('animationend', onEnd);
                        };
                        el.addEventListener('animationend', onEnd);

                        io.unobserve(section);
                    }
                });
            }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

            io.observe(section);
        })();

        // scroll-triggered animation for featured ministries cards
        (function () {
            const section = document.getElementById('featured-ministries');
            if (!section) return;
            let didAnimate = false;
            const io2 = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (didAnimate) return;
                    if (entry.isIntersecting) {
                        didAnimate = true;
                        section.classList.add('animate');
                        io2.unobserve(section);
                    }
                });
            }, { threshold: 0.25 });
            io2.observe(section);
        })();

        // slide-in animation for meet-leaders section
        (function () {
            const section = document.getElementById('meet-leaders');
            if (!section) return;
            let ran = false;
            const observer3 = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (ran) return;
                    if (entry.isIntersecting) {
                        ran = true;
                        section.classList.add('animate');
                        observer3.unobserve(section);
                    }
                });
            }, { threshold: 0.25 });
            observer3.observe(section);
        })();

    // previous code synced flip-card height to its back panel, causing the card to resize
    // whenever the page loaded or the content changed.  This behaviour is no longer
    // desired so the function is now a no-op.  The card will size according to its
    // image and CSS rules instead.
    function syncFlipCardHeight() {
        // intentionally empty
    }

    // Enable tap/click and keyboard toggling for the value flip-cards.
    // Behavior: tap/click toggles the clicked card, press Escape or click outside to close.
    (function installValueCardFlip() {
        const cards = Array.from(document.querySelectorAll('.value-card'));
        if (!cards.length) return;

        function closeAll(except) {
            cards.forEach(c => { if (c !== except) c.classList.remove('is-flipped'); });
        }

        cards.forEach(card => {
            // Ensure the card is keyboard-focusable (figure already has tabindex)
            card.addEventListener('click', (e) => {
                // If an interactive element inside the card was clicked, ignore
                const target = e.target;
                if (target && (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest && target.closest('a,button'))) return;

                const willFlip = !card.classList.contains('is-flipped');
                if (willFlip) {
                    closeAll(card);
                    card.classList.add('is-flipped');
                    card.setAttribute('aria-pressed', 'true');
                } else {
                    card.classList.remove('is-flipped');
                    card.setAttribute('aria-pressed', 'false');
                }
            });

            // keyboard support: Enter / Space toggles, Escape closes
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                } else if (e.key === 'Escape' || e.key === 'Esc') {
                    card.classList.remove('is-flipped');
                }
            });
        });

        // close flipped card when clicking outside
        document.addEventListener('click', (e) => {
            const inCard = e.target && e.target.closest && e.target.closest('.value-card');
            if (!inCard) closeAll();
        });

        // also close on Escape globally
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Esc') closeAll(); });
    })();

    // Desktop-only: drive `.hero-cards` transform based on scroll position so
    // the drop animation follows the user's scroll velocity precisely instead
    // of relying on a fixed CSS transition duration which can feel jumpy.
    (function () {
        const hero = document.getElementById('hero');
        const cards = document.querySelector('.hero-cards');
        const header = document.querySelector('.site-header');
        if (!hero || !cards || !header) return;

        const breakpoint = 900; // only active on desktop and up
        let ticking = false;

        function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

        function update() {
            ticking = false;
            if (window.innerWidth < breakpoint) {
                // restore default CSS behavior on smaller screens
                cards.classList.remove('detached');
                cards.style.transform = '';
                cards.style.willChange = '';
                cards.style.transition = '';
                return;
            }

            const heroRect = hero.getBoundingClientRect();
            const headerHeight = header.getBoundingClientRect().height;

            // Use the CTA bottom as the primary trigger so cards begin to move
            // when the hero CTAs approach the header.
            const cta = hero.querySelector('.hero-cta') || document.querySelector('.hero-cta');
            let triggerBottom = heroRect.bottom;
            try {
                if (cta && cta.getBoundingClientRect) {
                    triggerBottom = cta.getBoundingClientRect().bottom;
                }
            } catch (e) { /* ignore and fallback to hero bottom */ }

            // Range values must match the CSS overlap values used in responsive.css
            const range = (window.innerWidth >= 1400) ? 200 : 160;
            const offset = headerHeight + 6; // point where cards should be fully detached

            // Compute a normalized progress value [0..1] where 1 = fully overlapped
            // (translateY = -range) and 0 = fully detached (translateY = 0).
            const raw = (triggerBottom - offset) / range;
            const progress = clamp(raw, 0, 1);
            const translateY = -Math.round(range * progress);

            // Apply transform directly for frame-accurate motion. Disable CSS
            // transition while driving transform from scroll to avoid the fixed timing.
            cards.style.transition = 'transform 0s';
            cards.style.willChange = 'transform';
            cards.style.transform = `translateY(${translateY}px)`;

            // Keep the `.detached` class for other style rules; consider detached
            // when progress is effectively zero (fully scrolled into header).
            if (progress <= 0.001) cards.classList.add('detached');
            else cards.classList.remove('detached');
        }

        function onScroll() {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', function () { requestAnimationFrame(update); });
        // Run once after layout settles
        setTimeout(() => requestAnimationFrame(update), 120);
    })();

    // height syncing disabled; no listeners registered.
    // window.addEventListener('load', syncFlipCardHeight);
    // window.addEventListener('resize', () => { setTimeout(syncFlipCardHeight, 100); });
    // Overseers slider (two slides) — previous / next buttons navigate slides
    (function () {
        const slider = document.querySelector('.overseer-slides');
        if (!slider) return;
        const slides = Array.from(slider.querySelectorAll('.overseer-slide'));
        const btnPrev = document.querySelector('.overseer-prev');
        const btnNext = document.querySelector('.overseer-next');
        let index = slides.findIndex(s => s.classList.contains('active'));
        if (index < 0) index = 0;

        function show(i) {
            i = ((i % slides.length) + slides.length) % slides.length;
            slides.forEach((s, si) => s.classList.toggle('active', si === i));
            index = i;
        }

        if (btnPrev) btnPrev.addEventListener('click', () => show(index - 1));
        if (btnNext) btnNext.addEventListener('click', () => show(index + 1));

        // keyboard support
        slider.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') show(index - 1);
            if (e.key === 'ArrowRight') show(index + 1);
        });
    })();

    // allow mobile users to tap a flip-card and keep it flipped so they can
    // scroll the biography content without it reverting when the touch ends.
    (function () {
        const cards = document.querySelectorAll('.flip-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                // only toggle on narrow viewports so desktop hover still works
                if (window.matchMedia('(max-width: 700px)').matches) {
                    card.classList.toggle('flipped');
                }
            });
        });
    })();

    // Belief question handlers (yes/no buttons)
    const yesBtn = document.getElementById('belief-yes');
    const noBtn = document.getElementById('belief-no');
    const beliefMsg = document.getElementById('belief-msg');
    function displayBelief(choice) {
        if (!beliefMsg) return;

        // Toggle visual active state on the buttons so selection persists
        try {
            if (choice === 'yes') {
                yesBtn && yesBtn.classList.add('active');
                noBtn && noBtn.classList.remove('active');
                yesBtn && yesBtn.setAttribute('aria-pressed', 'true');
                noBtn && noBtn.setAttribute('aria-pressed', 'false');
            } else {
                noBtn && noBtn.classList.add('active');
                yesBtn && yesBtn.classList.remove('active');
                noBtn && noBtn.setAttribute('aria-pressed', 'true');
                yesBtn && yesBtn.setAttribute('aria-pressed', 'false');
            }
        } catch (e) { /* ignore DOM timing errors */ }

        if (choice === 'yes') {
            beliefMsg.textContent = 'You are on the right path.';
            beliefMsg.classList.remove('error');
            beliefMsg.classList.add('success');
        } else {
            // show encouragement, then fade and remove
            beliefMsg.textContent = 'God loves you deeply – Jesus Christ came to save us. Learn more about Him.';
            beliefMsg.classList.remove('success');
            beliefMsg.classList.add('error');
            // wait before starting fade so user can read
            setTimeout(() => {
                if (beliefMsg) {
                    beliefMsg.classList.add('fade-out');
                    // when animation finishes, clear text and reset classes
                    beliefMsg.addEventListener('animationend', function handler() {
                        beliefMsg.textContent = '';
                        beliefMsg.classList.remove('error', 'fade-out');
                        beliefMsg.removeEventListener('animationend', handler);
                    });
                }
            }, 2000); // begin fade after 2 seconds
        }
    }

    // Ensure buttons are accessible and maintain pressed state visually
    if (yesBtn) {
        yesBtn.setAttribute('role', 'button');
        yesBtn.setAttribute('aria-pressed', 'false');
        yesBtn.addEventListener('click', () => displayBelief('yes'));
    }
    if (noBtn) {
        noBtn.setAttribute('role', 'button');
        noBtn.setAttribute('aria-pressed', 'false');
        noBtn.addEventListener('click', () => displayBelief('no'));
    }

    // Responsive tweak: on very small screens replace the first two
    // hero card button labels with concise section labels so they're
    // readable (phone-only). Restores original labels on larger viewports.
    (function () {
        const breakpoint = 600; // use 600px so all phone widths apply
        const cards = document.querySelectorAll('.hero-cards .card');
        if (!cards || !cards.length) return;

        function applyLabels() {
            const isMobile = window.innerWidth <= breakpoint;
            cards.forEach((card, idx) => {
                const span = card.querySelector('.card-btn span');
                if (!span) return;
                // store original text once so we can restore later
                if (typeof span.dataset.orig === 'undefined') span.dataset.orig = span.textContent.trim();
                if (isMobile) {
                    if (idx === 0) span.textContent = 'Sunday Services';
                    else if (idx === 1) span.textContent = 'Weekly Services';
                } else {
                    // restore
                    span.textContent = span.dataset.orig || span.textContent;
                }
            });
        }

        // debounce resize so we don't run frequently during drags
        let t = null;
        window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(applyLabels, 120); });
        // apply on load
        applyLabels();
    })();

    // Move hero-cards visually under the fixed header on small screens so
    // they do not overlap the hero imagery. We use inline styles set by JS
    // (computed from the header height) so the cards sit directly beneath
    // the header on phones and restore to natural flow on larger viewports.
    (function () {
        const cards = document.querySelector('.hero-cards');
        const header = document.querySelector('.site-header');
        if (!cards || !header) return;

        function update() {
            const isMobile = window.innerWidth <= 600;
            if (isMobile) {
                // Let the CSS media queries handle placement on small screens so
                // the hero cards appear in normal document flow (directly below
                // the hero) instead of being fixed to the viewport.
                cards.style.position = '';
                cards.style.top = '';
                cards.style.left = '';
                cards.style.transform = '';
                cards.style.width = '';
                cards.style.zIndex = '';
                document.documentElement.style.removeProperty('--hero-cards-spacer');
                document.body.style.paddingTop = '';
            } else {
                // On larger viewports we also clear inline styles so the
                // stylesheet's absolute positioning can control the layout.
                cards.style.position = '';
                cards.style.top = '';
                cards.style.left = '';
                cards.style.transform = '';
                cards.style.width = '';
                cards.style.zIndex = '';
                document.documentElement.style.removeProperty('--hero-cards-spacer');
                document.body.style.paddingTop = '';
            }
        }

        let t;
        window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(update, 120); });
        // run after a short delay so styles have settled (and images loaded)
        setTimeout(update, 120);
    })();

    // Move the Latest Message CTA under the video thumbnail on mobile
    (function () {
        const section = document.getElementById('latest-message');
        if (!section) return;

        const videoCard = section.querySelector('.video-card');
        const videoInfo = section.querySelector('.video-info');
        if (!videoCard || !videoInfo) return;

        const cta = videoInfo.querySelector('.btn.btn-dark');
        if (!cta) return;

        const originalParent = cta.parentNode;
        const originalNext = cta.nextSibling;

        const breakpoint = 700;
        let resizeTimer = null;

        function placeCTA() {
            const isMobile = window.innerWidth <= breakpoint;

            if (isMobile) {
                // Move CTA to sit directly after the video-card
                if (cta.parentNode !== videoCard.parentNode || cta.previousElementSibling !== videoCard) {
                    // insert after videoCard
                    const parent = videoCard.parentNode;
                    parent.insertBefore(cta, videoCard.nextSibling);
                    cta.classList.add('mobile-cta');
                }
            } else {
                // Restore CTA to its original location inside .video-info
                if (cta.parentNode !== originalParent) {
                    if (originalNext) originalParent.insertBefore(cta, originalNext);
                    else originalParent.appendChild(cta);
                }
                cta.classList.remove('mobile-cta');
            }
        }

        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(placeCTA, 120);
        });

        // Run once after layout settles
        setTimeout(placeCTA, 120);
    })();

    // Hide header when scrolling down and keep it hidden until the very top
    (function () {
        const header = document.querySelector('.site-header');
        if (!header) return;
        const mbn = document.querySelector('.mobile-bottom-nav');
        const mbnFab = document.querySelector('.mobile-bottom-nav .mbn-fab') || document.querySelector('.mbn-fab');
        // Determine if the pill should always be visible on some pages
        const _pathName = (window.location.pathname || '').split('/').pop() || '';
        const _path = _pathName.toLowerCase();
        const desktopAlwaysOn = (window.innerWidth >= 1000) && !(_path === '' || _path === 'index.html');
        // mobile always-on pages list
        const mobileAlwaysOn = (_path === 'contact.html' || _path === 'give.html');
        function setBottomNavVisible(visible) {
            if (!mbn && !mbnFab) return;
            // always show on desktop non-home pages
            if (desktopAlwaysOn) {
                mbn && mbn.classList.add('mbn-visible');
                mbnFab && mbnFab.classList.add('mbn-visible');
                return;
            }
            // always show on the specified mobile pages regardless of scroll
            if (mobileAlwaysOn) {
                mbn && mbn.classList.add('mbn-visible');
                mbnFab && mbnFab.classList.add('mbn-visible');
                return;
            }
            if (visible) {
                mbn && mbn.classList.add('mbn-visible');
                mbnFab && mbnFab.classList.add('mbn-visible');
            } else {
                mbn && mbn.classList.remove('mbn-visible');
                mbnFab && mbnFab.classList.remove('mbn-visible');
            }
        }
        let lastY = window.scrollY || 0;
        const hideThreshold = 50; // start hiding after this scroll amount

        // If the page loads with a scrolled position (e.g. after refresh or
        // a direct anchor), keep the header hidden until the user scrolls
        // back to the very top. This ensures a refresh doesn't force the
        // nav into view unexpectedly.
        if (desktopAlwaysOn || mobileAlwaysOn) {
            // ensure visible immediately on these special pages
            setBottomNavVisible(true);
        } else if ((window.scrollY || 0) > hideThreshold) {
            header.classList.add('header-hidden');
            setBottomNavVisible(true);
        }

        window.addEventListener('scroll', () => {
            const currentY = window.scrollY || 0;

            // always show at the very top (near 0)
            if (currentY <= 10) {
                header.classList.remove('header-hidden');
                setBottomNavVisible(false);
                lastY = currentY;
                return;
            }

            // if user scrolls down past the hideThreshold, hide the header
            if (currentY - lastY > 10 && currentY > hideThreshold) {
                header.classList.add('header-hidden');
                setBottomNavVisible(true);
            }

            // Do NOT show the header on small upward scrolls — keep it hidden
            // until the user returns to the very top of the page.

            lastY = currentY;
        }, { passive: true });
    })();

    // Header entrance animation: slide down, stagger nav items, blur-to-clear
    (function () {
        const header = document.querySelector('.site-header');
        if (!header) return;

        const logo = header.querySelector('.logo');
        const navItems = Array.from(header.querySelectorAll('.main-nav > ul > li'));
        const giveBtn = header.querySelector('.btn-give');

        // ensure nav starts in initial (hidden) visual state
        header.classList.remove('nav-entered');

        function applyStagger() {
            // remove staggering; all items use the same delay so they animate in unison
            const commonDelay = '80ms';
            navItems.forEach((li) => {
                // give explicit transition rules so delays work consistently
                li.style.transition = 'transform 620ms cubic-bezier(.08,.82,.165,1), opacity 520ms ease, filter 620ms ease';
                li.style.transitionDelay = commonDelay;
                li.style.pointerEvents = 'none';
            });

            if (logo) {
                logo.style.transition = 'transform 620ms cubic-bezier(.08,.82,.165,1), opacity 520ms ease, filter 620ms ease';
                logo.style.transitionDelay = commonDelay;
                logo.style.pointerEvents = 'none';
            }

            if (giveBtn) {
                giveBtn.style.transition = 'transform 620ms cubic-bezier(.08,.82,.165,1), opacity 520ms ease, filter 620ms ease';
                giveBtn.style.transitionDelay = commonDelay;
                giveBtn.style.pointerEvents = 'none';
            }
        }

        function run() {
            // enable interactions and reveal
            navItems.forEach(li => li.style.pointerEvents = 'auto');
            if (logo) logo.style.pointerEvents = 'auto';
            if (giveBtn) giveBtn.style.pointerEvents = 'auto';
            header.classList.add('nav-entered');
        }

        // If header is initially hidden due to page scroll, wait until it becomes visible
        if (header.classList.contains('header-hidden') && (window.scrollY || 0) > 10) {
            const onScroll = () => {
                if ((window.scrollY || 0) <= 10) {
                    applyStagger();
                    setTimeout(run, 80);
                    window.removeEventListener('scroll', onScroll);
                }
            };
            window.addEventListener('scroll', onScroll, { passive: true });
        } else {
            // run a short time after paint to avoid FOUC
            applyStagger();
            setTimeout(run, 120);
        }
    })();

    // Scroll-down button: smooth scroll to next major section (meet-leaders)
    (function () {
        const down = document.getElementById('scroll-down');
        if (!down) return;

        // Prevent multiple rapid scroll attempts from interfering with smooth scroll
        let isAutoScrolling = false;

        // Helper to compute header height (if present) so we don't hide content behind it
        function getHeaderHeight() {
            const h = document.querySelector('.site-header');
            return h ? Math.round(h.getBoundingClientRect().height) : 0;
        }

        // Compute and scroll to the target section (recomputed each click so it works repeatedly)
        function scrollToNextSection() {
            if (isAutoScrolling) return;
            const target = document.querySelector('.meet-leaders') || document.querySelector('main > section:nth-of-type(2)');
            if (!target) return;
            const headerHeight = getHeaderHeight();
            const targetRect = target.getBoundingClientRect();
            const absoluteTop = Math.max(0, Math.round(window.scrollY + targetRect.top - headerHeight - 12)); // small offset

            // Start smooth scroll and set guard so repeated clicks won't interrupt
            isAutoScrolling = true;
            window.scrollTo({ top: absoluteTop, behavior: 'smooth' });

            // Clear guard once we've reached (or nearly reached) the destination, with a timeout fallback
            let checks = 0;
            const maxChecks = 80; // ~4s (80 * 50ms)
            const checker = setInterval(() => {
                const y = window.scrollY || window.pageYOffset;
                if (Math.abs(y - absoluteTop) < 6 || ++checks > maxChecks) {
                    clearInterval(checker);
                    isAutoScrolling = false;
                }
            }, 50);
        }

        // Use pointerdown for snappier response and click for accessibility
        down.addEventListener('pointerdown', function (e) { e.preventDefault(); scrollToNextSection(); });
        down.addEventListener('click', function (e) { e.preventDefault(); scrollToNextSection(); });
    })();

    // Flip-cards are handled via CSS on hover and focus for a simpler UX.
    // Keyboard users can focus a card (tab) and it will flip via the :focus rule.

    // Typing animation for hero title: cycles phrases, types and deletes
    (function () {
        const el = document.getElementById('typed');
        if (!el) return;

        // Allow per-element phrases via `data-phrases="Phrase A||Phrase B||Phrase C"`
        const defaultPhrases = [
            'Who we are...',
            'About us...',
            'Who we represent...',
            'Our values...',
            'Our pastorate...',
            'Our history ...'
        ];
        let phrases = defaultPhrases;
        try {
            const attr = el.dataset.phrases;
            if (attr && attr.trim()) {
                phrases = attr.split('||').map(s => s.trim()).filter(Boolean);
            }
        } catch (e) { phrases = defaultPhrases }

        const typeSpeed = 60; // ms per char
        const deleteSpeed = 40; // ms per char when deleting
        const pauseAfter = 1200; // pause after typing a phrase (default)

        // Start with the first phrase already visible, then delete it
        let phraseIndex = 0;
        let charIndex = phrases[0].length;
        let deleting = true;
        // show the initial phrase immediately
        el.textContent = phrases[0];

        function tick() {
            const current = phrases[phraseIndex];
            if (!deleting) {
                // type forward
                el.textContent = current.slice(0, charIndex + 1);
                charIndex++;
                if (charIndex === current.length) {
                    // pause then start deleting. Use a longer pause for the greeting.
                    deleting = true;
                    const pauseNow = (phraseIndex === 0) ? 2000 : pauseAfter;
                    setTimeout(tick, pauseNow);
                    return;
                }
                setTimeout(tick, typeSpeed + Math.random() * 40);
            } else {
                // deleting
                el.textContent = current.slice(0, charIndex - 1);
                charIndex--;
                if (charIndex === 0) {
                    deleting = false;
                    phraseIndex = (phraseIndex + 1) % phrases.length;
                    setTimeout(tick, 250);
                    return;
                }
                setTimeout(tick, deleteSpeed + Math.random() * 30);
            }
        }

        // start deletion after a short pause so the initial phrase is visible first
        setTimeout(tick, 1500);
    })();

    // Initialize marquee duration based on content width so speed feels constant
    (function () {
        const marquee = document.querySelector('.marquee');
        const track = document.querySelector('.marquee-track');
        if (!marquee || !track) return;

        // compute width of one group (we duplicated groups in markup)
        const group = track.querySelector('.marquee-group');
        if (!group) return;

        // Wait for fonts/images to load briefly then compute
        requestAnimationFrame(() => {
            const groupWidth = group.getBoundingClientRect().width;
            // base speed: pixels per second (adjustable)
            const pxPerSecond = 120; // larger = faster
            const duration = Math.max(12, Math.round((groupWidth / pxPerSecond)) );
            // set duration for animation to move by one group (we move 50% which equals one group)
            track.style.setProperty('--marquee-duration', duration + 's');
        });
    })();

    // handle any form with a submit button; show temporary sent state
    // NOTE: the contact form (id="contact-form") is handled separately via AJAX below.
    (function() {
        document.querySelectorAll('form').forEach(form => {
            // skip the contact form and any form that will be handled via AJAX (has data-endpoint)
            if (form.id === 'contact-form' || form.dataset.endpoint) return;
            const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
            if (!submitBtn) return;
            const span = submitBtn.querySelector('span');
            const defaultText = span ? span.textContent.trim() : '';

            form.addEventListener('submit', function(e) {
                e.preventDefault();
                // reset any existing state before applying new one
                submitBtn.classList.remove('sent');
                if (span) span.textContent = defaultText;

                // mimic send feedback
                submitBtn.classList.add('sent');
                if (span) span.textContent = 'Message sent';

                // revert after a short delay so user can send again
                setTimeout(() => {
                    submitBtn.classList.remove('sent');
                    if (span) span.textContent = defaultText;
                }, 3000);

                // TODO: add real submission logic (AJAX/fetch) here for other forms
            });
        });
    })();

    // Forms that declare a data-endpoint (AJAX -> Formspree or similar)
    (function() {
        const ajaxForms = document.querySelectorAll('form[data-endpoint]');
        if (!ajaxForms || !ajaxForms.length) return;

        ajaxForms.forEach(form => {
            const submitBtn = form.querySelector('button[type="submit"]');
            const span = submitBtn ? submitBtn.querySelector('span') : null;
            const defaultText = span ? span.textContent.trim() : '';

            form.addEventListener('submit', function(e) {
                e.preventDefault();
                const endpoint = form.dataset.endpoint || '';
                if (!endpoint || endpoint.indexOf('XXXXXXXX') !== -1) {
                    alert('Formspree endpoint not configured. Sign up at https://formspree.io and paste your form endpoint into the form "data-endpoint" attribute.');
                    return;
                }

                const formData = new FormData(form);
                // simple honeypot check
                if (formData.get('_gotcha')) return; // silently drop spam

                // update UI
                if (span) span.textContent = 'Sending...';
                if (submitBtn) submitBtn.disabled = true;

                fetch(endpoint, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                }).then(async res => {
                    if (res.ok) {
                        // show success state (matching previous behavior)
                        if (submitBtn) submitBtn.classList.add('sent');
                        if (span) span.textContent = 'Message sent';
                        form.reset();
                        setTimeout(() => {
                            if (submitBtn) submitBtn.classList.remove('sent');
                            if (span) span.textContent = defaultText;
                            if (submitBtn) submitBtn.disabled = false;
                        }, 3000);
                    } else {
                        const err = await res.json().catch(()=>({}));
                        throw err;
                    }
                }).catch(err => {
                    console.error('Send failed', err);
                    alert('Send failed — please try again later.');
                    if (span) span.textContent = defaultText;
                    if (submitBtn) submitBtn.disabled = false;
                });
            });
        });
    })();

    // Find Us button: open Google Maps directions from entered postcode to church address
    (function () {
        const findBtn = document.getElementById('find-us-btn');
        const postcodeInput = document.getElementById('postcode');
        const churchAddress = 'Palmer Avenue, Kingsfarm, Gravesend, Kent DA12 5DQ, United Kingdom';
        if (!findBtn || !postcodeInput) return;

        findBtn.addEventListener('click', function () {
            const origin = postcodeInput.value.trim();
            // If no postcode provided, open the church location in maps
            let url;
            if (!origin) {
                url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(churchAddress);
            } else {
                // Use Google Maps Directions with origin (user postcode) and destination church address
                url = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(origin) + '&destination=' + encodeURIComponent(churchAddress) + '&travelmode=driving';
            }
            window.open(url, '_blank');
        });
    })();

    // Find Evangelism Location: update embedded map to show directions from postcode to evangelism address
    (function () {
        const evBtn = document.getElementById('ev-find-btn');
        const evInput = document.getElementById('ev-postcode');
        const evMapIframe = document.querySelector('#evangelism-location .map-card iframe');
        const evDestination = "McDonald's, 85/87 New Rd, Gravesend DA11 0AF, United Kingdom";
        if (!evBtn || !evInput || !evMapIframe) return;

        evBtn.addEventListener('click', function () {
            const origin = evInput.value.trim();
            let src;
            if (!origin) {
                // show destination location centered
                src = 'https://www.google.com/maps?q=' + encodeURIComponent("DA11 0AF Gravesend") + '&z=17&output=embed';
            } else {
                // attempt to load directions into the iframe using the directions URL (works in many browsers)
                src = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(origin) + '&destination=' + encodeURIComponent(evDestination) + '&travelmode=walking&output=embed';
            }

            // update the iframe src so the embedded map shows the route
            evMapIframe.src = src;

            // also open a full maps directions page in a new tab for clearer step-by-step directions
            const openUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(origin || '') + '&destination=' + encodeURIComponent(evDestination) + '&travelmode=walking';
            window.open(openUrl, '_blank');
        });
    })();

    // Back to top button: show when scrolled down, smooth scroll to top on click
    (function () {
        const backBtn = document.getElementById('back-to-top');
        if (!backBtn) return;

        // const showAt = 200; // no longer used - show only when near page bottom
        const downBtn = document.getElementById('scroll-down');
        const hero = document.querySelector('.page-hero');

        function onScroll() {
            const y = window.scrollY || 0;
            // toggle back-to-top visibility only when user has scrolled close to the end
            const bottomThreshold = 100; // px from bottom
            const scrolledBottom = (y + window.innerHeight) >= (document.body.scrollHeight - bottomThreshold);
            if (scrolledBottom) backBtn.classList.add('visible'); else backBtn.classList.remove('visible');

            // hide the down button only when the hero is out of view (more robust than a fixed px threshold)
            if (downBtn) {
                let hideDown = false;
                if (hero) {
                    const rect = hero.getBoundingClientRect();
                    hideDown = rect.bottom <= 0 || y > rect.height;
                } else {
                    hideDown = scrolledBottom;                }
                if (hideDown) downBtn.classList.add('hidden'); else downBtn.classList.remove('hidden');
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        // initialize
        onScroll();

        backBtn.addEventListener('click', function () {
            // Smooth scroll to top only (no reload)
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    })();

    // Minimal site-only chatbot (bottom-left)
    (function () {
        const toggle = document.getElementById('chat-toggle');
        const windowEl = document.getElementById('chat-window');
        const closeBtn = document.getElementById('chat-close');
        const form = document.getElementById('chat-form');
        const input = document.getElementById('chat-input');
        const messages = document.getElementById('chat-messages');
        if (!toggle || !windowEl || !form || !input || !messages) return;

        // ---- Simple persistent memory (localStorage) ----
        const MEM_KEY = 'sg_assistant_memory_v1';
        function loadMemory() {
            try { return JSON.parse(localStorage.getItem(MEM_KEY)) || { recent: [] }; } catch (e) { return { recent: [] }; }
        }
        function saveMemory(mem) { try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ } }
        const memory = loadMemory();

        function rememberUserQuery(q) {
            if (!q) return;
            memory.recent = memory.recent || [];
            if (memory.recent[0] !== q) memory.recent.unshift(q);
            if (memory.recent.length > 12) memory.recent.length = 12;
            saveMemory(memory);
        }

        // ---- Build a lightweight knowledge index from page content ----
        let knowledgeIndex = [];
        function buildKnowledgeIndex() {
            const items = [];
            document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li').forEach(el => {
                const txt = (el.textContent || '').trim();
                if (txt.length > 30) { items.push({ text: txt, tag: el.tagName.toLowerCase() }); }
            });
            document.querySelectorAll('.card, .min-card, .video-info, .feature-content').forEach(el => {
                const txt = (el.innerText || el.textContent || '').trim(); if (txt && txt.length > 30) items.push({ text: txt, tag: 'card' });
            });
            document.querySelectorAll('.site-footer p, .site-footer h4').forEach(el => { const txt = (el.textContent || '').trim(); if (txt && txt.length > 10) items.push({ text: txt, tag: 'footer' }); });
            return items;
        }
        function refreshKnowledge() { knowledgeIndex = buildKnowledgeIndex(); }
        refreshKnowledge();

        function findMatches(query, limit = 3) {
            if (!query) return [];
            const q = query.toLowerCase().split(/\s+/).filter(Boolean);
            const scored = knowledgeIndex.map(item => {
                const text = item.text.toLowerCase(); let score = 0; q.forEach(w => { if (text.includes(w)) score += 1; }); if (q.length && text.includes(query.toLowerCase())) score += 2; return { item, score };
            }).filter(s => s.score > 0).sort((a,b) => b.score - a.score);
            return scored.slice(0, limit).map(s => s.item.text);
        }

        function escapeHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

        function appendMessage(payload, who = 'bot') {
            let text = '';
            let quick = null;
            if (typeof payload === 'string') text = payload; else if (payload && typeof payload === 'object') { text = payload.text || ''; quick = payload.quickReplies || null; }

            if (who === 'user') {
                const el = document.createElement('div'); el.className = 'chat-msg user'; el.textContent = text; messages.appendChild(el); messages.scrollTop = messages.scrollHeight; return;
            }

            const typingEl = document.createElement('div'); typingEl.className = 'chat-msg bot'; typingEl.innerHTML = '<div class="chat-text"><span class="chat-typing"><span class="typing-dots"><span></span><span></span><span></span></span></span></div>';
            messages.appendChild(typingEl); messages.scrollTop = messages.scrollHeight;

            const len = (text || '').replace(/<[^>]*>/g, '').length; const delay = Math.min(1100 + len * 20, 3200);
            setTimeout(() => {
                const el = document.createElement('div'); el.className = 'chat-msg bot'; el.innerHTML = '<div class="chat-text">' + (text || '') + '</div>';
                if (quick && Array.isArray(quick) && quick.length) {
                    const container = document.createElement('div'); container.className = 'chat-quick-replies'; quick.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chat-quick-reply'; b.textContent = q.label; b.dataset.href = q.href || q.target || ''; container.appendChild(b); }); el.appendChild(container);
                }
                messages.replaceChild(el, typingEl); messages.scrollTop = messages.scrollHeight;
            }, delay);
        }

        function findTextSnippet(keyword) { const matches = findMatches(keyword, 1); return (matches && matches.length) ? matches[0] : null; }

        function siteReply(userText) {
            const t = (userText || '').trim(); if (!t) return { text: "Can you type your question?" };
            rememberUserQuery(t);
            const low = t.toLowerCase();
            if (low.match(/^\s*(hi|hello|hey|good morning|good afternoon|good evening)\b/)) {
                const last = (memory.recent && memory.recent[1]) ? `Last time you asked about: "${memory.recent[1]}".` : '';
                return { text: `Hi — I\'m the SG Assistant. ${last} I can help with location, service times, ministries, giving, or opening pages. What would you like to do now?`, quickReplies: [{ label: 'Find us (map)', href: '#find-us' },{ label: 'Service times', href: 'new-here.html#what-to-expect' },{ label: 'Watch messages', href: 'https://www.youtube.com/@RCCGSolutionGroundKent' },{ label: 'Contact us', href: 'contact.html' }] };
            }

            if (low.match(/location|address|where|palmer|palmer avenue/)) {
                const el = document.getElementById('find-us'); if (el) { const addr = el.querySelector('.min-card p')?.innerText.trim() || el.innerText.trim(); return { text: `Our address is: ${addr}. Tap 'Open map' to view directions.`, quickReplies: [{ label: 'Open map', href: '#find-us' }] }; }
            }

            if (low.match(/service|sunday|time|times|services/)) { const matches = findMatches('sunday', 2); if (matches && matches.length) return { text: `Service times — ${matches.join(' \n\n')}`, quickReplies: [{ label: 'More about Sundays', href: 'new-here.html#what-to-expect' }] }; }

            if (low.match(/ministri|children|youth|groups|evangelism/)) {
                const cardEls = document.querySelectorAll('#featured-ministries .card');
                if (cardEls && cardEls.length) {
                    const items = Array.from(cardEls).map(card => { const titleEl = card.querySelector('.card-body h3'); const descEl = card.querySelector('.card-body p'); return { title: titleEl ? titleEl.textContent.trim() : 'Ministry', desc: descEl ? descEl.textContent.trim() : '', href: card.getAttribute('href') || 'children.html' }; });
                    const htmlLines = items.map(i => `<div style="margin-bottom:8px;"><a href="${escapeHtml(i.href)}" style="color:#9fd6ff;text-decoration:underline;">${escapeHtml(i.title)}</a> — ${escapeHtml(i.desc)}</div>`).join('');
                    return { text: `Here are the main groups and ministries:\n\n${htmlLines}`, quickReplies: items.slice(0,4).map(i => ({ label: i.title, href: i.href })) };
                }
            }

            if (low.match(/watch|online|youtube|live/)) { const el = document.querySelector('.video-thumb a') || document.querySelector('#latest-message a'); if (el) return { text: 'I can open recent messages or live streams for you. Tap below to view.', quickReplies: [{ label: 'Watch messages', href: el.href || el.getAttribute('href') }] }; }

            if (low.match(/contact|call|phone|email/)) { return { text: 'You can reach us via the Contact page or phone: 07491 644150. Would you like me to open the contact page?', quickReplies: [{ label: 'Open contact page', href: 'contact.html' }] }; }

            const words = t.split(/\s+/).slice(0, 6).map(w => w.replace(/[^a-z0-9]/gi, '')).filter(Boolean);
            const query = words.join(' ');
            if (query) { const matches = findMatches(query, 4); if (matches && matches.length) { const combined = matches.join('\n\n'); return { text: `I found this on the site that may help:\n\n${combined}` }; } }

            return { text: "Sorry — I can only provide information derived from this website. Try: 'Where are you?', 'Service times', 'Watch messages', or 'Contact'." };
        }

        function openChat() {
            windowEl.classList.remove('closing'); windowEl.setAttribute('aria-hidden', 'false'); windowEl.classList.add('opening');
            if (!messages.children.length) {
                const last = memory.recent && memory.recent[0];
                if (last) appendMessage({ text: `Welcome back — you last asked: "${escapeHtml(last)}". How can I help further?`, quickReplies: [{ label: 'Service times', href: 'new-here.html#what-to-expect' }, { label: 'Find us', href: '#find-us' }] });
                else appendMessage('Hi — I can answer questions about this site. Try: location, services, ministries, contact.');
            }
            const onEnd = (e) => { if (e.target !== windowEl) return; windowEl.classList.remove('opening'); windowEl.removeEventListener('animationend', onEnd); };
            windowEl.addEventListener('animationend', onEnd); input.focus();
        }

        function closeChat() { windowEl.classList.remove('opening'); windowEl.classList.add('closing'); const onEnd = (e) => { if (e.target !== windowEl) return; windowEl.classList.remove('closing'); windowEl.setAttribute('aria-hidden', 'true'); windowEl.removeEventListener('animationend', onEnd); }; windowEl.addEventListener('animationend', onEnd); }

        toggle.addEventListener('click', () => { const hidden = windowEl.getAttribute('aria-hidden') === 'true'; if (hidden) openChat(); else closeChat(); }); closeBtn.addEventListener('click', closeChat);

        form.addEventListener('submit', (e) => { e.preventDefault(); const text = input.value.trim(); if (!text) return; appendMessage(text, 'user'); input.value = ''; setTimeout(() => { const reply = siteReply(text); appendMessage(reply, 'bot'); }, 450); });

        messages.addEventListener('click', (e) => { const btn = e.target.closest('.chat-quick-reply'); if (!btn) return; const href = btn.dataset.href; if (!href) return; if (href.startsWith('http')) { window.open(href, '_blank'); return; } if (href.indexOf('.html') !== -1) { window.location.href = href; return; } if (href.startsWith('#')) { const target = document.querySelector(href); if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); windowEl.setAttribute('aria-hidden', 'true'); } return; } window.open(href, '_blank'); });

        const kdObserver = new MutationObserver(() => { refreshKnowledge(); }); kdObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

    })();

    // Insert mobile nav hamburger toggle beside the Give button and handle open/close
    (function () {
        const navWrap = document.querySelector('.nav-wrap');
        const give = navWrap && navWrap.querySelector('.btn-give');
        const mainNav = document.querySelector('.main-nav');
        if (!navWrap || !give || !mainNav) return;

        // ensure nav has an id for aria-controls
        if (!mainNav.id) mainNav.id = 'main-nav';

        // create toggle container (so styling can sit beside Give button)
        const container = document.createElement('span');
        container.className = 'nav-toggle';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'nav-toggle';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', mainNav.id);
        btn.setAttribute('aria-label', 'Open navigation menu');

        // hamburger simple bars
        const bar = document.createElement('span');
        bar.className = 'bar';
        btn.appendChild(bar);

        container.appendChild(btn);
        // insert after the Give button
        give.insertAdjacentElement('afterend', container);

        // --- Ensure 'Give' appears inside the mobile menu on small screens ---
        function syncGiveIntoNav() {
            try {
                const ul = mainNav.querySelector('ul');
                if (!ul) return;

                const existing = mainNav.querySelector('.nav-give');
                if (window.innerWidth <= 600) {
                    // create a nav item at the end if not present
                    if (!existing) {
                        const li = document.createElement('li');
                        li.className = 'nav-give';
                        const a = document.createElement('a');
                        a.className = 'mobile-nav-give';
                        a.href = give.getAttribute('href') || '#give';
                        a.innerHTML = give.innerHTML || 'Give';
                        li.appendChild(a);
                        ul.appendChild(li);
                    }
                    // hide the header give button on mobile (we show one inside the menu)
                    give.style.display = 'none';
                } else {
                    // remove cloned mobile give when returning to desktop
                    if (existing) existing.remove();
                    give.style.display = '';
                }
            } catch (e) { /* ignore DOM timing issues */ }
        }

        // sync on load and on resize
        syncGiveIntoNav();
        window.addEventListener('resize', function () { syncGiveIntoNav(); });

        function closeMenu() {
            document.body.classList.remove('mobile-nav-open');
            btn.setAttribute('aria-expanded', 'false');
        }

        function openMenu() {
            document.body.classList.add('mobile-nav-open');
            btn.setAttribute('aria-expanded', 'true');
        }

        btn.addEventListener('click', function (e) {
            const open = document.body.classList.toggle('mobile-nav-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
        });

            // create an in-menu close button (X) for the full-screen mobile sheet
            const closeInMenu = document.createElement('button');
            closeInMenu.type = 'button';
            closeInMenu.className = 'mobile-nav-close';
            closeInMenu.setAttribute('aria-label', 'Close menu');
            closeInMenu.innerHTML = '✕';
            // prepend to mainNav so it appears at the top
            mainNav.insertAdjacentElement('afterbegin', closeInMenu);
            closeInMenu.addEventListener('click', function (e) {
                e.stopPropagation();
                closeMenu();
            });

        // close menu when clicking outside the nav (on small screens)
        document.addEventListener('click', function (e) {
            if (!document.body.classList.contains('mobile-nav-open')) return;
            const target = e.target;
            if (navWrap.contains(target)) return; // click inside header
            // clicked outside header -> close
            closeMenu();
        }, { capture: true });

        // also collapse submenu if user right clicks anywhere outside an open item
        document.addEventListener('contextmenu', function(e) {
            if (!document.body.classList.contains('mobile-nav-open')) return;
            const target = e.target;
            // if click was on a dropdown link it is handled above; otherwise close all dropdowns
            if (target.closest('.has-dropdown')) return;
            const items = mainNav.querySelectorAll('.has-dropdown');
            items.forEach(li => {
                li.classList.remove('dropdown-open');
                const t = li.querySelector('.submenu-toggle');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
        });

        // Replace long-press with an explicit submenu toggle button (mobile).
        // This inserts a small arrow button for each `.has-dropdown` item and
        // toggles the submenu only when that button is pressed. The parent
        // link remains a normal link and will navigate immediately on tap.
        (function() {
            const dropdownItems = mainNav.querySelectorAll('.has-dropdown');
            if (!dropdownItems || !dropdownItems.length) return;

            function closeAllDropdowns(except) {
                dropdownItems.forEach(li => {
                    if (li !== except) {
                        li.classList.remove('dropdown-open');
                        const t = li.querySelector('.submenu-toggle');
                        if (t) t.setAttribute('aria-expanded', 'false');
                    }
                });
            }

            dropdownItems.forEach(li => {
                const link = li.querySelector('a');
                const dropdown = li.querySelector('.dropdown');
                if (!link) return;

                // create a visible toggle button for the submenu (if not present)
                if (!li.querySelector('.submenu-toggle')) {
                    const toggle = document.createElement('button');
                    toggle.type = 'button';
                    toggle.className = 'submenu-toggle';
                    toggle.setAttribute('aria-expanded', 'false');
                    toggle.setAttribute('aria-label', 'Open submenu');
                    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

                    if (dropdown) li.insertBefore(toggle, dropdown);
                    else link.insertAdjacentElement('afterend', toggle);

                    // explicit open/close behavior: click toggles this submenu only
                    toggle.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const isOpenNow = li.classList.contains('dropdown-open');
                        if (isOpenNow) {
                            li.classList.remove('dropdown-open');
                            toggle.setAttribute('aria-expanded', 'false');
                        } else {
                            closeAllDropdowns(li);
                            li.classList.add('dropdown-open');
                            toggle.setAttribute('aria-expanded', 'true');
                        }
                        // remove focus to avoid accidental keyboard re-triggers
                        try { toggle.blur(); } catch (err) {}
                    });

                    // pointerdown prevents the browser from treating the action as a press-hold
                    toggle.addEventListener('pointerdown', function(e) { e.preventDefault(); });

                    toggle.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.click();
                        } else if (e.key === 'Escape') {
                            li.classList.remove('dropdown-open');
                            toggle.setAttribute('aria-expanded', 'false');
                        }
                    });
                }

                // Keep contextmenu on desktop for convenience (right-click to open submenu)
                link.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    if (li.classList.contains('dropdown-open')) {
                        li.classList.remove('dropdown-open');
                        const t = li.querySelector('.submenu-toggle');
                        if (t) t.setAttribute('aria-expanded', 'false');
                    } else {
                        closeAllDropdowns(li);
                        li.classList.add('dropdown-open');
                        const t = li.querySelector('.submenu-toggle');
                        if (t) t.setAttribute('aria-expanded', 'true');
                    }
                });

                // Ensure tapping the parent link navigates immediately; if the
                // mobile sheet is open remove the class so the sheet hides.
                link.addEventListener('click', function() {
                    if (document.body.classList.contains('mobile-nav-open')) {
                        document.body.classList.remove('mobile-nav-open');
                        const navToggleBtn = document.getElementById('nav-toggle');
                        if (navToggleBtn) navToggleBtn.setAttribute('aria-expanded', 'false');
                    }
                });
            });

            // Close dropdowns when menu is closed (global click handler above will remove the sheet)
            document.addEventListener('click', function() {
                if (!document.body.classList.contains('mobile-nav-open')) {
                    dropdownItems.forEach(li => {
                        li.classList.remove('dropdown-open');
                        const t = li.querySelector('.submenu-toggle');
                        if (t) t.setAttribute('aria-expanded', 'false');
                    });
                }
            }, { capture: true });
        })();

        // close menu on resize to large screens
        window.addEventListener('resize', function () {
            if (window.innerWidth > 600) closeMenu();
        });

        // close mobile nav when the user scrolls down (keeps menu from blocking content)
        // only active when the mobile menu is open; ignores upward scrolling.
        (function () {
            let lastY = window.scrollY || 0;
            let ticking = false;
            window.addEventListener('scroll', function () {
                // only care when mobile menu is open
                if (!document.body.classList.contains('mobile-nav-open')) {
                    lastY = window.scrollY || 0;
                    return;
                }
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(function () {
                    const y = window.scrollY || 0;
                    // if user scrolled down more than a small threshold, close the menu
                    if (y - lastY > 8) {
                        closeMenu();
                    }
                    lastY = y;
                    ticking = false;
                });
            }, { passive: true });
        })();

    // Prompt before launching phone app for tel: links (footer call buttons)
    (function () {
        // capture both explicit footer-call links and any tel: links site-wide
        function handleCallClick(e) {
            try {
                e.preventDefault();
                const href = this.getAttribute('href');
                const label = (this.textContent || this.getAttribute('aria-label') || href).trim();
                // Use a native confirm dialog for simplicity and broad support
                const ok = window.confirm('Call ' + label + '?\n\nSelect OK to open your phone app.');
                if (ok) {
                    // navigate to tel: URL to invoke dialing app
                    window.location.href = href;
                }
            } catch (err) { /* ignore */ }
        }

        // Attach to existing links now
        Array.from(document.querySelectorAll('a.footer-call, a[href^="tel:"]')).forEach(a => {
            a.addEventListener('click', handleCallClick);
        });

        // If footer links are dynamically replaced, observe and attach
        const mo = new MutationObserver(muts => {
            muts.forEach(m => {
                m.addedNodes && m.addedNodes.forEach(node => {
                    if (node && node.querySelectorAll) {
                        Array.from(node.querySelectorAll('a.footer-call, a[href^="tel:"]')).forEach(a => {
                            if (!a.__callHandlerAttached) {
                                a.addEventListener('click', handleCallClick);
                                a.__callHandlerAttached = true;
                            }
                        });
                    }
                });
            });
        });
        mo.observe(document.body, { childList: true, subtree: true });
    })();
    })();
});

/* Gentle header double-bounce hint for full-screen desktop heroes
   - Triggers once on arrival, then repeats every 30s
   - Pauses when the user starts scrolling; resumes after idle
   - Now supports multiple `.hero` elements across the site */
document.addEventListener('DOMContentLoaded', function () {
    const breakpoint = 900; // desktop-only
    const repeatIntervalMs = 30000; // 30s
    const idleResumeMs = 8000; // resume after 8s of no scroll

    const heroes = Array.from(document.querySelectorAll('.hero'));
    if (!heroes.length) return;

    heroes.forEach((hero) => {
        // allow pages to opt-out by adding `data-no-bounce` to the hero element
        if (hero.hasAttribute && hero.hasAttribute('data-no-bounce')) return;

        function isFullScreenHero() {
            try {
                // allow an explicit force flag so pages that are not exact
                // full-screen can still show the hint: add `data-force-bounce`
                if (hero.hasAttribute && hero.hasAttribute('data-force-bounce')) return true;
                const rect = hero.getBoundingClientRect();
                const vh = window.innerHeight || document.documentElement.clientHeight;
                // treat as full-screen if hero height covers most of the viewport
                return rect.height >= (vh * 0.75);
            } catch (e) { return false; }
        }

        let intervalId = null;
        let resumeTimer = null;
        let hasUserScrolled = false;

        function triggerBounce() {
            // Restart the animation by removing and re-adding the class
            hero.classList.remove('header-bounce-animate');
            // force reflow so animation restarts reliably
            void hero.offsetWidth;
            hero.classList.add('header-bounce-animate');
        }

        function startRepeating() {
            if (intervalId) return;
            // initial immediate trigger
            triggerBounce();
            intervalId = setInterval(() => {
                // only run on desktop and when hero appears full-screen
                if (window.innerWidth >= breakpoint && isFullScreenHero() && !hasUserScrolled) {
                    triggerBounce();
                }
            }, repeatIntervalMs);
        }

        function stopRepeating() {
            if (intervalId) { clearInterval(intervalId); intervalId = null; }
        }

        // Pause when the user starts scrolling; resume after idleResumeMs of no scroll
        function onUserScroll() {
            if (!hasUserScrolled) hasUserScrolled = true;
            stopRepeating();
            if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
            resumeTimer = setTimeout(() => {
                hasUserScrolled = false;
                if (window.innerWidth >= breakpoint && isFullScreenHero()) startRepeating();
            }, idleResumeMs);
        }

        // Kick off only on desktop and when hero is effectively full-screen
        if (window.innerWidth >= breakpoint && isFullScreenHero()) {
            // small delay so the page paint completes and the hint feels like "arrival"
            setTimeout(() => startRepeating(), 520);
        }

        window.addEventListener('resize', function () {
            // re-evaluate when viewport changes
            if (window.innerWidth < breakpoint) stopRepeating();
            else if (!intervalId && !hasUserScrolled && isFullScreenHero()) startRepeating();
        }, { passive: true });

        window.addEventListener('scroll', onUserScroll, { passive: true });
    });
});

/* 3D rotatable history logo initializer
     - Wraps existing .history-logo-img in .history-logo-3d > .history-logo-inner when needed
     - Enables pointer drag rotation, keyboard nudges, dblclick reset, and inertia decay
*/
document.addEventListener('DOMContentLoaded', function(){
    const img = document.querySelector('.history-logo-img');
    if(!img) return;

    // ensure wrapper structure
    let outer = img.closest('.history-logo-3d');
    let inner;
    if(!outer){
        outer = document.createElement('div'); outer.className = 'history-logo-3d';
        inner = document.createElement('div'); inner.className = 'history-logo-inner';
        img.parentNode.insertBefore(outer, img);
        outer.appendChild(inner);
        inner.appendChild(img);
    } else {
        inner = outer.querySelector('.history-logo-inner');
        if(!inner){
            inner = document.createElement('div'); inner.className = 'history-logo-inner';
            outer.replaceChild(inner, img);
            inner.appendChild(img);
        }
    }

    // a11y
    outer.tabIndex = 0;
    outer.setAttribute('role','application');
    outer.setAttribute('aria-label','Rotatable logo. Drag with pointer or use arrow keys to rotate. Double-click to reset.');

    // rotation state
    let rotX = 0, rotY = 0, vx = 0, vy = 0;
    let dragging = false;
    let lastX = 0, lastY = 0, lastTime = 0;
    let rafId = null;

    function setTransform(){
        inner.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    }

    function animate(){
        if(!dragging){
            vx *= 0.94; vy *= 0.94;
            rotX = Math.max(-40, Math.min(40, rotX + vy));
            rotY = Math.max(-80, Math.min(80, rotY + vx));
            setTransform();
            if(Math.abs(vx) > 0.02 || Math.abs(vy) > 0.02){
                rafId = requestAnimationFrame(animate);
            } else {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        } else {
            rafId = requestAnimationFrame(animate);
        }
    }

    inner.addEventListener('pointerdown', function(e){
        dragging = true;
        inner.setPointerCapture && inner.setPointerCapture(e.pointerId);
        lastX = e.clientX; lastY = e.clientY; lastTime = performance.now();
        vx = vy = 0;
        if(!rafId) rafId = requestAnimationFrame(animate);
    });

    inner.addEventListener('pointermove', function(e){
        if(!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        rotY += dx * 0.22;
        rotX -= dy * 0.18;
        rotX = Math.max(-40, Math.min(40, rotX));
        rotY = Math.max(-80, Math.min(80, rotY));
        setTransform();
        const now = performance.now();
        const dt = Math.max(8, now - lastTime);
        vx = (dx / dt) * 16;
        vy = (-dy / dt) * 16;
        lastTime = now;
    });

    inner.addEventListener('pointerup', function(e){
        dragging = false;
        try{ inner.releasePointerCapture && inner.releasePointerCapture(e.pointerId); }catch(_){}
        if(!rafId) rafId = requestAnimationFrame(animate);
    });
    inner.addEventListener('pointercancel', function(){ dragging = false; if(!rafId) rafId = requestAnimationFrame(animate); });

    outer.addEventListener('keydown', function(e){
        const step = 6;
        if(e.key === 'ArrowLeft'){ rotY -= step; setTransform(); }
        if(e.key === 'ArrowRight'){ rotY += step; setTransform(); }
        if(e.key === 'ArrowUp'){ rotX -= step; setTransform(); }
        if(e.key === 'ArrowDown'){ rotX += step; setTransform(); }
        if(e.key.toLowerCase() === 'r'){ rotX = 0; rotY = 0; vx = vy = 0; setTransform(); }
    });

    outer.addEventListener('dblclick', function(){ rotX = 0; rotY = 0; vx = vy = 0; setTransform(); });

    // gentle hover tilt when not dragging
    function hoverMove(e){
        if(dragging) return;
        const rect = outer.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        const relX = (e.clientX - cx)/rect.width;
        const relY = (e.clientY - cy)/rect.height;
        rotY = relX * 12;
        rotX = -relY * 10;
        setTransform();
    }
    outer.addEventListener('pointerenter', function(){ outer.addEventListener('pointermove', hoverMove); });
    outer.addEventListener('pointerleave', function(){ outer.removeEventListener('pointermove', hoverMove); if(!dragging){ vx = vy = 0; if(!rafId) rafId = requestAnimationFrame(animate); } });

    // initial tiny tilt
    rotX = -6; rotY = 6; setTransform();
});

// ---------------------------------------------------------------------------
// Fade‑in slide‑up animation applied to text elements when they scroll into view
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    const selectors = 'h1, h2, h3, h4, h5, h6, p, li';
    const elements = Array.from(document.querySelectorAll(selectors));
    if (!elements.length) return;

    // assign a slight stagger so text builds up as the page scrolls
    // use a dedicated hero-only fade class for overlay texts so they run
    // a single fade animation instead of the stacked slide-up sequence
    elements.forEach((el, index) => {
        // skip any elements that live inside the footer — keep footer text static
        if (el.closest && el.closest('.site-footer')) return;
        // delay increments by 0.03s per element, capped at ~0.6s
        const delay = Math.min(index * 0.03, 0.6);
        if (el.closest && el.closest('.hero')) {
            el.classList.add('hero-fade');
            el.style.setProperty('--hero-fade-delay', delay + 's');
        } else {
            el.classList.add('fade-slide-up');
            el.style.transitionDelay = delay + 's';
        }
    });

    // track scroll speed to adjust animation duration
    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let currentDuration = 0.5; // seconds

    function onScrollSpeed() {
        const now = performance.now();
        const dy = Math.abs(window.scrollY - lastScrollY);
        const dt = now - lastTime || 16;
        const speed = dy / dt; // px per ms
        // map speed to duration: faster scroll → shorter animation
        // speed 0→0.1 → duration 0.7→0.3
        const min = 0.3, max = 0.7;
        currentDuration = Math.max(min, Math.min(max, max - speed * 4));
        lastScrollY = window.scrollY;
        lastTime = now;
    }
    window.addEventListener('scroll', onScrollSpeed, { passive: true });

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                // set duration based on current scroll speed
                el.style.setProperty('--anim-duration', currentDuration + 's');
                el.classList.add('visible');
                obs.unobserve(el);
            }
        });
    }, {
        threshold: 0.05,
        rootMargin: '0px 0px -20% 0px' // start animating before element fully enters
    });

    elements.forEach(el => {
        // hero elements should animate as soon as possible (even on load)
        if (el.closest('.hero')) {
            // delay slightly so the class addition triggers transition
            setTimeout(() => {
                el.style.setProperty('--anim-duration', currentDuration + 's');
                el.classList.add('visible');
            }, 20);
            return;
        }
        // if element is already near top portion of viewport, show immediately
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.8) {
            el.style.setProperty('--anim-duration', currentDuration + 's');
            el.classList.add('visible');
        } else {
            observer.observe(el);
        }
    });
});

    // ---------------------------------------------------------------------------
    // Mobile bottom nav interactions (attach after DOM loaded)
    // ---------------------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        try {
            const nav = document.querySelector('.mobile-bottom-nav');
            if (!nav) return;

            const items = Array.from(nav.querySelectorAll('.mbn-item'));
            const fab = nav.querySelector('.mbn-fab');
            const chatToggle = document.getElementById('chat-toggle');

            // ensure the correct tab is marked active based on URL (fixes contact page hiding bug)
            (function(){
                let path = window.location.pathname.split('/').pop() || '';
                path = path.toLowerCase();
                let currentTab = 'home';
                if (path.includes('ministries')) currentTab = 'ministries';
                else if (path.includes('location')) currentTab = 'location';
                else if (path.includes('contact')) currentTab = 'contact';
                else if (path === '' || path === 'index.html') currentTab = 'home';
                // mark items accordingly
                items.forEach(i => {
                    if (i.dataset.tab === currentTab) {
                        i.classList.add('active');
                        i.setAttribute('aria-pressed', 'true');
                    } else {
                        i.classList.remove('active');
                        i.setAttribute('aria-pressed', 'false');
                    }
                });
            })();

            // Map tabs to content selectors (if selectors exist on the page)
            const tabMap = {
                home: '#hero',
                ministries: '#featured-ministries',
                location: '#find-us',
                contact: '#contact'
            };

            items.forEach(item => {
                // activate tab when clicked/tapped
                item.addEventListener('click', () => {
                    // ensure only one active at a time
                    items.forEach(i => { i.classList.remove('active'); i.setAttribute('aria-pressed', 'false'); i.classList.remove('touch-active'); });
                    item.classList.add('active');
                    item.setAttribute('aria-pressed', 'true');

                    // subtle micro-interaction: brief scale then settle
                    item.style.transition = 'transform 160ms cubic-bezier(.2,.9,.3,1)';
                    item.style.transform = 'scale(1.03)';
                    setTimeout(() => { item.style.transform = ''; }, 160);

                    // show/hide mapped content sections so only one panel visible at once
                    const tabName = item.dataset.tab;
                    if (tabName && tabMap[tabName]) {
                        const targetSelector = tabMap[tabName];
                        // hide other mapped sections
                        Object.values(tabMap).forEach(sel => {
                            try {
                                const el = document.querySelector(sel);
                                if (!el) return;
                                if (sel === targetSelector) {
                                    el.classList.remove('mbn-panel-hidden');
                                    // smooth reveal: ensure it's visible and focusable
                                    el.style.transition = 'opacity 260ms ease';
                                    el.style.opacity = '1';
                                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                } else {
                                    // hide other sections softly
                                    el.style.opacity = '0';
                                    // after transition, apply a hiding class to remove from flow
                                    setTimeout(() => el.classList.add('mbn-panel-hidden'), 260);
                                }
                            } catch (e) { /* ignore missing selectors */ }
                        });
                    } else if (tabName === 'contact') {
                        // If no in-page contact, navigate to contact page
                        if (!document.querySelector(tabMap.contact)) {
                            window.location.href = 'contact.html';
                        }
                    }
                });

                // quick tactile feedback for touch
                item.addEventListener('pointerdown', () => { item.classList.add('touch-active'); });
                item.addEventListener('pointerup', () => { setTimeout(() => item.classList.remove('touch-active'), 140); });

                // keyboard activation (Enter / Space)
                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
                });
            });

            // Create a sliding glossy highlight element and wire it to hover/click
            (function() {
                const container = nav.querySelector('.mbn-container');
                if (!container) return;

                let gloss = container.querySelector('.mbn-gloss');
                if (!gloss) {
                    gloss = document.createElement('div');
                    gloss.className = 'mbn-gloss';
                    // insert below the items so items' SVGs sit above the gloss
                    container.insertBefore(gloss, container.firstChild);
                }

                function placeGlossOn(item, instant) {
                    if (!item || !gloss) return;
                    const now = performance.now();
                    const iRect = item.getBoundingClientRect();
                    const cRect = container.getBoundingClientRect();
                    // determine orientation: horizontal on narrow, vertical on desktop
                    const isVertical = window.innerWidth >= 1000 || container.classList.contains('mbn-vertical');
                    const inset = (isVertical ? 26 : 18); // larger gap so a visible rim shows around the gloss
                    // Reset transition duration based on how fast the pointer moves
                    let delta, dt, speed, duration;
                    if (isVertical) {
                        // will compute later once y is known
                    } else {
                        // will compute later once x is known
                    }

                    if (!isVertical) {
                        // horizontal (existing behavior)
                        const center = iRect.left + (iRect.width / 2) - cRect.left;
                        // add extra padding so the highlight extends past the icon
                        const rawWidth = Math.round(iRect.width + 24);
                        // allow a wider range on mobile for a more pill‑like shape
                        const glossWidth = Math.max(60, Math.min(120, rawWidth - inset));
                        gloss.style.width = glossWidth + 'px';
                        const containerHeight = container.clientHeight || 58;
                        // gloss height is half the container, satisfying the tip ratio
                        let glossHeight = Math.round(containerHeight / 2);
                        // bump height a bit more on small screens for a chunkier blob
                        // (increased multiplier to make blob more prominent on phones)
                        if (window.innerWidth < 700) {
                            glossHeight = Math.round(glossHeight * 1.35);
                        }
                        gloss.style.height = glossHeight + 'px';
                        gloss.style.borderRadius = (glossHeight / 2) + 'px';
                        const x = center - (glossWidth / 2);
                        if (instant) {
                            gloss.style.transition = 'none';
                            gloss.style.transform = 'translateX(' + x + 'px) translateY(-50%)';
                            void gloss.offsetWidth;
                            gloss.style.transition = '';
                            gloss._lastX = x;
                        } else {
                            const prev = (typeof gloss._lastX === 'number') ? gloss._lastX : x;
                            const delta = x - prev;
                            // smaller overshoot factor for a gentler motion
                            const overshoot = Math.max(-4, Math.min(4, Math.round(delta * 0.08)));
                            gloss.style.setProperty('--overshoot', overshoot + 'px');
                            // add temporary scale while moving
                            const scale = Math.abs(delta) > 4 ? 1.1 : 1;
                            gloss.classList.add('mbn-gloss-moving');
                            gloss.style.transform = 'translateX(' + x + 'px) translateY(-50%) scale(' + scale + ')';
                            // remove moving class and reset scale after short delay
                            clearTimeout(gloss._moveT);
                            gloss._moveT = setTimeout(() => {
                                gloss.classList.remove('mbn-gloss-moving');
                                // reapply translation without scale
                                gloss.style.transform = 'translateX(' + x + 'px) translateY(-50%)';
                            }, 300);

                            if (Math.abs(delta) > 4) {
                                gloss.classList.remove('mbn-gloss-bounce');
                                void gloss.offsetWidth;
                                gloss.classList.add('mbn-gloss-bounce');
                                clearTimeout(gloss._bounceT);
                                // match new slower animation duration
                                gloss._bounceT = setTimeout(() => { gloss.classList.remove('mbn-gloss-bounce'); }, 1050);
                            }
                            gloss._lastX = x;
                        }
                    } else {
                        // vertical pill: center vertically relative to container;
                        // blob length should be based on the individual item's height
                        const centerY = iRect.top + (iRect.height / 2) - cRect.top;
                        const rawHeight = Math.round(iRect.height + 16);
                        const glossHeight = Math.max(56, Math.min(100, rawHeight - inset));
                        gloss.style.height = glossHeight + 'px';
                        // set radius to half the computed height so corners stay circular
                        gloss.style.borderRadius = (glossHeight / 2) + 'px';
                        // make gloss slightly narrower than the pill so a rim shows
                        const containerWidth = container.clientWidth || 72;
                        const glossWidth = Math.max(44, Math.min(84, containerWidth - 12));
                        gloss.style.width = glossWidth + 'px';
                        const y = centerY - (glossHeight / 2);
                        if (instant) {
                            gloss.style.transition = 'none';
                            gloss.style.transform = 'translateX(-50%) translateY(' + y + 'px)';
                            void gloss.offsetWidth;
                            gloss.style.transition = '';
                            gloss._lastY = y;
                        } else {
                            const prev = (typeof gloss._lastY === 'number') ? gloss._lastY : y;
                            delta = y - prev;
                            dt = now - (gloss._lastMoveTime || now);
                            gloss._lastMoveTime = now;
                            speed = Math.abs(delta) / (dt || 1);
                            duration = Math.min(600, Math.max(120, 200 / (speed + 0.01)));
                            gloss.style.transitionDuration = duration + 'ms';
                            // vertical version also toned down
                            const overshoot = Math.max(-4, Math.min(4, Math.round(delta * 0.08)));
                            gloss.style.setProperty('--overshoot', overshoot + 'px');
                            const scale = Math.abs(delta) > 4 ? 1.1 : 1;
                            gloss.classList.add('mbn-gloss-moving');
                            gloss.style.transform = 'translateX(-50%) translateY(' + y + 'px) scale(' + scale + ')';
                            clearTimeout(gloss._moveT);
                            gloss._moveT = setTimeout(() => {
                                gloss.classList.remove('mbn-gloss-moving');
                                gloss.style.transform = 'translateX(-50%) translateY(' + y + 'px)';
                            }, 300);
                            if (Math.abs(delta) > 4) {
                                gloss.classList.remove('mbn-gloss-bounce');
                                void gloss.offsetWidth;
                                gloss.classList.add('mbn-gloss-bounce');
                                clearTimeout(gloss._bounceT);
                                // match new slower animation duration
                                gloss._bounceT = setTimeout(() => { gloss.classList.remove('mbn-gloss-bounce'); }, 1050);
                            }
                            gloss._lastY = y;
                        }
                    }
                    gloss.style.opacity = '1';
                }

                // mark navigation orientation class for desktop (vertical)
                function updateNavOrientation() {
                    if (window.innerWidth >= 1000) nav.classList.add('mbn-vertical');
                    else nav.classList.remove('mbn-vertical');
                }

                updateNavOrientation();

                // Move to the currently active item initially
                const initial = nav.querySelector('.mbn-item.active') || items[0];
                // ensure we can measure after layout
                setTimeout(() => placeGlossOn(initial, true), 40);

                // Recalculate orientation and gloss placement on resize
                window.addEventListener('resize', () => {
                    updateNavOrientation();
                    const active = nav.querySelector('.mbn-item.active') || items[0];
                    setTimeout(() => placeGlossOn(active, true), 80);
                });

                // Wire events for hover/focus/click
                items.forEach(it => {
                    it.addEventListener('pointerenter', () => placeGlossOn(it));
                    it.addEventListener('focus', () => placeGlossOn(it));
                    it.addEventListener('click', () => placeGlossOn(it));
                    // for touch devices ensure glossy shows on pointerdown
                    it.addEventListener('pointerdown', () => placeGlossOn(it));
                });

                // Drag / long-press support for touch: user can long-press then slide
                // The gloss will follow the finger; on release we trigger the underlying item.
                (function() {
                    let dragging = false;
                    let dragPointerId = null;
                    let dragTimer = null;
                    let currentTarget = null;
                    // Flag used to suppress the browser's native click event that
                    // follows a pointerup after a drag. We allow programmatic clicks
                    // (element.click()) by checking event.isTrusted in the click handler.
                    let justEndedDrag = false;

                    function findItemAt(clientX, clientY) {
                        // prefer bounding-box detection for each item
                        for (let itm of items) {
                            const r = itm.getBoundingClientRect();
                            if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return itm;
                        }
                        // fallback: nearest by horizontal distance
                        const cRect = container.getBoundingClientRect();
                        const relX = clientX - cRect.left;
                        let nearest = null; let best = Infinity;
                        for (let itm of items) {
                            const r = itm.getBoundingClientRect();
                            const center = (r.left + r.right) / 2 - cRect.left;
                            const d = Math.abs(center - relX);
                            if (d < best) { best = d; nearest = itm; }
                        }
                        return nearest;
                    }

                    function placeGlossAtPoint(clientX, instant) {
                        const cRect = container.getBoundingClientRect();
                        const relX = clientX - cRect.left;
                        // compute center-based placement using nearest item width for a nicer snap
                        const nearest = findItemAt(clientX, cRect.top + (cRect.height/2)) || items[0];
                        placeGlossOn(nearest, instant);
                        return nearest;
                    }

                    container.addEventListener('pointerdown', (e) => {
                        // only react to touch pointers for drag; allow mouse to use hover/click
                        if (e.pointerType !== 'touch') return;
                        // start a short timer so normal taps aren't interpreted as drags
                        dragTimer = setTimeout(() => {
                            dragging = true;
                            dragPointerId = e.pointerId;
                            try { container.setPointerCapture(dragPointerId); } catch (err) {}
                            currentTarget = placeGlossAtPoint(e.clientX, true);
                            if (currentTarget) currentTarget.classList.add('mbn-gloss-target');
                        }, 140);
                    }, { passive: true });

                    container.addEventListener('pointermove', (e) => {
                        if (!dragging || e.pointerId !== dragPointerId) return;
                        e.preventDefault();
                        const nearest = placeGlossAtPoint(e.clientX, false);
                        if (nearest !== currentTarget) {
                            if (currentTarget) currentTarget.classList.remove('mbn-gloss-target');
                            currentTarget = nearest;
                            if (currentTarget) currentTarget.classList.add('mbn-gloss-target');
                        }
                    }, { passive: false });

                    function endDrag(e) {
                        if (dragTimer) { clearTimeout(dragTimer); dragTimer = null; }
                        if (dragging && e && e.pointerId === dragPointerId) {
                            // commit to the current target — allow programmatic click
                            // to run normally while suppressing the native click that
                            // the browser will emit after pointerup.
                            const targetToClick = currentTarget;
                            if (targetToClick) {
                                targetToClick.classList.remove('mbn-gloss-target');
                                // mark that a drag just ended so we can suppress the
                                // following native (trusted) click event from the browser
                                justEndedDrag = true;
                                try { if (e && e.pointerId) container.releasePointerCapture(e.pointerId); } catch (err) {}
                                // clear dragging state BEFORE triggering the programmatic click
                                dragging = false; dragPointerId = null; currentTarget = null;
                                try { targetToClick.click(); } catch (err) {}
                                // reset the flag shortly after (one native click will be suppressed)
                                setTimeout(() => { justEndedDrag = false; }, 350);
                                return;
                            }
                        }
                        dragging = false; dragPointerId = null; currentTarget = null;
                        try { if (e && e.pointerId) container.releasePointerCapture(e.pointerId); } catch (err) {}
                    }

                    // Prevent accidental native clicks while dragging/long-pressing.
                    // We use capture so we can stop the event before page navigation.
                    container.addEventListener('click', (e) => {
                        // If the user is actively dragging or a long-press timer is running,
                        // suppress the click to avoid navigating mid-drag.
                        if (dragging || dragTimer) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            return;
                        }
                        // If a drag just ended, block the browser-generated trusted click
                        // but allow programmatic (isTrusted === false) clicks that we
                        // triggered intentionally via `element.click()` above.
                        if (justEndedDrag && e.isTrusted) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            justEndedDrag = false;
                            return;
                        }
                    }, { capture: true });

                    container.addEventListener('pointerup', (e) => { endDrag(e); }, { passive: true });
                    container.addEventListener('pointercancel', (e) => { endDrag(e); }, { passive: true });
                    // If pointer leaves container while dragging, end drag and commit
                    container.addEventListener('pointerleave', (e) => { if (dragging) endDrag(e); else {
                        const active = nav.querySelector('.mbn-item.active') || items[0];
                        placeGlossOn(active);
                    } }, { passive: true });
                })();

                // Reposition on resize to avoid visual mismatch
                window.addEventListener('resize', () => {
                    const active = nav.querySelector('.mbn-item.active') || items[0];
                    setTimeout(() => placeGlossOn(active, true), 80);
                });
            })();

            if (fab) {
                // open the existing chat toggle (if present) for the FAB
                fab.addEventListener('click', () => {
                    if (chatToggle) chatToggle.click();
                    // small press animation
                    fab.classList.add('fab-active');
                    setTimeout(() => fab.classList.remove('fab-active'), 420);
                });

                fab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fab.click(); } });
            }
        } catch (e) { /* graceful degrade if DOM changes */ }
    });

    // Ensure mapped sections are initially hidden except home (but only if mobile nav exists)
    document.addEventListener('DOMContentLoaded', function () {
        try {
            // bail out early when there is no bottom nav on the page (e.g. standalone contact page)
            const nav = document.querySelector('.mobile-bottom-nav');
            if (!nav) return;

            const initialMap = { home: '#hero', ministries: '#featured-ministries', location: '#find-us', contact: '#contact' };
            const active = nav.querySelector('.mbn-item.active');
            const activeTab = active && active.dataset && active.dataset.tab ? active.dataset.tab : 'home';
            Object.entries(initialMap).forEach(([name, sel]) => {
                const el = document.querySelector(sel);
                if (!el) return;
                if (name === activeTab) {
                    el.classList.remove('mbn-panel-hidden'); el.style.opacity = '1';
                } else {
                    el.classList.add('mbn-panel-hidden'); el.style.opacity = '0';
                }
            });
        } catch (e) {}
    });

    // Insert muted footer metadata into every footer.site-footer element.
    // Shows a static creation date and a "last updated" date set to yesterday.
    document.addEventListener('DOMContentLoaded', function () {
        try {
            const createdDateStr = '03 March 2026';
            const contactEmail = 'oluwanifemijosiah02@gmail.com';
            const contactPhone = '07587993762';

            // compute yesterday's date in 'DD Month YYYY' format (zero-padded day)
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const yDay = String(yesterday.getDate()).padStart(2, '0') + ' ' + monthNames[yesterday.getMonth()] + ' ' + yesterday.getFullYear();

            const footers = document.querySelectorAll('footer.site-footer');
            footers.forEach(footer => {
                if (!footer) return;
                if (footer.querySelector('.footer-meta')) return; // don't duplicate

                const p = document.createElement('p');
                p.className = 'footer-meta muted';
                p.style.marginTop = '12px';
                p.style.fontSize = '13px';
                p.style.textAlign = 'center';

                // Build content with clickable email (opens Gmail compose) and tel link.
                const prefix = document.createTextNode(`Website last created and updated on ${createdDateStr} by `);
                p.appendChild(prefix);

                const emailLink = document.createElement('a');
                emailLink.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(contactEmail);
                emailLink.target = '_blank';
                emailLink.rel = 'noopener noreferrer';
                emailLink.textContent = contactEmail;
                emailLink.style.color = 'inherit';
                emailLink.style.textDecoration = 'none';
                emailLink.style.cursor = 'pointer';
                emailLink.setAttribute('aria-label', 'Send email (opens Gmail compose)');
                p.appendChild(emailLink);

                p.appendChild(document.createTextNode(', '));

                // Normalize phone to international format for tel: (assume UK if starts with 0)
                const rawDigits = contactPhone.replace(/\D/g, '');
                let telHref = rawDigits;
                if (telHref.length) {
                    if (telHref.charAt(0) === '0') telHref = '+44' + telHref.substring(1);
                    else if (telHref.charAt(0) !== '+') telHref = '+' + telHref;
                }

                const phoneLink = document.createElement('a');
                phoneLink.href = telHref ? ('tel:' + telHref) : ('tel:' + contactPhone);
                phoneLink.textContent = contactPhone;
                phoneLink.style.color = 'inherit';
                phoneLink.style.textDecoration = 'none';
                phoneLink.style.cursor = 'pointer';
                phoneLink.setAttribute('aria-label', 'Call this number');
                p.appendChild(phoneLink);

                // Append the metadata paragraph before the final container if present,
                // otherwise append to footer directly.
                const lastContainer = footer.querySelector('.container:last-of-type');
                if (lastContainer) lastContainer.parentNode.insertBefore(p, lastContainer.nextSibling);
                else footer.appendChild(p);
            });
        } catch (e) { /* graceful degrade */ }
    });

