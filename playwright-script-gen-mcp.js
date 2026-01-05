#!/usr/bin/env node

// playwright-script-gen-mcp.js - 一个包装 playwright-mcp 并增加 Python 脚本生成功能的 MCP 服务

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {
  log, generatePythonScript
} = require('./modules/script-generator');
const {
  spawn
} = require('./modules/service-manager');
const config = require('./config/service-config');

// 定义testSteps文件路径
const testStepsFilePath = path.join(__dirname, 'testSteps.txt');

// 存储测试步骤的数组
let testSteps = loadTestSteps();
let currentPageUrl = '';


// 从testSteps文件中加载历史操作记录
function loadTestSteps() {
  let list = []
  if (fs.existsSync(testStepsFilePath)) {
    try {
      const data = fs.readFileSync(testStepsFilePath, 'utf8');
      list = JSON.parse(data);
      log(`从 ${testStepsFilePath} 加载了 ${testSteps.length} 个历史操作记录`);
    } catch (error) {
      log(`读取 testSteps 文件失败: ${error.message}`);
      list = [];
    }
  } else {
    list = [];
    log('testSteps 文件不存在，初始化为空数组');
  }

  return list
}

// 保存测试步骤到testSteps文件
function saveTestSteps(testSteps) {
  try {
    fs.writeFileSync(testStepsFilePath, JSON.stringify(testSteps, null, 2), 'utf8');
    log(`测试步骤已保存到 ${testStepsFilePath}`);
  } catch (error) {
    log(`保存 testSteps 文件失败: ${error.message}`);
  }
}

// 清除testSteps文件中的历史记录
function clearTestSteps() {
  testSteps = [];
  try {
    if (fs.existsSync(testStepsFilePath)) {
      fs.writeFileSync(testStepsFilePath, '[]', 'utf8');
      log(`已清除 ${testStepsFilePath} 中的历史记录`);
    }
  } catch (error) {
    log(`清除 testSteps 文件失败: ${error.message}`);
  }
}


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
      return params
  }
}

// 检查方法是否是浏览器操作
function isBrowserOperation(method) {
  return method.startsWith('browser/') ||
    method.startsWith('page/') ||
    method.startsWith('element/');
}

// Playwright MCP 服务连接管理
let isPlaywrightMcpReady = false;
let pendingRequests = []; // 存储等待服务启动的请求

// 存储待处理请求的回调函数
const pendingCallbacks = new Map();

// 用于健康检查的定时器
let healthCheckInterval = null;
const HEALTH_CHECK_INTERVAL = config.healthCheck.interval; // 从配置文件获取健康检查间隔

// Playwright MCP 实例
let mockPlaywrightMcpInstance = null;

const playwright_script_generator_tool = {
  name: config.tools.playwright_script_generator.name,
  description: config.tools.playwright_script_generator.description,
  inputSchema: null
}

// 执行健康检查
function performHealthCheck() {
  // 检查是否有一个模拟的实例
  if (!mockPlaywrightMcpInstance) {
    // 如果没有实例，尝试连接或启动 playwright-mcp
    connectToPlaywrightMcp();
    return;
  }

  if (!mockPlaywrightMcpInstance.stdin) {
    // 如果实例的 stdin 不可用，停止健康检查
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
    isPlaywrightMcpReady = false;
    return;
  }

  // 发送一个简单的探针请求来检查服务是否就绪
  const probeRequest = {
    method: config.healthCheck.method,  // 从配置文件获取健康检查方法
    id: `health_check_${Date.now()}`, jsonrpc: '2.0'
  };

  try {
    log(`发送健康检查探针请求: ${JSON.stringify(probeRequest)}`);
    mockPlaywrightMcpInstance.stdin.write(JSON.stringify(probeRequest) + '\n');
  } catch (err) {
    log(`发送健康检查请求失败: ${err.message}`);
    isPlaywrightMcpReady = false;
  }
}

