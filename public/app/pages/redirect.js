// public/app/pages/redirect.js
(function () {
  const token = localStorage.getItem('sb_session_token');
  const pageName = window.location.pathname.split('/').pop().replace('.html', '');

  // หากไม่มี session token ให้ส่งกลับไปหน้า Login ที่ Root
  if (!token) {
    window.location.href = '/';
    return;
  }

  // กำหนดแผนผังการจับคู่หน้าเดิมกับ Hash Route ของแอปพลิเคชันใหม่
  let route = pageName;
  if (pageName === 'homeAdmin' || pageName === 'admin') {
    route = 'admin';
  }

  // เปลี่ยนเส้นทางไปยัง React SPA หน้าแรกพร้อมส่ง Hash Route
  window.location.href = '/#' + route;
})();
