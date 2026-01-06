// script-generator.js - Node.js脚本生成相关工具函数模块，用于生成通过MCP协议调用Playwright服务的脚本
const fs = require('fs');
const path = require('path');
const config = require('./../config/service-config');

// 日志工具类
class Logger {
  static log(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(config.logging.logFile, logMessage);
  }
}

// 脚本模板生成器类
class ScriptTemplate {
  static initializeTestScript(url, browser = 'msedge') {
    const scriptLines = [
      "// 生成的 Node.js 自动化测试脚本 - 通过 MCP 协议调用 Playwright 服务",
      "const { spawn } = require('child_process');",
      "const readline = require('readline');",
      "",
      "async function runAutomation() {",
      "  console.log('启动 Playwright MCP 自动化测试');",
      "",
      "  // 启动 Playwright MCP 子进程",
      "  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';",
      "  const mcpProcess = spawn(npxCmd, ['@playwright/mcp@latest', '--browser', '" + browser + "'], {",
      "    stdio: ['pipe', 'pipe', 'pipe'],",
      "    shell: true",
      "  });",
      "",
      "  // 存储响应的 Promise 队列",
      "  const responsePromises = new Map();",
      "",
      "  // 监听 MCP 输出",
      "  mcpProcess.stdout.on('data', (data) => {",
      "    const output = data.toString().trim();",
      "    console.log('on data  output----->', output)",
      "    if (output) {",
      "      try {",
      "        const response = JSON.parse(output);",
      "        if (response.id && responsePromises.has(response.id)) {",
      "          const { resolve, reject } = responsePromises.get(response.id);",
      "          responsePromises.delete(response.id);",
      "          if (response.error) {",
      "            reject(new Error(`MCP Error: ${response.error.message}`));",
      "          } else {",
      "            resolve(response);",
      "          }",
      "        }",
      "      } catch (e) {",
      "        console.error('解析 MCP 响应失败:', e);",
      "      }",
      "    }",
      "  });",
      "",
      "  // 发送请求到 MCP 服务的函数",
      "  const sendRequest = (method, params) => {",
      "    return new Promise((resolve, reject) => {",
      "      const id = `req_${Date.now()}_${Math.random()}`;",
      "      const request = {",
      "        jsonrpc: '2.0',",
      "        method,",
      "        params,",
      "        id",
      "      };",
      "      responsePromises.set(id, { resolve, reject });",
      "      mcpProcess.stdin.write(JSON.stringify(request) + '\\n');",
      "      // 设置超时",
      "      setTimeout(() => {",
      "        if (responsePromises.has(id)) {",
      "          responsePromises.delete(id);",
      "          reject(new Error('MCP Request Timeout'));",
      "        }",
      "      }, 30000);",
      "    });",
      "  };",
      "",
      "  try {",
      "    // 初始化 MCP 服务",
      "    await sendRequest('initialize', {",
      "      protocolVersion: '2024-11-05',",
      "      clientInfo: { name: 'mcphost', version: '0.1.0' },",
      "      capabilities: {}",
      "    });",
      "    console.log('MCP 服务初始化完成');",
      "",
      "    // 导航到目标 URL",
      "    // await sendRequest('browser/navigate', { url: '" + (url || 'https://example.com') + "' });",
      "    // console.log('已导航到目标页面');"
    ];
    return scriptLines;
  }

  static finalizeTestScript(scriptLines) {
    scriptLines.push("    console.log('自动化测试执行完成');");
    scriptLines.push("  } catch (error) {");
    scriptLines.push("    console.error('自动化测试失败:', error.message);");
    scriptLines.push("    process.exit(1); // 测试失败退出码");
    scriptLines.push("  } finally {");
    scriptLines.push("    // 关闭 MCP 进程");
    scriptLines.push("    if (!mcpProcess.killed) {");
    scriptLines.push("      mcpProcess.kill();");
    scriptLines.push("    }");
    scriptLines.push("  }");
    scriptLines.push("}");
    scriptLines.push("");
    scriptLines.push("// 执行自动化测试");
    scriptLines.push("runAutomation();");
    return scriptLines;
  }
}

