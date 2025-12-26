import type { InjectionKey, Ref, VNode } from 'vue'
import { inject } from 'vue'

export interface MessageBranchContextType<T = VNode[]> {
  currentBranch: Readonly<Ref<number>>
  totalBranches: Readonly<Ref<number>>
  goToPrevious: () => void
  goToNext: () => void
  branches: Ref<T>
  setBranches: (count: number) => void
}

export const MessageBranchKey: InjectionKey<MessageBranchContextType>
  = Symbol('MessageBranch')
export const MessageBranchWidthKey: InjectionKey<Ref<number>>
  = Symbol('MessageBranchWidth')

export function useMessageBranchWidth(): Ref<number> {
  const width = inject(MessageBranchWidthKey)
  if (!width) {
    throw new Error('Message Branch Width must be used within Message Branch')
  }
  return width
}

export function useMessageBranchContext(): MessageBranchContextType {
  const ctx = inject(MessageBranchKey)
  if (!ctx) {
    throw new Error('Message Branch components must be used within Message Branch')
  }
  return ctx
}
