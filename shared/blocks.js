// ---------------------------------------------------------
// 1. CATALOG OF WORKFLOW BLOCKS (WITH PRIMARY TARGET FIELD & SMART PRESETS)
// ---------------------------------------------------------
const BLOCK_CATALOG = [
  {
    type: 'trigger_form',
    category: 'Trigger • จุดเริ่มต้น',
    title: 'เมื่อมีคนกรอกฟอร์ม (Form)',
    icon: '📝',
    color: 'amber',
    badge: 'Trigger',
    inputs: [],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{customer_name}}', '{{phone}}', '{{service_type}}', '{{amount}}', '{{message}}'],
    primaryField: 'formName',
    varAdvice: 'บล็อกนี้เป็นจุดเริ่มต้น (Trigger) ไม่ต้องรับตัวแปรจากใคร แต่จะทำหน้าที่ **ส่งออกตัวแปร** ชื่อลูกค้า เบอร์โทร และยอดเงิน ไปให้บล็อกถัดไปครับ',
    defaultConfig: { formName: 'ฟอร์มจองคิว / แจ้งโอนเงิน', triggerEvent: 'on_submit' },
    fields: [
      { key: 'formName', label: 'ชื่อฟอร์มต้นทาง', type: 'text', placeholder: 'เช่น ฟอร์มจองห้องพัก / แจ้งโอนเงิน' },
      { key: 'triggerEvent', label: 'ทำงานเมื่อ', type: 'select', options: [
        { value: 'on_submit', label: 'มีคนกดส่งฟอร์มใหม่ทันที (On Submit)' },
        { value: 'on_edit', label: 'มีการแก้ไขข้อมูลฟอร์ม (On Edit)' }
      ]}
    ]
  },
  {
    type: 'trigger_schedule',
    category: 'Trigger • จุดเริ่มต้น',
    title: 'ตั้งเวลาทำงาน (Schedule)',
    icon: '⏰',
    color: 'amber',
    badge: 'Trigger',
    inputs: [],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{current_date}}', '{{current_time}}'],
    primaryField: 'time',
    varAdvice: 'บล็อกตั้งเวลาเป็นจุดเริ่มต้น จะส่งตัวแปร **{{current_date}} (วันที่วันนี้)** ออกไปให้บล็อก Google Sheets ใช้ดึงคิวงานของวันนี้ครับ',
    defaultConfig: { frequency: 'daily', time: '08:00' },
    fields: [
      { key: 'frequency', label: 'ความถี่ในการรัน', type: 'select', options: [
        { value: 'daily', label: 'ทุกวัน (Daily)' },
        { value: 'hourly', label: 'ทุกชั่วโมง (Hourly)' },
        { value: 'weekly', label: 'ทุกสัปดาห์ (Weekly)' }
      ]},
      { key: 'time', label: 'เวลาที่ทำงาน', type: 'text', placeholder: 'เช่น 08:00 หรือ 18:00' }
    ]
  },
  {
    type: 'trigger_chat',
    category: 'Trigger • จุดเริ่มต้น',
    title: 'เมื่อลูกค้าทักแชท (LINE OA)',
    icon: '💬',
    color: 'amber',
    badge: 'Trigger',
    inputs: [],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{user_name}}', '{{message_text}}', '{{reply_token}}'],
    primaryField: 'channel',
    varAdvice: 'บล็อกนี้จะส่งออกตัวแปร **{{user_name}} (ชื่อลูกค้า)** และ **{{message_text}} (ข้อความแชทที่พิมพ์มา)** ไปให้ AI หรือบล็อกถัดไปใช้งานครับ',
    defaultConfig: { channel: 'LINE Official Account', eventType: 'text_message' },
    fields: [
      { key: 'channel', label: 'ช่องทางแชท', type: 'text', placeholder: 'เช่น LINE OA ร้านค้า' },
      { key: 'eventType', label: 'ประเภทเหตุการณ์', type: 'select', options: [
        { value: 'text_message', label: 'ลูกค้าพิมพ์ข้อความเข้ามา (Text Message)' },
        { value: 'image_slip', label: 'ลูกค้าส่งรูปภาพ/สลิป (Image)' }
      ]}
    ]
  },
  {
    type: 'trigger_webhook',
    category: 'Trigger • จุดเริ่มต้น',
    title: 'รับข้อมูล Webhook (API เข้า)',
    icon: '🌐',
    color: 'amber',
    badge: 'Trigger',
    inputs: [],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{order_id}}', '{{customer_name}}', '{{amount}}', '{{payment_status}}'],
    primaryField: 'sourceSystem',
    varAdvice: 'บล็อกนี้รับข้อมูลจากระบบอื่นและส่งออก **{{order_id}}**, **{{customer_name}}**, **{{amount}}**, **{{payment_status}}** ให้บล็อกถัดไปครับ',
    defaultConfig: { sourceSystem: 'ระบบจองห้องพัก / ร้านค้าออนไลน์', method: 'POST' },
    fields: [
      { key: 'sourceSystem', label: 'รับข้อมูลจากระบบ', type: 'text', placeholder: 'เช่น เว็บไซต์จองห้องพัก' },
      { key: 'method', label: 'HTTP Method', type: 'select', options: [
        { value: 'POST', label: 'POST (รับข้อมูล JSON)' },
        { value: 'GET', label: 'GET (รับผ่าน URL)' }
      ]}
    ]
  },

  // --- LOGIC (4) ---
  {
    type: 'logic_if',
    category: 'Logic • เงื่อนไขและควบคุมสาย',
    title: 'ตรวจสอบเงื่อนไข (IF / Else)',
    icon: '🔀',
    color: 'purple',
    badge: 'Logic 2 สาย',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [
      { id: 'true', label: 'จริง (True)', color: 'emerald' },
      { id: 'false', label: 'เท็จ (False)', color: 'rose' }
    ],
    producedVars: [],
    primaryField: 'leftValue',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "ค่าที่ต้องการตรวจ (ช่องแรก)":** เช่น ใส่ `{{amount}}` เพื่อเช็คยอดเงิน หรือใส่ `{{ai_result}}` เพื่อเช็คผลวิเคราะห์จาก AI',
    smartPreset: (availVars) => {
      if (availVars.includes('{{ai_result}}')) {
        return { leftValue: '{{ai_result}}', operator: 'contains', rightValue: 'ด่วน' };
      }
      return { leftValue: '{{amount}}', operator: '>=', rightValue: '1000' };
    },
    defaultConfig: { leftValue: '{{amount}}', operator: '>=', rightValue: '1000' },
    fields: [
      { key: 'leftValue', label: '🎯 1. ค่าที่ต้องการตรวจ (ใส่ตัวแปรที่นี่)', type: 'text', placeholder: 'เช่น {{amount}} หรือ {{ai_result}}' },
      { key: 'operator', label: '2. เครื่องหมายเปรียบเทียบ', type: 'select', options: [
        { value: '>=', label: 'มากกว่าหรือเท่ากับ (>=)' },
        { value: '>', label: 'มากกว่า (>)' },
        { value: '<', label: 'น้อยกว่า (<)' },
        { value: '==', label: 'เท่ากับ (==)' },
        { value: 'contains', label: 'มีคำว่า (Contains)' }
      ]},
      { key: 'rightValue', label: '3. ค่าที่ใช้เทียบ (ตัวเลข หรือ คำ)', type: 'text', placeholder: 'เช่น 1000 หรือ ด่วน' }
    ]
  },
  {
    type: 'logic_switch',
    category: 'Logic • เงื่อนไขและควบคุมสาย',
    title: 'แยกหลายเส้นทาง (Switch 3 สาย)',
    icon: '🧭',
    color: 'purple',
    badge: 'Logic 3 สาย',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [
      { id: 'route_a', label: 'สาย A', color: 'emerald' },
      { id: 'route_b', label: 'สาย B', color: 'amber' },
      { id: 'route_c', label: 'สาย C', color: 'rose' }
    ],
    producedVars: [],
    primaryField: 'switchField',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "ตัวแปรที่ใช้แยกสาย":** เช่น ใส่ `{{service_type}}` หรือ `{{payment_status}}`',
    smartPreset: () => ({ switchField: '{{service_type}}', caseA: 'จองที่พัก', caseB: 'สั่งอาหาร', caseC: 'ติดต่อทั่วไป' }),
    defaultConfig: { switchField: '{{service_type}}', caseA: 'จองที่พัก', caseB: 'สั่งอาหาร', caseC: 'ติดต่อสอบถามทั่วไป' },
    fields: [
      { key: 'switchField', label: '🎯 ตัวแปรที่ใช้แยกสาย (ใส่ตัวแปรที่นี่)', type: 'text', placeholder: 'เช่น {{service_type}}' },
      { key: 'caseA', label: 'เงื่อนไขสาย A', type: 'text', placeholder: 'เช่น จองที่พัก' },
      { key: 'caseB', label: 'เงื่อนไขสาย B', type: 'text', placeholder: 'เช่น สั่งอาหาร' },
      { key: 'caseC', label: 'เงื่อนไขสาย C', type: 'text', placeholder: 'เช่น อื่นๆ' }
    ]
  },
  {
    type: 'logic_loop',
    category: 'Logic • เงื่อนไขและควบคุมสาย',
    title: 'วนลูปทีละรายการ (Loop)',
    icon: '🔁',
    color: 'purple',
    badge: 'Loop',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [
      { id: 'each', label: 'ทำทีละชิ้น', color: 'emerald' },
      { id: 'done', label: 'เมื่อครบแล้ว', color: 'amber' }
    ],
    producedVars: ['{{loop_item}}'],
    primaryField: 'sourceList',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "รายการข้อมูลที่จะนำมาวนลูป":** มักใส่ `{{sheet_rows}}` ที่ดึงมาจาก Google Sheets',
    smartPreset: () => ({ sourceList: '{{sheet_rows}}', batchSize: '1' }),
    defaultConfig: { sourceList: '{{sheet_rows}}', batchSize: '1' },
    fields: [
      { key: 'sourceList', label: '🎯 รายการข้อมูลที่จะนำมาวนลูป (ใส่ตัวแปรที่นี่)', type: 'text', placeholder: 'เช่น {{sheet_rows}}' },
      { key: 'batchSize', label: 'จำนวนต่อรอบ', type: 'text', placeholder: '1' }
    ]
  },
  {
    type: 'logic_delay',
    category: 'Logic • เงื่อนไขและควบคุมสาย',
    title: 'หน่วงเวลา / รอ (Wait / Delay)',
    icon: '⏳',
    color: 'purple',
    badge: 'Wait',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: [],
    primaryField: 'duration',
    varAdvice: 'บล็อกหน่วงเวลาใช้กำหนดเวลารอ (เช่น 15 นาที) ไม่จำเป็นต้องใส่ตัวแปรครับ',
    defaultConfig: { duration: '15 นาที', reason: 'รอลูกค้าโอนเงิน' },
    fields: [
      { key: 'duration', label: 'ระยะเวลาที่รอ', type: 'text', placeholder: 'เช่น 15 นาที, 1 ชั่วโมง' },
      { key: 'reason', label: 'เหตุผลที่หน่วงเวลา', type: 'text', placeholder: 'เช่น รอเช็คสถานะการจ่ายเงิน' }
    ]
  },

  // --- AI & DATA (3) ---
  {
    type: 'ai_agent',
    category: 'AI & Data • ประมวลผลและ AI',
    title: 'AI วิเคราะห์ / ร่างข้อความ (LLM)',
    icon: '🤖',
    color: 'cyan',
    badge: 'AI / LLM',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{ai_result}}', '{{ai_reply}}'],
    primaryField: 'prompt',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "คำสั่ง Prompt":** ต้องส่งข้อมูลให้ AI อ่าน เช่น ใส่ `{{message_text}}` (ข้อความลูกค้า) หรือ `{{sheet_rows}}` (ข้อมูลจากตาราง) ลงในประโยคคำสั่งครับ',
    smartPreset: (availVars) => {
      if (availVars.includes('{{sheet_rows}}')) {
        return { taskType: 'summarize', prompt: 'ช่วยสรุปรายการคิวงานวันนี้จากข้อมูล {{sheet_rows}} ให้เป็นข้อความสั้นๆ อ่านง่ายสำหรับส่งให้ทีมงาน' };
      }
      if (availVars.includes('{{message_text}}')) {
        return { taskType: 'sentiment_triage', prompt: 'วิเคราะห์ข้อความลูกค้าคุณ {{user_name}} ที่พิมพ์มาว่า: "{{message_text}}" ว่าเป็นเคสด่วนหรือปกติ และร่างคำตอบสุภาพให้ด้วย' };
      }
      return { taskType: 'extract_data', prompt: 'ตรวจสอบข้อมูลของลูกค้า {{customer_name}} ยอดเงิน {{amount}} บาท ว่าถูกต้องครบถ้วนหรือไม่' };
    },
    defaultConfig: {
      taskType: 'sentiment_triage',
      prompt: 'วิเคราะห์ข้อความลูกค้า: "{{message_text}}" ว่าอารมณ์เป็นอย่างไร และเป็นเคสด่วนหรือไม่ (ตอบว่า ด่วน หรือ ปกติ)'
    },
    fields: [
      { key: 'taskType', label: 'รูปแบบงาน AI', type: 'select', options: [
        { value: 'sentiment_triage', label: 'วิเคราะห์อารมณ์ & คัดกรองเคสด่วน' },
        { value: 'draft_reply', label: 'ร่างคำตอบกลับลูกค้าอัตโนมัติ' },
        { value: 'summarize', label: 'สรุปข้อมูลจากตารางให้สั้นกระชับ' },
        { value: 'extract_data', label: 'อ่านสลิป / ตรวจสอบข้อมูลลูกค้า' }
      ]},
      { key: 'prompt', label: '🎯 คำสั่ง Prompt ที่ส่งให้ AI (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'เขียนคำสั่งบอก AI พร้อมใส่ตัวแปร เช่น {{message_text}}' }
    ]
  },
  {
    type: 'data_formatter',
    category: 'AI & Data • ประมวลผลและ AI',
    title: 'จัดรูปแบบ / สรุปข้อมูล (Formatter)',
    icon: '🛠️',
    color: 'sky',
    badge: 'Data',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{formatted_text}}'],
    primaryField: 'template',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "รูปแบบข้อความสรุป":** มักใส่ `{{current_date}}` คู่กับ `{{sheet_rows}}` เพื่อรวมตารางเป็นข้อความเดียวก่อนส่งเข้า LINE',
    smartPreset: () => ({
      formatMode: 'summary_text',
      template: '📋 สรุปรายการประจำวันที่ {{current_date}}:\n{{sheet_rows}}'
    }),
    defaultConfig: {
      formatMode: 'summary_text',
      template: '📋 สรุปคิววันนี้ ({{current_date}}): {{sheet_rows}}'
    },
    fields: [
      { key: 'formatMode', label: 'โหมดการแปลงข้อมูล', type: 'select', options: [
        { value: 'summary_text', label: 'รวมรายการจากตารางเป็นข้อความสรุป' },
        { value: 'math_calc', label: 'คำนวณตัวเลข / ยอดรวม' }
      ]},
      { key: 'template', label: '🎯 รูปแบบข้อความสรุป (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'เช่น สรุปคิววันที่ {{current_date}}: {{sheet_rows}}' }
    ]
  },
  {
    type: 'action_http',
    category: 'AI & Data • ประมวลผลและ AI',
    title: 'เชื่อมต่อ API ภายนอก (HTTP)',
    icon: '🔌',
    color: 'sky',
    badge: 'API',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{api_data}}'],
    primaryField: 'bodyPayload',
    varAdvice: 'ใส่ตัวแปรที่ต้องการส่งไปให้ API ในช่อง "ข้อมูลที่ส่งไป" ได้เลยครับ',
    defaultConfig: { method: 'GET', endpoint: 'https://api.example.com/orders', bodyPayload: '' },
    fields: [
      { key: 'method', label: 'HTTP Method', type: 'select', options: [
        { value: 'GET', label: 'GET (ดึงข้อมูล)' },
        { value: 'POST', label: 'POST (ส่งข้อมูล)' }
      ]},
      { key: 'endpoint', label: 'URL / Endpoint', type: 'text', placeholder: 'https://...' },
      { key: 'bodyPayload', label: '🎯 ข้อมูลที่ส่งไป (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'เช่น {"name": "{{customer_name}}"}' }
    ]
  },

  // --- ACTIONS (5) ---
  {
    type: 'action_sheets',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'Google Sheets (บันทึก/ดึงข้อมูล)',
    icon: '📊',
    color: 'emerald',
    badge: 'Sheets',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{sheet_rows}}', '{{row_number}}'],
    primaryField: 'columns',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "คอลัมน์ที่บันทึก / เงื่อนไขที่ดึง":** \n• ถ้า **บันทึกแถวใหม่**: ใส่ `{{customer_name}}, {{phone}}, {{amount}}` \n• ถ้า **ดึงข้อมูลรายวัน**: ใส่ `ดึงเฉพาะวันที่ {{current_date}}`',
    smartPreset: (availVars, currentConfig) => {
      if (currentConfig.operation === 'read_rows' || availVars.includes('{{current_date}}')) {
        return { operation: 'read_rows', sheetName: 'ตารางคิวงานวันนี้', columns: 'ดึงข้อมูลที่ตรงกับวันที่ {{current_date}}' };
      }
      if (availVars.includes('{{user_name}}')) {
        return { operation: 'append_row', sheetName: 'ตารางประวัติแชทลูกค้า', columns: '{{user_name}}, {{message_text}}, {{ai_result}}' };
      }
      return { operation: 'append_row', sheetName: currentConfig.sheetName || 'ตารางรายการลูกค้า', columns: '{{customer_name}}, {{phone}}, {{amount}}' };
    },
    defaultConfig: {
      operation: 'append_row',
      sheetName: 'ตารางรายการลูกค้า',
      columns: '{{customer_name}}, {{phone}}, {{amount}}'
    },
    fields: [
      { key: 'operation', label: 'โหมดการทำงาน', type: 'select', options: [
        { value: 'append_row', label: '➕ เพิ่มแถวใหม่ต่อท้าย (Append Row)' },
        { value: 'read_rows', label: '🔍 ดึงข้อมูลหลายแถวตามเงื่อนไข (Get Many Rows)' },
        { value: 'update_row', label: '✏️ อัปเดตแถวเดิม (Update Row)' }
      ]},
      { key: 'sheetName', label: 'ชื่อหน้าชีต (แยกชื่อชีตตามต้องการ)', type: 'text', placeholder: 'เช่น ลูกค้า VIP หรือ ลูกค้าทั่วไป' },
      { key: 'columns', label: '🎯 คอลัมน์ที่บันทึก / เงื่อนไขที่ดึง (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'เช่น {{customer_name}}, {{phone}}, {{amount}}' }
    ]
  },
  {
    type: 'action_line',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'ส่งข้อความ LINE (แจ้งเตือน/ตอบกลับ)',
    icon: '🟢',
    color: 'emerald',
    badge: 'LINE Msg',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: [],
    primaryField: 'messageTemplate',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "เนื้อหาข้อความที่จะส่ง":** อยากให้แอดมินหรือลูกค้าเห็นข้อมูลอะไร ให้แทรกตัวแปรนั้นลงในประโยคข้อความได้เลย!',
    smartPreset: (availVars) => {
      if (availVars.includes('{{formatted_text}}')) {
        return { target: 'admin_group', messageTemplate: '🌅 สรุปรายงานประจำวัน ({{current_date}}):\n{{formatted_text}}' };
      }
      if (availVars.includes('{{ai_result}}') && availVars.includes('{{user_name}}')) {
        return { target: 'admin_group', messageTemplate: '🔔 แจ้งเตือนจากแชท!\nลูกค้า: {{user_name}}\nข้อความ: "{{message_text}}"\nผลวิเคราะห์ AI: {{ai_result}}' };
      }
      return { target: 'admin_group', messageTemplate: '🔔 มีรายการใหม่เข้ามา!\nชื่อลูกค้า: {{customer_name}}\nเบอร์โทร: {{phone}}\nยอดเงิน: {{amount}} บาท' };
    },
    defaultConfig: {
      target: 'admin_group',
      messageTemplate: '🔔 แจ้งเตือนใหม่!\nลูกค้า: {{customer_name}}\nเบอร์โทร: {{phone}}\nยอดเงิน: {{amount}} บาท'
    },
    fields: [
      { key: 'target', label: 'ส่งไปที่ไหน', type: 'select', options: [
        { value: 'admin_group', label: 'กลุ่มแอดมิน / เจ้าของร้าน (Admin Alert)' },
        { value: 'vip_team', label: 'กลุ่มทีมดูแลลูกค้า VIP / เคสด่วนพิเศษ' },
        { value: 'reply_customer', label: 'ตอบกลับแชทลูกค้าโดยตรง (Reply Message)' }
      ]},
      { key: 'messageTemplate', label: '🎯 เนื้อหาข้อความที่จะส่ง (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'พิมพ์ข้อความผสมกับตัวแปร เช่น คุณ {{customer_name}} โอนยอด {{amount}} บาท' }
    ]
  },
  {
    type: 'action_telegram',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'ส่งแจ้งเตือน Telegram / Discord',
    icon: '✈️',
    color: 'emerald',
    badge: 'Bot Alert',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: [],
    primaryField: 'message',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "ข้อความที่ส่ง":** เช่น `อัปเดตสถานะของ {{customer_name}} ยอด {{amount}} บาท`',
    smartPreset: () => ({ platform: 'Telegram Bot', chatId: 'ห้องแจ้งเตือนออเดอร์', message: '🚀 ออเดอร์ใหม่จากคุณ {{customer_name}} ยอด {{amount}} บาท' }),
    defaultConfig: {
      platform: 'Telegram Bot',
      chatId: 'ห้องแจ้งเตือนระบบ',
      message: '🚀 อัปเดตสถานะ: {{customer_name}} ยอด {{amount}} บาท'
    },
    fields: [
      { key: 'platform', label: 'แพลตฟอร์ม', type: 'select', options: [
        { value: 'Telegram Bot', label: 'Telegram Bot' },
        { value: 'Discord Webhook', label: 'Discord Webhook' }
      ]},
      { key: 'chatId', label: 'ชื่อห้อง / Chat ID', type: 'text', placeholder: 'เช่น ห้องแจ้งเตือนออเดอร์' },
      { key: 'message', label: '🎯 ข้อความที่ส่ง (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'ใส่ข้อความและตัวแปร...' }
    ]
  },
  {
    type: 'action_email',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'ส่งอีเมล (Gmail / SMTP)',
    icon: '✉️',
    color: 'emerald',
    badge: 'Email',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: [],
    primaryField: 'body',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "เนื้อหาอีเมล":** แทรก `{{customer_name}}` หรือ `{{amount}}` เพื่อส่งอีเมลยืนยันให้ลูกค้า',
    defaultConfig: {
      toEmail: 'customer@example.com',
      subject: 'ยืนยันรายการของคุณ {{customer_name}}',
      body: 'สวัสดีคุณ {{customer_name}} ระบบได้รับยอด {{amount}} บาทเรียบร้อยแล้ว'
    },
    fields: [
      { key: 'toEmail', label: 'อีเมลผู้รับ (To)', type: 'text', placeholder: 'เช่น manager@company.com' },
      { key: 'subject', label: 'หัวข้ออีเมล (Subject)', type: 'text', placeholder: 'หัวข้ออีเมล' },
      { key: 'body', label: '🎯 เนื้อหาอีเมล (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'รายละเอียดอีเมล...' }
    ]
  },
  {
    type: 'action_calendar',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'ลงตารางนัดหมาย (Google Calendar)',
    icon: '📅',
    color: 'emerald',
    badge: 'Calendar',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{event_link}}'],
    primaryField: 'eventTitle',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "ชื่อนัดหมายบนปฏิทิน":** เช่น `คิวจองคุณ {{customer_name}} เบอร์ {{phone}}`',
    defaultConfig: {
      eventTitle: 'คิวจองคุณ {{customer_name}} ({{service_type}})',
      eventDate: '{{current_date}}',
      notes: 'เบอร์ติดต่อ: {{phone}}'
    },
    fields: [
      { key: 'eventTitle', label: '🎯 ชื่อนัดหมายบนปฏิทิน (ใส่ตัวแปรที่นี่)', type: 'text', placeholder: 'เช่น นัดลูกค้า {{customer_name}}' },
      { key: 'eventDate', label: 'วันที่ / เวลา', type: 'text', placeholder: 'เช่น {{current_date}} 14:00' },
      { key: 'notes', label: 'รายละเอียดในนัดหมาย', type: 'textarea', placeholder: 'เบอร์โทร {{phone}}' }
    ]
  }
];

if (typeof module !== 'undefined') module.exports = { BLOCK_CATALOG };
