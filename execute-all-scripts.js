const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 定义脚本目录
const scriptDir = 'E:/Codes/auto-test-mcp/generated-scripts';

// 获取目录下所有.js文件
const jsFiles = fs.readdirSync(scriptDir).filter(file => path.extname(file).toLowerCase() === '.js');

console.log(`找到 ${jsFiles.length} 个JS脚本文件`);
console.log('开始执行脚本...\n');

// 记录执行结果
const results = {
  success: [],
  failed: []
};

// 依次执行每个JS脚本
jsFiles.forEach(file => {
  const filePath = path.join(scriptDir, file);
  console.log(`正在执行: ${file}`);
  
  try {
    // 使用node命令执行JS文件
    const output = execSync(`node "${filePath}"`, { encoding: 'utf-8' });
    
    // 检查输出是否包含成功标志
    if (output.includes('自动化测试执行完成')) {
      console.log(`✓ ${file} 执行成功`);
      console.log(`输出: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}\n`);
      results.success.push({ file: file, output: output });
    } else {
      console.log(`✗ ${file} 执行失败 - 未找到成功标志`);
      console.log(`输出: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}\n`);
      results.failed.push({ file: file, error: '未找到成功标志: 自动化测试执行完成' });
    }
  } catch (error) {
    console.log(`✗ ${file} 执行失败`);
    console.log(`错误: ${error.message}\n`);
    results.failed.push({ file: file, error: error.message });
  }
});

// 输出最终统计结果
console.log('='.repeat(50));
console.log('执行完成！统计结果：');
console.log(`成功执行: ${results.success.length} 个脚本`);
console.log(`执行失败: ${results.failed.length} 个脚本`);

if (results.success.length > 0) {
  console.log('\n成功执行的脚本:');
  results.success.forEach(result => {
    console.log(`  ✓ ${result.file}`);
  });
}

if (results.failed.length > 0) {
  console.log('\n执行失败的脚本:');
  results.failed.forEach(result => {
    console.log(`  ✗ ${result.file}`);
  });
}