#property strict
#include <Trade\Trade.mqh>

// Tien to comment danh dau lenh cua bot (dong bo voi orderComment trong OpenOrder) -
// dung nhu 1 lop check bo sung ben canh magic number trong IsBotPosition, KHONG thay the
#define BOT_COMMENT_PREFIX "ATR : "

//=============================================================================
// INPUTS
//=============================================================================
 string InpCoralIndicatorName = "Coral-custom";
 string InpTelegramToken         = "8696728373:AAFmkD2bLCRM2XviVvBtaSY2HGaoV4iY5cE";
 string InpTelegramChatID        = "7383830655"; // FRTMO

//=============================================================================
// INPUTS (Magic Number - phan biet lenh bot vs lenh thu cong)
//=============================================================================
input long InpMagicNumber = 20250806;  // Magic number cua bot (lenh thu cong magic=0)

//=============================================================================
// INPUTS (stop loss)
//=============================================================================
input double InpSlSpacingDistance = 8;  // Khoảng cách SL tối đa tính từ entry (theo giá), cap lại nếu swing xa hơn

//=============================================================================
// INPUTS (take profit)
//=============================================================================
input double InpTakeProfitDistance = 50;  // Khoảng cách TP tính từ entry (theo giá), BUY: entry+giá trị, SELL: entry-giá trị

//=============================================================================
// INPUTS (gioi han lai/lo trong ngay)
//=============================================================================
input double InpDailyMaxLoss   = 40;  // Lỗ tối đa trong ngày ($) - chạm mức này thì dừng vào lệnh mới
input double InpDailyMaxProfit = 100;  // Lãi tối đa trong ngày ($) - chạm mức này thì dừng vào lệnh mới

//=============================================================================
// INPUTS (gioi han lai theo khung gio: 00h-6h / 6h-12h / 12h-24h)
//=============================================================================
input double InpTimeWindowMaxProfit = 30;  // Lãi tối đa trong 1 khung giờ ($) - chạm mức này thì dừng vào lệnh mới đến khi sang khung giờ kế tiếp

//=============================================================================
// GLOBALS
//=============================================================================
string   g_previousPosition = "NONE";
double   g_tradeLotSize     = 0;
double   g_lotMultiplier    =  1;   // he so nhan vol co ban (min lot x he so); dong thoi la nguong chot loi *100

CTrade   trade;

int g_hATR_M1, g_hADX_M1;
int g_hCoralM1, g_hCoralM5, g_hCoralM15, g_hCoralM30, g_hCoralH1;

//=============================================================================
// INIT
//=============================================================================
// Khởi tạo EA: setup CTrade, tạo handle cho các chỉ báo ATR/ADX/Coral (5 khung thời gian)
int OnInit()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) { Print("Auto trading is disabled in terminal - EA init aborted"); return 0; }

   g_tradeLotSize = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), 2);
   trade.SetDeviationInPoints(500);
   trade.SetExpertMagicNumber(InpMagicNumber);   // gan magic number cho moi lenh bot mo

   g_hATR_M1   = iATR(_Symbol, PERIOD_M1, 14);
   g_hADX_M1   = iADX(_Symbol, PERIOD_M1, 14);
   
   g_hCoralM1  = iCustom(_Symbol, PERIOD_M1,  InpCoralIndicatorName, true, 14);
   g_hCoralM5  = iCustom(_Symbol, PERIOD_M5,  InpCoralIndicatorName, true, 14);
   g_hCoralM15 = iCustom(_Symbol, PERIOD_M15, InpCoralIndicatorName, true, 14);
   g_hCoralM30 = iCustom(_Symbol, PERIOD_M30, InpCoralIndicatorName, true, 14);
   g_hCoralH1  = iCustom(_Symbol, PERIOD_H1,  InpCoralIndicatorName, true, 14);

   if(g_hATR_M1==INVALID_HANDLE || g_hADX_M1==INVALID_HANDLE ||
      g_hCoralM1==INVALID_HANDLE || g_hCoralM5==INVALID_HANDLE || g_hCoralM15==INVALID_HANDLE ||
      g_hCoralM30==INVALID_HANDLE || g_hCoralH1==INVALID_HANDLE)
   {
       Print("Failed to create ATR/ADX/Coral indicator handle(s) for ", _Symbol);
      return INIT_FAILED;
   }

   Print("EA initialized on ", _Symbol, ", magic=", InpMagicNumber);

   return INIT_SUCCEEDED;
}

