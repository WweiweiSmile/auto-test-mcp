#!/usr/bin/env node

// playwright-script-gen-mcp.js - 一个包装 playwright-mcp 并增加 Python 脚本生成功能的 MCP 服务

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { log, generatePythonScript } = require('./modules/script-generator');
const { PlaywrightServiceManager } = require('./modules/service-manager');
const TestStepsManager = require('./modules/test-steps-manager');
const config = require('./config/service-config');

// 初始化组件
const serviceManager = new PlaywrightServiceManager(config);
const testStepsManager = new TestStepsManager();

// 从MCP方法调用中提取操作信息
function extractActionFromMethod(method, params) {
  // 根据MCP方法名和参数创建对应的操作对象
  switch (method) {
    case 'browser/navigate':
      return {
        type: 'navigate', value: params.url
      };
    case 'page/fill':
    case 'element/fill':
      return {
        type: 'fill', selector: params.selector, value: params.text
      };
    case 'page/click':
    case 'element/click':
      return {
        type: 'click', selector: params.selector
      };
    case 'page/wait':
      return {
        type: 'wait', value: params.milliseconds || 1000
      };
    case 'page/screenshot':
      return {
        type: 'screenshot', value: params.path
      };
    case 'page/text':
    case 'element/text':
      return {
        type: 'text', selector: params.selector
      };
    case 'page/elements':
    case 'element/query':
      return {
        type: 'get_elements', selector: params.selector
      };
    case 'page/content':
      return {
        type: 'snapshot'
      };
    case 'page/press':
    case 'element/press':
      return {
        type: 'press', selector: params.selector, value: params.key
      };
    case 'page/hover':
    case 'element/hover':
      return {
        type: 'hover', selector: params.selector
      };
    default:
      return params;
  }
}

const playwright_script_generator_tool = {
  name: config.tools.playwright_script_generator.name,
  description: config.tools.playwright_script_generator.description,
  inputSchema: null
};

// 处理传入的 MCP 请求
async function handleRequest(request) {
  try {
    log(`接收到来自客户端的请求: ${request}`);
    const parsed = JSON.parse(request);
    const {method, params, id} = parsed;

    if (method === 'tools/call' && params && params.name === 'playwright_script_generator') {
      // 生成 Node.js 脚本 - 处理标准MCP工具调用格式
      const outputDir = config.scriptGeneration.outputDir;
      const fileName = `${outputDir}/${config.scriptGeneration.defaultFileName}-${Date.now()}.js`;  // 更改为.js扩展名

      log(`playwright_script_generator  testSteps---> ${JSON.stringify(testStepsManager.getTestSteps())}`);

      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
      }

      const generationResult = generatePythonScript(
        testStepsManager.getCurrentPageUrl(), 
        testStepsManager.getTestSteps(), 
        fileName
      );  // 使用相同的函数（现在生成Node.js脚本）

      // 读取生成的脚本内容
      let scriptContent = [{
        "type": "text", 
        "text": `脚本保存在文件地址：  ${fileName}`
      }];

      // 返回结果，包含 content 字段
      const clientResponse = {
        jsonrpc: "2.0", 
        id: id, 
        result: {
          ...generationResult, 
          content: scriptContent
        }
      };

      log(`playwright_script_generator 工具执行完毕 ${JSON.stringify(clientResponse)}`);
      process.stdout.write(JSON.stringify(clientResponse) + '\n');

      // 生成脚本后清除历史记录
      testStepsManager.clearTestSteps();
      return;
    }

    // 确保 Playwright MCP 服务已启动（仅在实例不存在时启动）
    if (!serviceManager.getMcpInstance()) {
      await serviceManager.startPlaywrightMcp();
    }

    // 检查是否是其他可能的操作，如果是则记录到testSteps（除了生成脚本的调用）
    // 尝试从params中提取操作信息并添加到testSteps
    if (method === 'tools/call' && params && params.name !== 'playwright_script_generator') {
      const action = extractActionFromMethod(method, params);
      testStepsManager.addTestStep(action);
    }

    // 定义回调函数处理响应
    const callback = (error, response) => {
      if (error) {
        log(`处理方法 ${method} 时出错: ${error.message}`);

        const errorResponse = {
          jsonrpc: "2.0", 
          id: id, 
          error: {
            code: -32603, 
            message: `处理请求时出错: ${error.message}`
          }
        };

        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      } else {
        log(`从 Playwright MCP 接收到响应: ${JSON.stringify(response)}`);

        // 对于 initialize 和 tools/list 方法，需要合并自定义工具
        if (method === 'tools/list') {
          // 合并 Playwright MCP 的工具和我们自己的工具
          let playwrightTools = [];

          // 尝试多种可能的响应格式
          if (response && response.result && response.result.tools) {
            // 检查是否有工具列表
            // 标准 MCP 协议格式: {result: {tools: [...]}, jsonrpc: '2.0', id: string}
            playwrightTools = response.result.tools;
          }

          log(`合并工具: Playwright工具数量=${playwrightTools.length}, 我们的工具数量=1`);

          // 准备合并后的工具列表
          const ourTools = [playwright_script_generator_tool];
          const mergedTools = [...playwrightTools, ...ourTools];
          // tools/list 方法或其他包含工具列表的响应格式
          const clientResponse = {
            ...response, 
            result: {
              tools: mergedTools
            }
          };

          process.stdout.write(JSON.stringify(clientResponse) + '\n');
        } else {
          // 对于其他方法，直接返回原始响应
          // 检查是否是导航操作，如果是则更新当前页面URL
          if (method === 'browser/navigate' && params && params.url) {
            testStepsManager.setCurrentPageUrl(params.url);
          }

          process.stdout.write(JSON.stringify(response) + '\n');
        }
      }
    };

    // 所有请求都转发到 Playwright MCP
    serviceManager.processPlaywrightRequest(parsed, id, callback);
  } catch (error) {
    log(`处理请求时出错: ${error}`);

    const errorResponse = {
      jsonrpc: "2.0", 
      id: null, 
      error: {
        code: -32700, 
        message: "Parse error"
      }
    };

    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
}

// 创建接口来读取标准输入
const rl = readline.createInterface({
  input: process.stdin, 
  output: process.stdout, 
  terminal: false
});

// 监听来自客户端的请求
rl.on('line', async (input) => {
  if (input.trim()) {
    await handleRequest(input);
  }
});

// 清理函数，在程序退出时清理资源
process.on('SIGINT', () => {
  log('接收到 SIGINT 信号，正在清理...');

  serviceManager.cleanup();

  process.exit(0);
});

// 启动服务并等待其就绪
async function initializeService() {
  log('正在初始化 Playwright Script Generation MCP 服务...');

  // 确保 Playwright MCP 服务启动并就绪
  try {
    await serviceManager.startPlaywrightMcp();
    log('Playwright Script Generation MCP 服务已就绪');
  } catch (error) {
    log(`Playwright MCP 服务初始化失败: ${error.message}`);
    // 即使初始化失败，也继续运行，因为服务可能会稍后启动
    log('继续运行服务，等待 Playwright MCP 服务稍后启动');
  }
}

// 初始化服务
initializeService();