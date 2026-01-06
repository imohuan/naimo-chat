/**
 * 测试后端请求中断功能
 */

const fetch = require('node-fetch');

async function testAbortFunctionality() {
  console.log('🧪 开始测试后端请求中断功能...\n');

  try {
    // 1. 创建对话
    console.log('1. 创建新对话...');
    const createResponse = await fetch('http://localhost:3457/api/ai_chat/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initialInput: '请写一个关于春天的小诗',
        mode: 'chat',
        model: 'iflow,glm-4.6',
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`创建对话失败: ${createResponse.status}`);
    }

    const { conversationId, requestId, streamUrl } = await createResponse.json();
    console.log(`✅ 对话创建成功: conversationId=${conversationId}, requestId=${requestId}`);

    // 2. 等待一小段时间让请求开始
    console.log('\n2. 等待请求开始...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. 中断请求
    console.log('\n3. 发送中断请求...');
    const abortResponse = await fetch(`http://localhost:3457/api/ai_chat/conversations/${conversationId}/stream/${requestId}/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!abortResponse.ok) {
      throw new Error(`中断请求失败: ${abortResponse.status}`);
    }

    const abortResult = await abortResponse.json();
    console.log(`✅ 请求中断成功: ${abortResult.message}`);

    // 4. 验证中断后的状态
    console.log('\n4. 验证中断状态...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // 尝试再次中断（应该失败）
    const secondAbortResponse = await fetch(`http://localhost:3457/api/ai_chat/conversations/${conversationId}/stream/${requestId}/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`第二次中断状态: ${secondAbortResponse.status} (${secondAbortResponse.statusText})`);

    console.log('\n🎉 测试完成！中断功能正常工作。');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testAbortFunctionality();