// Giải phóng toàn bộ handle chỉ báo đã tạo trong OnInit khi EA gỡ bỏ
void OnDeinit(const int reason)
{
   IndicatorRelease(g_hATR_M1);
   IndicatorRelease(g_hADX_M1);
   IndicatorRelease(g_hCoralM1);
   IndicatorRelease(g_hCoralM5);
   IndicatorRelease(g_hCoralM15);
   IndicatorRelease(g_hCoralM30);
   IndicatorRelease(g_hCoralH1);
}

//=============================================================================
// MAGIC HELPER: kiem tra lenh dang chon co phai cua bot khong
//   (goi sau khi da PositionSelect / PositionSelectByTicket / PositionGetTicket)
//=============================================================================
bool IsBotPosition()
{
   if(PositionGetString(POSITION_SYMBOL) != _Symbol) return false;
   if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) return false;
   // Lop check bo sung: lenh cua bot luon co comment bat dau bang BOT_COMMENT_PREFIX
   // (xem orderComment trong OpenOrder). Lenh thu cong khong dat comment nay se bi loai,
   // du magic co trung do netting gop lenh di nua.
   if(StringFind(PositionGetString(POSITION_COMMENT), BOT_COMMENT_PREFIX) != 0) return false;
   return true;
}

//=============================================================================
// TIME HELPERS (thay cho Hour()/Minute() của MQL4)
//=============================================================================
// Trả về giờ hiện tại theo giờ server (0-23)
int Hour()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return dt.hour;
}

// Trả về phút hiện tại theo giờ server (0-59)
int Minute()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return dt.min;
}

//=============================================================================
// TELEGRAM
//=============================================================================
// Gửi message tới Telegram qua Bot API (WebRequest), trả về false nếu gửi thất bại
bool SendTelegram(string message)
{
   char post[], result[];
   string headers;
   string msg = "MACOS MT5 %0A------------------%0A" +  message ;
   string url = "https://api.telegram.org/bot" + InpTelegramToken
              + "/sendMessage?chat_id=" + InpTelegramChatID
              + "&parse_mode=HTML"
              + "&text=" + msg;

   int res = WebRequest("GET", url, "", 5000, post, result, headers);
   if(res == -1)
   {
      Print("Telegram WebRequest failed, error code: ", GetLastError(), " (check URL is whitelisted in terminal options)");
      return false;
   }
   return true;
}

// Dựng format nội dung telegram: ghép title với các thông số lệnh (entry/SL/dist/swing/ATR) + spread/ADX hiện tại
string TelegramMsg(string title, string entryPrice, string sl, string distanceText, string swingPrice, string atr)
{
   double spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) / 10.0;

   double adxBuf[]; ArraySetAsSeries(adxBuf, true);
   double adx = 0;
   if(CopyBuffer(g_hADX_M1, 0, 1, 1, adxBuf) > 0) adx = adxBuf[0];

   return title + "%0A------------------%0A"
        + "Entry:  $" + entryPrice + "%0A"
        + "SL:     $" + sl         + "%0A"
        + "Dist:    " + distanceText + "%0A"
        + "Swing:  $" + swingPrice  + "%0A"
        + "spread:    " + DoubleToString(spread, 1) + "%0A"
        + "adx:  $" + DoubleToString(adx, 2)  + "%0A"
        + "ATR:     " + atr;
}

//=============================================================================
// TICK
//=============================================================================
// Mỗi tick: xử lý tín hiệu vào lệnh khi có nến M1 mới, sau đó cập nhật previousPosition cho tất cả lệnh đang mở của bot (không trailing)
void OnTick()
{
   static datetime lastBarTime = 0;
   datetime currentBarTime = iTime(_Symbol, PERIOD_M1, 0);

   if(currentBarTime > lastBarTime)
   {
      lastBarTime = currentBarTime;
      ProcessSignal(1);
   }

   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(!IsBotPosition()) continue;   // bo qua lenh thu cong / symbol khac

      // Khong trailing - lenh giu nguyen SL/TP co dinh dat luc OpenOrder()
      g_previousPosition = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "LONG" : "SHORT";
   }
}

