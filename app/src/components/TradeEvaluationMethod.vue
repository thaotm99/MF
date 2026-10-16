<script setup lang="ts">
import type { EvaluationOptions } from '../utils/trade-evaluation'

/** Giải thích cách tính từng chỉ số đánh giá lệnh (số liệu lấy theo tham số đang chọn trên giao diện). */
defineProps<{
  options: EvaluationOptions
  entryTimeframe: string
  exitTimeframe: string
  exitBars: number
}>()
</script>

<template>
  <details class="card method">
    <summary>Cách tính &amp; phân tích</summary>

    <div class="body">
      <h3>Nguyên tắc chung</h3>
      <ul>
        <li>
          <b>Không nhìn tương lai:</b> chỉ dùng nến đã đóng trước giờ vào lệnh (phần "Lúc vào lệnh") hoặc trước giờ đóng lệnh
          (phần "Trước khi đóng"). Nến đang chạy lúc vào/đóng không được tính.
        </li>
        <li><b>ATR</b> = trung bình 14 nến của True Range (max của High−Low, |High−Close trước|, |Low−Close trước|). Dùng làm "thước đo" để so khoảng cách giữa các thời điểm có biên độ khác nhau.</li>
        <li><b>Thắng</b> = lợi nhuận ròng của lệnh ≥ 0. Mỗi nhóm hiện số lệnh, tỉ lệ thắng, tổng lãi/lỗ. Nhóm dưới 5 lệnh chỉ mang tính tham khảo.</li>
        <li>Cần tối thiểu 60 nến trước lệnh, nếu thiếu lệnh đó bị bỏ qua.</li>
      </ul>

      <h3>Lúc vào lệnh (nến {{ entryTimeframe }})</h3>

      <h4>1. Swing (đỉnh / đáy)</h4>
      <p>
        Fractal {{ options.swingStrength }} nến: nến i là <b>swing high</b> nếu High của nó cao hơn High của {{ options.swingStrength }} nến bên trái
        và {{ options.swingStrength }} nến bên phải; <b>swing low</b> tương tự với Low. Chỉ xét {{ options.lookback }} nến gần nhất, và swing phải đủ
        {{ options.swingStrength }} nến sau nó đã đóng (nên không bao giờ dùng swing "chưa xác nhận").
      </p>

      <h4>2. Cấu trúc thị trường (xu hướng / sideway)</h4>
      <p>So sánh 2 đỉnh swing và 2 đáy swing gần nhất:</p>
      <ul>
        <li><b>Xu hướng tăng:</b> đỉnh gần nhất cao hơn đỉnh trước (HH) <u>và</u> đáy gần nhất cao hơn đáy trước (HL).</li>
        <li><b>Xu hướng giảm:</b> đỉnh thấp hơn (LH) <u>và</u> đáy thấp hơn (LL).</li>
        <li>
          <b>Sideway:</b> mọi trường hợp còn lại — tức đỉnh và đáy không cùng hướng (ví dụ HH nhưng LL = biên độ mở rộng; LH nhưng HL = tam giác co hẹp),
          hoặc chưa đủ 2 đỉnh + 2 đáy trong {{ options.lookback }} nến.
        </li>
      </ul>
      <p class="note">
        Ví dụ: 2 đỉnh swing gần nhất là 2350 → 2362 (HH) nhưng 2 đáy là 2340 → 2335 (LL) ⇒ sideway (mở rộng). Nếu đáy là 2340 → 2345 (HL) ⇒ xu hướng tăng.
        Lưu ý: đây là sideway theo <i>cấu trúc đỉnh/đáy</i>, không đo độ rộng biên độ, nên một sideway biên độ rộng vẫn được tính là sideway.
      </p>

      <h4>3. Thuận / ngược xu hướng</h4>
      <p>Buy trong xu hướng tăng hoặc Sell trong xu hướng giảm = <b>thuận</b>; ngược lại = <b>ngược</b>; xu hướng là sideway = <b>trong sideway</b>.</p>

      <h4>4. Phá cấu trúc</h4>
      <p>
        Giá đóng của nến cuối trước lệnh so với đỉnh / đáy swing gần nhất: đóng trên đỉnh = "phá đỉnh", đóng dưới đáy = "thủng đáy", còn lại = "còn trong đỉnh/đáy swing".
        Kết hợp với chiều lệnh (Buy/Sell) để chia nhóm.
      </p>

      <h4>5. Vị trí vào trong range</h4>
      <p>
        Lấy High cao nhất và Low thấp nhất của {{ options.rangeBars }} nến gần nhất, rồi tính
        <code>(giá vào − Low) / (High − Low)</code> (0 = đáy, 1 = đỉnh). Chia 3: &lt; 1/3 = vùng thấp, 1/3–2/3 = giữa range, &gt; 2/3 = vùng cao.
      </p>

      <h4>6. Khoảng cách tới cản phía trước</h4>
      <p>
        Buy: swing high gần nhất <i>nằm trên</i> giá vào. Sell: swing low gần nhất <i>nằm dưới</i> giá vào. Khoảng cách chia cho ATR, chia nhóm:
        sát cản (&lt; {{ options.nearLevelAtr }} ATR), cản gần ({{ options.nearLevelAtr }}–1.5 ATR), có khoảng trống (≥ 1.5 ATR); không tìm thấy swing = "không có cản gần".
      </p>

      <h4>7. Nến trước khi vào</h4>
      <p>Phân loại nến đóng cuối cùng theo thứ tự ưu tiên:</p>
      <ul>
        <li><b>Engulfing:</b> nến ngược màu nến trước, thân lớn hơn và bao trọn thân nến trước.</li>
        <li><b>Pin bar:</b> bóng dưới (tăng) hoặc bóng trên (giảm) ≥ 2× thân và ≥ 60% toàn bộ nến.</li>
        <li><b>Doji:</b> thân ≤ 10% toàn bộ nến.</li>
        <li><b>Inside bar:</b> High thấp hơn và Low cao hơn nến trước.</li>
        <li>Còn lại: nến tăng / nến giảm.</li>
      </ul>
      <p>"Xác nhận" = nến cùng chiều lệnh (Buy: engulfing/pin/nến tăng); "ngược chiều" = nến ngược chiều lệnh; còn lại là trung tính.</p>

      <h4>8. EMA20</h4>
      <p>
        Giá đóng của nến cuối nằm trên hay dưới EMA20, và EMA20 dốc lên hay xuống (so EMA hiện tại với EMA 5 nến trước). Cho ra 4 nhóm: trên/dưới × dốc lên/xuống.
      </p>

      <h4>9. Biến động</h4>
      <p>
        ATR hiện tại chia cho trung bình ATR lấy mẫu mỗi 5 nến trong 50 nến trước đó. &gt; 1.25× = biến động tăng, &lt; 0.8× = biến động thấp, còn lại bình thường.
      </p>

      <h4>10. Khung H1 / H4</h4>
      <p>
        Gộp nến {{ entryTimeframe }} thành nến H1 / H4 (mốc giờ UTC), rồi xác định cấu trúc HH+HL / LH+LL như mục 2 trên nến khung lớn đã đóng.
        So với chiều lệnh: thuận / ngược / sideway. Cần ≥ 30 nến khung lớn, nếu thiếu = "không đủ nến".
      </p>
      <h4>11. So với ngày hôm trước (PDH / PDL)</h4>
      <p>
        Đỉnh / đáy của ngày D1 đã đóng gần nhất (gộp từ nến). Giá vào trên PDH / dưới PDL; sát PDH / sát PDL khi cách &lt; 0.5 ATR; còn lại = trong range ngày trước.
      </p>
      <h4>12. Số tròn</h4>
      <p>
        Khoảng cách từ giá vào tới số tròn gần nhất, chia ATR. Bước số tròn theo độ lớn giá: ≥ 1000 → 10 (vàng: 4150, 4160…), ≥ 100 → 1, ≥ 10 → 0.1, còn lại 0.001.
      </p>
      <h4>13. Phiên giao dịch</h4>
      <p>Theo giờ server UTC+0: Á 0–7h, Âu 7–12h, Âu–Mỹ chồng nhau 12–16h, Mỹ 16–21h, cuối ngày 21–24h.</p>

      <h3>Tổ hợp setup</h3>
      <ul>
        <li>Ghép 2–3 yếu tố lúc vào lệnh ở trên (bỏ nhóm "không đủ nến / không rõ"), tính số lệnh, tỉ lệ thắng, lãi/lỗ cho từng tổ hợp.</li>
        <li>
          Lệnh xếp theo giờ vào: <b>70% đầu</b> dùng để tìm tổ hợp (chỉ xét tổ hợp đủ số lệnh tối thiểu), <b>30% sau</b> chỉ để kiểm tra —
          không dùng để chọn, nên phản ánh kết quả "chưa thấy trước" của tổ hợp.
        </li>
        <li>Bỏ tổ hợp chỉ là bản mở rộng của tổ hợp đơn giản hơn đã chọn (ưu tiên ít điều kiện).</li>
        <li>"Lặp lại ✓" = ở phần kiểm tra tổ hợp vẫn lãi (setup tốt) / vẫn lỗ (setup xấu) với ≥ 5 lệnh.</li>
      </ul>

      <h3>Biên độ trong lệnh — MAE / MFE (nến {{ exitTimeframe }})</h3>
      <ul>
        <li>Dùng các nến chồng lên khoảng [giờ vào, giờ ra]; đổi ra ATR14 lúc vào lệnh.</li>
        <li><b>MAE</b> = giá đi ngược chiều lệnh xa nhất so với giá vào (Buy: giá vào − Low thấp nhất). <b>MFE</b> = đi thuận xa nhất (Buy: High cao nhất − giá vào).</li>
        <li><b>MAE p90 của lệnh thắng:</b> 90% lệnh thắng không bị ngược quá mức này → SL hẹp hơn sẽ cắt mất lệnh thắng.</li>
        <li><b>Lệnh thua từng có lãi:</b> % lệnh thua có MFE ≥ 0.5 / 1 / 1.5 ATR → ứng viên dời SL về hoà vốn.</li>
        <li><b>Chốt được:</b> trung vị (kết quả theo giá / MFE) của lệnh thắng — thấp nghĩa là TP / trailing nhả nhiều.</li>
        <li>Nến đầu / cuối có thể gồm một phần trước khi vào / sau khi ra, nên khung càng nhỏ (M1) càng chính xác.</li>
      </ul>

      <h3>Nhật ký của bạn</h3>
      <p>
        Nhãn và ghi chú bạn gắn cho từng lệnh (lưu ở <code>app/journal/trade-journal.json</code>). Bảng "Theo nhãn của bạn" thống kê thắng/thua theo nhãn;
        lệnh có nhiều nhãn được tính vào mỗi nhãn.
      </p>

      <h3>Trước khi đóng lệnh ({{ exitBars }} nến {{ exitTimeframe }})</h3>
      <ul>
        <li>
          <b>Đà giá:</b> <code>(Close nến cuối − Close nến ngay trước cửa sổ) × chiều lệnh / ATR</code> (chiều lệnh: Buy = +1, Sell = −1).
          ≥ +0.5 ATR = "đang chạy thuận", ≤ −0.5 ATR = "đã quay đầu", ở giữa = "đi ngang".
        </li>
        <li><b>Số nến thuận chiều:</b> đếm trong {{ exitBars }} nến, nến có (Close − Open) cùng chiều lệnh (Buy: nến tăng, Sell: nến giảm).</li>
        <li>
          <b>Lợi nhuận đã trả lại:</b> giá tốt nhất trong {{ exitBars }} nến (Buy: High cao nhất, Sell: Low thấp nhất) trừ giá đóng lệnh, chia ATR.
          Nhóm: &lt; 0.25 (đóng gần giá tốt nhất), 0.25–1, 1–2, ≥ 2 ATR.
        </li>
        <li><b>Nến cuối:</b> "đảo chiều" khi là pin bar hoặc engulfing ngược chiều lệnh (Buy: giảm; Sell: tăng).</li>
      </ul>

      <h3>Cách đọc kết quả</h3>
      <p>
        Mỗi bảng chỉ cho biết bot hay thắng/thua ở bối cảnh nào — là <b>tương quan</b>, không phải nguyên nhân. Nhóm có ít lệnh dễ nhiễu;
        nên so nhiều khung/tham số và chỉ coi là gợi ý khi nhóm đủ lớn (vài chục lệnh trở lên).
      </p>
    </div>
  </details>
</template>

<style scoped>
.method { margin-top: 18px; padding: 0 16px; font-size: 13px; }
summary { cursor: pointer; padding: 12px 0; font-weight: 600; font-size: 14px; }
.body { padding-bottom: 14px; line-height: 1.55; }
h3 { font-size: 13px; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border); }
h4 { font-size: 13px; margin: 12px 0 4px; }
p { margin: 4px 0; color: var(--text); }
ul { margin: 4px 0; padding-left: 20px; }
li { margin: 2px 0; }
code { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
.note { color: var(--muted); background: var(--bg); padding: 8px 10px; border-radius: var(--radius); }
</style>