// 连接到 playwright-mcp 服务
export function connectToPlaywrightMcp() {
  log('尝试连接到 Playwright MCP 服务...');

  // 启动 playwright-mcp 子进程
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  mockPlaywrightMcpInstance = spawn(npxCmd, ['@playwright/mcp@latest', '--browser', config.service.browser], {
    stdio: ['pipe', 'pipe', 'pipe'], shell: true
  });

  // 监听服务输出
  mockPlaywrightMcpInstance.stdout.on('data', (data) => {
    const output = data.toString();
    // 注意：不要将来自 playwright-mcp 的原始输出记录到 stdout，因为这会干扰 MCP 协议
    log(`Playwright MCP 输出: ${output}`);

    // 检查是否是健康检查的响应
    try {
      const response = JSON.parse(output);

      log(`Playwright MCP Response 输出: ${JSON.stringify(response)}    hase id:${response.id}`,);

      if (response.id !== undefined && response.id !== null && String(response.id).startsWith('health_check_')) {
        log(`Playwright MCP Response  health_check_ 检查: `,);
        // 这是健康检查的响应，说明服务已就绪
        if (!isPlaywrightMcpReady) {
          isPlaywrightMcpReady = true;
          log('Playwright MCP 服务通过健康检查已就绪');

          // 启动健康检查定时器
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
          }
          healthCheckInterval = setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL);

          // 处理等待的请求
          processPendingRequests();
        }

        return
      }

      if (response.id !== undefined && response.id !== null) {
        // 检查是否有对应的回调函数
        if (pendingCallbacks.has(response.id)) {
          const callback = pendingCallbacks.get(response.id);
          pendingCallbacks.delete(response.id); // 移除已处理的回调
          callback(null, response); // 调用回调函数处理响应
        } else {
          // 如果没有找到对应的回调，直接将响应写入到 stdout
          process.stdout.write(output + '\n');
        }


      }
    } catch (parseError) {
      // 如果解析失败，可能是非 JSON 数据或空行，直接输出到 stdout
      // 但要小心，这可能会干扰 MCP 协议
      log(`parseError ---->  ${parseError.toLocaleString()}`)
    }
  });

  // 监听错误
  mockPlaywrightMcpInstance.stderr.on('data', (data) => {
    log(`Playwright MCP 错误: ${data}`);
    // 注意：错误输出不应该发送到 stdout，因为它不是 MCP 协议的一部分
  });

  // 监听进程关闭
  mockPlaywrightMcpInstance.on('close', (code) => {
    log(`Playwright MCP 进程退出，代码 ${code}`);
    mockPlaywrightMcpInstance = null;
    isPlaywrightMcpReady = false;

    // 停止健康检查定时器
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }

    // 如果不是预期关闭，尝试重启
    if (code !== 0) {
      log('尝试重启 Playwright MCP 服务...');
      setTimeout(() => {
        connectToPlaywrightMcp();
      }, 1000);
    }
  });

  // 监听进程错误
  mockPlaywrightMcpInstance.on('error', (err) => {
    log(`连接 Playwright MCP 时出错: ${err}`);
    mockPlaywrightMcpInstance = null;
    isPlaywrightMcpReady = false;

    // 停止健康检查定时器
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  });

  // 发送初始健康检查请求
  setTimeout(() => {
    if (mockPlaywrightMcpInstance) {
      performHealthCheck();
    }
  }, 500); // 等待500毫秒后发送第一个健康检查请求
}

// 启动 Playwright MCP 服务
function startPlaywrightMcp() {
  return new Promise((resolve, reject) => {
    if (mockPlaywrightMcpInstance) {
      // 如果实例已存在，直接返回
      if (isPlaywrightMcpReady) {
        log('Playwright MCP 服务已存在且就绪');
        resolve(mockPlaywrightMcpInstance);
      } else {
        log('Playwright MCP 服务正在连接，等待就绪');
        // 等待服务准备好
        const checkReady = setInterval(() => {
          if (isPlaywrightMcpReady) {
            clearInterval(checkReady);
            resolve(mockPlaywrightMcpInstance);
          }
        }, 100);
      }
      return;
    }

    // 连接到 Playwright MCP 服务
    connectToPlaywrightMcp();

    // 等待服务准备好
    const checkReady = setInterval(() => {
      if (isPlaywrightMcpReady) {
        clearInterval(checkReady);
        resolve(mockPlaywrightMcpInstance);
      }
    }, 100);

    // 设置超时
    setTimeout(() => {
      clearInterval(checkReady);
      if (!isPlaywrightMcpReady) {
        reject(new Error('连接到 Playwright MCP 服务超时'));
      }
    }, config.service.timeout); // 使用配置文件中的超时时间
  });
}

// 创建接口来读取标准输入
const rl = readline.createInterface({
  input: process.stdin, output: process.stdout, terminal: false
});

// 处理等待的请求
function processPendingRequests() {
  log(`处理 ${pendingRequests.length} 个等待的请求`);
  while (pendingRequests.length > 0) {
    const {request, id, callback} = pendingRequests.shift();
    processPlaywrightRequest(request, id, callback);
  }
}

// 向 Playwright MCP 发送请求
function sendToPlaywrightMcp(request, id, callback) {
  // 使用健康检查机制判断服务是否就绪
  if (!mockPlaywrightMcpInstance || !isPlaywrightMcpReady) {
    log('Playwright MCP 服务未就绪，将请求添加到队列中');
    // 如果服务未准备好，将请求添加到队列中
    pendingRequests.push({request: request, id: id, callback: callback});
    return;
  }

  const mcpRequest = JSON.stringify(request) + '\n';

  try {
    log(`向 Playwright MCP 发送请求: ${JSON.stringify(request)}`);
    mockPlaywrightMcpInstance.stdin.write(mcpRequest);

    // 存储回调函数，用于处理响应
    if (callback) {
      pendingCallbacks.set(id, callback);
    }
  } catch (err) {
    log(`向 Playwright MCP 发送请求时出错: ${err}`);
    // 尝试重启服务
    mockPlaywrightMcpInstance = null;
    isPlaywrightMcpReady = false;

    // 停止健康检查定时器
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }

    startPlaywrightMcp().then(() => {
      // 重新发送请求
      sendToPlaywrightMcp(request, id, callback);
    });
  }
}

