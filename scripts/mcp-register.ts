import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Account } from '../lib/server/auth'
import { MCP_TOOL_NAMES, MCP_TOOL_SCHEMAS, runMcpTool } from './mcp-tools'

const descriptions: Record<(typeof MCP_TOOL_NAMES)[number], string> = {
  create_project_from_text: 'Қазақша/орысша жиһаз сипаттамасынан цех жобасын жасайды. Өлшемдер мм.',
  get_quote: 'Жобаның материал, кромка, фурнитура, жұмыс және жалпы сметасын ₸ түрінде береді.',
  get_cut_list: 'Дайын және кесу өлшемдерін, кромкасын береді (мм).',
  compute_nesting: 'Гильотиналық раскрой: парақ саны, қалдық пайызы, кесінділер.',
  search_materials: 'Өз цехының материалдарын бағасымен іздейді.',
  get_drilling: 'Кесілген панель координаттарындағы присадка тесіктері (мм).',
  validate_config: 'Жоба не CabinetBrief конфигі құрастырылатынын тексереді; қате параметр мен аралықты береді.',
  list_projects: 'Өз цехының жобаларын тізеді.',
  get_project: 'Өз цехының бір жобасын толық оқиды.',
}

export function createMcpServer(account: Account): McpServer {
  const server = new McpServer({ name: 'aismebel', version: '1.0.0' })
  for (const name of MCP_TOOL_NAMES) {
    server.registerTool(name, {
      description: descriptions[name],
      inputSchema: MCP_TOOL_SCHEMAS[name].shape,
    }, async (args: Record<string, unknown>) => {
      const result = await runMcpTool(account, name, args)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result.ok ? result.data : result) }],
        isError: !result.ok }
    })
  }
  return server
}
