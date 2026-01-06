import time
import urllib

import json5
from qwen_agent.agents import Assistant
from qwen_agent.gui import WebUI
from qwen_agent.tools.base import BaseTool, register_tool


# 自定义 Playwright 测试工具类
@register_tool('playwright_test_tool')
class PlaywrightTestTool(BaseTool):
    """
    Playwright 自动化测试工具，生成自动化测试的py脚本
    """

    # `description` 用于告诉智能体该工具的功能。
    description = 'Playwright 自动化测试生成工具，生成并保存自动化测试脚本到 test-时间戳.py 文件中。'
    # `parameters` 告诉智能体该工具有哪些输入参数。
    parameters = [
        {
            "name": "url",
            "type": "string",
            "description": "要访问的网页 URL"
        },
        {
            "name": "actions",
            "type": "array",
            "description": "要执行的操作列表，每个操作包含 type、selector 和 value 字段",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["click", "fill", "wait", "screenshot", "text", "get_elements", "snapshot"],
                        "description": "操作类型：click(点击)、fill(填写)、wait(等待)、screenshot(截图)、text(获取文本)、get_elements(获取页面元素)、snapshot(获取页面快照)"
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS 选择器或 XPath，用于定位元素（在 click、fill、text、get_elements 操作中使用）"
                    },
                    "value": {
                        "type": "string",
                        "description": "操作的值，如填入的文本、等待时间(毫秒)或截图保存路径"
                    }
                },
                "required": ["type"]
            }
        }
    ]

    def __init__(self, tool_cfg=None):
        super().__init__()
        if tool_cfg:
            # 在这里处理 tool_cfg 参数
            pass

    def call(self, params: str, **kwargs) -> str:
        """
        生成浏览器自动化测试脚本
        :param params: 包含目标 URL 和操作列表的 JSON 字符串
        :return: 测试结果和页面元素信息
        """
        data = json5.loads(params)
        url = data.get('url', '')
        actions = data.get('actions', [])

        # 生成测试脚本
        test_scripts = []
        test_scripts.append("# 生成的 Playwright 自动化测试脚本\n")
        test_scripts.append("from playwright.sync_api import sync_playwright\n")
        test_scripts.append("\n")
        test_scripts.append("def run_automation():\n")
        test_scripts.append(f"    with sync_playwright() as p:\n")
        test_scripts.append(f"        browser = p.chromium.launch(headless=False)\n")
        test_scripts.append(f"        page = browser.new_page()\n")
        test_scripts.append(f"        page.goto('{url}')\n")

        # 初始化结果
        results = {
            "status": "success",
            "message": f"已成功执行 {len(actions)} 个自动化步骤",
            "test_steps": [],
            "page_elements": [],
            "screenshots": [],
            "generated_script_file": ""
        }

        # 记录操作步骤
        results["test_steps"].append(f"访问 URL: {url}")

        # 生成脚本
        for i, action in enumerate(actions):
            action_type = action.get('type')
            selector = action.get('selector', '')
            value = action.get('value', '')

            step_description = ""

            if action_type == 'click':
                test_scripts.append(f"        page.click('{selector}')\n")
                step_description = f"第 {i + 1} 步: 点击元素 '{selector}'"

            elif action_type == 'fill':
                test_scripts.append(f"        page.fill('{selector}', '{value}')\n")
                step_description = f"第 {i + 1} 步: 在 '{selector}' 填入 '{value}'"

            elif action_type == 'wait':
                test_scripts.append(f"        page.wait_for_timeout({value})\n")
                step_description = f"第 {i + 1} 步: 等待 {value} 毫秒"

            elif action_type == 'screenshot':
                test_scripts.append(f"        page.screenshot(path='{value}')\n")
                step_description = f"第 {i + 1} 步: 截图保存至 '{value}'"
                results["screenshots"].append(value)

            elif action_type == 'text':
                test_scripts.append(f"        text = page.locator('{selector}').text_content()\n")
                test_scripts.append(f"        print(f'元素文本: {{text}}')\n")
                step_description = f"第 {i + 1} 步: 获取元素 '{selector}' 的文本"

            elif action_type == 'get_elements':
                # 使用 JS 获取页面元素信息
                test_scripts.append(f"        elements = page.query_selector_all('{selector}')\n")
                test_scripts.append(f"        print(f'找到 {{len(elements)}} 个元素: {{elements}}')\n")
                step_description = f"第 {i + 1} 步: 获取页面元素 '{selector}' 的信息"

            elif action_type == 'snapshot':
                # 获取页面快照
                test_scripts.append(f"        content = page.content()\n")
                test_scripts.append(f"        print(f'页面快照: {{content[:200]}}...')\n")
                step_description = f"第 {i + 1} 步: 获取页面快照"

            else:
                step_description = f"第 {i + 1} 步: 不支持的操作类型 '{action_type}'"
                results["status"] = "error"

            results["test_steps"].append(step_description)

        test_scripts.append(f"        browser.close()\n")
        test_scripts.append("\n")
        test_scripts.append("if __name__ == '__main__':\n")
        test_scripts.append("    run_automation()\n")

        # 生成测试脚本文件
        timestamp = int(time.time())
        filename = f"test-{timestamp}.py"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("".join(test_scripts))

        results["generated_script_file"] = filename

        return json5.dumps(results, ensure_ascii=False)


