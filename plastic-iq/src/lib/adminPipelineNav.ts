const FOCUS_KEY = 'pacscore_admin_pipeline_focus'

export type AdminPipelineTab = 'agent1' | 'agent2' | 'agent3' | 'publish'

export type PipelineFocus = {
  tab: AdminPipelineTab
  productId: string
}

export function setPipelineFocus(tab: AdminPipelineTab, productId: string): void {
  sessionStorage.setItem(FOCUS_KEY, JSON.stringify({ tab, productId }))
}

export function consumePipelineFocus(): PipelineFocus | null {
  const raw = sessionStorage.getItem(FOCUS_KEY)
  if (!raw) return null
  sessionStorage.removeItem(FOCUS_KEY)
  try {
    const parsed = JSON.parse(raw) as PipelineFocus
    if (parsed?.tab && parsed?.productId) return parsed
  } catch {
    return null
  }
  return null
}