// 处理 Playwright 请求
function processPlaywrightRequest(request, id, callback) {
  // 使用健康检查机制判断服务是否就绪
  if (!isPlaywrightMcpReady) {
    log('Playwright MCP 服务未就绪，将请求添加到队列中');
    // 如果服务未准备好，将请求添加到队列中
    pendingRequests.push({request: request, id: id, callback: callback});
    return;
  }

  log(`处理 Playwright 请求: ${JSON.stringify(request)}`);
  sendToPlaywrightMcp(request, id, callback);
}

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

      log(`playwright_script_generator  testSteps---> ${JSON.stringify(testSteps)}`)

      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
      }

      const generationResult = generatePythonScript(currentPageUrl, loadTestSteps(), fileName);  // 使用相同的函数（现在生成Node.js脚本）

      // 读取生成的脚本内容
      let scriptContent = [{
        "type": "text", "text": `脚本保存在文件地址：  ${fileName}`
      }];


      // if (generationResult.generated_script_file && fs.existsSync(generationResult.generated_script_file)) {
      // scriptContent = fs.readFileSync(generationResult.generated_script_file, 'utf8');
      // }


      // 返回结果，包含 content 字段
      const clientResponse = {
        jsonrpc: "2.0", id: id, result: {
          ...generationResult, content: scriptContent
        }
      };

      log(`playwright_script_generator 工具执行完毕 ${JSON.stringify(clientResponse)}`)
      process.stdout.write(JSON.stringify(clientResponse) + '\n');

      // 生成脚本后清除历史记录
      clearTestSteps();
      return
    }


    // 确保 Playwright MCP 服务已启动（仅在实例不存在时启动）
    if (!mockPlaywrightMcpInstance) {
      await startPlaywrightMcp();
    }

    // 检查是否是其他可能的操作，如果是则记录到testSteps（除了生成脚本的调用）
    // 尝试从params中提取操作信息并添加到testSteps
    if (method === 'tools/call' && params && params.name !== 'playwright_script_generator') {
      const action = extractActionFromMethod(method, params);
      testSteps.push(action);
      log(`记录操作到testSteps: ${JSON.stringify(action)}`);

      // 保存到testSteps文件
      saveTestSteps(testSteps);
    }


    // 定义回调函数处理响应
    const callback = (error, response) => {
      if (error) {
        log(`处理方法 ${method} 时出错: ${error.message}`);

        const errorResponse = {
          jsonrpc: "2.0", id: id, error: {
            code: -32603, message: `处理请求时出错: ${error.message}`
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
            ...response, result: {
              tools: mergedTools
            }
          };

          process.stdout.write(JSON.stringify(clientResponse) + '\n');
        } else {
          // 对于其他方法，直接返回原始响应
          // 检查是否是导航操作，如果是则更新当前页面URL
          if (method === 'browser/navigate' && params && params.url) {
            currentPageUrl = params.url;
          }

          process.stdout.write(JSON.stringify(response) + '\n');
        }
      }
    };

    // 所有请求都转发到 Playwright MCP
    processPlaywrightRequest(parsed, id, callback);
  } catch (error) {
    log(`处理请求时出错: ${error}`);

    const errorResponse = {
      jsonrpc: "2.0", id: null, error: {
        code: -32700, message: "Parse error"
      }
    };

    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
}

// 监听来自客户端的请求
rl.on('line', async (input) => {
  if (input.trim()) {
    await handleRequest(input);
  }
});

// 清理函数，在程序退出时清理资源
process.on('SIGINT', () => {
  log('接收到 SIGINT 信号，正在清理...');

  // 停止健康检查定时器
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // 关闭 playwright-mcp 实例
  if (mockPlaywrightMcpInstance) {
    mockPlaywrightMcpInstance.kill();
  }

  process.exit(0);
});

// 启动服务并等待其就绪
async function initializeService() {
  log('正在初始化 Playwright Script Generation MCP 服务...');

  // 确保 Playwright MCP 服务启动并就绪
  try {
    await startPlaywrightMcp();
    log('Playwright Script Generation MCP 服务已就绪');
  } catch (error) {
    log(`Playwright MCP 服务初始化失败: ${error.message}`);
    // 即使初始化失败，也继续运行，因为服务可能会稍后启动
    log('继续运行服务，等待 Playwright MCP 服务稍后启动');
  }
}

// 初始化服务
initializeService();