// 操作处理器类
class ActionHandler {
  // 添加操作到测试脚本
  static addStepToScript(scriptLines, action) {
    if (!action || typeof action !== 'object') {
      Logger.log('无效的操作对象');
      return scriptLines;
    }

    // 检查是否是 MCP 工具调用格式 (name/arguments)
    if (action.name && action.arguments !== undefined) {
      return this.handleMCPFormat(scriptLines, action);
    }

    // 否则是处理后的格式 (type/selector/value)
    const actionType = action.type;
    const selector = action.selector || '';
    const value = action.value || '';

    if (actionType === 'click') {
      scriptLines.push("    await sendRequest('page/click', { selector: '" + selector + "' });");
      scriptLines.push("    console.log('点击元素: " + selector + "');");
    } else if (actionType === 'fill') {
      scriptLines.push("    await sendRequest('page/fill', { selector: '" + selector + "', text: '" + value.replace(/'/g, "\\'") + "' });");
      scriptLines.push("    console.log('填充元素: " + selector + " 为 " + value.replace(/'/g, "\\'") + "');");
    } else if (actionType === 'wait') {
      scriptLines.push("    await new Promise(resolve => setTimeout(resolve, " + value + "));");
      scriptLines.push("    console.log('等待 " + value + " 毫秒');");
    } else if (actionType === 'screenshot') {
      scriptLines.push("    await sendRequest('page/screenshot', { path: '" + value.replace(/'/g, "\\'") + "' });");
      scriptLines.push("    console.log('截图保存到: " + value.replace(/'/g, "\\'") + "');");
    } else if (actionType === 'text') {
      scriptLines.push("    const textResult = await sendRequest('page/text', { selector: '" + selector + "' });");
      scriptLines.push("    console.log('元素文本: ' + textResult.result);");
    } else if (actionType === 'get_elements') {
      scriptLines.push("    const elementsResult = await sendRequest('page/elements', { selector: '" + selector + "' });");
      scriptLines.push("    console.log('找到元素数量: ' + elementsResult.result.length);");
    } else if (actionType === 'snapshot') {
      scriptLines.push("    const snapshotResult = await sendRequest('page/content', {});");
      scriptLines.push("    console.log('获取页面快照，长度: ' + snapshotResult.result.length);");
    } else if (actionType === 'navigate') {
      scriptLines.push("    await sendRequest('browser/navigate', { url: '" + value.replace(/'/g, "\\'") + "' });");
      scriptLines.push("    console.log('导航到: " + value.replace(/'/g, "\\'") + "');");
    } else if (actionType === 'press') {
      scriptLines.push("    await sendRequest('page/press', { selector: '" + selector + "', key: '" + value.replace(/'/g, "\\'") + "' });");
      scriptLines.push("    console.log('按键操作: " + selector + " 按下 " + value.replace(/'/g, "\\'") + "');");
    } else if (actionType === 'hover') {
      scriptLines.push("    await sendRequest('page/hover', { selector: '" + selector + "' });");
      scriptLines.push("    console.log('悬停操作: " + selector + "');");
    } else if (actionType.startsWith('browser/') || actionType.startsWith('page/') || actionType.startsWith('element/')) {
      // 处理通用浏览器操作
      if (action.params) {
        // 构造 MCP 请求参数
        scriptLines.push("    await sendRequest('" + actionType + "', " + JSON.stringify(action.params) + ");");
        scriptLines.push("    console.log('执行操作: " + actionType + "');");
      } else {
        scriptLines.push("    // 未处理的操作: " + actionType);
        Logger.log("未处理的通用浏览器操作: " + actionType);
      }
    } else {
      Logger.log("不支持的操作类型: " + actionType);
      scriptLines.push("    // 未支持的操作类型: " + actionType);
    }

    return scriptLines;
  }

  // 处理 MCP 工具调用格式 (name/arguments)
  static handleMCPFormat(scriptLines, action) {
    const name = action.name;
    const args = action.arguments || {};

    // 发送工具调用请求到 MCP 服务
    scriptLines.push("    await sendRequest('tools/call', { name: '" + name + "', arguments: " + JSON.stringify(args) + " });");
    scriptLines.push("    console.log('执行工具调用: " + name + "');");

    return scriptLines;
  }
}

// 脚本生成器主类
class ScriptGenerator {
  // 生成 Node.js 测试脚本文件（保留原函数名但生成Node.js脚本）
  static generateNodeScript(url, actions, filename) {
    // 从配置文件获取浏览器类型
    const browser = config.service.browser;

    if (!filename || typeof filename !== 'string') {
      filename = config.scriptGeneration.defaultFileName + '-' + Date.now() + '.js';  // 改为.js扩展名
    }

    if (!Array.isArray(actions)) {
      actions = [];
    }

    let scriptLines = ScriptTemplate.initializeTestScript(url, browser);

    // 为每个操作添加对应的 MCP 调用代码
    actions.forEach(action => {
      scriptLines = ActionHandler.addStepToScript(scriptLines, action);
    });

    scriptLines = ScriptTemplate.finalizeTestScript(scriptLines);

    try {
      // 确保输出目录存在
      const outputDir = path.dirname(filename);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
      }

      fs.writeFileSync(filename, scriptLines.join('\n'), 'utf8');
    } catch (error) {
      Logger.log('写入文件失败: ' + error.message);
      return {
        status: "error",
        message: '写入文件失败: ' + error.message,
        generated_script_file: null
      };
    }

    return {
      status: "success",
      message: '已成功生成包含 ' + actions.length + ' 个自动化步骤的 Node.js 测试脚本',
      generated_script_file: filename
    };
  }

}

module.exports = {
  log: Logger.log,
  generateNodeScript: ScriptGenerator.generateNodeScript
};