@register_tool('my_image_gen')
class MyImageGen(BaseTool):
    # `description` 用于告诉智能体该工具的功能。
    description = 'AI 绘画（图像生成）服务，输入文本描述，返回基于文本信息绘制的图像 URL。'
    # `parameters` 告诉智能体该工具有哪些输入参数。
    parameters = [{
        'name': 'prompt',
        'type': 'string',
        'description': '期望的图像内容的详细描述',
        'required': True
    }]

    def call(self, params: str, **kwargs) -> str:
        # `params` 是由 LLM 智能体生成的参数。
        prompt = json5.loads(params)['prompt']
        prompt = urllib.parse.quote(prompt)
        return json5.dumps(
            {'image_url': f'https://image.pollinations.ai/prompt/{prompt}'},
            ensure_ascii=False)


# 配置常量
LLM_CONFIG = {
    'model': 'qwen3:8b',
    'model_server': ' http://localhost:11434/v1',
    'api_key': 'EMPTY',
    'prompt': '''
你是一个web自动化测试助手：
- 使用 playwright-script-gen MCP 服务来执行浏览器自动化操作
- 将任务操作拆分为多个步骤，保存在当下目录的 steps.md文档。
- 读取当前目下的 steps.md文档， 按照文档步骤顺序依次执行，当上一步骤完成以后执行下一步骤
- 如果步骤执行失败，重试这个步骤，步骤最多重试三次。
- 当所有步骤测试完成以后 使用 playwright-script-gen MCP  playwright_script_generator 方法，生成自动化的测试脚本
- 你总是用中文回复用户。
''',
    'generate_cfg': {
        'top_p': 0.8
    }
}

SYSTEM_INSTRUCTION = '''
你是一个web自动化测试助手：
- 使用 playwright-script-gen MCP 服务来执行浏览器自动化操作
- 将任务操作拆分为多个步骤，保存在当下目录的 steps.md文档。
- 读取当前目下的 steps.md文档， 按照文档步骤顺序依次执行，当上一步骤完成以后执行下一步骤
- 如果步骤执行失败，重试这个步骤，步骤最多重试三次。
- 当所有步骤测试完成以后 使用 playwright-script-gen MCP  playwright_script_generator 方法，生成自动化的测试脚本
- 你总是用中文回复用户。
'''

MCP_SERVERS_CONFIG = {
    "mcpServers": {
        "playwright-script-gen": {
            "timeout": 30,
            "type": "stdio",
            "command": "node",
            "args": ["playwright-script-gen-mcp.js"],
            "env": {}
        },
    }
}


# 初始化智能体
def initialize_agent():
    """初始化智能体"""
    tools = [MCP_SERVERS_CONFIG, 'code_interpreter']
    files = []

    return Assistant(
        llm=LLM_CONFIG,
        system_message=SYSTEM_INSTRUCTION,
        function_list=tools,
        files=files
    )


# 启动 WebUI
def main():
    bot = initialize_agent()
    WebUI(bot).run()


if __name__ == '__main__':
    main()
