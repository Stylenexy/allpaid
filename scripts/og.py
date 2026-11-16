"""Render scripts/og.html to public/og.png (1200x630).

Connects to the shared Chrome on port 9333 instead of launching a browser:
start it first with the team's chrome automation script (see docs/DEVELOPING.md).
"""
import pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9333')
    ctx = browser.new_context(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto((root / 'scripts' / 'og.html').as_uri(), wait_until='networkidle')
    page.wait_for_timeout(600)
    page.screenshot(path=str(root / 'public' / 'og.png'))
    ctx.close()
    browser.close()
print('public/og.png written')
