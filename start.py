import urllib

import json5
from qwen_agent.agents import Assistant
from qwen_agent.gui import WebUI
from qwen_agent.tools.base import BaseTool, register_tool


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
            "args": ["E:\\Codes\\auto-test-mcp\\playwright-script-gen-mcp.js"],
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
