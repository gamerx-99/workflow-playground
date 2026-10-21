// ---------------------------------------------------------
// 2. EXERCISE LEVELS
// checks = เงื่อนไขผ่านด่าน (ดูชนิดที่รองรับใน shared/checker.js)
// ---------------------------------------------------------
const COMMON_CHECKS = [
  { type: 'reachable' },
  { type: 'upstreamVars' }
];

const LEVELS = [
  {
    id: 1,
    shortName: 'ด่าน 1: พื้นฐาน',
    checks: [
      { type: 'block', block: 'trigger_form' },
      { type: 'block', block: 'action_sheets' },
      { type: 'block', block: 'action_line' },
      { type: 'link', from: 'trigger_form', to: 'action_sheets' },
      { type: 'link', from: 'action_sheets', to: 'action_line' },
      { type: 'vars', block: 'action_sheets', field: 'columns', vars: ['{{customer_name}}', '{{phone}}'] },
      { type: 'vars', block: 'action_line', field: 'messageTemplate', vars: ['{{customer_name}}'] },
      ...COMMON_CHECKS
    ],
    badge: 'ด่านที่ 1 • พื้นฐานการส่งต่อตัวแปร',
    title: 'รับฟอร์มจองคิว → บันทึกลง Google Sheets → แจ้งเตือนเข้า LINE',
    desc: 'ฝึกหยิบตัวแปร {{customer_name}}, {{phone}}, {{amount}} จากฟอร์ม ไปใส่ในช่องคอลัมน์ของ Google Sheets และช่องข้อความของ LINE',
    hint: '💡 <b>โพยตัวแปรด่าน 1:</b><br>1. บล็อก <b>[Google Sheets]</b> ช่องคอลัมน์ ให้ใส่: <code>{{customer_name}}, {{phone}}, {{amount}}</code><br>2. บล็อก <b>[ส่งข้อความ LINE]</b> ช่องข้อความ ให้ใส่: <code>ลูกค้า {{customer_name}} เบอร์ {{phone}} ยอด {{amount}} บาท</code>',
    template: {
      nodes: [
        { id: 1, type: 'trigger_form', x: 80, y: 180, config: { formName: 'ฟอร์มจองคิวลูกค้าใหม่', triggerEvent: 'on_submit' } },
        { id: 2, type: 'action_sheets', x: 430, y: 180, config: { operation: 'append_row', sheetName: 'ตารางจองคิว', columns: '{{customer_name}}, {{phone}}, {{service_type}}' } },
        { id: 3, type: 'action_line', x: 780, y: 180, config: { target: 'admin_group', messageTemplate: '🔔 มีคิวจองใหม่!\nชื่อ: {{customer_name}}\nเบอร์: {{phone}}\nบริการ: {{service_type}}' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'out', toNode: 3, toPort: 'in' }
      ]
    }
  },
  {
    id: 2,
    shortName: 'ด่าน 2: เงื่อนไข IF',
    checks: [
      { type: 'block', block: 'trigger_form' },
      { type: 'block', block: 'logic_if' },
      { type: 'block', block: 'action_sheets', min: 2 },
      { type: 'link', from: 'trigger_form', to: 'logic_if' },
      { type: 'link', from: 'logic_if', port: 'true', to: 'action_sheets' },
      { type: 'link', from: 'logic_if', port: 'false', to: 'action_sheets' },
      { type: 'vars', block: 'logic_if', field: 'leftValue', vars: ['{{amount}}'] },
      { type: 'value', block: 'logic_if', field: 'operator', oneOf: ['>='] },
      { type: 'value', block: 'logic_if', field: 'rightValue', oneOf: ['1000', '1,000'] },
      { type: 'distinct', block: 'action_sheets', field: 'sheetName' },
      { type: 'link', from: 'action_sheets', to: 'action_line', label: 'ต่อสายจาก [Google Sheets] ➔ [ส่งข้อความ LINE] เพื่อแจ้งเตือน' },
      ...COMMON_CHECKS
    ],
    badge: 'ด่านที่ 2 • เช็คเงื่อนไขตัวแปร (IF / Else)',
    title: 'คัดกรองยอดโอน: ลูกค้า VIP (>= 1,000 บาท) vs ลูกค้าทั่วไป',
    desc: 'ฝึกตั้งค่าบล็อก IF โดยใส่ {{amount}} >= 1000 แล้วแยกสายบันทึกชีต VIP กับชีตทั่วไป พร้อมส่งแจ้งเตือน',
    hint: '💡 <b>โพยตัวแปรด่าน 2:</b><br>1. บล็อก <b>[ตรวจสอบเงื่อนไข IF]</b> ช่องแรกใส่ <code>{{amount}}</code> เลือก <code>>=</code> ช่องท้ายใส่ <code>1000</code><br>2. บล็อก <b>[Google Sheets]</b> ทั้ง 2 สาย ช่องคอลัมน์ใส่ <code>{{customer_name}}, {{phone}}, {{amount}}</code> (และตั้งชื่อหน้าชีตให้ต่างกัน)<br>3. บล็อก <b>[ส่งข้อความ LINE]</b> ใส่ <code>แจ้งเตือน VIP คุณ {{customer_name}} โอนยอด {{amount}} บาท</code>',
    template: {
      nodes: [
        { id: 1, type: 'trigger_form', x: 60, y: 200, config: { formName: 'ฟอร์มแจ้งโอนเงินลูกค้า', triggerEvent: 'on_submit' } },
        { id: 2, type: 'logic_if', x: 390, y: 200, config: { leftValue: '{{amount}}', operator: '>=', rightValue: '1000' } },
        { id: 3, type: 'action_sheets', x: 720, y: 80, config: { operation: 'append_row', sheetName: 'รายชื่อลูกค้า VIP', columns: '{{customer_name}}, {{phone}}, {{amount}}' } },
        { id: 4, type: 'action_sheets', x: 720, y: 320, config: { operation: 'append_row', sheetName: 'รายชื่อลูกค้าทั่วไป', columns: '{{customer_name}}, {{phone}}, {{amount}}' } },
        { id: 5, type: 'action_line', x: 1060, y: 80, config: { target: 'vip_team', messageTemplate: '🌟 ลูกค้า VIP ยอดโอนสูง!\nคุณ {{customer_name}} ({{phone}}) โอนยอด {{amount}} บาท' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'true', toNode: 3, toPort: 'in' },
        { fromNode: 2, fromPort: 'false', toNode: 4, toPort: 'in' },
        { fromNode: 3, fromPort: 'out', toNode: 5, toPort: 'in' }
      ]
    }
  },
  {
    id: 3,
    shortName: 'ด่าน 3: ตั้งเวลาสรุปยอด',
    checks: [
      { type: 'block', block: 'trigger_schedule' },
      { type: 'block', block: 'action_sheets' },
      { type: 'block', block: 'data_formatter' },
      { type: 'block', block: 'action_line' },
      { type: 'link', from: 'trigger_schedule', to: 'action_sheets' },
      { type: 'link', from: 'action_sheets', to: 'data_formatter' },
      { type: 'link', from: 'data_formatter', to: 'action_line' },
      { type: 'value', block: 'action_sheets', field: 'operation', oneOf: ['read_rows'], label: 'Google Sheets ใช้โหมด "ดึงข้อมูลหลายแถว (Get Many Rows)"' },
      { type: 'vars', block: 'action_sheets', field: 'columns', vars: ['{{current_date}}'] },
      { type: 'vars', block: 'data_formatter', field: 'template', vars: ['{{sheet_rows}}'] },
      { type: 'vars', block: 'action_line', field: 'messageTemplate', vars: ['{{formatted_text}}'] },
      ...COMMON_CHECKS
    ],
    badge: 'ด่านที่ 3 • ตั้งเวลาดึงตารางมาสรุปรายวัน (Schedule & Summary)',
    title: 'ทุกเช้า 08:00 น. ดึงคิวงานของวันนี้จาก Sheet มาสรุปส่งเข้ากลุ่มแอดมิน',
    desc: 'ฝึกใช้ {{current_date}} ไปดึงข้อมูลจาก Google Sheets ออกมาเป็น {{sheet_rows}} แล้วรวมเป็นข้อความสรุป {{formatted_text}} ส่งเข้า LINE',
    hint: '💡 <b>โพยตัวแปรด่าน 3 (ไหลเป็นทอดๆ):</b><br>1. <b>[ตั้งเวลา Schedule]</b> ส่งออก <code>{{current_date}}</code><br>2. <b>[Google Sheets]</b> (เลือกโหมด <i>ดึงข้อมูลหลายแถว</i>) ใส่เงื่อนไขว่า <code>ดึงเฉพาะวันที่ {{current_date}}</code> ➔ จะได้ <code>{{sheet_rows}}</code> ออกมา<br>3. <b>[จัดรูปแบบ Formatter]</b> ใส่ <code>สรุปคิววันที่ {{current_date}}: {{sheet_rows}}</code> ➔ จะได้ <code>{{formatted_text}}</code> ออกมา<br>4. <b>[ส่งข้อความ LINE]</b> ใส่ <code>รายงานเช้านี้: {{formatted_text}}</code>',
    template: {
      nodes: [
        { id: 1, type: 'trigger_schedule', x: 70, y: 190, config: { frequency: 'daily', time: '08:00' } },
        { id: 2, type: 'action_sheets', x: 380, y: 190, config: { operation: 'read_rows', sheetName: 'ตารางคิวงาน', columns: 'ดึงเฉพาะแถวที่ตรงกับวันที่ {{current_date}}' } },
        { id: 3, type: 'data_formatter', x: 700, y: 190, config: { formatMode: 'summary_text', template: '📅 สรุปคิวงานประจำวันที่ {{current_date}}:\n{{sheet_rows}}' } },
        { id: 4, type: 'action_line', x: 1020, y: 190, config: { target: 'admin_group', messageTemplate: 'อรุณสวัสดิ์ทีมงาน!\n{{formatted_text}}' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'out', toNode: 3, toPort: 'in' },
        { fromNode: 3, fromPort: 'out', toNode: 4, toPort: 'in' }
      ]
    }
  },
  {
    id: 4,
    shortName: 'ด่าน 4: ผสาน AI Agent',
    checks: [
      { type: 'block', block: 'trigger_chat' },
      { type: 'block', block: 'ai_agent' },
      { type: 'block', block: 'logic_if' },
      { type: 'block', block: 'action_line', min: 2 },
      { type: 'link', from: 'trigger_chat', to: 'ai_agent' },
      { type: 'link', from: 'ai_agent', to: 'logic_if' },
      { type: 'link', from: 'logic_if', port: 'true', to: 'action_line' },
      { type: 'link', from: 'logic_if', port: 'false', to: 'action_line' },
      { type: 'vars', block: 'ai_agent', field: 'prompt', vars: ['{{message_text}}'] },
      { type: 'vars', block: 'logic_if', field: 'leftValue', vars: ['{{ai_result}}'] },
      { type: 'value', block: 'logic_if', field: 'operator', oneOf: ['contains'] },
      { type: 'value', block: 'logic_if', field: 'rightValue', oneOf: ['ด่วน'] },
      ...COMMON_CHECKS
    ],
    badge: 'ด่านที่ 4 • ส่งแชทให้ AI วิเคราะห์แล้วแยกสาย',
    title: 'ลูกค้าทักแชท → AI วิเคราะห์อารมณ์ ({{ai_result}}) → เช็คเงื่อนไขแยกสาย',
    desc: 'ฝึกส่ง {{message_text}} เข้าไปใน Prompt ของ AI แล้วนำผลลัพธ์ {{ai_result}} ไปเช็คในบล็อก IF เพื่อแยกเคสด่วนกับเคสทั่วไป',
    hint: '💡 <b>โพยตัวแปรด่าน 4:</b><br>1. <b>[เมื่อลูกค้าทักแชท]</b> ส่งออก <code>{{user_name}}</code> และ <code>{{message_text}}</code><br>2. <b>[AI วิเคราะห์]</b> ในช่อง Prompt ต้องมี <code>{{message_text}}</code> เพื่อให้ AI อ่าน ➔ AI จะส่งออก <code>{{ai_result}}</code> และ <code>{{ai_reply}}</code><br>3. <b>[ตรวจสอบเงื่อนไข IF]</b> ช่องแรกใส่ <code>{{ai_result}}</code> เลือก <code>มีคำว่า (Contains)</code> ช่องท้ายใส่ <code>ด่วน</code><br>4. <b>[ส่งข้อความ LINE]</b> ใส่ <code>ลูกค้า {{user_name}} ทักว่า {{message_text}} (ผล AI: {{ai_result}})</code>',
    template: {
      nodes: [
        { id: 1, type: 'trigger_chat', x: 50, y: 200, config: { channel: 'LINE Official Account', eventType: 'text_message' } },
        { id: 2, type: 'ai_agent', x: 350, y: 200, config: { taskType: 'sentiment_triage', prompt: 'อ่านข้อความ "{{message_text}}" ของคุณ {{user_name}} แล้วประเมินว่าเป็นเคสด่วนหรือไม่ และร่างคำตอบสุภาพไว้ด้วย' } },
        { id: 3, type: 'logic_if', x: 660, y: 200, config: { leftValue: '{{ai_result}}', operator: 'contains', rightValue: 'ด่วน' } },
        { id: 4, type: 'action_line', x: 990, y: 90, config: { target: 'vip_team', messageTemplate: '🚨 เคสด่วน! ลูกค้า: {{user_name}}\nข้อความ: "{{message_text}}"\nผลจาก AI: {{ai_result}}' } },
        { id: 5, type: 'action_line', x: 990, y: 310, config: { target: 'reply_customer', messageTemplate: 'สวัสดีครับคุณ {{user_name}}\n{{ai_reply}}' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'out', toNode: 3, toPort: 'in' },
        { fromNode: 3, fromPort: 'true', toNode: 4, toPort: 'in' },
        { fromNode: 3, fromPort: 'false', toNode: 5, toPort: 'in' }
      ]
    }
  },
  {
    id: 5,
    shortName: 'ด่าน 5: Free Sandbox',
    mode: 'sandbox',
    checks: [
      { type: 'block', block: 'trigger_*' },
      { type: 'minBlocks', min: 3 },
      ...COMMON_CHECKS
    ],
    badge: 'ด่านที่ 5 • สนามทดลองอิสระ (Free Sandbox)',
    title: 'ออกแบบระบบ Automation ของคุณเอง พร้อมตัวช่วยเติมตัวแปร',
    desc: 'ต่อบล็อกได้อิสระตามไอเดียธุรกิจของคุณ แล้วกดปุ่ม "🎯 ตรวจการใช้ตัวแปร" ด้านบนเพื่อเช็คความถูกต้องได้เลย!',
    hint: '💡 <b>ทริค:</b> เวลาวางบล็อกเสร็จ คลิกที่บล็อกแล้วกดปุ่มสีเขียว <b>"⚡ เติมตัวแปรแนะนำให้อัตโนมัติ"</b> ในแถบขวาได้เลยครับ!',
    template: {
      nodes: [
        { id: 1, type: 'trigger_webhook', x: 80, y: 220, config: { sourceSystem: 'ระบบจองห้องพักออนไลน์', method: 'POST' } },
        { id: 2, type: 'logic_switch', x: 400, y: 220, config: { switchField: '{{payment_status}}', caseA: 'โอนเงินสำเร็จ', caseB: 'รอชำระเงิน', caseC: 'ยกเลิกรายการ' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' }
      ]
    }
  },
  {
    id: 6,
    shortName: 'ด่าน 6: เติมช่องว่าง',
    mode: 'fill',
    badge: 'ด่านที่ 6 • เติมตัวแปรให้ถูกช่อง (Fill in the blanks)',
    title: 'ออเดอร์จากเว็บ → แยกตามสถานะชำระเงิน → แจ้งแต่ละช่องทาง',
    desc: 'Flow ต่อสายไว้ให้แล้ว แต่ช่องตัวแปรว่างอยู่ ให้เติม {{...}} ให้ถูกช่อง แล้วกด ▶ จำลองการทำงาน ดูว่าข้อความที่ส่งออกไปถูกต้องหรือไม่',
    hint: '💡 <b>โพยด่าน 6:</b><br>1. <b>[Switch]</b> ช่อง "ตัวแปรที่ใช้แยกสาย" ใส่ <code>{{payment_status}}</code><br>2. <b>[อีเมล]</b> เนื้อหาใส่ <code>{{customer_name}}</code> และ <code>{{order_id}}</code><br>3. <b>[LINE]</b> และ <b>[Telegram]</b> ใส่ <code>{{order_id}}</code> ลงในข้อความ',
    checks: [
      { type: 'vars', block: 'logic_switch', field: 'switchField', vars: ['{{payment_status}}'] },
      { type: 'vars', block: 'action_email', field: 'body', vars: ['{{customer_name}}', '{{order_id}}'] },
      { type: 'vars', block: 'action_line', field: 'messageTemplate', vars: ['{{order_id}}'] },
      { type: 'vars', block: 'action_telegram', field: 'message', vars: ['{{order_id}}'] },
      ...COMMON_CHECKS
    ],
    start: {
      nodes: [
        { id: 1, type: 'trigger_webhook', x: 60, y: 200, config: { sourceSystem: 'เว็บร้านค้าออนไลน์', method: 'POST' } },
        { id: 2, type: 'logic_switch', x: 380, y: 200, config: { switchField: '', caseA: 'โอนเงินสำเร็จ', caseB: 'รอชำระเงิน', caseC: 'ยกเลิกรายการ' } },
        { id: 3, type: 'action_email', x: 740, y: 60, config: { toEmail: 'customer@example.com', subject: 'ยืนยันออเดอร์', body: '' } },
        { id: 4, type: 'action_line', x: 740, y: 260, config: { target: 'admin_group', messageTemplate: '' } },
        { id: 5, type: 'action_telegram', x: 740, y: 450, config: { platform: 'Telegram Bot', chatId: 'ห้องออเดอร์ยกเลิก', message: '' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'route_a', toNode: 3, toPort: 'in' },
        { fromNode: 2, fromPort: 'route_b', toNode: 4, toPort: 'in' },
        { fromNode: 2, fromPort: 'route_c', toNode: 5, toPort: 'in' }
      ]
    },
    template: {
      nodes: [
        { id: 1, type: 'trigger_webhook', x: 60, y: 200, config: { sourceSystem: 'เว็บร้านค้าออนไลน์', method: 'POST' } },
        { id: 2, type: 'logic_switch', x: 380, y: 200, config: { switchField: '{{payment_status}}', caseA: 'โอนเงินสำเร็จ', caseB: 'รอชำระเงิน', caseC: 'ยกเลิกรายการ' } },
        { id: 3, type: 'action_email', x: 740, y: 60, config: { toEmail: 'customer@example.com', subject: 'ยืนยันออเดอร์', body: 'คุณ {{customer_name}} ออเดอร์ {{order_id}} ชำระเงินแล้ว' } },
        { id: 4, type: 'action_line', x: 740, y: 260, config: { target: 'admin_group', messageTemplate: 'ออเดอร์ {{order_id}} ยังรอชำระเงิน' } },
        { id: 5, type: 'action_telegram', x: 740, y: 450, config: { platform: 'Telegram Bot', chatId: 'ห้องออเดอร์ยกเลิก', message: 'ออเดอร์ {{order_id}} ถูกยกเลิก' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'route_a', toNode: 3, toPort: 'in' },
        { fromNode: 2, fromPort: 'route_b', toNode: 4, toPort: 'in' },
        { fromNode: 2, fromPort: 'route_c', toNode: 5, toPort: 'in' }
      ]
    }
  },
  {
    id: 7,
    shortName: 'ด่าน 7: หาจุดผิด',
    mode: 'debug',
    badge: 'ด่านที่ 7 • หาจุดผิดใน Flow (Debug)',
    title: 'Flow คัดกรองลูกค้า VIP ที่ต่อมาผิด — หาให้เจอแล้วแก้',
    desc: 'Flow นี้ทำงานไม่ถูกต้อง มีทั้งตัวแปรที่ไม่มีใครส่งมา บล็อกที่ไม่ได้ต่อสาย และชีตที่ตั้งชื่อซ้ำ กด ▶ จำลองการทำงานเพื่อดูอาการ แล้วกดส่งตรวจเพื่อดูว่าแก้ครบหรือยัง',
    hint: '💡 <b>แนวทางหาจุดผิด:</b><br>1. กด <b>▶ จำลองการทำงาน</b> ดูคำเตือนสีเหลืองในแต่ละขั้นตอน<br>2. บล็อก IF ควรเช็ค <code>{{amount}}</code> ไม่ใช่ <code>{{ai_result}}</code> (ฟอร์มไม่มี AI)<br>3. ชีต 2 ตัวต้องชื่อต่างกัน (VIP / ทั่วไป)<br>4. บล็อก LINE ต้องต่อสายจากชีต และใช้ <code>{{customer_name}}</code> แทน <code>{{user_name}}</code>',
    checks: [
      { type: 'vars', block: 'logic_if', field: 'leftValue', vars: ['{{amount}}'] },
      { type: 'distinct', block: 'action_sheets', field: 'sheetName' },
      { type: 'link', from: 'action_sheets', to: 'action_line', label: 'ต่อสายจาก [Google Sheets] ➔ [ส่งข้อความ LINE]' },
      { type: 'vars', block: 'action_line', field: 'messageTemplate', vars: ['{{customer_name}}'] },
      ...COMMON_CHECKS
    ],
    start: {
      nodes: [
        { id: 1, type: 'trigger_form', x: 60, y: 200, config: { formName: 'ฟอร์มแจ้งโอนเงิน', triggerEvent: 'on_submit' } },
        { id: 2, type: 'logic_if', x: 390, y: 200, config: { leftValue: '{{ai_result}}', operator: '>=', rightValue: '1000' } },
        { id: 3, type: 'action_sheets', x: 740, y: 80, config: { operation: 'append_row', sheetName: 'ลูกค้า', columns: '{{customer_name}}, {{phone}}, {{amount}}' } },
        { id: 4, type: 'action_sheets', x: 740, y: 330, config: { operation: 'append_row', sheetName: 'ลูกค้า', columns: '{{customer_name}}, {{phone}}, {{amount}}' } },
        { id: 5, type: 'action_line', x: 1090, y: 80, config: { target: 'vip_team', messageTemplate: 'ลูกค้า VIP คุณ {{user_name}} โอน {{amount}} บาท' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'true', toNode: 3, toPort: 'in' },
        { fromNode: 2, fromPort: 'false', toNode: 4, toPort: 'in' }
      ]
    },
    template: {
      nodes: [
        { id: 1, type: 'trigger_form', x: 60, y: 200, config: { formName: 'ฟอร์มแจ้งโอนเงิน', triggerEvent: 'on_submit' } },
        { id: 2, type: 'logic_if', x: 390, y: 200, config: { leftValue: '{{amount}}', operator: '>=', rightValue: '1000' } },
        { id: 3, type: 'action_sheets', x: 740, y: 80, config: { operation: 'append_row', sheetName: 'ลูกค้า VIP', columns: '{{customer_name}}, {{phone}}, {{amount}}' } },
        { id: 4, type: 'action_sheets', x: 740, y: 330, config: { operation: 'append_row', sheetName: 'ลูกค้าทั่วไป', columns: '{{customer_name}}, {{phone}}, {{amount}}' } },
        { id: 5, type: 'action_line', x: 1090, y: 80, config: { target: 'vip_team', messageTemplate: 'ลูกค้า VIP คุณ {{customer_name}} โอน {{amount}} บาท' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'true', toNode: 3, toPort: 'in' },
        { fromNode: 2, fromPort: 'false', toNode: 4, toPort: 'in' },
        { fromNode: 3, fromPort: 'out', toNode: 5, toPort: 'in' }
      ]
    }
  },
  {
    id: 8,
    shortName: 'ด่าน 8: ทายผลลัพธ์',
    mode: 'predict',
    badge: 'ด่านที่ 8 • ทายผลลัพธ์ก่อนรัน (Predict)',
    title: 'ดู Flow แล้วทายว่าระบบจะทำอะไรกับข้อมูลชุดนี้',
    desc: 'Flow ถูกต้องอยู่แล้ว ให้ไล่ดูเงื่อนไขในแต่ละบล็อก แล้วตอบว่าข้อมูลตัวอย่างแต่ละชุดจะลงชีตไหน และส่งข้อความหาใคร กด "ส่งตรวจ" เพื่อตอบ',
    hint: '💡 <b>วิธีทาย:</b> เริ่มจากบล็อก IF — แทนค่า <code>{{amount}}</code> ลงไปเทียบกับ <code>1000</code> ว่าเป็นจริงหรือเท็จ แล้วไล่ตามสายที่ออกจากพอร์ตนั้น ถ้าไม่มั่นใจ กด ▶ จำลองการทำงานเพื่อเช็คคำตอบได้',
    checks: [],
    start: {
      nodes: [
        { id: 1, type: 'trigger_form', x: 60, y: 200, config: { formName: 'ฟอร์มแจ้งโอนเงินลูกค้า', triggerEvent: 'on_submit' } },
        { id: 2, type: 'logic_if', x: 390, y: 200, config: { leftValue: '{{amount}}', operator: '>=', rightValue: '1000' } },
        { id: 3, type: 'action_sheets', x: 720, y: 80, config: { operation: 'append_row', sheetName: 'รายชื่อลูกค้า VIP', columns: '{{customer_name}}, {{phone}}, {{amount}}' } },
        { id: 4, type: 'action_sheets', x: 720, y: 320, config: { operation: 'append_row', sheetName: 'รายชื่อลูกค้าทั่วไป', columns: '{{customer_name}}, {{phone}}, {{amount}}' } },
        { id: 5, type: 'action_line', x: 1060, y: 80, config: { target: 'vip_team', messageTemplate: '🌟 ลูกค้า VIP คุณ {{customer_name}} โอน {{amount}} บาท' } }
      ],
      connections: [
        { fromNode: 1, fromPort: 'out', toNode: 2, toPort: 'in' },
        { fromNode: 2, fromPort: 'true', toNode: 3, toPort: 'in' },
        { fromNode: 2, fromPort: 'false', toNode: 4, toPort: 'in' },
        { fromNode: 3, fromPort: 'out', toNode: 5, toPort: 'in' }
      ]
    },
    // คำตอบที่ถูกคำนวณจากตัวจำลอง (simulator) เทียบกับ outcome ของแต่ละตัวเลือก — ไม่ต้องเขียนเฉลยแยก
    questions: [
      {
        text: 'ลูกค้าโอน 2,500 บาท ระบบจะทำอะไร?',
        overrides: { amount: '2500' },
        options: [
          { label: 'บันทึกชีต "รายชื่อลูกค้า VIP" และส่ง LINE ถึงทีม VIP', outcome: { sheets: ['รายชื่อลูกค้า VIP'], messages: ['vip_team'] } },
          { label: 'บันทึกชีต "รายชื่อลูกค้าทั่วไป" อย่างเดียว ไม่ส่ง LINE', outcome: { sheets: ['รายชื่อลูกค้าทั่วไป'], messages: [] } },
          { label: 'บันทึกทั้ง 2 ชีต และส่ง LINE ถึงทีม VIP', outcome: { sheets: ['รายชื่อลูกค้า VIP', 'รายชื่อลูกค้าทั่วไป'], messages: ['vip_team'] } }
        ],
        explain: '2,500 >= 1,000 เป็นจริง จึงไปสาย True → ชีต VIP → LINE ทีม VIP'
      },
      {
        text: 'ลูกค้าโอน 300 บาท ระบบจะทำอะไร?',
        overrides: { amount: '300' },
        options: [
          { label: 'บันทึกชีต "รายชื่อลูกค้า VIP" และส่ง LINE ถึงทีม VIP', outcome: { sheets: ['รายชื่อลูกค้า VIP'], messages: ['vip_team'] } },
          { label: 'บันทึกชีต "รายชื่อลูกค้าทั่วไป" อย่างเดียว ไม่ส่ง LINE', outcome: { sheets: ['รายชื่อลูกค้าทั่วไป'], messages: [] } },
          { label: 'ไม่ทำอะไรเลย', outcome: { sheets: [], messages: [] } }
        ],
        explain: '300 >= 1,000 เป็นเท็จ จึงไปสาย False → ชีตทั่วไป และสายนี้ไม่ได้ต่อไปที่ LINE'
      },
      {
        text: 'ถ้าลูกค้าโอนพอดี 1,000 บาท ระบบจะทำอะไร? (สังเกตเครื่องหมาย >=)',
        overrides: { amount: '1000' },
        options: [
          { label: 'บันทึกชีต "รายชื่อลูกค้า VIP" และส่ง LINE ถึงทีม VIP', outcome: { sheets: ['รายชื่อลูกค้า VIP'], messages: ['vip_team'] } },
          { label: 'บันทึกชีต "รายชื่อลูกค้าทั่วไป" อย่างเดียว ไม่ส่ง LINE', outcome: { sheets: ['รายชื่อลูกค้าทั่วไป'], messages: [] } }
        ],
        explain: '>= หมายถึงมากกว่าหรือ "เท่ากับ" 1,000 ก็ผ่าน จึงเป็น VIP'
      }
    ]
  }
];

if (typeof module !== 'undefined') module.exports = { LEVELS, COMMON_CHECKS };
