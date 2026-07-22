from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.set_viewport_size({"width": 1280, "height": 800})
    pg.goto("http://localhost:3847", wait_until="networkidle")
    pg.wait_for_timeout(800)
    pg.screenshot(path="shot_home.png")

    # Trigger a search then screenshot grid with badges
    pg.click("#search button[type=submit]")
    pg.wait_for_timeout(800)
    pg.screenshot(path="shot_search.png")

    # Open booking modal on first available "Book now"
    pg.eval_on_selector_all("button[data-id]", "els => els.find(e=>!e.disabled)?.click()")
    pg.wait_for_timeout(700)
    pg.screenshot(path="shot_booking.png")
    b.close()
    print("done")