//=============================================================================
// SIGNAL
//=============================================================================
// Đọc trend Coral trên M1/M5/M15: đóng lệnh ngược hướng khi Coral M1 đảo chiều,
// sau đó mở lệnh mới khi cả 3 khung đồng thuận hướng (buy/sell signal)
int ProcessSignal(int shift)
{
   bool upNow    = IsCoralUp(PERIOD_M1, shift);
   bool upPrev   = IsCoralUp(PERIOD_M1, shift + 1);
   bool downNow  = IsCoralDown(PERIOD_M1, shift);
   bool downPrev = IsCoralDown(PERIOD_M1, shift + 1);
   bool upM5     = IsCoralUp(PERIOD_M5, shift);
   bool downM5   = IsCoralDown(PERIOD_M5, shift);
   bool upM15    = IsCoralUp(PERIOD_M15, shift);
   bool downM15  = IsCoralDown(PERIOD_M15, shift);

   bool reversedAgainstPosition = (g_previousPosition == "SHORT" && upNow) ||
                                   (g_previousPosition == "LONG"  && downNow);
   if(reversedAgainstPosition) CloseAllPositions();

   Print("Coral trend snapshot - M1 up:", upNow, " M1 up(prev):", upPrev, " M5 up:", upM5, " M15 up:", upM15,
         " | M1 down:", downNow, " M1 down(prev):", downPrev, " M5 down:", downM5, " M15 down:", downM15);

   bool buySignal  = (upNow   && !upPrev   && upM5   && upM15);
   bool sellSignal = (downNow && !downPrev && downM5 && downM15);

   if(buySignal)  OpenOrder((int)POSITION_TYPE_BUY,  shift);
   if(sellSignal) OpenOrder((int)POSITION_TYPE_SELL, shift);

   return 0;
}


//=============================================================================
// GIOI HAN LAI/LO TRONG NGAY / THEO KHUNG GIO
//=============================================================================
// Tinh loi/lo DA CHOT (deal cua bot, loc theo symbol + magic) trong khoang [fromTime, toTime]
double GetRealizedProfitInRange(datetime fromTime, datetime toTime)
{
   double total = 0;
   if(!HistorySelect(fromTime, toTime)) return total;

   int totalDeals = HistoryDealsTotal();
   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      if(HistoryDealGetString(dealTicket, DEAL_SYMBOL) != _Symbol) continue;
      if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != InpMagicNumber) continue;
      total += HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
             + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
             + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   }
   return total;
}

// Tinh loi/lo DA CHOT tu dau ngay (server) den hien tai
double GetTodayRealizedProfit()
{
   datetime startOfDay = TimeCurrent() - (TimeCurrent() % 86400);
   return GetRealizedProfitInRange(startOfDay, TimeCurrent());
}

// Tinh loi/lo NOI (floating) cua cac lenh dang mo cua bot
double GetBotFloatingProfit()
{
   double total = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(!IsBotPosition()) continue;
      total += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
   }
   return total;
}

// Kiem tra da cham nguong dung vao lenh moi trong ngay chua: lo >= InpDailyMaxLoss hoac lai >= InpDailyMaxProfit.
// dailyPnl (tra ra ngoai) = tong P/L da chot + dang mo cua bot trong ngay server hien tai.
// Lenh dang mo van duoc CloseAllPositions quan ly binh thuong (khong con TrailingStop), chi OpenOrder() bi chan.
bool DailyLimitReached(double &dailyPnl)
{
   dailyPnl = (GetTodayRealizedProfit() + GetBotFloatingProfit() );
   if(dailyPnl <= -InpDailyMaxLoss * g_lotMultiplier) return true;
   if(dailyPnl >= InpDailyMaxProfit * g_lotMultiplier) return true;
   return false;
}

// Xac dinh khung gio hien tai theo gio server: 0 = 00h-6h, 1 = 6h-12h, 2 = 12h-24h
int GetTimeWindowIndex()
{
   int hour = Hour();
   if(hour < 6)  return 0;
   if(hour < 12) return 1;
   return 2;
}

// Tra ve gio bat dau/ket thuc (0-24) cua khung gio theo windowIndex (0/1/2, xem GetTimeWindowIndex)
void GetTimeWindowRange(int windowIndex, int &startHour, int &endHour)
{
   if(windowIndex == 0)      { startHour = 0;  endHour = 6;  }
   else if(windowIndex == 1) { startHour = 6;  endHour = 12; }
   else                      { startHour = 12; endHour = 24; }
}

