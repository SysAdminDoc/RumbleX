// Regression coverage for the main-site theme surfaces. This stays synthetic
// so the release gate does not depend on live Rumble content or timing.
const { test, expect, chromium } = require('@playwright/test');
const { BODY, createHarnessPage } = require('./_harness');

test('premium site theme frames feed cards and watch metadata', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const result = await page.evaluate(async ({ body }) => {
            document.body.innerHTML = body + `
                <section class="homepage-section">
                    <div class="constrained">
                        <h2 class="homepage-heading__title">Featured</h2>
                        <rum-video-thumbnail role="listitem" video-title="Theme fixture">
                            <img class="rum-video-thumbnail__image" alt="Theme fixture">
                            <rum-video-thumbnail-footer>
                                <rum-text role="heading">Theme fixture</rum-text>
                                <rum-avatar></rum-avatar>
                            </rum-video-thumbnail-footer>
                        </rum-video-thumbnail>
                    </div>
                </section>`;
            history.replaceState({}, '', '/');
            document.documentElement.classList.add('rumblex-active');
            const harness = globalThis.__RumbleXFeatureHarness;
            harness.enable('darkEnhance');
            const feature = harness.features.find((candidate) => candidate.id === 'darkEnhance');
            feature.destroy();
            feature.init();
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const card = document.querySelector('.homepage-section rum-video-thumbnail[role="listitem"]');
            const footer = card.querySelector('rum-video-thumbnail-footer');
            const section = document.querySelector('.homepage-section');
            const title = document.querySelector('.homepage-heading__title');
            const related = document.querySelector('.media-page-related-media-desktop-sidebar');
            const description = document.querySelector('.media-description-section');
            const cardStyle = getComputedStyle(card);
            const footerStyle = getComputedStyle(footer);
            const sectionStyle = getComputedStyle(section);
            const titleAfter = getComputedStyle(title, '::after');
            const relatedStyle = getComputedStyle(related);
            const descriptionStyle = getComputedStyle(description);
            const styleMounted = !!document.getElementById('rx-darkenhance');
            const snapshot = {
                styleMounted,
                card: {
                    display: cardStyle.display,
                    borderRadius: cardStyle.borderRadius,
                    borderStyle: cardStyle.borderTopStyle,
                    background: cardStyle.backgroundColor,
                },
                footer: {
                    display: footerStyle.display,
                    paddingTop: footerStyle.paddingTop,
                },
                section: {
                    paddingTop: sectionStyle.paddingTop,
                    gradient: sectionStyle.backgroundImage.includes('gradient'),
                },
                headingRule: titleAfter.content !== 'none' && titleAfter.display === 'block',
                related: {
                    borderLeftStyle: relatedStyle.borderLeftStyle,
                    paddingLeft: relatedStyle.paddingLeft,
                },
                description: {
                    borderRadius: descriptionStyle.borderRadius,
                    marginTop: descriptionStyle.marginTop,
                },
            };
            feature.destroy();
            return { ...snapshot, removed: !document.getElementById('rx-darkenhance') };
        }, { body: BODY });

        expect(result.styleMounted).toBe(true);
        expect(result.card).toEqual(expect.objectContaining({
            display: 'block',
            borderRadius: '12px',
            borderStyle: 'solid',
            background: 'rgb(30, 30, 46)',
        }));
        expect(result.footer).toEqual({ display: 'block', paddingTop: '8px' });
        expect(result.section).toEqual(expect.objectContaining({ paddingTop: '18px', gradient: true }));
        expect(result.headingRule).toBe(true);
        expect(result.related).toEqual({ borderLeftStyle: 'solid', paddingLeft: '18px' });
        expect(result.description).toEqual({ borderRadius: '12px', marginTop: '16px' });
        expect(result.removed).toBe(true);
        await context.close();
    } finally {
        await browser.close();
    }
});
