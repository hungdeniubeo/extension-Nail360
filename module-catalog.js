/* Module routing and coverage catalog. No guessed URLs or product rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.N360Modules=api;})(globalThis,()=>{
'use strict';
const ORIGIN='https://dev.nail360.info';
const items=[
 {id:'home',title:'HOME',hint:'Ticket, Waiting List và Turn',segments:['home','dashboard'],known:'/light/admin/home',available:['Nhận diện Search, View Turn List, Add Service Ticket','Quan sát nhãn Waiting List / Walk-In và Turn, không suy đoán nghiệp vụ'],planned:['Tạo/sửa Ticket, lọc trạng thái, tìm kiếm','Xác minh Waiting List, gán technician và quy tắc Turn']},
 {id:'appointment',title:'APPOINTMENT',hint:'Lịch hẹn và dịch vụ',segments:['appointment','appointments','booking','bookings','calendar'],known:'/light/admin/appointment',available:['Đếm lịch hẹn có ID và phân trang rõ','Kiểm tra ID dòng dịch vụ khi đọc được'],planned:['Tạo, sửa, đổi giờ, hủy lịch','Check-in và chuyển sang Ticket','Kiểm tra trùng lịch, technician']},
 {id:'reports',title:'REPORTS',hint:'Doanh thu và báo cáo',segments:['report','reports','revenue','sales-report'],available:['Đối chiếu tổng cùng chỉ số Sales, Revenue, Tip, Tax khi bảng đầy đủ'],planned:['Chọn khoảng ngày, bộ lọc','Đối chiếu giao dịch test với báo cáo','Kiểm tra void/refund theo quy tắc']},
 {id:'marketing',title:'MARKETING',hint:'Campaign và khách hàng',segments:['marketing','campaign','campaigns'],available:[],planned:['Tạo và sửa chiến dịch test','Kiểm tra bộ lọc khách và preview','Kiểm tra cấu hình, không gửi tin ra ngoài']},
 {id:'settings',title:'SETTINGS',hint:'Cấu hình salon',segments:['setting','settings','configuration'],available:[],planned:['Lưu, tải lại, kiểm tra cấu hình test','Kiểm tra trường bắt buộc và quyền','Khôi phục cấu hình ban đầu']},
 {id:'ticket',title:'TICKET / POS',hint:'Dịch vụ và thanh toán',segments:['ticket','tickets','pos','checkout','invoice','invoices'],available:['Thành tiền, Discount, Tax, Grand total khi đủ trường'],planned:['Tạo Ticket, thêm/xóa Service','Checkout và refund chỉ qua phương thức test','Kiểm tra trạng thái và dữ liệu lưu']},
 {id:'service',title:'SERVICE',hint:'Danh mục dịch vụ',segments:['service','services','service-catalog'],available:['ID dịch vụ lặp, tên dịch vụ trống'],planned:['Tạo/sửa dịch vụ test','Giá, thời lượng và danh mục']},
 {id:'turn',title:'TURN / TECHNICIAN',hint:'Hàng đợi và thợ',segments:['turn','turns','technician','technicians','queue'],available:['Kiểm tra vị trí hàng đợi theo quy ước số nguyên dương'],planned:['Thứ tự, tăng lượt, reset, ngoại lệ','Đối chiếu sau khi hoàn thành Ticket']},
 {id:'customer',title:'CUSTOMER',hint:'Hồ sơ khách hàng',segments:['customer','customers','client','clients'],available:[],planned:['Tạo/sửa/tìm khách test','Kiểm tra dữ liệu lưu và validation']},
 {id:'other',title:'KHÁC',hint:'Trang chưa phân loại',segments:[],available:[],planned:['Bổ sung kịch bản khi xác định trang và nghiệp vụ']}
];
const byId=id=>items.find(m=>m.id===id)||null;
function routeId(path){if(typeof path!=='string')return null;const m=path.match(/^\/light\/admin\/([a-zA-Z0-9_-]+)(?:\/|$)/);if(!m)return null;const seg=m[1].toLowerCase();if(/^(login|logout|signout|signin|auth|register|reset|password)$/.test(seg))return null;return items.find(x=>x.segments.includes(seg))?.id||'other';}
function urlId(url){try{const u=new URL(url);return u.origin===ORIGIN&&!u.username&&!u.password?routeId(u.pathname):null;}catch{return null;}}
function candidate(url,id){try{const u=new URL(url);if(urlId(url)!==id||id==='other'||u.search||u.hash||!/^\/light\/admin\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))return null;return u.origin+u.pathname.replace(/\/$/,'');}catch{return null;}}
function destination(id,urls=[]){const m=byId(id);if(!m||id==='other')return null;const hits=[...new Set(urls.map(u=>candidate(u,id)).filter(Boolean))];if(hits.length===1)return hits[0];if(hits.length>1)return null;return m.known?ORIGIN+m.known:null;}
function runId(run){return routeId(run?.route)||'other';}
return {ORIGIN,items,byId,routeId,urlId,candidate,destination,runId};
});