// Tinh loi/lo DA CHOT trong khung gio hien tai (00h-6h / 6h-12h / 12h-24h) cua ngay server hom nay
double GetTimeWindowRealizedProfit()
{
   int startHour, endHour;
   GetTimeWindowRange(GetTimeWindowIndex(), startHour, endHour);

   datetime startOfDay  = TimeCurrent() - (TimeCurrent() % 86400);
   datetime windowStart = startOfDay + startHour * 3600;
   datetime windowEnd   = startOfDay + endHour   * 3600;

   return GetRealizedProfitInRange(windowStart, windowEnd);
}

// Kiem tra da cham nguong lai toi da trong khung gio hien tai chua (lai > InpTimeWindowMaxProfit).
// windowPnl (tra ra ngoai) = P/L da chot trong khung gio hien tai + P/L dang mo cua bot.
// Tu dong "reset" khi sang khung gio moi vi luon tinh lai theo khung gio hien tai, khong luu trang thai.
bool TimeWindowLimitReached(double &windowPnl)
{
   windowPnl = (GetTimeWindowRealizedProfit() + GetBotFloatingProfit());
   return (windowPnl > InpTimeWindowMaxProfit * g_lotMultiplier);
}

//=============================================================================
// OPEN ORDER
//=============================================================================
// Mở lệnh buy/sell: tính SL theo swing gần nhất (cap bởi InpSlSpacingDistance), bỏ qua nếu ATR quá thấp,
// đã chạm giới hạn lãi/lỗ trong ngày, hoặc đã chạm giới hạn lãi trong khung giờ hiện tại;
// gửi thông báo Telegram cho cả trường hợp thành công lẫn thất bại
void OpenOrder(int orderType, int shift)
{
   bool   isBuy      = (orderType == (int)POSITION_TYPE_BUY);
   double entryPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   string label      = isBuy ? "Buy" : "Sell";

   double dailyPnl = 0;
   if(DailyLimitReached(dailyPnl))
   {
      Print(label, " signal skipped on ", _Symbol, ": daily P/L limit reached ($", DoubleToString(dailyPnl, 2),
            ", loss limit=-$", DoubleToString(InpDailyMaxLoss, 2), ", profit limit=$", DoubleToString(InpDailyMaxProfit, 2), ")");
      SendTelegram("Daily P/L limit reached - " + label + " signal skipped %0A P/L today: $" + DoubleToString(dailyPnl, 2));
      return;
   }

   double windowPnl = 0;
   if(TimeWindowLimitReached(windowPnl))
   {
      Print(label, " signal skipped on ", _Symbol, ": time-window profit limit reached (window #", GetTimeWindowIndex(),
            ", P/L $", DoubleToString(windowPnl, 2), " > $", DoubleToString(InpTimeWindowMaxProfit, 2), ")");
      SendTelegram("Time-window profit limit reached - " + label + " signal skipped %0A P/L this window: $" + DoubleToString(windowPnl, 2));
      return;
   }

   // Volume co dinh (min lot * g_lotMultiplier), khong tang theo chuoi lenh cung huong
   double orderVol   = CalcOrderVolume(isBuy);

   int lowIdx  = iLowest(_Symbol,  PERIOD_M1, MODE_LOW,  14, 1);
   int highIdx = iHighest(_Symbol, PERIOD_M1, MODE_HIGH, 14, 1);
   double swingPrice = isBuy ? iLow(_Symbol, PERIOD_M1, lowIdx) : iHigh(_Symbol, PERIOD_M1, highIdx);

   double sl         = swingPrice;
   double slDistance = MathAbs(entryPrice - sl);

   double atrBuf[]; ArraySetAsSeries(atrBuf, true);
   if(CopyBuffer(g_hATR_M1, 0, 1, 1, atrBuf) <= 0) return;
   double atr = atrBuf[0];

   // Lam tron ATR ve 1 chu so thap phan truoc khi so sanh (vd 1.9344 -> 1.9, 1.95 -> 2.0)
   double atrRounded = NormalizeDouble(atr + 0.00001, 1);

   if(atrRounded < 2)
   {
      Print(label, " signal skipped on ", _Symbol, ": ATR too low (", DoubleToString(atrRounded, 1), " < 2)");
      SendTelegram("Signal: " + label + " %0A ATR: " + DoubleToString(atrRounded, 1));
      return;
   }

   // SL qua xa -> cap InpSlSpacingDistance
   if(slDistance > InpSlSpacingDistance) sl = isBuy ? entryPrice - InpSlSpacingDistance : entryPrice + InpSlSpacingDistance;

   // TP co dinh cach entry InpTakeProfitDistance gia: BUY cong them, SELL tru di
   double tp = isBuy ? entryPrice + InpTakeProfitDistance : entryPrice - InpTakeProfitDistance;

   string orderComment = BOT_COMMENT_PREFIX + DoubleToString(atr, 1);
   bool sent = isBuy ? trade.Buy(orderVol, _Symbol, entryPrice, sl, tp, orderComment)
                      : trade.Sell(orderVol, _Symbol, entryPrice, sl, tp, orderComment);

   if(!sent)
   {
      Print(label, " order failed on ", _Symbol, ", error code: ", GetLastError());
      SendTelegram(TelegramMsg(label + " FAILED",
         DoubleToString(entryPrice, 2), DoubleToString(sl, 2),
         DoubleToString(slDistance, 2), DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)));
      return;
   }

   if(PositionSelect(_Symbol))
   {
      SendTelegram(TelegramMsg(label + " OK",
         DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 2),
         DoubleToString(PositionGetDouble(POSITION_SL), 2),
         DoubleToString(slDistance, 2), DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)));
   }

   g_previousPosition = isBuy ? "LONG" : "SHORT";
   Print(label, " order placed on ", _Symbol, ", ticket: ", trade.ResultOrder(),
         ", entry: ", DoubleToString(entryPrice, 2), ", SL: ", DoubleToString(sl, 2), ", TP: ", DoubleToString(tp, 2));
}

