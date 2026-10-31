// ---------------------------------------------------------
// n8n Workflow Adapter for Workflow Playground
// แปลง Playground Flow เป็น n8n Workflow JSON v1 ที่นำเข้า n8n ได้โดยตรง
// ---------------------------------------------------------

const N8N_NODE_TYPE_MAP = {
  trigger_form: {
    type: 'n8n-nodes-base.formTrigger',
    typeVersion: 2,
    buildParams: (cfg) => ({
      formTitle: cfg.formName || 'Form',
      formDescription: 'ฟอร์มรับข้อมูลจากผู้ใช้',
      responseMode: 'onReceived'
    })
  },
  trigger_schedule: {
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    buildParams: (cfg) => {
      const freq = cfg.frequency || 'daily';
      const time = cfg.time || '08:00';
      const [hour = '8', minute = '0'] = time.split(':');
      if (freq === 'hourly') {
        return { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } };
      }
      return {
        rule: {
          interval: [{
            field: 'cronExpression',
            expression: `${minute} ${hour} * * *`
          }]
        }
      };
    }
  },
  trigger_chat: {
    type: 'n8n-nodes-base.chatTrigger',
    typeVersion: 1.1,
    buildParams: (cfg) => ({
      options: {
        channel: cfg.channel || 'LINE Official Account',
        eventType: cfg.eventType || 'text_message'
      }
    })
  },
  trigger_webhook: {
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    buildParams: (cfg) => ({
      path: (cfg.sourceSystem || 'webhook').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      httpMethod: (cfg.method || 'POST').toUpperCase(),
      responseMode: 'onReceived',
      responseData: 'allEntries'
    })
  },
  logic_if: {
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    buildParams: (cfg) => {
      const conditions = Array.isArray(cfg.conditions) && cfg.conditions.length > 0
        ? cfg.conditions
        : [{ leftValue: cfg.leftValue || '', operator: cfg.operator || '==', rightValue: cfg.rightValue || '' }];

      const opMap = {
        '==': 'equals',
        '!=': 'notEquals',
        '>': 'larger',
        '>=': 'largerEqual',
        '<': 'smaller',
        '<=': 'smallerEqual',
        'contains': 'contains',
        'not_contains': 'notContains',
        'starts_with': 'startsWith',
        'ends_with': 'endsWith',
        'is_empty': 'isEmpty',
        'is_not_empty': 'isNotEmpty'
      };

      return {
        combineOperation: (cfg.conditionLogic || 'AND').toLowerCase(),
        conditions: {
          options: { caseSensitive: false },
          conditions: conditions.map(c => ({
            id: Math.random().toString(36).substring(2, 9),
            leftValue: convertVarToN8nExpression(c.leftValue),
            rightValue: convertVarToN8nExpression(c.rightValue),
            operator: {
              type: 'string',
              operation: opMap[c.operator] || 'equals'
            }
          }))
        }
      };
    }
  },
  logic_switch: {
    type: 'n8n-nodes-base.switch',
    typeVersion: 3.1,
    buildParams: (cfg) => {
      const routes = Array.isArray(cfg.routes) && cfg.routes.length > 0
        ? cfg.routes
        : [
            { condition: cfg.caseA || 'จองที่พัก', operator: '==' },
            { condition: cfg.caseB || 'สั่งอาหาร', operator: '==' },
            { condition: cfg.caseC || 'ติดต่อสอบถามทั่วไป', operator: '==' }
          ];

      return {
        mode: 'rules',
        rules: {
          values: routes.map((r, i) => ({
            value1: convertVarToN8nExpression(cfg.switchField),
            operation: r.operator === 'contains' ? 'contains' : 'equal',
            value2: r.condition || '',
            output: i
          }))
        },
        fallbackOutput: routes.length
      };
    }
  },
  logic_loop: {
    type: 'n8n-nodes-base.splitInBatches',
    typeVersion: 3,
    buildParams: (cfg) => ({
      batchSize: parseInt(cfg.batchSize, 10) || 1,
      options: {
        reset: false
      }
    })
  },
  logic_delay: {
    type: 'n8n-nodes-base.wait',
    typeVersion: 1.1,
    buildParams: (cfg) => {
      const dur = cfg.duration || '15 นาที';
      const num = parseInt(dur, 10) || 15;
      const unit = dur.includes('ชั่วโมง') ? 'hours' : (dur.includes('วินาที') ? 'seconds' : 'minutes');
      return {
        amount: num,
        unit
      };
    }
  },
  ai_agent: {
    type: '@n8n/n8n-nodes-langchain.agent',
    typeVersion: 1.7,
    buildParams: (cfg) => ({
      promptType: 'define',
      text: convertVarToN8nExpression(cfg.prompt),
      options: {
        systemMessage: `You are an AI assistant acting as ${cfg.systemRole || 'customer_support'}. Model: ${cfg.model || 'gemini-2.5-flash'}`
      }
    })
  },
  data_formatter: {
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    buildParams: (cfg) => ({
      mode: 'manual',
      fields: {
        values: [
          {
            name: 'formatted_text',
            stringValue: convertVarToN8nExpression(cfg.template)
          }
        ]
      }
    })
  },
  action_http: {
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    buildParams: (cfg) => ({
      method: (cfg.method || 'GET').toUpperCase(),
      url: convertVarToN8nExpression(cfg.endpoint || 'https://api.example.com'),
      sendBody: ['POST', 'PUT', 'PATCH'].includes((cfg.method || 'GET').toUpperCase()),
      specifyBody: 'json',
      jsonBody: convertVarToN8nExpression(cfg.bodyPayload || '')
    })
  },
  action_sheets: {
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: 4.5,
    buildParams: (cfg) => {
      const op = cfg.operation === 'read_rows' ? 'read' : (cfg.operation === 'update_row' ? 'update' : 'append');
      return {
        operation: op,
        sheetName: cfg.sheetName || 'Sheet1',
        columns: convertVarToN8nExpression(cfg.columns || '')
      };
    }
  },
  action_line: {
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    buildParams: (cfg) => ({
      method: 'POST',
      url: 'https://api.line.me/v2/bot/message/push',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: 'Bearer YOUR_LINE_CHANNEL_ACCESS_TOKEN' },
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: JSON.stringify({
        to: cfg.target || 'ADMIN_USER_ID',
        messages: [{ type: 'text', text: convertVarToN8nExpression(cfg.messageTemplate || '') }]
      })
    })
  },
  action_telegram: {
    type: 'n8n-nodes-base.telegram',
    typeVersion: 1.2,
    buildParams: (cfg) => ({
      operation: 'sendMessage',
      chatId: cfg.chatId || '@alerts',
      text: convertVarToN8nExpression(cfg.message || ''),
      additionalFields: {
        parse_mode: cfg.parseMode || 'HTML'
      }
    })
  },
  action_email: {
    type: 'n8n-nodes-base.emailSend',
    typeVersion: 2.1,
    buildParams: (cfg) => ({
      toEmail: convertVarToN8nExpression(cfg.toEmail || 'user@example.com'),
      subject: convertVarToN8nExpression(cfg.subject || 'แจ้งเตือนอัตโนมัติ'),
      message: convertVarToN8nExpression(cfg.body || '')
    })
  },
  action_calendar: {
    type: 'n8n-nodes-base.googleCalendar',
    typeVersion: 1.2,
    buildParams: (cfg) => ({
      operation: 'create',
      summary: convertVarToN8nExpression(cfg.eventTitle || 'นัดหมาย'),
      start: convertVarToN8nExpression(cfg.eventDate || '{{current_date}}'),
      description: convertVarToN8nExpression(cfg.notes || '')
    })
  }
};

