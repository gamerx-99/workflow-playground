// สาย "ข้อมูล & Loop" — อ่านชีต, วนลูป, Formatter, เรียก API (id 18-22; ด่าน 3 อยู่ใน core.js)
if (typeof require !== 'undefined') require('./_helpers.js');
(function ({ node, link }) {
WF.levels.data = [
  {
    id: 18,
    difficulty: 2,
    shortName: 'ด่าน 18: วนลูปคิวงาน',
    badge: 'ด่านที่ 18 • Loop ทีละรายการ',
    title: 'ทุกเช้าดึงคิวจากชีต → วนลูปส่งทีละคิวเข้า LINE',
    desc: 'Loop รับรายการหลายแถว ({{sheet_rows}}) แล้วปล่อยทีละชิ้นออกทางสาย "ทำทีละชิ้น" พร้อมตัวแปร {{loop_item}}',
    template: {
      nodes: [
        node(1, 'trigger_schedule', { frequency: 'daily', time: '08:00' }, 0, 0),
        node(2, 'action_sheets', { operation: 'read_rows', sheetName: 'คิววันนี้', columns: 'ดึงเฉพาะวันที่ {{current_date}}' }, 1, 0),
        node(3, 'logic_loop', { sourceList: '{{sheet_rows}}', batchSize: '1' }, 2, 0),
        node(4, 'action_line', { target: 'admin_group', messageTemplate: 'คิวถัดไป: {{loop_item}}' }, 3, 0)
      ],
      connections: [link(1, 2), link(2, 3), link(3, 4, 'each')]
    }
  },
  {
    id: 19,
    difficulty: 2,
    shortName: 'ด่าน 19: สรุปส่งอีเมล',
    badge: 'ด่านที่ 19 • ดึงชีต → Formatter → อีเมล',
    title: 'ทุกเช้าสรุปคิววันนี้เป็นข้อความเดียว ส่งอีเมลหาผู้จัดการ',
    desc: 'ตัวแปรไหลเป็นทอด: {{current_date}} → {{sheet_rows}} → {{formatted_text}} → เนื้อหาอีเมล',
    template: {
      nodes: [
        node(1, 'trigger_schedule', { frequency: 'daily', time: '07:30' }, 0, 0),
        node(2, 'action_sheets', { operation: 'read_rows', sheetName: 'คิววันนี้', columns: 'ดึงเฉพาะวันที่ {{current_date}}' }, 1, 0),
        node(3, 'data_formatter', { formatMode: 'summary_text', template: 'สรุปคิววันที่ {{current_date}}:\n{{sheet_rows}}' }, 2, 0),
        node(4, 'action_email', { toEmail: 'manager@example.com', subject: 'สรุปคิว {{current_date}}', body: '{{formatted_text}}' }, 3, 0)
      ],
      connections: [link(1, 2), link(2, 3), link(3, 4)]
    }
  },
  {
    id: 20,
    difficulty: 2,
    shortName: 'ด่าน 20: เรียก API รายวัน',
    badge: 'ด่านที่ 20 • HTTP Request',
    title: 'ทุกเช้าเรียก API ดึงข้อมูล → จัดข้อความ → ส่ง Telegram',
    desc: 'บล็อก HTTP ผลิต {{api_data}} ให้ Formatter นำไปประกอบข้อความ แล้วส่งต่อ {{formatted_text}} เข้า Telegram',
    template: {
      nodes: [
        node(1, 'trigger_schedule', { frequency: 'daily', time: '09:00' }, 0, 0),
        node(2, 'action_http', { method: 'GET', endpoint: 'https://api.example.com/daily-rates', bodyPayload: '' }, 1, 0),
        node(3, 'data_formatter', { formatMode: 'summary_text', template: 'อัตราประจำวันที่ {{current_date}}: {{api_data}}' }, 2, 0),
        node(4, 'action_telegram', { platform: 'Telegram Bot', chatId: 'ห้องรายงาน', message: '{{formatted_text}}' }, 3, 0)
      ],
      connections: [link(1, 2), link(2, 3), link(3, 4)]
    }
  },
  {
    id: 21,
    difficulty: 3,
    shortName: 'ด่าน 21: Loop ครบแล้วแจ้ง',
    badge: 'ด่านที่ 21 • Loop สองสาย (ทีละชิ้น / เมื่อครบ)',
    title: 'วนส่งทีละคิวเข้า Telegram แล้วเมื่อครบทุกคิว แจ้งสรุปเข้า LINE',
    desc: 'Loop มี 2 ทางออก: "ทำทีละชิ้น" ทำซ้ำทุกรายการ ส่วน "เมื่อครบแล้ว" ทำครั้งเดียวตอนจบ ต้องต่อให้ถูกสาย',
    template: {
      nodes: [
        node(1, 'trigger_schedule', { frequency: 'daily', time: '08:00' }, 0, 0.5),
        node(2, 'action_sheets', { operation: 'read_rows', sheetName: 'คิววันนี้', columns: 'ดึงเฉพาะวันที่ {{current_date}}' }, 1, 0.5),
        node(3, 'logic_loop', { sourceList: '{{sheet_rows}}', batchSize: '1' }, 2, 0.5),
        node(4, 'action_telegram', { platform: 'Telegram Bot', chatId: 'ห้องคิวงาน', message: 'คิว: {{loop_item}}' }, 3, 0),
        node(5, 'action_line', { target: 'admin_group', messageTemplate: 'ส่งคิวครบแล้วของวันที่ {{current_date}}' }, 3, 1)
      ],
      connections: [link(1, 2), link(2, 3), link(3, 4, 'each'), link(3, 5, 'done')]
    }
  },
  {
    id: 22,
    difficulty: 3,
    mode: 'debug',
    shortName: 'ด่าน 22: หาจุดผิด (สรุปรายวัน)',
    badge: 'ด่านที่ 22 • หาจุดผิด: Flow สรุปรายวันที่พัง',
    title: 'Flow สรุปคิวรายวันไม่ทำงาน — หา 3 จุดผิดแล้วแก้',
    desc: 'มีทั้งโหมดชีตที่ผิด ตัวแปรที่ไม่มีใครส่งมา และบล็อกที่ไม่ได้ต่อสาย กด ▶ จำลองการทำงานดูอาการก่อน แล้วค่อยส่งตรวจ',
    hint: '💡 ดูว่า (1) ชีตควร "ดึงข้อมูล" ไม่ใช่ "เพิ่มแถว" (2) Formatter ใช้ {{ai_reply}} ทั้งที่ไม่มี AI — ควรใช้ {{sheet_rows}} และ {{current_date}} (3) บล็อก LINE ยังไม่ได้ต่อสายจาก Formatter',
    start: {
      nodes: [
        node(1, 'trigger_schedule', { frequency: 'daily', time: '08:00' }, 0, 0),
        node(2, 'action_sheets', { operation: 'append_row', sheetName: 'คิววันนี้', columns: 'ดึงเฉพาะวันที่ {{current_date}}' }, 1, 0),
        node(3, 'data_formatter', { formatMode: 'summary_text', template: 'สรุป: {{ai_reply}}' }, 2, 0),
        node(4, 'action_line', { target: 'admin_group', messageTemplate: 'รายงานเช้านี้\n{{formatted_text}}' }, 3, 0)
      ],
      connections: [link(1, 2), link(2, 3)]
    },
    template: {
      nodes: [
        node(1, 'trigger_schedule', { frequency: 'daily', time: '08:00' }, 0, 0),
        node(2, 'action_sheets', { operation: 'read_rows', sheetName: 'คิววันนี้', columns: 'ดึงเฉพาะวันที่ {{current_date}}' }, 1, 0),
        node(3, 'data_formatter', { formatMode: 'summary_text', template: 'สรุปคิว {{current_date}}: {{sheet_rows}}' }, 2, 0),
        node(4, 'action_line', { target: 'admin_group', messageTemplate: 'รายงานเช้านี้\n{{formatted_text}}' }, 3, 0)
      ],
      connections: [link(1, 2), link(2, 3), link(3, 4)]
    }
  }
];
})(WF.helpers);