//=============================================================================
// VOLUME
//=============================================================================
// Tính khối lượng lệnh (lot): min lot của symbol nhân hệ số g_lotMultiplier
double CalcOrderVolume(bool isBuy)
{
   return g_tradeLotSize * g_lotMultiplier;
}

// Đóng tất cả lệnh đang mở của bot (theo magic number), giữ nguyên lệnh thủ công
void CloseAllPositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(!IsBotPosition()) continue;   // chi dong lenh cua bot, giu nguyen lenh thu cong

      if(!trade.PositionClose(ticket))
         { Print("Failed to close bot position, ticket=", ticket, ", error code: ", GetLastError()); ResetLastError(); }
      else
         Print("Bot position closed, ticket=", ticket);
   }
}

//=============================================================================
// CORAL HELPERS
//=============================================================================
// Trả về handle chỉ báo Coral tương ứng với khung thời gian truyền vào
int GetCoralHandle(ENUM_TIMEFRAMES timeframe)
{
   switch(timeframe)
   {
      case PERIOD_M1:  return g_hCoralM1;
      case PERIOD_M5:  return g_hCoralM5;
      case PERIOD_M15: return g_hCoralM15;
      case PERIOD_M30: return g_hCoralM30;
      case PERIOD_H1:  return g_hCoralH1;
      default: return INVALID_HANDLE;
   }
}

// Đọc buffer chỉ báo Coral tại 1 shift: có giá trị (khác EMPTY_VALUE) nghĩa là đang trong trend đó (up/down)
bool CoralBufferHasValue(ENUM_TIMEFRAMES timeframe, int bufferIndex, int shift)
{
   int handle = GetCoralHandle(timeframe);
   double coralBuf[]; ArraySetAsSeries(coralBuf, true);
   if(CopyBuffer(handle, bufferIndex, shift, 1, coralBuf) <= 0) return false;
   return coralBuf[0] != EMPTY_VALUE;
}

// Coral đang trong trend tăng (buffer 1) / trend giảm (buffer 2) tại shift truyền vào
bool IsCoralUp(ENUM_TIMEFRAMES timeframe, int shift)   { return CoralBufferHasValue(timeframe, 1, shift); }
bool IsCoralDown(ENUM_TIMEFRAMES timeframe, int shift) { return CoralBufferHasValue(timeframe, 2, shift); }