// แปลง {{var_name}} ให้กลายเป็นรูปแบบ Expression ของ n8n: {{ $json.var_name }}
function convertVarToN8nExpression(text) {
  if (!text) return '';
  return String(text).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, '={{ $json.$1 }}');
}

function convertToN8nWorkflow(flow, catalog, workflowName) {
  const nodes = (flow && flow.nodes) || [];
  const connections = (flow && flow.connections) || [];

  const nameMap = new Map();
  const n8nNodes = nodes.map((node, idx) => {
    const def = (catalog && catalog.find(b => b.type === node.type)) || {};
    const mapper = N8N_NODE_TYPE_MAP[node.type] || {
      type: 'n8n-nodes-base.set',
      typeVersion: 1,
      buildParams: () => ({})
    };

    const cleanTitle = def.cleanTitle || def.title || node.type;
    const nodeName = `${cleanTitle} #${node.id}`;
    nameMap.set(node.id, nodeName);

    const cfg = node.config || {};
    const parameters = mapper.buildParams ? mapper.buildParams(cfg) : {};

    return {
      id: `node-${node.id}`,
      name: nodeName,
      type: mapper.type,
      typeVersion: mapper.typeVersion || 1,
      position: [node.x || (idx * 280 + 100), node.y || 200],
      parameters
    };
  });

  const n8nConnections = {};

  connections.forEach(conn => {
    const fromName = nameMap.get(conn.fromNode);
    const toName = nameMap.get(conn.toNode);
    if (!fromName || !toName) return;

    const fromNodeObj = nodes.find(n => n.id === conn.fromNode);
    const fromType = fromNodeObj ? fromNodeObj.type : '';

    let outputIndex = 0;
    if (fromType === 'logic_if') {
      outputIndex = conn.fromPort === 'false' ? 1 : 0;
    } else if (fromType === 'logic_switch') {
      const routes = Array.isArray(fromNodeObj.config && fromNodeObj.config.routes) && fromNodeObj.config.routes.length > 0
        ? fromNodeObj.config.routes
        : [{ id: 'route_a' }, { id: 'route_b' }, { id: 'route_c' }];
      if (conn.fromPort === 'default') {
        outputIndex = routes.length;
      } else {
        const foundIdx = routes.findIndex(r => r.id === conn.fromPort);
        outputIndex = foundIdx >= 0 ? foundIdx : 0;
      }
    } else if (fromType === 'logic_loop') {
      outputIndex = conn.fromPort === 'done' ? 1 : 0;
    }

    if (!n8nConnections[fromName]) {
      n8nConnections[fromName] = { main: [] };
    }
    while (n8nConnections[fromName].main.length <= outputIndex) {
      n8nConnections[fromName].main.push([]);
    }

    n8nConnections[fromName].main[outputIndex].push({
      node: toName,
      type: 'main',
      index: 0
    });
  });

  return {
    name: workflowName || (flow && flow.name) || 'Workflow Playground Export',
    nodes: n8nNodes,
    connections: n8nConnections,
    active: false,
    settings: {
      executionOrder: 'v1'
    },
    meta: {
      templateCredsSetupCompleted: true,
      instanceId: 'playground-export'
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { convertToN8nWorkflow, convertVarToN8nExpression, N8N_NODE_TYPE_MAP };
}
