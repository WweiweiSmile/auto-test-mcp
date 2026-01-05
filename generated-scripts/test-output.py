# 生成的 Playwright 自动化测试脚本
from playwright.sync_api import sync_playwright

def run_automation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto('https://www.baidu.com')
        page.goto('https://www.baidu.com')
        page.fill('e38', 'ai')
        page.click('e76')
        page.goto('https://www.baidu.com')
        page.fill('e38', 'ai')
        page.click('e76')
        page.goto('https://www.baidu.com')
        page.fill('e38', 'ai')
        page.click('e76')
        browser.close()

if __name__ == '__main__':
    run_automation()