//=============================================================================
// Ý TƯỞNG CHIẾN LƯỢC CỦA BOT (tổng quan)
//=============================================================================
// 1. Tín hiệu: đọc trend chỉ báo Coral trên 3 khung M1 (chính) / M5 / M15 (xác nhận).
//    Vào lệnh BUY khi Coral M1 vừa chuyển sang uptrend (up hiện tại, không up nến trước)
//    VÀ cả M5, M15 cũng đang uptrend đồng thuận. Tương tự cho SELL với downtrend.
//    -> Mục đích: chỉ vào lệnh đúng lúc M1 mới đổi chiều, nhưng phải được 2 khung lớn hơn
//       xác nhận cùng hướng, tránh vào lệnh ngược trend chính.
//
// 2. Đảo chiều vị thế: nếu đang giữ lệnh ngược với trend Coral M1 mới (vd đang SHORT mà
//    M1 chuyển Up), đóng toàn bộ lệnh của bot trước (xem reversedAgainstPosition trong
//    ProcessSignal) để tránh giữ lệnh sai hướng khi thị trường đã đảo chiều.
//
// 3. Stop loss, take profit & lọc tín hiệu (OpenOrder): SL đặt theo điểm swing gần nhất
//    (14 nến M1), nếu khoảng cách SL quá xa thì cap lại bằng InpSlSpacingDistance. TP đặt
//    cố định cách entry InpTakeProfitDistance (BUY: entry+giá trị, SELL: entry-giá trị).
//    Bỏ qua tín hiệu nếu ATR M1 quá thấp (<= 2) vì biên độ dao động không đủ để trade an toàn.
//
// 4. Không trailing stop: lệnh giữ nguyên SL/TP cố định đặt lúc OpenOrder() cho tới khi
//    đóng bởi TP/SL hoặc CloseAllPositions() (đảo chiều).
//
// 5. Volume: cố định = min lot của symbol nhân hệ số g_lotMultiplier (CalcOrderVolume),
//    không còn tăng vol theo chuỗi lệnh cùng hướng (tính năng này đã bị loại bỏ).
//
// 6. Phân tách lệnh bot / lệnh thủ công: mọi lệnh bot mở đều được gán InpMagicNumber
//    (trade.SetExpertMagicNumber trong OnInit). Mọi thao tác trail/đóng lệnh đều đi qua
//    IsBotPosition() để chỉ đụng tới lệnh có magic này, không đụng vào lệnh thủ công.
//    LƯU Ý quan trọng: cơ chế này chỉ đáng tin cậy trên tài khoản HEDGING. Trên tài
//    khoản NETTING, MT5 chỉ cho 1 position/symbol - nếu bot gửi lệnh (Buy/Sell) trong
//    lúc đang có lệnh thủ công trên cùng symbol, MT5 sẽ tự động gộp/netting 2 lệnh đó
//    làm một, có thể làm mất/đóng lệnh thủ công mà không đi qua IsBotPosition(). Cần
//    thêm bước kiểm tra "có lệnh không phải của bot đang mở trên symbol" trước khi gọi
//    trade.Buy/trade.Sell trong OpenOrder() để tránh rủi ro này trên tài khoản netting.
//
// 7. Thông báo: mọi sự kiện quan trọng (mở lệnh thành công/thất bại, tín hiệu bị bỏ qua
//    do ATR thấp, xuất không được) đều gửi qua Telegram (SendTelegram).
//
// 8. Giới hạn lãi/lỗ trong ngày (DailyLimitReached, gọi trong OpenOrder): tính tổng P/L
//    (đã chốt + đang mở) của bot trong ngày server hiện tại. Nếu lỗ >= InpDailyMaxLoss
//    ($40) hoặc lãi >= InpDailyMaxProfit ($100), bot NGỪNG mở lệnh mới cho đến hết ngày.
//    Lệnh đang mở KHÔNG bị đóng cưỡng bức - vẫn được CloseAllPositions quản lý bình thường
//    (không còn trailing), chỉ đường mở lệnh mới (OpenOrder) bị chặn.
//
// 9. Giới hạn lãi theo khung giờ (TimeWindowLimitReached, gọi trong OpenOrder, bổ sung
//    song song với mục 8 - không thay thế): 1 ngày chia làm 3 khung giờ server 00h-6h /
//    6h-12h / 12h-24h (GetTimeWindowIndex). Trong mỗi khung, nếu P/L (đã chốt trong khung
//    + đang mở) > InpTimeWindowMaxProfit ($30), bot NGỪNG mở lệnh mới đến khi sang khung
//    giờ kế tiếp. Vì luôn tính lại theo khung giờ hiện tại (không lưu trạng thái), ngưỡng
//    tự động "reset" khi giờ server bước sang khung mới. Lệnh đang mở không bị đóng.
//=============================================================================

