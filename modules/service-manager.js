// service-manager.js - Playwright MCP 服务管理模块

const { spawn } = require('child_process');
const { log } = require('./script-generator');

// 检查 npx 是否可用
function isNpxAvailable() {
  return new Promise((resolve) => {
    // 检测操作系统，Windows 上使用 npx.cmd
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    
    const testNpx = spawn(npxCmd, ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true  // 使用 shell 来确保 PATH 环境变量被正确使用
    });

    testNpx.on('error', (err) => {
      log(`npx 命令不可用: ${err.message}`);
      resolve(false);
    });

    testNpx.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// 检查 playwright-mcp 是否已安装
function isPlaywrightMcpInstalled() {
  return new Promise((resolve) => {
    // 检测操作系统，Windows 上使用 npx.cmd
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    
    const testPw = spawn(npxCmd, ['@playwright/mcp@latest', '--help'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    testPw.on('error', (err) => {
      log(`Playwright MCP 未安装或不可用: ${err.message}`);
      resolve(false);
    });

    testPw.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

module.exports = {
  isNpxAvailable,
  isPlaywrightMcpInstalled,
  spawn
};