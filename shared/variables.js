// พจนานุกรมคำอธิบายตัวแปรภาษาไทย (เพื่อให้เข้าใจทันทีว่าแต่ละตัวคืออะไร)
const VARIABLE_DICTIONARY = {
  '{{customer_name}}': { label: 'ชื่อลูกค้า (จากฟอร์ม/ระบบ)', source: 'Form / Webhook' },
  '{{phone}}': { label: 'เบอร์โทรศัพท์ลูกค้า', source: 'Form' },
  '{{service_type}}': { label: 'ประเภทบริการที่เลือก', source: 'Form' },
  '{{amount}}': { label: 'ยอดเงินโอน / ราคา', source: 'Form / Webhook' },
  '{{message}}': { label: 'ข้อความหมายเหตุในฟอร์ม', source: 'Form' },
  '{{current_date}}': { label: 'วันที่วันนี้ (เช่น 2026-10-14)', source: 'Schedule' },
  '{{current_time}}': { label: 'เวลาปัจจุบัน (เช่น 08:00)', source: 'Schedule' },
  '{{user_name}}': { label: 'ชื่อโปรไฟล์ LINE ของลูกค้า', source: 'LINE Chat' },
  '{{message_text}}': { label: 'ข้อความแชทที่ลูกค้าพิมพ์มา', source: 'LINE Chat' },
  '{{reply_token}}': { label: 'รหัสอ้างอิงสำหรับตอบกลับแชท', source: 'LINE Chat' },
  '{{order_id}}': { label: 'รหัสคำสั่งซื้อ (Order ID)', source: 'Webhook' },
  '{{payment_status}}': { label: 'สถานะการชำระเงิน', source: 'Webhook' },
  '{{ai_result}}': { label: 'ผลการวิเคราะห์จาก AI (เช่น ด่วน/ปกติ)', source: 'AI (LLM)' },
  '{{ai_reply}}': { label: 'ข้อความคำตอบที่ AI ร่างให้', source: 'AI (LLM)' },
  '{{sheet_rows}}': { label: 'รายการข้อมูลหลายแถวที่ดึงมาจากชีต', source: 'Google Sheets' },
  '{{row_number}}': { label: 'เลขแถวที่บันทึกในชีต', source: 'Google Sheets' },
  '{{formatted_text}}': { label: 'ข้อความที่จัดรูปทรง/รวมยอดเสร็จแล้ว', source: 'Formatter' },
  '{{loop_item}}': { label: 'ข้อมูลทีละรายการจากการวนลูป', source: 'Loop' },
  '{{api_data}}': { label: 'ข้อมูลที่ได้จากการดึง API', source: 'HTTP Request' }
};

if (typeof module !== 'undefined') module.exports = { VARIABLE_DICTIONARY };
