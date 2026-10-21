// สาย "เคสธุรกิจจริง" — Flow ครบวงจรของธุรกิจแต่ละแบบ (id 28-30; ด่าน 5, 6 อยู่ใน core.js)
if (typeof require !== 'undefined') require('./_helpers.js');
(function ({ node, link }) {
WF.levels.cases = [
  {
    id: 28,
    difficulty: 2,
    shortName: 'ด่าน 28: คลินิก จองคิว+เตือน',
    badge: 'ด่านที่ 28 • เคสคลินิก: ยืนยันนัดแล้วรอเตือน',
    title: 'คลินิก: ลูกค้าจองคิว → ลงปฏิทิน → อีเมลยืนยัน → รอ → LINE เตือนก่อนนัด',
    desc: 'ต่อ 5 บล็อกเป็นสายยาว ใช้ {{event_link}} ที่ได้จากปฏิทินในอีเมล และใช้บล็อกหน่วงเวลา (Wait) ก่อนส่งเตือน',
    template: {
      nodes: [
        node(1, 'trigger_form', { formName: 'ฟอร์มจองคิวคลินิก', triggerEvent: 'on_submit' }, 0, 0),
        node(2, 'action_calendar', { eventTitle: 'นัดคุณ {{customer_name}} ({{service_type}})', eventDate: 'ตามที่ลูกค้าเลือก', notes: 'โทร {{phone}}' }, 1, 0),
        node(3, 'action_email', { toEmail: 'patient@example.com', subject: 'ยืนยันนัดของคุณ {{customer_name}}', body: 'นัด {{service_type}} ของคุณถูกบันทึกแล้ว ดูนัดได้ที่ {{event_link}}' }, 2, 0),
        node(4, 'logic_delay', { duration: '1 ชั่วโมงก่อนนัด', reason: 'รอเวลาส่งเตือน' }, 3, 0),
        node(5, 'action_line', { target: 'reply_customer', messageTemplate: 'เตือนนัดคุณ {{customer_name}} ({{service_type}}) อย่าลืมมาตามเวลานะคะ' }, 4, 0)
      ],
      connections: [link(1, 2), link(2, 3), link(3, 4), link(4, 5)]
    }
  },
  {
    id: 29,
    difficulty: 3,
    shortName: 'ด่าน 29: รีสอร์ท 3 สถานะชำระ',
    badge: 'ด่านที่ 29 • เคสรีสอร์ท: แยกตามสถานะการชำระเงิน',
    title: 'รีสอร์ท: จองออนไลน์ → แยก 3 สถานะ → ชำระแล้ว / รอชำระ / ยกเลิก ทำคนละอย่าง',
    desc: 'สาย A (โอนเงินสำเร็จ): บันทึกชีต → อีเมลยืนยัน • สาย B (รอชำระเงิน): รอ 24 ชม. → LINE เตือน • สาย C (ยกเลิก): แจ้ง Telegram',
    template: {
      nodes: [
        node(1, 'trigger_webhook', { sourceSystem: 'ระบบจองห้องพักออนไลน์', method: 'POST' }, 0, 1),
        node(2, 'logic_switch', { switchField: '{{payment_status}}', caseA: 'โอนเงินสำเร็จ', caseB: 'รอชำระเงิน', caseC: 'ยกเลิกรายการ' }, 1, 1),
        node(3, 'action_sheets', { operation: 'append_row', sheetName: 'การจองที่ชำระแล้ว', columns: '{{order_id}}, {{customer_name}}, {{amount}}' }, 2, 0),
        node(4, 'action_email', { toEmail: 'guest@example.com', subject: 'ยืนยันการจอง {{order_id}}', body: 'คุณ {{customer_name}} ชำระเงิน {{amount}} บาทเรียบร้อยแล้ว' }, 3, 0),
        node(5, 'logic_delay', { duration: '24 ชั่วโมง', reason: 'รอลูกค้าชำระเงิน' }, 2, 1),
        node(6, 'action_line', { target: 'reply_customer', messageTemplate: 'การจอง {{order_id}} ของคุณ {{customer_name}} ยังรอชำระเงินอยู่นะคะ' }, 3, 1),
        node(7, 'action_telegram', { platform: 'Telegram Bot', chatId: 'ห้องการจองยกเลิก', message: 'ยกเลิก {{order_id}} ของคุณ {{customer_name}}' }, 2, 2)
      ],
      connections: [link(1, 2), link(2, 3, 'route_a'), link(3, 4), link(2, 5, 'route_b'), link(5, 6), link(2, 7, 'route_c')]
    }
  },
  {
    id: 30,
    difficulty: 3,
    shortName: 'ด่าน 30: ร้านออนไลน์ แยก VIP',
    badge: 'ด่านที่ 30 • เคสร้านออนไลน์: ลูกค้า VIP vs ทั่วไป',
    title: 'ร้านออนไลน์: ออเดอร์ >= 3,000 บาทเป็น VIP (บันทึกชีต VIP + อีเมลขอบคุณ) นอกนั้นบันทึกชีตทั่วไปแล้วแจ้ง LINE',
    desc: 'ชีต 2 ตัวต้องตั้งชื่อต่างกัน และแต่ละสายต้องใช้ตัวแปรของ Webhook ให้ถูก ({{order_id}}, {{customer_name}}, {{amount}})',
    template: {
      nodes: [
        node(1, 'trigger_webhook', { sourceSystem: 'เว็บร้านค้าออนไลน์', method: 'POST' }, 0, 0.5),
        node(2, 'logic_if', { leftValue: '{{amount}}', operator: '>=', rightValue: '3000' }, 1, 0.5),
        node(3, 'action_sheets', { operation: 'append_row', sheetName: 'ออเดอร์ VIP', columns: '{{order_id}}, {{customer_name}}, {{amount}}' }, 2, 0),
        node(4, 'action_email', { toEmail: 'vip@example.com', subject: 'ขอบคุณคุณ {{customer_name}}', body: 'ออเดอร์ {{order_id}} ยอด {{amount}} บาท ขอบคุณที่อุดหนุนค่ะ' }, 3, 0),
        node(5, 'action_sheets', { operation: 'append_row', sheetName: 'ออเดอร์ทั่วไป', columns: '{{order_id}}, {{customer_name}}, {{amount}}' }, 2, 1),
        node(6, 'action_line', { target: 'admin_group', messageTemplate: 'ออเดอร์ทั่วไป {{order_id}} จากคุณ {{customer_name}} ยอด {{amount}} บาท' }, 3, 1)
      ],
      connections: [link(1, 2), link(2, 3, 'true'), link(3, 4), link(2, 5, 'false'), link(5, 6)]
    }
  }
];
})(WF.helpers);
