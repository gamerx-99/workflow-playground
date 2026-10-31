// ---------------------------------------------------------
// 1. CATALOG OF WORKFLOW BLOCKS (WITH PRIMARY TARGET FIELD & SMART PRESETS)
// ---------------------------------------------------------
const BLOCK_CATALOG = [
  {
    type: 'trigger_form',
    category: 'Trigger • จุดเริ่มต้น',
    title: 'Form (ฟอร์มรับข้อมูล)',
    cleanTitle: 'Form',
    icon: '📝',
    color: 'amber',
    badge: 'Trigger',
    inputs: [],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{customer_name}}', '{{phone}}', '{{service_type}}', '{{amount}}', '{{message}}'],
    primaryField: 'formName',
    varAdvice: 'บล็อกนี้เป็นจุดเริ่มต้น (Trigger) ไม่ต้องรับตัวแปรจากใคร แต่จะทำหน้าที่ **ส่งออกตัวแปร** ชื่อลูกค้า เบอร์โทร และยอดเงิน ไปให้บล็อกถัดไปครับ',
    defaultConfig: { formName: 'ฟอร์มจองคิว / แจ้งโอนเงิน', triggerEvent: 'on_submit', successMessage: 'ขอบคุณที่ส่งข้อมูลเรียบร้อยแล้วค่ะ' },
    fields: [
      { key: 'formName', label: 'ชื่อฟอร์มต้นทาง', type: 'text', placeholder: 'เช่น ฟอร์มจองห้องพัก / แจ้งโอนเงิน' },
      { key: 'triggerEvent', label: 'ทำงานเมื่อ', type: 'select', options: [
        { value: 'on_submit', label: 'มีคนกดส่งฟอร์มใหม่ทันที (On Submit)' },
        { value: 'on_edit', label: 'มีการแก้ไขข้อมูลฟอร์ม (On Edit)' }
      ]},
      { key: 'successMessage', label: 'ข้อความตอบกลับหลังส่งฟอร์มสำเร็จ', type: 'text', placeholder: 'เช่น ขอบคุณที่ส่งข้อมูล' }
    ]
  },
  {
    type: 'trigger_schedule',
    category: 'Trigger • จุดเริ่มต้น',
    title: 'Schedule (ตั้งเวลาอัตโนมัติ)',
    cleanTitle: 'Schedule',
    icon: '⏰',
    color: 'amber',
    badge: 'Trigger',
    inputs: [],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{current_date}}', '{{current_time}}'],
    primaryField: 'time',
    varAdvice: 'บล็อกตั้งเวลาเป็นจุดเริ่มต้น จะส่งตัวแปร **{{current_date}} (วันที่วันนี้)** ออกไปให้บล็อก Spreadsheet ใช้ดึงคิวงานของวันนี้ครับ',
    defaultConfig: { frequency: 'daily', time: '08:00', timezone: 'Asia/Bangkok' },
    fields: [
      { key: 'frequency', label: 'ความถี่ในการรัน', type: 'select', options: [
        { value: 'daily', label: 'ทุกวัน (Daily)' },
        { value: 'hourly', label: 'ทุกชั่วโมง (Hourly)' },
        { value: 'weekly', label: 'ทุกสัปดาห์ (Weekly)' },
        { value: 'every_15_mins', label: 'ทุก 15 นาที (Every 15 mins)' },
        { value: 'custom_cron', label: 'กำหนดเวลาเอง (Cron Expression)' }
      ]},
      { key: 'time', label: 'เวลาที่ทำงาน', type: 'text', placeholder: 'เช่น 08:00 หรือ 18:00' },
      { key: 'timezone', label: 'เขตเวลา (Timezone)', type: 'select', options: [
        { value: 'Asia/Bangkok', label: '🇹🇭 Asia/Bangkok (UTC+7)' },
        { value: 'UTC', label: '🌐 UTC' }
      ]}
    ]
  },
  {
    type: 'trigger_chat',
    category: 'Trigger • จุดเริ่มต้น',
    title: 'Inbound Message (ข้อความแชทเข้า)',
    cleanTitle: 'Inbound Message',
    icon: '💬',
    color: 'amber',
    badge: 'Trigger',
    inputs: [],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{user_name}}', '{{message_text}}', '{{reply_token}}', '{{chat_id}}', '{{user_id}}'],
    primaryField: 'channel',
    varAdvice: 'บล็อกนี้จะส่งออกตัวแปร **{{user_name}} (ชื่อลูกค้า)** และ **{{message_text}} (ข้อความแชทที่พิมพ์มา)** ไปให้ AI หรือบล็อกถัดไปใช้งานครับ',
    defaultConfig: { channel: 'LINE Official Account', eventType: 'text_message' },
    fields: [
      { key: 'channel', label: 'ช่องทางแชท (Channel)', type: 'select', options: [
        { value: 'LINE Official Account', label: '🟢 LINE Official Account' },
        { value: 'Telegram Bot', label: '✈️ Telegram Bot' },
        { value: 'WeChat Work', label: '💬 WeChat Work' },
        { value: 'Facebook Messenger', label: '💙 Facebook Messenger' },
        { value: 'Web Chat', label: '🌐 Web Chat Widget' }
      ]},
      { key: 'eventType', label: 'ประเภทเหตุการณ์', type: 'select', options: [
        { value: 'text_message', label: 'ลูกค้าพิมพ์ข้อความเข้ามา (Text Message)' },
        { value: 'image_slip', label: 'ลูกค้าส่งรูปภาพ/สลิป (Image)' }
      ]}
    ]
  },
  {
    type: 'trigger_webhook',
    category: 'Trigger • จุดเริ่มต้น',
    title: 'Webhook (รับข้อมูล API)',
    cleanTitle: 'Webhook',
    icon: '🌐',
    color: 'amber',
    badge: 'Trigger',
    inputs: [],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{order_id}}', '{{customer_name}}', '{{amount}}', '{{payment_status}}', '{{headers}}'],
    primaryField: 'sourceSystem',
    varAdvice: 'บล็อกนี้รับข้อมูลจากระบบอื่นและส่งออก **{{order_id}}**, **{{customer_name}}**, **{{amount}}**, **{{payment_status}}** ให้บล็อกถัดไปครับ',
    defaultConfig: { sourceSystem: 'ระบบจองห้องพัก / ร้านค้าออนไลน์', method: 'POST', authType: 'none', secretToken: '' },
    fields: [
      { key: 'sourceSystem', label: 'รับข้อมูลจากระบบ', type: 'text', placeholder: 'เช่น เว็บไซต์จองห้องพัก' },
      { key: 'method', label: 'HTTP Method', type: 'select', options: [
        { value: 'POST', label: 'POST (รับข้อมูล JSON)' },
        { value: 'GET', label: 'GET (รับผ่าน URL)' }
      ]},
      { key: 'authType', label: 'ระบบความปลอดภัย (Authentication)', type: 'select', options: [
        { value: 'none', label: '🔓 ไม่ต้องยืนยันตัวตน (Public)' },
        { value: 'bearer_token', label: '🔑 Bearer Token' },
        { value: 'api_key', label: '🛡️ API Key Header' }
      ]},
      { key: 'secretToken', label: 'รหัสลับ / Token (ถ้ามี)', type: 'text', placeholder: 'เช่น secret_token_123' }
    ]
  },

  // --- LOGIC (4) ---
  {
    type: 'logic_if',
    category: 'Logic • เงื่อนไขและควบคุมสาย',
    title: 'IF / Else (ตรวจสอบเงื่อนไข)',
    cleanTitle: 'IF / Else',
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
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "ค่าที่ต้องการตรวจ (ช่องแรก)":** เช่น ใส่ `{{amount}}` เพื่อเช็คยอดเงิน หรือใส่ `{{ai_result}}` เพื่อเช็คผลวิเคราะห์จาก AI (รองรับเงื่อนไขรวม AND / OR หลายข้อ)',
    smartPreset: (availVars) => {
      if (availVars.includes('{{ai_result}}')) {
        return { conditionLogic: 'AND', leftValue: '{{ai_result}}', operator: 'contains', rightValue: 'ด่วน', conditions: [{ leftValue: '{{ai_result}}', operator: 'contains', rightValue: 'ด่วน' }] };
      }
      return { conditionLogic: 'AND', leftValue: '{{amount}}', operator: '>=', rightValue: '1000', conditions: [{ leftValue: '{{amount}}', operator: '>=', rightValue: '1000' }] };
    },
    defaultConfig: {
      conditionLogic: 'AND',
      leftValue: '{{amount}}',
      operator: '>=',
      rightValue: '1000',
      conditions: [
        { leftValue: '{{amount}}', operator: '>=', rightValue: '1000' }
      ]
    },
    fields: [
      { key: 'conditionLogic', label: 'ตรรกะการรวมเงื่อนไข', type: 'select', options: [
        { value: 'AND', label: 'AND (ต้องจริงทุกข้อพร้อมกัน)' },
        { value: 'OR', label: 'OR (จริงข้อใดข้อหนึ่งก็ผ่าน)' }
      ]},
      { key: 'leftValue', label: '🎯 1. ค่าที่ต้องการตรวจ (ใส่ตัวแปรที่นี่)', type: 'text', placeholder: 'เช่น {{amount}} หรือ {{ai_result}}' },
      { key: 'operator', label: '2. เครื่องหมายเปรียบเทียบ', type: 'select', options: [
        { value: '>=', label: 'มากกว่าหรือเท่ากับ (>=)' },
        { value: '>', label: 'มากกว่า (>)' },
        { value: '<=', label: 'น้อยกว่าหรือเท่ากับ (<=)' },
        { value: '<', label: 'น้อยกว่า (<)' },
        { value: '==', label: 'เท่ากับ (==)' },
        { value: '!=', label: 'ไม่เท่ากับ (!=)' },
        { value: 'contains', label: 'มีคำว่า (Contains)' },
        { value: 'not_contains', label: 'ไม่มีคำว่า (Not Contains)' },
        { value: 'starts_with', label: 'ขึ้นต้นด้วย (Starts With)' },
        { value: 'ends_with', label: 'ลงท้ายด้วย (Ends With)' },
        { value: 'is_empty', label: 'เป็นค่าว่าง (Is Empty)' },
        { value: 'is_not_empty', label: 'มีค่า ไม่ว่าง (Is Not Empty)' }
      ]},
      { key: 'rightValue', label: '3. ค่าที่ใช้เทียบ (ตัวเลข หรือ คำ)', type: 'text', placeholder: 'เช่น 1000 หรือ ด่วน' }
    ]
  },
  {
    type: 'logic_switch',
    category: 'Logic • เงื่อนไขและควบคุมสาย',
    title: 'Switch (แยกหลายเส้นทาง)',
    cleanTitle: 'Switch',
    icon: '🧭',
    color: 'purple',
    badge: 'Switch',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [
      { id: 'route_a', label: 'สาย A', color: 'emerald' },
      { id: 'route_b', label: 'สาย B', color: 'amber' },
      { id: 'route_c', label: 'สาย C', color: 'rose' },
      { id: 'default', label: 'กรณีอื่นๆ (Default)', color: 'slate' }
    ],
    producedVars: [],
    primaryField: 'switchField',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "ตัวแปรที่ใช้แยกสาย":** เช่น ใส่ `{{service_type}}` หรือ `{{payment_status}}` เพื่อแยกเส้นทางการทำงาน (เพิ่มสายได้ไม่จำกัด พร้อมสาย Default กรณีไม่ตรงเงื่อนไข)',
    smartPreset: () => ({ switchField: '{{service_type}}', caseA: 'จองที่พัก', caseB: 'สั่งอาหาร', caseC: 'ติดต่อทั่วไป' }),
    defaultConfig: {
      switchField: '{{service_type}}',
      caseA: 'จองที่พัก',
      caseB: 'สั่งอาหาร',
      caseC: 'ติดต่อสอบถามทั่วไป',
      routes: [
        { id: 'route_a', label: 'สาย A', condition: 'จองที่พัก', operator: '==' },
        { id: 'route_b', label: 'สาย B', condition: 'สั่งอาหาร', operator: '==' },
        { id: 'route_c', label: 'สาย C', condition: 'ติดต่อสอบถามทั่วไป', operator: '==' }
      ]
    },
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
    title: 'Loop (วนลูปทีละรายการ)',
    cleanTitle: 'Loop',
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
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "รายการข้อมูลที่จะนำมาวนลูป":** มักใส่ `{{sheet_rows}}` ที่ดึงมาจาก Spreadsheet',
    smartPreset: () => ({ sourceList: '{{sheet_rows}}', batchSize: '1' }),
    defaultConfig: { loopMode: 'item_by_item', sourceList: '{{sheet_rows}}', batchSize: '1', maxIterations: '100', onError: 'stop_loop' },
    fields: [
      { key: 'loopMode', label: 'รูปแบบการวนลูป', type: 'select', options: [
        { value: 'item_by_item', label: 'ทีละรายการ (Item by Item)' },
        { value: 'batch_groups', label: 'แบ่งกลุ่มตาม Batch Size' }
      ]},
      { key: 'sourceList', label: '🎯 รายการข้อมูลที่จะนำมาวนลูป (ใส่ตัวแปรที่นี่)', type: 'text', placeholder: 'เช่น {{sheet_rows}}' },
      { key: 'batchSize', label: 'จำนวนต่อรอบ (Batch Size)', type: 'text', placeholder: '1' },
      { key: 'maxIterations', label: 'จำกัดรอบสูงสุด (ป้องกันลูปค้าง)', type: 'text', placeholder: '100' },
      { key: 'onError', label: 'เมื่อเจอบั๊ก/เออเร่อในรอบนั้น', type: 'select', options: [
        { value: 'stop_loop', label: '🛑 หยุดวนลูปทันที (Stop on Error)' },
        { value: 'continue_next', label: '⏭️ ข้ามไปทำชิ้นถัดไป (Continue Next)' }
      ]}
    ]
  },
  {
    type: 'logic_delay',
    category: 'Logic • เงื่อนไขและควบคุมสาย',
    title: 'Delay (หน่วงเวลารอ)',
    cleanTitle: 'Delay',
    icon: '⏳',
    color: 'purple',
    badge: 'Delay',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: [],
    primaryField: 'duration',
    varAdvice: 'บล็อกหน่วงเวลาใช้กำหนดเวลารอ (เช่น 15 นาที) ไม่จำเป็นต้องใส่ตัวแปรครับ',
    defaultConfig: { delayType: 'duration', duration: '15 นาที', timeUnit: 'minutes', reason: 'รอลูกค้าโอนเงิน' },
    fields: [
      { key: 'delayType', label: 'ประเภทการรอ', type: 'select', options: [
        { value: 'duration', label: 'หน่วงเวลาตามระยะ (Duration)' },
        { value: 'until_time', label: 'รอจนถึงเวลาที่ระบุ (Wait Until Time)' }
      ]},
      { key: 'duration', label: 'ระยะเวลาที่รอ', type: 'text', placeholder: 'เช่น 15 นาที, 1 ชั่วโมง' },
      { key: 'timeUnit', label: 'หน่วยเวลา', type: 'select', options: [
        { value: 'minutes', label: 'นาที (Minutes)' },
        { value: 'seconds', label: 'วินาที (Seconds)' },
        { value: 'hours', label: 'ชั่วโมง (Hours)' },
        { value: 'days', label: 'วัน (Days)' }
      ]},
      { key: 'reason', label: 'เหตุผลที่หน่วงเวลา', type: 'text', placeholder: 'เช่น รอเช็คสถานะการจ่ายเงิน' }
    ]
  },

  // --- AI & DATA (3) ---
  {
    type: 'ai_agent',
    category: 'AI & Data • ประมวลผลและ AI',
    title: 'AI Agent (วิเคราะห์/ประมวลผล)',
    cleanTitle: 'AI Agent',
    icon: '🤖',
    color: 'cyan',
    badge: 'AI',
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
      model: 'gemini-2.5-flash',
      systemRole: 'customer_support',
      taskType: 'sentiment_triage',
      temperature: 'balanced',
      prompt: 'วิเคราะห์ข้อความลูกค้า: "{{message_text}}" ว่าอารมณ์เป็นอย่างไร และเป็นเคสด่วนหรือไม่ (ตอบว่า ด่วน หรือ ปกติ)'
    },
    fields: [
      { key: 'model', label: 'สมองกล AI (Model Engine)', type: 'select', options: [
        { value: 'gemini-2.5-flash', label: '⚡ Google Gemini 2.5 Flash (เร็ว & แม่นยำ)' },
        { value: 'gpt-4o-mini', label: '🧠 OpenAI GPT-4o Mini (เข้าใจภาษาธรรมชาติ)' },
        { value: 'claude-3.5-haiku', label: '✍️ Anthropic Claude 3.5 Haiku (ร่างข้อความสุภาพ)' },
        { value: 'deepseek-chat', label: '🧩 DeepSeek V3 (วิเคราะห์เชิงตรรกะ)' }
      ]},
      { key: 'systemRole', label: 'บทบาทของ AI (System Persona)', type: 'select', options: [
        { value: 'customer_support', label: '🤝 ฝ่ายบริการลูกค้า สุภาพและเป็นมิตร' },
        { value: 'data_analyst', label: '📊 นักวิเคราะห์ข้อมูล สรุปกระชับ ตรงประเด็น' },
        { value: 'emergency_triage', label: '🚨 ฝ่ายคัดกรองเคสด่วนและการร้องเรียน' }
      ]},
      { key: 'taskType', label: 'รูปแบบงาน AI', type: 'select', options: [
        { value: 'sentiment_triage', label: 'วิเคราะห์อารมณ์ & คัดกรองเคสด่วน' },
        { value: 'draft_reply', label: 'ร่างคำตอบกลับลูกค้าอัตโนมัติ' },
        { value: 'summarize', label: 'สรุปข้อมูลจากตารางให้สั้นกระชับ' },
        { value: 'extract_data', label: 'อ่านสลิป / ตรวจสอบข้อมูลลูกค้า' }
      ]},
      { key: 'temperature', label: 'ระดับความคิดสร้างสรรค์ (Temperature)', type: 'select', options: [
        { value: 'precise', label: '🎯 ตรงไปตรงมา แม่นยำ ไม่แต่งเติม (0.2)' },
        { value: 'balanced', label: '⚖️ สมดุล เป็นธรรมชาติ (0.7)' },
        { value: 'creative', label: '💡 คิดนอกกรอบ หลากหลาย (1.0)' }
      ]},
      { key: 'prompt', label: '🎯 คำสั่ง Prompt ที่ส่งให้ AI (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'เขียนคำสั่งบอก AI พร้อมใส่ตัวแปร เช่น {{message_text}}' }
    ]
  },
  {
    type: 'data_formatter',
    category: 'AI & Data • ประมวลผลและ AI',
    title: 'Text Formatter (จัดรูปแบบข้อความ)',
    cleanTitle: 'Text Formatter',
    icon: '🛠️',
    color: 'sky',
    badge: 'Formatter',
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
      template: '📋 สรุปคิววันนี้ ({{current_date}}): {{sheet_rows}}',
      dateFormatPattern: 'th_long',
      numberFormatDecimals: '2'
    },
    fields: [
      { key: 'formatMode', label: 'โหมดการแปลงข้อมูล', type: 'select', options: [
        { value: 'summary_text', label: 'รวมรายการจากตารางเป็นข้อความสรุป' },
        { value: 'math_calc', label: 'คำนวณตัวเลข / ยอดรวม' },
        { value: 'json_transform', label: 'แปลงเป็นรูปแบบ JSON (JSON Object)' },
        { value: 'text_replace', label: 'ค้นหาและแทนที่คำ (Text Replace)' },
        { value: 'date_format', label: '📅 แปลงรูปแบบวันที่ (Date Formatter)' },
        { value: 'number_format', label: '💰 แปลงรูปแบบตัวเลข/การเงิน (Currency/Number)' }
      ]},
      { key: 'template', label: '🎯 รูปแบบข้อความสรุป (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'เช่น สรุปคิววันที่ {{current_date}}: {{sheet_rows}}' },
      { key: 'dateFormatPattern', label: 'รูปแบบวันที่ (เมื่อเลือก date_format)', type: 'select', options: [
        { value: 'th_long', label: 'ไทยเต็ม (เช่น 31 ตุลาคม 2569)' },
        { value: 'th_short', label: 'ไทยย่อ (เช่น 31 ต.ค. 69)' },
        { value: 'iso_date', label: 'สากล (YYYY-MM-DD)' }
      ]}
    ]
  },
  {
    type: 'action_http',
    category: 'AI & Data • ประมวลผลและ AI',
    title: 'HTTP Request (เชื่อมต่อ API)',
    cleanTitle: 'HTTP Request',
    icon: '🔌',
    color: 'sky',
    badge: 'HTTP API',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{api_data}}', '{{api_status}}'],
    primaryField: 'bodyPayload',
    varAdvice: 'ใส่ตัวแปรที่ต้องการส่งไปให้ API ในช่อง "ข้อมูลที่ส่งไป" ได้เลยครับ',
    defaultConfig: { method: 'GET', endpoint: 'https://api.example.com/orders', authType: 'none', headers: '', bodyPayload: '', timeoutSeconds: '30' },
    fields: [
      { key: 'method', label: 'HTTP Method', type: 'select', options: [
        { value: 'GET', label: 'GET (ดึงข้อมูล)' },
        { value: 'POST', label: 'POST (ส่งข้อมูลสร้างใหม่)' },
        { value: 'PUT', label: 'PUT (อัปเดตทั้งก้อน)' },
        { value: 'PATCH', label: 'PATCH (แก้ไขบางฟิลด์)' },
        { value: 'DELETE', label: 'DELETE (ลบข้อมูล)' }
      ]},
      { key: 'endpoint', label: 'URL / Endpoint', type: 'text', placeholder: 'https://...' },
      { key: 'authType', label: 'ระบบความปลอดภัย (Authentication)', type: 'select', options: [
        { value: 'none', label: '🔓 ไม่ระบุ Header Authentication' },
        { value: 'bearer', label: '🔑 Bearer Token (ใส่ใน Headers)' },
        { value: 'api_key', label: '🛡️ API Key Header' }
      ]},
      { key: 'headers', label: 'HTTP Headers (กำหนดเองได้)', type: 'text', placeholder: 'เช่น Authorization: Bearer token หรือ Content-Type: application/json' },
      { key: 'bodyPayload', label: '🎯 ข้อมูลที่ส่งไป (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'เช่น {"name": "{{customer_name}}"}' },
      { key: 'timeoutSeconds', label: 'หมดเวลาเชื่อมต่อ (วินาที)', type: 'text', placeholder: '30' }
    ]
  },

  // --- ACTIONS (5) ---
  {
    type: 'action_sheets',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'Spreadsheet (ตารางข้อมูล)',
    cleanTitle: 'Spreadsheet',
    icon: '📊',
    color: 'emerald',
    badge: 'Spreadsheet',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{sheet_rows}}', '{{row_number}}'],
    primaryField: 'columns',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "คอลัมน์ที่บันทึก / เงื่อนไขที่ดึง":** \n• ถ้า **บันทึกแถวใหม่**: ใส่ `{{customer_name}}, {{phone}}, {{amount}}` \n• ถ้า **ดึงข้อมูลรายวัน**: ใส่ `ดึงเฉพาะวันที่ {{current_date}}`',
    smartPreset: (availVars, currentConfig) => {
      if (currentConfig.operation === 'read_rows' || availVars.includes('{{current_date}}')) {
        return { channel: currentConfig.channel || 'google_sheets', operation: 'read_rows', sheetName: 'ตารางคิวงานวันนี้', columns: 'ดึงข้อมูลที่ตรงกับวันที่ {{current_date}}' };
      }
      if (availVars.includes('{{user_name}}')) {
        return { channel: currentConfig.channel || 'google_sheets', operation: 'append_row', sheetName: 'ตารางประวัติแชทลูกค้า', columns: '{{user_name}}, {{message_text}}, {{ai_result}}' };
      }
      return { channel: currentConfig.channel || 'google_sheets', operation: 'append_row', sheetName: currentConfig.sheetName || 'ตารางรายการลูกค้า', columns: '{{customer_name}}, {{phone}}, {{amount}}' };
    },
    defaultConfig: {
      channel: 'google_sheets',
      operation: 'append_row',
      sheetName: 'ตารางรายการลูกค้า',
      columns: '{{customer_name}}, {{phone}}, {{amount}}'
    },
    fields: [
      { key: 'channel', label: 'ผู้ให้บริการตารางข้อมูล (Channel / Provider)', type: 'select', options: [
        { value: 'google_sheets', label: '📊 Google Sheets' },
        { value: 'excel_365', label: '📗 Microsoft Excel 365' },
        { value: 'lark_base', label: '🦅 Lark Base / Feishu' },
        { value: 'airtable', label: '📑 Airtable' },
        { value: 'supabase_table', label: '⚡ Supabase Database Table' }
      ]},
      { key: 'operation', label: 'โหมดการทำงาน', type: 'select', options: [
        { value: 'append_row', label: '➕ เพิ่มแถวใหม่ต่อท้าย (Append Row)' },
        { value: 'read_rows', label: '🔍 ดึงข้อมูลหลายแถวตามเงื่อนไข (Get Many Rows)' },
        { value: 'update_row', label: '✏️ อัปเดตแถวเดิม (Update Row)' },
        { value: 'delete_row', label: '🗑️ ลบแถวข้อมูล (Delete Row)' },
        { value: 'clear_sheet', label: '🧹 ล้างข้อมูลทั้งตาราง (Clear Sheet)' }
      ]},
      { key: 'sheetName', label: 'ชื่อตาราง / หน้าชีต (Table / Sheet Name)', type: 'text', placeholder: 'เช่น ลูกค้า VIP หรือ ลูกค้าทั่วไป' },
      { key: 'columns', label: '🎯 คอลัมน์ที่บันทึก / เงื่อนไขที่ดึง (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'เช่น {{customer_name}}, {{phone}}, {{amount}}' }
    ]
  },
  {
    type: 'action_line',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'Notification (ส่งข้อความแจ้งเตือน)',
    cleanTitle: 'Notification',
    icon: '💬',
    color: 'emerald',
    badge: 'Notify',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: [],
    primaryField: 'messageTemplate',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "เนื้อหาข้อความที่จะส่ง":** อยากให้แอดมินหรือลูกค้าเห็นข้อมูลอะไร ให้แทรกตัวแปรนั้นลงในประโยคข้อความได้เลย!',
    smartPreset: (availVars) => {
      if (availVars.includes('{{formatted_text}}')) {
        return { channel: 'line', target: 'admin_group', messageTemplate: '🌅 สรุปรายงานประจำวัน ({{current_date}}):\n{{formatted_text}}' };
      }
      if (availVars.includes('{{ai_result}}') && availVars.includes('{{user_name}}')) {
        return { channel: 'line', target: 'admin_group', messageTemplate: '🔔 แจ้งเตือนจากแชท!\nลูกค้า: {{user_name}}\nข้อความ: "{{message_text}}"\nผลวิเคราะห์ AI: {{ai_result}}' };
      }
      return { channel: 'line', target: 'admin_group', messageTemplate: '🔔 มีรายการใหม่เข้ามา!\nชื่อลูกค้า: {{customer_name}}\nเบอร์โทร: {{phone}}\nยอดเงิน: {{amount}} บาท' };
    },
    defaultConfig: {
      channel: 'line',
      messageType: 'text',
      target: 'admin_group',
      messageTemplate: '🔔 แจ้งเตือนใหม่!\nลูกค้า: {{customer_name}}\nเบอร์โทร: {{phone}}\nยอดเงิน: {{amount}} บาท'
    },
    fields: [
      { key: 'channel', label: 'ช่องทางส่งข้อความ (Channel / Platform)', type: 'select', options: [
        { value: 'line', label: '🟢 LINE Official Account' },
        { value: 'telegram', label: '✈️ Telegram' },
        { value: 'wechat', label: '💬 WeChat Work' },
        { value: 'slack', label: '⚡ Slack' },
        { value: 'discord', label: '🎮 Discord' },
        { value: 'custom_webhook', label: '🔗 Custom Webhook URL' }
      ]},
      { key: 'messageType', label: 'รูปแบบข้อความ', type: 'select', options: [
        { value: 'text', label: '💬 ข้อความธรรมดา (Text Message)' },
        { value: 'flex_card', label: '🎴 การ์ดข้อความสวยงาม (Flex Card)' },
        { value: 'image', label: '🖼️ รูปภาพพร้อมข้อความ (Image Card)' }
      ]},
      { key: 'target', label: 'ผู้รับ / ปลายทาง (Target)', type: 'select', options: [
        { value: 'admin_group', label: 'กลุ่มแอดมิน / เจ้าของร้าน (Admin Alert)' },
        { value: 'vip_team', label: 'กลุ่มทีมดูแลลูกค้า VIP / เคสด่วนพิเศษ' },
        { value: 'reply_customer', label: 'ตอบกลับแชทลูกค้าโดยตรง (Reply Message)' },
        { value: 'custom', label: '🎯 กำหนดเอง (ระบุ ID / ตัวแปร / Webhook URL)' }
      ]},
      { key: 'customTarget', label: 'ผู้รับที่กำหนดเอง (ใส่ตัวแปรได้)', type: 'text', placeholder: 'เช่น {{phone}}, {{user_id}}, หรือ Webhook URL' },
      { key: 'messageTemplate', label: '🎯 เนื้อหาข้อความที่จะส่ง (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'พิมพ์ข้อความผสมกับตัวแปร เช่น คุณ {{customer_name}} โอนยอด {{amount}} บาท' }
    ]
  },
  {
    type: 'action_telegram',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'Bot Alert (แจ้งเตือนบอท)',
    cleanTitle: 'Bot Alert',
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
      parseMode: 'HTML',
      silentNotification: 'no',
      message: '🚀 อัปเดตสถานะ: {{customer_name}} ยอด {{amount}} บาท'
    },
    fields: [
      { key: 'platform', label: 'แพลตฟอร์ม (Platform)', type: 'select', options: [
        { value: 'Telegram Bot', label: '✈️ Telegram Bot' },
        { value: 'Discord Webhook', label: '🎮 Discord Webhook' },
        { value: 'Slack Webhook', label: '⚡ Slack Webhook' },
        { value: 'WeChat Work Bot', label: '💬 WeChat Work Bot' }
      ]},
      { key: 'chatId', label: 'ชื่อห้อง / Chat ID', type: 'text', placeholder: 'เช่น ห้องแจ้งเตือนออเดอร์' },
      { key: 'parseMode', label: 'การจัดรูปแบบข้อความ', type: 'select', options: [
        { value: 'HTML', label: 'HTML (<b>ตัวหนา</b>, <code>โค้ด</code>)' },
        { value: 'MarkdownV2', label: 'Markdown (*ตัวหนา*, _ตัวเอียง_)' },
        { value: 'None', label: 'ข้อความธรรมดา (Plain Text)' }
      ]},
      { key: 'silentNotification', label: 'การส่งแจ้งเตือน', type: 'select', options: [
        { value: 'no', label: '🔔 มีเสียงแจ้งเตือนปกติ' },
        { value: 'yes', label: '🔕 ส่งแบบเงียบ (Silent Notification)' }
      ]},
      { key: 'message', label: '🎯 ข้อความที่ส่ง (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'ใส่ข้อความและตัวแปร...' }
    ]
  },
  {
    type: 'action_email',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'Email (ส่งอีเมล)',
    cleanTitle: 'Email',
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
      ccEmail: '',
      bccEmail: '',
      subject: 'ยืนยันรายการของคุณ {{customer_name}}',
      contentType: 'html',
      body: 'สวัสดีคุณ {{customer_name}} ระบบได้รับยอด {{amount}} บาทเรียบร้อยแล้ว'
    },
    fields: [
      { key: 'toEmail', label: 'อีเมลผู้รับ (To)', type: 'text', placeholder: 'เช่น manager@company.com' },
      { key: 'ccEmail', label: 'สำเนาถึง (CC)', type: 'text', placeholder: 'เช่น team@company.com' },
      { key: 'bccEmail', label: 'สำเนาลับ (BCC)', type: 'text', placeholder: 'เช่น audit@company.com' },
      { key: 'subject', label: 'หัวข้ออีเมล (Subject)', type: 'text', placeholder: 'หัวข้ออีเมล' },
      { key: 'contentType', label: 'รูปแบบอีเมล', type: 'select', options: [
        { value: 'html', label: '🌐 HTML Email (รองรับการจัดหน้าสวยงาม)' },
        { value: 'plain', label: '📄 Plain Text (ข้อความธรรมดา)' }
      ]},
      { key: 'body', label: '🎯 เนื้อหาอีเมล (ใส่ตัวแปรที่นี่)', type: 'textarea', placeholder: 'รายละเอียดอีเมล...' }
    ]
  },
  {
    type: 'action_calendar',
    category: 'Action • บันทึกและแจ้งเตือนปลายทาง',
    title: 'Calendar (ปฏิทินนัดหมาย)',
    cleanTitle: 'Calendar',
    icon: '📅',
    color: 'emerald',
    badge: 'Calendar',
    inputs: [{ id: 'in', label: 'เข้า' }],
    outputs: [{ id: 'out', label: 'ถัดไป' }],
    producedVars: ['{{event_link}}'],
    primaryField: 'eventTitle',
    varAdvice: '🎯 **ช่องที่ต้องใส่ตัวแปรคือ "ชื่อนัดหมายบนปฏิทิน":** เช่น `คิวจองคุณ {{customer_name}} เบอร์ {{phone}}`',
    defaultConfig: {
      provider: 'google_calendar',
      eventTitle: 'คิวจองคุณ {{customer_name}} ({{service_type}})',
      eventDate: '{{current_date}}',
      durationMinutes: '60',
      location: 'Google Meet',
      notes: 'เบอร์ติดต่อ: {{phone}}'
    },
    fields: [
      { key: 'provider', label: 'ผู้ให้บริการปฏิทิน (Provider)', type: 'select', options: [
        { value: 'google_calendar', label: '📅 Google Calendar' },
        { value: 'outlook_calendar', label: '📆 Microsoft Outlook Calendar' },
        { value: 'apple_calendar', label: '🍏 Apple iCloud Calendar' }
      ]},
      { key: 'eventTitle', label: '🎯 ชื่อนัดหมายบนปฏิทิน (ใส่ตัวแปรที่นี่)', type: 'text', placeholder: 'เช่น นัดลูกค้า {{customer_name}}' },
      { key: 'eventDate', label: 'วันที่ / เวลา', type: 'text', placeholder: 'เช่น {{current_date}} 14:00' },
      { key: 'durationMinutes', label: 'ระยะเวลาการนัดหมาย', type: 'select', options: [
        { value: '15', label: '15 นาที' },
        { value: '30', label: '30 นาที' },
        { value: '45', label: '45 นาที' },
        { value: '60', label: '1 ชั่วโมง (60 นาที)' },
        { value: '90', label: '1 ชั่วโมง 30 นาที' },
        { value: '120', label: '2 ชั่วโมง (120 นาที)' }
      ]},
      { key: 'location', label: 'สถานที่นัดหมาย / ลิงก์ห้องประชุม', type: 'text', placeholder: 'เช่น Google Meet หรือ สำนักงานใหญ่' },
      { key: 'notes', label: 'รายละเอียดในนัดหมาย', type: 'textarea', placeholder: 'เบอร์โทร {{phone}}' }
    ]
  }
];

if (typeof module !== 'undefined') module.exports = { BLOCK_CATALOG };
