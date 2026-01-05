// script-generator.js - Python脚本生成相关工具函数模块

const fs = require('fs');
const path = require('path');

// 日志函数
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(path.join(__dirname, '..', 'playwright-script-gen-mcp.log'), logMessage);
}

// 初始化测试脚本内容
function initializeTestScript(url) {
  const scriptLines = [
    "# 生成的 Playwright 自动化测试脚本",
    "from playwright.sync_api import sync_playwright",
    "",
    "def run_automation():",
    "    with sync_playwright() as p:",
    "        browser = p.chromium.launch(headless=False)",
    "        page = browser.new_page()",
    `        page.goto('${url || 'https://example.com'}')`
  ];
  return scriptLines;
}

// 添加操作到测试脚本
function addStepToScript(scriptLines, action) {
  if (!action || typeof action !== 'object') {
    log('无效的操作对象');
    return scriptLines;
  }

  // 检查是否是 MCP 工具调用格式 (name/arguments)
  if (action.name && action.arguments) {
    return handleMCPFormat(scriptLines, action);
  }
  
  // 否则是处理后的格式 (type/selector/value)
  const actionType = action.type;
  const selector = action.selector || '';
  const value = action.value || '';

  if (actionType === 'click') {
    scriptLines.push(`        page.click('${selector}')`);
  } else if (actionType === 'fill') {
    scriptLines.push(`        page.fill('${selector}', '${value}')`);
  } else if (actionType === 'wait') {
    scriptLines.push(`        page.wait_for_timeout(${value})`);
  } else if (actionType === 'screenshot') {
    scriptLines.push(`        page.screenshot(path='${value}')`);
  } else if (actionType === 'text') {
    scriptLines.push(`        text = page.locator('${selector}').text_content()`);
    scriptLines.push("        print(f'元素文本: {text}')");
  } else if (actionType === 'get_elements') {
    scriptLines.push(`        elements = page.query_selector_all('${selector}')`);
    scriptLines.push("        print(f'找到 {len(elements)} 个元素: {elements}')");
  } else if (actionType === 'snapshot') {
    scriptLines.push("        content = page.content()");
    scriptLines.push("        print(f'页面快照: {content[:200]}...')");
  } else if (actionType === 'navigate') {
    scriptLines.push(`        page.goto('${value}')`);
  } else if (actionType === 'press') {
    scriptLines.push(`        page.press('${selector}', '${value}')`);
  } else if (actionType === 'hover') {
    scriptLines.push(`        page.hover('${selector}')`);
  } else if (actionType.startsWith('browser_') || actionType.startsWith('page_') || actionType.startsWith('element_')) {
    // 处理通用浏览器操作，这些是通过 isBrowserOperation 检测到但未被 extractActionFromMethod 处理的操作
    // 将操作类型转换回原始的浏览器方法调用
    if (action.params) {
      // 根据操作类型和参数生成适当的代码
      if (actionType === 'browser_navigate') {
        const url = action.params.url || 'https://example.com';
        scriptLines.push(`        page.goto('${url}')`);
      } else if (actionType === 'page_goto') {
        const url = action.params.url || 'https://example.com';
        scriptLines.push(`        page.goto('${url}')`);
      } else {
        // 对于无法明确处理的通用操作，记录为注释
        scriptLines.push(`        # 未处理的操作: ${actionType}, 参数: ${JSON.stringify(action.params)}`);
        log(`未处理的通用浏览器操作: ${actionType}`);
      }
    } else {
      scriptLines.push(`        # 未处理的操作: ${actionType}`);
      log(`未处理的通用浏览器操作: ${actionType}`);
    }
  } else {
    log(`不支持的操作类型: ${actionType}`);
  }

  return scriptLines;
}

// 处理 MCP 工具调用格式 (name/arguments)
function handleMCPFormat(scriptLines, action) {
  const name = action.name;
  const args = action.arguments || {};

  switch (name) {
    case 'browser_navigate':
      scriptLines.push(`        page.goto('${args.url || 'https://example.com'}')`);
      break;
    case 'browser_fill_form':
      if (args.fields && args.fields.length > 0) {
        const field = args.fields[0];
        scriptLines.push(`        page.fill('${field.ref}', '${field.value}')`);
      }
      break;
    case 'browser_click':
      scriptLines.push(`        page.click('${args.ref}')`);
      break;
    case 'browser_type':
      scriptLines.push(`        page.fill('${args.ref}', '${args.text}')`);
      break;
    case 'browser_close':
      // 不在自动化步骤中直接关闭浏览器，让脚本在最后统一关闭
      // scriptLines.push('        browser.close()');
      break;
    case 'browser_snapshot':
      scriptLines.push('        content = page.content()');
      scriptLines.push("        print(f'页面快照: {content[:200]}...')");
      break;
    case 'browser_wait_for':
      scriptLines.push(`        page.wait_for_timeout(${args.time ? args.time * 1000 : 1000})`);
      break;
    case 'browser_take_screenshot':
      scriptLines.push(`        page.screenshot(path='${args.filename || 'screenshot.png'}')`);
      break;
    case 'browser_hover':
      scriptLines.push(`        page.hover('${args.ref}')`);
      break;
    case 'browser_select_option':
      scriptLines.push(`        page.locator('${args.ref}').click()`);
      scriptLines.push(`        page.locator('${args.values[0]}').click()`);
      break;
    default:
      log(`不支持的MCP操作类型: ${name}`);
      scriptLines.push(`        # 未处理的操作: ${name}, 参数: ${JSON.stringify(args)}`);
  }

  return scriptLines;
}

// 完成测试脚本
function finalizeTestScript(scriptLines) {
  scriptLines.push("        browser.close()");
  scriptLines.push("");
  scriptLines.push("if __name__ == '__main__':");
  scriptLines.push("    run_automation()");
  return scriptLines;
}

// 生成 Python 测试脚本文件
function generatePythonScript(url, actions, filename) {
  if (!filename || typeof filename !== 'string') {
    filename = `test-${Date.now()}.py`;
  }

  if (!Array.isArray(actions)) {
    actions = [];
  }

  let scriptLines = initializeTestScript(url);

  // 为每个操作添加对应的 Python 代码
  actions.forEach(action => {
    scriptLines = addStepToScript(scriptLines, action);
  });

  scriptLines = finalizeTestScript(scriptLines);

  try {
    fs.writeFileSync(filename, scriptLines.join('\n'), 'utf8');
  } catch (error) {
    log(`写入文件失败: ${error.message}`);
    return {
      status: "error",
      message: `写入文件失败: ${error.message}`,
      generated_script_file: null
    };
  }

  return {
    status: "success",
    message: `已成功生成包含 ${actions.length} 个自动化步骤的测试脚本`,
    generated_script_file: filename
  };
}

module.exports = {
  log,
  generatePythonScript,
};