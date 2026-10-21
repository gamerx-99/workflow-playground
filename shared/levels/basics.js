// สาย "พื้นฐานตัวแปร" — Trigger → Action และการส่งต่อตัวแปร (id 9-13; ด่าน 1 อยู่ใน core.js)
if (typeof require !== 'undefined') require('./_helpers.js');
(function ({ node, link }) {
WF.levels.basics = [
  {
    id: 9,
    difficulty: 1,
    shortName: 'ด่าน 9: อีเมลต้อนรับ',
    badge: 'ด่านที่ 9 • ส่งตัวแปรเข้าอีเมล',
    title: 'สมัครสมาชิกผ่านฟอร์ม → ส่งอีเมลต้อนรับ',
    desc: 'หยิบ {{customer_name}} และ {{phone}} จากฟอร์ม ไปใส่ในหัวข้อและเนื้อหาอีเมล',
    template: {
      nodes: [
        node(1, 'trigger_form', { formName: 'ฟอร์มสมัครสมาชิก', triggerEvent: 'on_submit' }, 0, 0),
        node(2, 'action_email', { toEmail: 'customer@example.com', subject: 'ยินดีต้อนรับคุณ {{customer_name}}', body: 'สวัสดีคุณ {{customer_name}} เราจะติดต่อกลับที่เบอร์ {{phone}}' }, 1, 0)
      ],
      connections: [link(1, 2)]
    }
  },
  {
    id: 10,
    difficulty: 1,
    shortName: 'ด่าน 10: แจ้งออเดอร์ Telegram',
    badge: 'ด่านที่ 10 • Webhook → Telegram',
    title: 'ออเดอร์ใหม่จากเว็บ (Webhook) → แจ้งเตือนเข้า Telegram',
    desc: 'Webhook ส่งตัวแปรคนละชุดกับฟอร์ม: ใช้ {{order_id}}, {{customer_name}}, {{amount}} ในข้อความแจ้งเตือน',
    template: {
      nodes: [
        node(1, 'trigger_webhook', { sourceSystem: 'เว็บร้านค้าออนไลน์', method: 'POST' }, 0, 0),
        node(2, 'action_telegram', { platform: 'Telegram Bot', chatId: 'ห้องออเดอร์', message: 'ออเดอร์ {{order_id}} จากคุณ {{customer_name}} ยอด {{amount}} บาท' }, 1, 0)
      ],
      connections: [link(1, 2)]
    }
  },
  {
    id: 11,
    difficulty: 2,
    shortName: 'ด่าน 11: นัดหมาย + ยืนยัน',
    badge: 'ด่านที่ 11 • ตัวแปรจากบล็อกกลางทาง',
    title: 'ฟอร์มจองนัด → ลงปฏิทิน → ส่ง LINE ยืนยันพร้อมลิงก์นัด',
    desc: 'บล็อกปฏิทินผลิตตัวแปรใหม่ {{event_link}} ให้บล็อกถัดไปใช้ — ตัวแปรที่ผลิตกลางทางใช้ได้เฉพาะบล็อกที่อยู่ท้ายสาย',
    template: {
      nodes: [
        node(1, 'trigger_form', { formName: 'ฟอร์มจองนัด', triggerEvent: 'on_submit' }, 0, 0),
        node(2, 'action_calendar', { eventTitle: 'นัดคุณ {{customer_name}} ({{service_type}})', eventDate: 'ตามวันที่ลูกค้าเลือก', notes: 'เบอร์ติดต่อ {{phone}}' }, 1, 0),
        node(3, 'action_line', { target: 'reply_customer', messageTemplate: 'ยืนยันนัดคุณ {{customer_name}} แล้ว ดูนัดได้ที่ {{event_link}}' }, 2, 0)
      ],
      connections: [link(1, 2), link(2, 3)]
    }
  },
  {
    id: 12,
    difficulty: 2,
    shortName: 'ด่าน 12: เลขแถวในชีต',
    badge: 'ด่านที่ 12 • ใช้ผลลัพธ์ของบล็อกก่อนหน้า',
    title: 'บันทึกลง Google Sheets → แจ้ง LINE พร้อมเลขแถวที่บันทึก',
    desc: 'หลังบันทึกแถวใหม่ ชีตจะส่ง {{row_number}} ออกมา — เอาไปบอกแอดมินว่าข้อมูลอยู่แถวไหน',
    template: {
      nodes: [
        node(1, 'trigger_form', { formName: 'ฟอร์มแจ้งโอนเงิน', triggerEvent: 'on_submit' }, 0, 0),
        node(2, 'action_sheets', { operation: 'append_row', sheetName: 'รายการโอน', columns: '{{customer_name}}, {{phone}}, {{amount}}' }, 1, 0),
        node(3, 'action_line', { target: 'admin_group', messageTemplate: 'บันทึกรายการของคุณ {{customer_name}} แล้ว อยู่แถวที่ {{row_number}}' }, 2, 0)
      ],
      connections: [link(1, 2), link(2, 3)]
    }
  },
  {
    id: 13,
    difficulty: 2,
    mode: 'fill',
    shortName: 'ด่าน 13: เติมช่องว่าง (สรุป)',
    badge: 'ด่านที่ 13 • เติมช่องว่าง: ผลิตตัวแปรแล้วส่งต่อ',
    title: 'ฟอร์ม → จัดรูปแบบสรุป → ส่งอีเมล (เติมช่องที่ว่างไว้)',
    desc: 'Flow ต่อไว้แล้ว เติมรูปแบบสรุปใน Formatter ให้ผลิต {{formatted_text}} แล้วเอาไปใส่เนื้อหาอีเมล',
    start: {
      nodes: [
        node(1, 'trigger_form', { formName: 'ฟอร์มสั่งบริการ', triggerEvent: 'on_submit' }, 0, 0),
        node(2, 'data_formatter', { formatMode: 'summary_text', template: '' }, 1, 0),
        node(3, 'action_email', { toEmail: 'manager@example.com', subject: '', body: '' }, 2, 0)
      ],
      connections: [link(1, 2), link(2, 3)]
    },
    template: {
      nodes: [
        node(1, 'trigger_form', { formName: 'ฟอร์มสั่งบริการ', triggerEvent: 'on_submit' }, 0, 0),
        node(2, 'data_formatter', { formatMode: 'summary_text', template: 'ใบสรุป: {{customer_name}} | {{service_type}} | {{amount}} บาท' }, 1, 0),
        node(3, 'action_email', { toEmail: 'manager@example.com', subject: 'สรุปรายการของ {{customer_name}}', body: '{{formatted_text}}' }, 2, 0)
      ],
      connections: [link(1, 2), link(2, 3)]
    }
  }
];
})(WF.helpers);
