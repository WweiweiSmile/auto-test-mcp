// 生成的 Node.js 自动化测试脚本 - 通过 MCP 协议调用 Playwright 服务
const { spawn } = require('child_process');
const readline = require('readline');

async function runAutomation() {
  console.log('启动 Playwright MCP 自动化测试');

  // 启动 Playwright MCP 子进程
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const mcpProcess = spawn(npxCmd, ["@playwright/mcp@latest","--browser","msedge"], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });

  // 存储响应的 Promise 队列
  const responsePromises = new Map();

  // 监听 MCP 输出
  mcpProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      try {
        const response = JSON.parse(output);
        if (response.id && responsePromises.has(response.id)) {
          const { resolve, reject } = responsePromises.get(response.id);
          responsePromises.delete(response.id);
          if (response.error) {
            reject(new Error(`MCP Error: ${response.error.message}`));
          } else {
            resolve(response);
          }
        }
      } catch (e) {
        console.error('解析 MCP 响应失败:', e);
      }
    }
  });

  // 发送请求到 MCP 服务的函数
  const sendRequest = (method, params) => {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random()}`;
      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
      };
      responsePromises.set(id, { resolve, reject });
      mcpProcess.stdin.write(JSON.stringify(request) + '\n');
      // 设置超时
      setTimeout(() => {
        if (responsePromises.has(id)) {
          responsePromises.delete(id);
          reject(new Error('MCP Request Timeout'));
        }
      }, 30000);
    });
  };

  try {
    // 初始化 MCP 服务
    await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'mcphost', version: '0.1.0' },
      capabilities: {}
    });
    console.log('MCP 服务初始化完成');

    // 导航到目标 URL
    // await sendRequest('browser/navigate', { url: 'https://example.com' });
    // console.log('已导航到目标页面');
    await sendRequest('tools/call', { name: 'browser_navigate', arguments: {"url":"https://www.bilibili.com"} });
    console.log('执行工具调用: browser_navigate');
    await sendRequest('tools/call', { name: 'browser_fill_form', arguments: {"fields":[{"name":"搜索框","ref":"e35","type":"textbox","value":"ai"}]} });
    console.log('执行工具调用: browser_fill_form');
    await sendRequest('tools/call', { name: 'browser_click', arguments: {"element":"搜索按钮","ref":"e37"} });
    console.log('执行工具调用: browser_click');
    await sendRequest('tools/call', { name: 'browser_tabs', arguments: {"action":"select","index":2} });
    console.log('执行工具调用: browser_tabs');
    await sendRequest('tools/call', { name: 'browser_click', arguments: {"element":"第一个视频链接","ref":"e175"} });
    console.log('执行工具调用: browser_click');
    await sendRequest('tools/call', { name: 'browser_tabs', arguments: {"action":"select","index":3} });
    console.log('执行工具调用: browser_tabs');
    await sendRequest('tools/call', { name: 'browser_click', arguments: {"element":"点赞按钮","ref":"e293"} });
    console.log('执行工具调用: browser_click');
    console.log('自动化测试执行完成');
  } catch (error) {
    console.error('自动化测试失败:', error.message);
    process.exit(1); // 测试失败退出码
  } finally {
    // 关闭 MCP 进程
    if (!mcpProcess.killed) {
      mcpProcess.kill();
    }
  }
}

// 执行自动化测试
runAutomation();