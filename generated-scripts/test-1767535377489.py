# 生成的 Playwright 自动化测试脚本
from playwright.sync_api import sync_playwright

def run_automation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto('https://example.com')
        browser.close()

if __name__ == '__main__':
    run_automation()