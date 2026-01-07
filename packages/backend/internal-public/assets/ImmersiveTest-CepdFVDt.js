import{$t as e,Pt as t,Vn as n,Xt as r,en as i,gn as a,jn as o,qn as s,qt as c,w as l}from"./index-urHyhAmF.js";import"./editor.api-CN-1LKou.js";import"./monaco.contribution-DPTc76V3.js";import"./SelectValue-BI7pjivR.js";import{t as u}from"./immersive-code-BxELHjtE.js";import"./CodeEditor-BYu0j6s-.js";var d={class:`w-full h-screen bg-slate-100 flex flex-col overflow-hidden`},f={class:`w-full max-w-[100vw] flex-1 flex flex-col min-h-0 px-4 py-4`},p={class:`mb-4 shrink-0`},m={class:`space-y-3`},h={class:`flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm`},g={class:`flex items-center space-x-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap`},_={class:`flex items-center space-x-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap`},v={class:`flex-1 min-h-0`},y=i({__name:`ImmersiveTest`,setup(i){let y=n(),b=n(!1),x=n(!1),{pushToast:S}=l();function C(e){S(`错误: ${e}`,`error`)}function w(e,t){console.log(`=== 选中元素信息 ===`),console.log(`选择器 (Selector):`,e),t?(console.log(`标签名 (Tag):`,t.tagName),console.log(`ID:`,t.id||`(无)`),console.log(`类名 (Classes):`,t.classList.length>0?t.classList:`(无)`),console.log(`文本内容 (Text):`,t.textContent||`(无)`),console.log(`位置信息 (Position):`,t.position),console.log(`样式信息 (Styles):`,t.styles),console.log(`属性 (Attributes):`,t.attributes),console.log(`完整数据对象:`,t)):console.log(`完整数据:`,{selector:e,timestamp:new Date().toISOString(),type:`element-selected`}),console.log(`===================`),S(`已选中元素: ${t?.tagName?`${t.tagName}${t.id?`#`+t.id:``}${t.classList.length>0?`.`+t.classList.join(`.`):``}`:e}`,`success`)}function T(){y.value&&y.value.addMajorVersion(void 0,`Major Version ${new Date().toLocaleTimeString()}`)}function E(){if(y.value){let e=y.value.getCurrentCode();console.log(e),alert(`Current Code retrieved! Check console.`)}}function D(){if(y.value){let e=y.value.diff(`------- SEARCH
<h1 class="text-3xl font-bold text-gray-900 mb-2">测试UI</h1>
=======
<p class="font-mono text-sm">Hello Immersive World</p>
<p class="text-xs text-gray-300 mt-2">Power by Naimo</p>
+++++++ REPLACE
`);e.success?console.log(`Diff UI Opened`):alert(`Diff 失败：${e.message}`)}}function O(){if(y.value){let e=y.value.diff(`------- SEARCH
<h1 class="text-4xl font-bold mb-4">Code Immersive</h1>
=======
<h1 class="text-4xl font-bold mb-4">代码沉浸式编辑器</h1>
+++++++ REPLACE
------- SEARCH
<p class="text-lg opacity-90 mb-8">Edit the code to see live changes!</p>
=======
<p class="text-lg opacity-90 mb-8">编辑代码以查看实时更改！</p>
+++++++ REPLACE
`);e.success?console.log(`Diff UI Opened for multiple changes`):alert(`多处 Diff 失败：${e.message}`)}}async function k(){if(!y.value)return;let e=y.value,t=e.getCurrentCode(),n=[t.substring(0,100),t.substring(0,200),t.substring(0,300),t.substring(0,400),t.substring(0,500),t];S(`开始流式写入...`,`info`),e.startStreaming();try{for(let t=0;t<n.length;t++)e.streamWrite(n[t]),S(`流式写入中... ${t+1}/${n.length}`,`info`),await new Promise(e=>setTimeout(e,300));S(`流式写入完成！`,`success`)}catch(e){console.error(`流式写入错误:`,e),S(`流式写入失败`,`error`)}finally{e.endStreaming()}}async function A(){if(!y.value)return;let e=y.value,t=`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 生成的页面</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-gradient-to-br from-purple-400 to-pink-400 min-h-screen flex items-center justify-center">
  <div class="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
    <h1 class="text-3xl font-bold text-gray-800 mb-4">欢迎使用</h1>
    <p class="text-gray-600 mb-6">这是一个由 AI 流式生成的页面</p>
    <button class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition">
      开始体验</button>  </div>
</body>
</html>`.replace(/\n/g,``);S(`开始 AI 流式生成代码...`,`info`),e.startStreaming();try{let n=``;for(let r=0;r<t.length;r++)n+=t[r],e.streamWrite(n),r%10==0&&await new Promise(e=>setTimeout(e,50));S(`AI 代码生成完成！`,`success`)}catch(e){console.error(`AI 流式写入错误:`,e),S(`AI 代码生成失败`,`error`)}finally{e.endStreaming()}}async function j(){if(!y.value)return;let e=y.value,t=e.getCurrentCode(),n=[`
<!-- 这是第一行注释 -->`,`
<!-- 这是第二行注释 -->`,`
<div class='new-section'>`,`
  <p>新增的内容</p>`,`
</div>`];S(`开始增量流式写入...`,`info`),e.startStreaming();try{let r=t;for(let t=0;t<n.length;t++)r+=n[t],e.streamWrite(r),S(`添加第 ${t+1} 个片段...`,`info`),await new Promise(e=>setTimeout(e,400));S(`增量写入完成！`,`success`)}catch(e){console.error(`增量流式写入错误:`,e),S(`增量写入失败`,`error`)}finally{e.endStreaming()}}return(n,i)=>(a(),r(`div`,d,[c(`div`,f,[c(`div`,p,[i[7]||=c(`div`,{class:`mb-3`},[c(`h1`,{class:`text-2xl font-bold text-slate-800`},` Immersive Code Component Test `),c(`p`,{class:`text-slate-500 text-sm`},` Testing the history, preview, and console integration. `)],-1),c(`div`,m,[c(`div`,h,[c(`label`,g,[o(c(`input`,{type:`checkbox`,"onUpdate:modelValue":i[0]||=e=>b.value=e,class:`rounded text-purple-600 focus:ring-purple-500 w-4 h-4`},null,512),[[t,b.value]]),i[2]||=c(`span`,null,`Enable Share`,-1)]),c(`label`,_,[o(c(`input`,{type:`checkbox`,"onUpdate:modelValue":i[1]||=e=>x.value=e,class:`rounded text-blue-600 focus:ring-blue-500 w-4 h-4`},null,512),[[t,x.value]]),i[3]||=c(`span`,null,`只读模式`,-1)]),i[4]||=c(`div`,{class:`h-4 w-px bg-slate-200`},null,-1),c(`button`,{onClick:T,class:`px-3 py-1.5 text-sm bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition font-medium whitespace-nowrap min-w-fit`},` Add Major Version `),c(`button`,{onClick:E,class:`px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition font-medium whitespace-nowrap min-w-fit`},` Get Current Code `)]),c(`div`,{class:`flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm`},[i[5]||=c(`span`,{class:`text-sm font-semibold text-slate-700 whitespace-nowrap`},`Diff 測試：`,-1),c(`button`,{onClick:D,class:`px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition font-medium whitespace-nowrap min-w-fit`},` 应用单处 Diff `),c(`button`,{onClick:O,class:`px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition font-medium whitespace-nowrap min-w-fit`},` 应用多处 Diff `)]),c(`div`,{class:`flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm`},[i[6]||=c(`span`,{class:`text-sm font-semibold text-slate-700 whitespace-nowrap`},`流式写入测试：`,-1),c(`button`,{onClick:k,class:`px-3 py-1.5 text-sm bg-cyan-50 text-cyan-600 rounded hover:bg-cyan-100 transition font-medium whitespace-nowrap min-w-fit`},` 基础流式写入 `),c(`button`,{onClick:A,class:`px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition font-medium whitespace-nowrap min-w-fit`},` AI 流式生成 `),c(`button`,{onClick:j,class:`px-3 py-1.5 text-sm bg-teal-50 text-teal-600 rounded hover:bg-teal-100 transition font-medium whitespace-nowrap min-w-fit`},` 增量流式写入 `)])])]),c(`div`,v,[e(s(u),{ref_key:`immersiveRef`,ref:y,"enable-share":b.value,readonly:x.value,onError:C,onElementSelected:w},null,8,[`enable-share`,`readonly`])])])]))}});export{y as default};