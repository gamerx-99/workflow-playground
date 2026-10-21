// สาย "AI & API" — บล็อก AI, HTTP, ตัวแปร {{ai_result}} / {{ai_reply}} / {{api_data}} (id 23-27; ด่าน 4 อยู่ใน core.js)
if (typeof require !== 'undefined') require('./_helpers.js');
(function ({ node, link }) {

const URGENT_FLOW = {
  nodes: [
    node(1, 'trigger_chat', { channel: 'LINE Official Account', eventType: 'text_message' }, 0, 0.5),
    node(2, 'ai_agent', { taskType: 'sentiment_triage', prompt: 'อ่านข้อความ "{{message_text}}" ของคุณ {{user_name}} แล้วตอบว่า ด่วน หรือ ปกติ' }, 1, 0.5),
    node(3, 'logic_if', { leftValue: '{{ai_result}}', operator: 'contains', rightValue: 'ด่วน' }, 2, 0.5),
    node(4, 'action_line', { target: 'vip_team', messageTemplate: 'เคสด่วนจากคุณ {{user_name}}: {{message_text}}' }, 3, 0),
    node(5, 'action_line', { target: 'reply_customer', messageTemplate: 'สวัสดีคุณ {{user_name}} {{ai_reply}}' }, 3, 1)
  ],
  connections: [link(1, 2), link(2, 3), link(3, 4, 'true'), link(3, 5, 'false')]
};

WF.levels.ai = [
  {
    id: 23,
    difficulty: 2,
    shortName: 'ด่าน 23: AI ร่างคำตอบ',
    badge: 'ด่านที่ 23 • ให้ AI ร่างคำตอบลูกค้า',
    title: 'ลูกค้าทักแชท → AI ร่างคำตอบสุภาพ → ตอบกลับทาง LINE',
    desc: 'ส่งข้อความลูกค้าเข้า Prompt ของ AI ให้อ่าน แล้วนำ {{ai_reply}} ที่ AI ร่างให้ไปตอบกลับ',
    template: {
      nodes: [
        node(1, 'trigger_chat', { channel: 'LINE Official Account', eventType: 'text_message' }, 0, 0),
        node(2, 'ai_agent', { taskType: 'draft_reply', prompt: 'ร่างคำตอบสุภาพให้ข้อความ "{{message_text}}" จากคุณ {{user_name}}' }, 1, 0),
        node(3, 'action_line', { target: 'reply_customer', messageTemplate: 'สวัสดีคุณ {{user_name}}\n{{ai_reply}}' }, 2, 0)
      ],
      connections: [link(1, 2), link(2, 3)]
    }
  },
  {
    id: 24,
    difficulty: 2,
    shortName: 'ด่าน 24: AI ตรวจข้อมูลแล้วบันทึก',
    badge: 'ด่านที่ 24 • AI ตรวจข้อมูล → Sheets',
    title: 'ฟอร์มลูกค้า → AI ตรวจความครบถ้วน → บันทึกผลลงชีต',
    desc: 'Prompt ต้องมีข้อมูลที่ให้ AI ตรวจ แล้วเก็บ {{ai_result}} ไว้คู่กับข้อมูลลูกค้าในชีต',
    template: {
      nodes: [
        node(1, 'trigger_form', { formName: 'ฟอร์มลงทะเบียนลูกค้า', triggerEvent: 'on_submit' }, 0, 0),
        node(2, 'ai_agent', { taskType: 'extract_data', prompt: 'ตรวจข้อมูลลูกค้า {{customer_name}} เบอร์ {{phone}} ยอด {{amount}} บาท ว่าครบถ้วนหรือไม่' }, 1, 0),
        node(3, 'action_sheets', { operation: 'append_row', sheetName: 'ผลตรวจข้อมูลลูกค้า', columns: '{{customer_name}}, {{phone}}, {{ai_result}}' }, 2, 0)
      ],
      connections: [link(1, 2), link(2, 3)]
    }
  },
  {
    id: 25,
    difficulty: 2,
    shortName: 'ด่าน 25: ส่งข้อมูลไป API',
    badge: 'ด่านที่ 25 • HTTP POST แล้วใช้ผลตอบกลับ',
    title: 'ออเดอร์ใหม่ → ส่งไประบบคลังสินค้าผ่าน API → แจ้งผลทาง LINE',
    desc: 'ใส่ตัวแปรลงใน "ข้อมูลที่ส่งไป" ของบล็อก HTTP แล้วนำ {{api_data}} ที่ตอบกลับมาไปแจ้งแอดมิน',
    template: {
      nodes: [
        node(1, 'trigger_webhook', { sourceSystem: 'เว็บร้านค้าออนไลน์', method: 'POST' }, 0, 0),
        node(2, 'action_http', { method: 'POST', endpoint: 'https://api.example.com/stock/reserve', bodyPayload: '{"order_id":"{{order_id}}","amount":"{{amount}}"}' }, 1, 0),
        node(3, 'action_line', { target: 'admin_group', messageTemplate: 'ส่งออเดอร์ {{order_id}} ไปคลังแล้ว ผลตอบกลับ: {{api_data}}' }, 2, 0)
      ],
      connections: [link(1, 2), link(2, 3)]
    }
  },
  {
    id: 26,
    difficulty: 3,
    mode: 'fill',
    shortName: 'ด่าน 26: เติมช่องว่าง (AI)',
    badge: 'ด่านที่ 26 • เติมช่องว่าง: Prompt + ชีต + ข้อความ',
    title: 'ทักแชท → AI วิเคราะห์ → บันทึกชีต → แจ้ง LINE (เติมช่องที่ว่างไว้)',
    desc: 'ต่อสายครบแล้ว แต่ Prompt, คอลัมน์ชีต และข้อความ LINE ยังว่าง เติมให้ตัวแปรไหลถูกต้องตลอดสาย',
    hint: '💡 Prompt ต้องมี {{message_text}} ให้ AI อ่าน • ชีตบันทึก {{user_name}}, {{message_text}}, {{ai_result}} • LINE แจ้ง {{user_name}} และ {{ai_result}}',
    start: {
      nodes: [
        node(1, 'trigger_chat', { channel: 'LINE Official Account', eventType: 'text_message' }, 0, 0),
        node(2, 'ai_agent', { taskType: 'sentiment_triage', prompt: '' }, 1, 0),
        node(3, 'action_sheets', { operation: 'append_row', sheetName: 'ประวัติแชท', columns: '' }, 2, 0),
        node(4, 'action_line', { target: 'admin_group', messageTemplate: '' }, 3, 0)
      ],
      connections: [link(1, 2), link(2, 3), link(3, 4)]
    },
    template: {
      nodes: [
        node(1, 'trigger_chat', { channel: 'LINE Official Account', eventType: 'text_message' }, 0, 0),
        node(2, 'ai_agent', { taskType: 'sentiment_triage', prompt: 'วิเคราะห์ข้อความ "{{message_text}}" ของคุณ {{user_name}} ว่าด่วนหรือปกติ' }, 1, 0),
        node(3, 'action_sheets', { operation: 'append_row', sheetName: 'ประวัติแชท', columns: '{{user_name}}, {{message_text}}, {{ai_result}}' }, 2, 0),
        node(4, 'action_line', { target: 'admin_group', messageTemplate: 'บันทึกแชทของคุณ {{user_name}} แล้ว ผล AI: {{ai_result}}' }, 3, 0)
      ],
      connections: [link(1, 2), link(2, 3), link(3, 4)]
    }
  },
  {
    id: 27,
    difficulty: 3,
    mode: 'predict',
    shortName: 'ด่าน 27: ทายผล AI + IF',
    badge: 'ด่านที่ 27 • ทายว่า AI ตัดสินแล้วไปสายไหน',
    title: 'แชทแต่ละข้อความ AI จะประเมินว่าด่วนหรือไม่ แล้วระบบแจ้งใคร?',
    desc: 'Flow: ทักแชท → AI ประเมิน → IF มีคำว่า "ด่วน" → ทีม VIP / ตอบกลับลูกค้า (ตัวจำลองใช้กฎคำสำคัญแทน AI จริง เช่น ด่วน, ช่วยด้วย, ไม่ได้รับ, เร่ง)',
    hint: '💡 ดูว่าข้อความมีคำที่บ่งบอกความเร่งด่วนหรือไม่ — ถ้า AI ตอบ "ด่วน" IF จะไปสาย True',
    start: URGENT_FLOW,
    questions: [
      {
        text: 'ลูกค้าพิมพ์ว่า "ด่วนมากครับ โอนเงินแล้วแต่ยังไม่ได้รับของ ช่วยด้วย" ระบบจะแจ้งใคร?',
        scenarios: { trigger_chat: 'urgent' },
        options: [
          { label: 'ทีม VIP / เคสด่วน', outcome: { sheets: [], messages: ['vip_team'] } },
          { label: 'ตอบกลับลูกค้าอย่างเดียว', outcome: { sheets: [], messages: ['reply_customer'] } },
          { label: 'แจ้งทั้งสองที่', outcome: { sheets: [], messages: ['vip_team', 'reply_customer'] } }
        ],
        explain: 'ข้อความมีคำว่า ด่วน/ช่วยด้วย → AI ตอบ "ด่วน" → IF ไปสาย True → ทีม VIP'
      },
      {
        text: 'ลูกค้าพิมพ์ว่า "สวัสดีครับ สนใจสอบถามราคาบริการหน่อยครับ" ระบบจะแจ้งใคร?',
        scenarios: { trigger_chat: 'normal' },
        options: [
          { label: 'ทีม VIP / เคสด่วน', outcome: { sheets: [], messages: ['vip_team'] } },
          { label: 'ตอบกลับลูกค้าอย่างเดียว', outcome: { sheets: [], messages: ['reply_customer'] } },
          { label: 'ไม่ทำอะไรเลย', outcome: { sheets: [], messages: [] } }
        ],
        explain: 'ไม่มีคำเร่งด่วน → AI ตอบ "ปกติ" → IF ไปสาย False → ตอบกลับลูกค้าด้วยข้อความที่ AI ร่าง'
      },
      {
        text: 'ลูกค้าพิมพ์ว่า "ไม่ได้รับของที่สั่งมา 3 วันแล้ว" (ไม่มีคำว่า "ด่วน" ตรงๆ) ระบบจะแจ้งใคร?',
        overrides: { message_text: 'ไม่ได้รับของที่สั่งมา 3 วันแล้ว' },
        options: [
          { label: 'ทีม VIP / เคสด่วน', outcome: { sheets: [], messages: ['vip_team'] } },
          { label: 'ตอบกลับลูกค้าอย่างเดียว', outcome: { sheets: [], messages: ['reply_customer'] } }
        ],
        explain: 'IF เช็คผลของ AI ({{ai_result}}) ไม่ได้เช็คข้อความเดิมของลูกค้า — AI เข้าใจว่า "ไม่ได้รับของ" คือเรื่องด่วน จึงตอบ "ด่วน"'
      }
    ]
  }
];
})(WF.helpers);
