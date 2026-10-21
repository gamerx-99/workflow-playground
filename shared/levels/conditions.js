// สาย "เงื่อนไข" — IF, Switch, การทายผลสายที่ข้อมูลจะไหลไป (id 14-17; ด่าน 2, 7, 8 อยู่ใน core.js)
if (typeof require !== 'undefined') require('./_helpers.js');
(function ({ node, link }) {

const SWITCH_FLOW = {
  nodes: [
    node(1, 'trigger_form', { formName: 'ฟอร์มจองคิวร้านเสริมสวย', triggerEvent: 'on_submit' }, 0, 1),
    node(2, 'logic_switch', { switchField: '{{service_type}}', caseA: 'ตัดผม', caseB: 'ทำสี', caseC: 'สระ-ไดร์' }, 1, 1),
    node(3, 'action_line', { target: 'admin_group', messageTemplate: 'คิวตัดผม: {{customer_name}} ({{phone}})' }, 2, 0),
    node(4, 'action_line', { target: 'vip_team', messageTemplate: 'คิวทำสี: {{customer_name}} ({{phone}})' }, 2, 1),
    node(5, 'action_line', { target: 'reply_customer', messageTemplate: 'รับคิวสระ-ไดร์ของคุณ {{customer_name}} แล้ว' }, 2, 2)
  ],
  connections: [link(1, 2), link(2, 3, 'route_a'), link(2, 4, 'route_b'), link(2, 5, 'route_c')]
};

WF.levels.conditions = [
  {
    id: 14,
    difficulty: 2,
    shortName: 'ด่าน 14: IF ยอดสูง',
    badge: 'ด่านที่ 14 • IF / Else สองสายแยกข้อความ',
    title: 'ยอดโอน >= 5,000 บาท แจ้งทีม VIP, น้อยกว่านั้นแจ้งแอดมินทั่วไป',
    desc: 'ตั้ง IF ให้ถูกทั้งตัวแปร เครื่องหมาย และค่าเทียบ แล้วต่อสาย True / False ไปยัง LINE คนละกลุ่ม',
    template: {
      nodes: [
        node(1, 'trigger_form', { formName: 'ฟอร์มแจ้งโอนเงิน', triggerEvent: 'on_submit' }, 0, 0.5),
        node(2, 'logic_if', { leftValue: '{{amount}}', operator: '>=', rightValue: '5000' }, 1, 0.5),
        node(3, 'action_line', { target: 'vip_team', messageTemplate: 'ยอดสูง! คุณ {{customer_name}} โอน {{amount}} บาท' }, 2, 0),
        node(4, 'action_line', { target: 'admin_group', messageTemplate: 'ยอดปกติ: คุณ {{customer_name}} โอน {{amount}} บาท' }, 2, 1)
      ],
      connections: [link(1, 2), link(2, 3, 'true'), link(2, 4, 'false')]
    }
  },
  {
    id: 15,
    difficulty: 2,
    shortName: 'ด่าน 15: Switch 3 สาย',
    badge: 'ด่านที่ 15 • Switch แยกตามประเภทบริการ',
    title: 'แยกคิวตามบริการ (ตัดผม / ทำสี / สระ-ไดร์) ไปคนละปลายทาง',
    desc: 'Switch เทียบค่าตัวแปรกับเงื่อนไขของสาย A/B/C — ใส่ตัวแปรที่ใช้แยกสายให้ถูก แล้วต่อแต่ละสายไปยัง LINE',
    template: SWITCH_FLOW
  },
  {
    id: 16,
    difficulty: 2,
    shortName: 'ด่าน 16: IF มีคำว่า',
    badge: 'ด่านที่ 16 • IF แบบ Contains กับข้อความแชท',
    title: 'ลูกค้าทักแชทมีคำว่า "ยกเลิก" → แจ้งแอดมิน, ไม่มี → ตอบรับทั่วไป',
    desc: 'ใช้ IF โหมด "มีคำว่า (Contains)" เช็ค {{message_text}} แล้วแยกสายแจ้งแอดมินกับตอบกลับลูกค้า',
    template: {
      nodes: [
        node(1, 'trigger_chat', { channel: 'LINE Official Account', eventType: 'text_message' }, 0, 0.5),
        node(2, 'logic_if', { leftValue: '{{message_text}}', operator: 'contains', rightValue: 'ยกเลิก' }, 1, 0.5),
        node(3, 'action_line', { target: 'admin_group', messageTemplate: 'คุณ {{user_name}} ขอยกเลิก: {{message_text}}' }, 2, 0),
        node(4, 'action_line', { target: 'reply_customer', messageTemplate: 'สวัสดีคุณ {{user_name}} ทีมงานจะตอบกลับโดยเร็วค่ะ' }, 2, 1)
      ],
      connections: [link(1, 2), link(2, 3, 'true'), link(2, 4, 'false')]
    }
  },
  {
    id: 17,
    difficulty: 3,
    mode: 'predict',
    shortName: 'ด่าน 17: ทายผล Switch',
    badge: 'ด่านที่ 17 • ทายผลลัพธ์ของ Switch',
    title: 'ลูกค้าเลือกบริการแต่ละแบบ ข้อความจะไปถึงใคร?',
    desc: 'Flow ถูกต้องแล้ว ไล่ดูเงื่อนไขของสาย A/B/C ว่าบริการที่ลูกค้าเลือกตรงกับสายไหน (สังเกตกรณีที่ไม่ตรงสายไหนเลย)',
    hint: '💡 Switch เทียบ "ค่าตัวแปร" กับข้อความของแต่ละสายแบบตรงตัว ถ้าไม่ตรงสายไหนเลย Flow จะหยุด ไม่ส่งอะไรออกไป',
    start: SWITCH_FLOW,
    questions: [
      {
        text: 'ลูกค้าเลือกบริการ "ตัดผม" ระบบจะส่ง LINE ไปที่ไหน?',
        overrides: { service_type: 'ตัดผม' },
        options: [
          { label: 'กลุ่มแอดมิน', outcome: { sheets: [], messages: ['admin_group'] } },
          { label: 'ทีม VIP / เคสด่วน', outcome: { sheets: [], messages: ['vip_team'] } },
          { label: 'ลูกค้า (ตอบกลับแชท)', outcome: { sheets: [], messages: ['reply_customer'] } },
          { label: 'ไม่ส่งอะไรเลย', outcome: { sheets: [], messages: [] } }
        ],
        explain: '"ตัดผม" ตรงกับสาย A → LINE กลุ่มแอดมิน'
      },
      {
        text: 'ลูกค้าเลือกบริการ "ทำสี" ระบบจะส่ง LINE ไปที่ไหน?',
        overrides: { service_type: 'ทำสี' },
        options: [
          { label: 'กลุ่มแอดมิน', outcome: { sheets: [], messages: ['admin_group'] } },
          { label: 'ทีม VIP / เคสด่วน', outcome: { sheets: [], messages: ['vip_team'] } },
          { label: 'ลูกค้า (ตอบกลับแชท)', outcome: { sheets: [], messages: ['reply_customer'] } },
          { label: 'ส่งทั้งแอดมินและ VIP', outcome: { sheets: [], messages: ['admin_group', 'vip_team'] } }
        ],
        explain: '"ทำสี" ตรงกับสาย B → LINE ทีม VIP'
      },
      {
        text: 'ลูกค้าเลือกบริการ "ย้อมผม" (ไม่มีในรายการของ Switch) ระบบจะทำอย่างไร?',
        overrides: { service_type: 'ย้อมผม' },
        options: [
          { label: 'ส่งไปสาย C (สระ-ไดร์) เพราะเป็นสายสุดท้าย', outcome: { sheets: [], messages: ['reply_customer'] } },
          { label: 'ส่ง LINE ถึงกลุ่มแอดมิน', outcome: { sheets: [], messages: ['admin_group'] } },
          { label: 'ไม่ส่งอะไรเลย เพราะไม่ตรงสายไหน', outcome: { sheets: [], messages: [] } }
        ],
        explain: 'Switch ในระบบนี้ไม่มีสาย "อื่นๆ" ค่าที่ไม่ตรงจึงไม่ไปต่อ — ในงานจริงควรมีสายดักกรณีนี้'
      }
    ]
  }
];
})(WF.helpers);
