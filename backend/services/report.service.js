import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import PDFDocument from "pdfkit";
import path from "path";

const chartCanvas = new ChartJSNodeCanvas({
  width: 600,
  height: 400,
  backgroundColour: "white"
});

export async function renderOrderStatusChart(statusStats) {
  const LABELS = {
    pending: "Chờ xử lý",
    cancelled: "Đã hủy",
    completed: "Hoàn thành",
    "in-progress": "Đang thực hiện",
    accepted: "Đã nhận"
  };

  const labels = statusStats.map(s => LABELS[s._id] || s._id);
  const data = statusStats.map(s => s.count);

  return await chartCanvas.renderToBuffer({
    type: "pie",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6"
        ]
      }]
    },
    options: {
      plugins: { legend: { position: "bottom" } }
    }
  });
}

export function createPdf(res) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.registerFont("regular", path.resolve("../backend/config/Roboto-Regular.ttf"));
  doc.registerFont("bold", path.resolve("../backend/Roboto-Bold.ttf"));
  doc.font("regular");

  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  return doc;
}

export function drawTable(doc, headers, rows) {
  const startX = 50;
  let y = doc.y;

  const colWidth = (500 / headers.length);

  doc.font("bold");
  headers.forEach((h, i) => {
    doc.text(h, startX + i * colWidth, y, { width: colWidth });
  });

  y += 20;
  doc.font("regular");

  rows.forEach(row => {
    row.forEach((cell, i) => {
      doc.text(String(cell), startX + i * colWidth, y, { width: colWidth });
    });
    y += 18;
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
  });

  doc.moveDown(1);
}

export async function exportFullReportPdf(req, res, data) {
  const doc = createPdf(res);

  const formatNumber = n => new Intl.NumberFormat("vi-VN").format(n || 0);
  const formatCurrency = n => formatNumber(n) + " VNĐ";

  // ===== HEADER =====
  doc.font("bold").fontSize(22).text("BÁO CÁO THỐNG KÊ TỔNG HỢP", { align: "center" });
  doc.moveDown(1);

  // ===== ĐƠN HÀNG =====
  doc.font("bold").fontSize(16).text("1. Thống kê đơn hàng");
  doc.moveDown(0.5);

  drawTable(doc,
    ["Chỉ số", "Giá trị"],
    [
      ["Tổng đơn", formatNumber(data.orders.total)],
      ["Hoàn thành", formatNumber(data.orders.completed)],
      ["Đã hủy", formatNumber(data.orders.cancelled)]
    ]
  );

  // ===== CHART =====
  const chartImage = await renderOrderStatusChart(data.orders.statusStats);
  doc.addPage();
  doc.font("bold").fontSize(16).text("Biểu đồ trạng thái đơn hàng");
  doc.moveDown(1);
  doc.image(chartImage, { fit: [400, 300], align: "center" });

  // ===== DOANH THU =====
  doc.addPage();
  doc.font("bold").fontSize(16).text("2. Thống kê doanh thu");

  drawTable(doc,
    ["Chỉ số", "Số tiền"],
    [
      ["Tổng doanh thu", formatCurrency(data.revenue.total)],
      ["Đã chi trả Tasker", formatCurrency(data.revenue.payouts)],
      ["Chưa chi", formatCurrency(data.revenue.pending)]
    ]
  );

  // ===== FOOTER =====
  doc.fontSize(8).font("regular").text(
    "Báo cáo được tạo tự động bởi hệ thống TaskGo",
    { align: "center" }
  );

  doc.end();
}