<!-- dc34a5d1-ff99-4772-9926-929dfe486e6a eff1b811-9dcd-4f96-8878-d60dbd53a5eb -->
# 將請求保存邏輯移至後台並統一 Canvas 顯示判斷

## 問題分析

### 原始問題

1. **邏輯分散**：`showCanvas.value` 在多處設置（lines 580, 640, 662, 693, 703, 886, 924），邏輯不一致
2. **判斷片面**：只依賴 `hasCodeHistory`（已保存的 conversation.codeHistory），但流寫入開始時可能還沒有保存
3. **競爭條件**：`canvasMode.ts` 的 `onShowCanvasChange(true)` 會被 `ChatPanel.vue` 的 watch (660-669) 關閉

### 新增邊界情況問題

用戶在流寫入過程中切換對話，會導致：

1. **對話歷史**：消息會保存，但 codeHistory 可能在切換時還沒保存（因為流寫入還沒結束）
2. **Canvas 顯示**：切換回來時，如果沒有 codeHistory，canvas 無法顯示
3. **流寫入錯誤**：組件被 `refreshImmersiveCode = false` 卸載，`immersiveCodeRef` 變成 null，但 `handleStreamResponse` 仍在嘗試調用 `streamWrite()`，會報錯

### 邊界情況解決方案

#### 解決方案 1：對話切換時保存部分代碼歷史

在 `watch(activeConversationId)` 中：

- 切換前檢查 `isCanvasRequestInProgress.value` 是否為 true
- 如果正在流寫入，先調用 `immersiveCodeRef.value?.endStreaming()` 結束流寫入狀態（即使流還沒完全結束）
- 然後立即調用 `saveCodeHistory()` 保存當前的代碼歷史（可能包含部分完成的流寫入記錄）
- 這樣切換回來時，即使流寫入還沒完成，也能恢復部分狀態

#### 解決方案 2：防護機制防止流寫入錯誤

在 `canvasMode.ts` 的 `handleStreamResponse` 中：

- 每次調用 `context.immersiveCodeRef?.streamWrite()` 前檢查 ref 是否存在
- 如果組件已被卸載（ref 為 null），只記錄警告日誌，不拋出錯誤
- 使用可選鏈調用：`context.immersiveCodeRef?.streamWrite(htmlCode)`
- 這樣即使組件在流寫入過程中卸載，也不會中斷整個流式響應過程

#### 解決方案 3：改進對話切換邏輯

在 `watch(activeConversationId)` 中：

- 使用 `shouldShowCanvasEditor()` 判斷切換回來時是否顯示 canvas
- 該函數會檢查已保存的 codeHistory 和內存中的代碼歷史
- 只要滿足任一條件，就會顯示 canvas 編輯器

#### 解決方案 4：改進 saveCodeHistory() 函數

- 確保 `saveCodeHistory()` 能夠處理部分完成的流寫入歷史
- 即使流寫入還沒完全結束（有 `isStreamingRecord: true` 的記錄），也要保存當前的狀態
- 在切換對話時強制調用，確保狀態不丟失

## 解決方案

### 1. 創建統一的判斷函數 `shouldShowCanvasEditor()`

在 `ChatPanel.vue` 中創建一個函數，綜合考慮以下因素：

- 當前模式是否是 canvas（`selectedMode.value === "canvas"`）
- conversation 是否有已保存的 codeHistory（`conversation.codeHistory?.versions?.length > 0`）
- immersiveCodeRef 是否有內存中的代碼歷史（`immersiveCodeRef.value?.getHistory()?.versions?.length > 0`）
- 是否正在進行 canvas 相關的請求（新增狀態標誌）

### 2. 添加請求狀態追蹤

添加一個 `ref<boolean>` 來追蹤是否正在進行 canvas 請求：

- 在 `requestAssistantReply` 的 `onBeforeSubmit` 後設置為 `true`（僅 canvas 模式）
- 在 `requestAssistantReply` 的 `onAfterSubmit` 後設置為 `false`（僅 canvas 模式）

### 3. 替換所有 showCanvas 設置邏輯

將所有直接設置 `showCanvas.value` 的地方改為調用 `shouldShowCanvasEditor()`，包括：

- `watch(selectedMode)` (line 573-587)
- `watch([activeConversationId, ...])` (line 637-669)
- `watch(immersiveCodeRef)` (line 691-703)
- `requestAssistantReply` (line 916-927)
- `onShowCanvasChange` 回調 (line 885-887)

### 4. 修改 watch 邏輯避免錯誤關閉

確保 `watch([activeConversationId, ...])` 在判斷時使用新的 `shouldShowCanvasEditor()` 函數，並且不會在正在進行請求時關閉 canvas。

### 5. 確保流寫入時正確打開

在 `canvasMode.ts` 中調用 `onShowCanvasChange(true)` 時，確保不會被 watch 關閉。通過新函數的邏輯，當檢測到內存中有代碼歷史時（即使還沒保存），也會返回 true。

## 實現細節

### 新函數簽名

```typescript
function shouldShowCanvasEditor(): boolean {
  // 1. 檢查模式
  if (selectedMode.value !== "canvas") return false;
  
  // 2. 檢查是否正在進行請求（優先級最高）
  if (isCanvasRequestInProgress.value) return true;
  
  // 3. 檢查 conversation 的 codeHistory
  const conversation = activeConversation.value;
  const hasSavedHistory = conversation?.codeHistory?.versions?.length > 0;
  
  // 4. 檢查內存中的代碼歷史
  const memoryHistory = immersiveCodeRef.value?.getHistory();
  const hasMemoryHistory = memoryHistory?.versions?.length > 0;
  
  return hasSavedHistory || hasMemoryHistory;
}
```

### 需要修改的文件

1. **packages/frontend/src/views/LlmDashboard/Chat/ChatPanel.vue**

   - 添加 `isCanvasRequestInProgress` ref
   - 創建 `shouldShowCanvasEditor()` 函數
   - 替換所有 `showCanvas.value = ...` 為 `showCanvas.value = shouldShowCanvasEditor()`
   - 在 `requestAssistantReply` 中設置請求狀態

2. **packages/frontend/src/views/LlmDashboard/Chat/modes/canvasMode.ts**

   - 保持 `onShowCanvasChange(true)` 調用（用於立即響應）
   - 新函數會確保正確的判斷邏輯