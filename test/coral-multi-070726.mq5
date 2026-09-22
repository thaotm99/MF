#property strict
#include <Trade\Trade.mqh>

// delete trailing stop, close after m1-14

//=============================================================================
// INPUTS
//=============================================================================
string InpCoralIndicatorName = "Coral-custom";
input string TelegramToken         = "8696728373:AAFmkD2bLCRM2XviVvBtaSY2HGaoV4iY5cE";
input string TelegramChatID        = "7383830655F";



//=============================================================================
// INPUTS (Xuất báo cáo CSV)
//=============================================================================
input int  InpExportHour        = 23;   // Giờ xuất báo cáo (giờ server MT5)
input bool InpExportOpenOrders  = true; // Ghi thêm cả lệnh đang mở (chưa đóng) không
input bool InpExportAllSymbols  = false;// false = chỉ ghi lệnh của symbol EA đang chạy

//=============================================================================
// INPUTS (Efficiency Ratio - do "hieu qua" xu huong gia tren 1 khung tf rieng, chi de
// tinh/hien thi/gui Telegram + ghi vao comment lenh, CHUA dung de loc tin hieu vao lenh)
//=============================================================================
input int             InpERPeriod   = 12;         // So nen dung tinh Efficiency Ratio
input ENUM_TIMEFRAMES InpERtf       = PERIOD_M5;   // Khung thoi gian tinh ER (doc lap voi Coral)
input int             InpERLookback = 300;         // So gia tri ER qua khu dung de xep hang
input double          InpERRank     = 0.50;        // Nguong tham khao (chua dung de loc lenh)
input int             InpSidewayNotifyCooldown = 1800;   // Giay toi thieu giua 2 lan gui canh bao sideway (ER thap) qua Telegram

//=============================================================================
// INPUTS (trailing stop)
//=============================================================================
 double InpTrailDistance       = 10.0;  // Khoảng cách bám SL khi đã ở vùng dương
input double InpTrailNotifyStep     = 3.0;  // Chỉ gửi Telegram khi SL đổi thêm >= giá trị này
input int    InpTrailNotifyCooldown = 30;   // Giây tối thiểu giữa 2 lần thông báo trailing



//=============================================================================
// GLOBALS
//=============================================================================
string   g_symbol           = _Symbol;
string   g_previousPosition = "NONE";
double   g_tradeLotSize     = 0;
double   g_lotMultiplier    = 1;
int      g_spacingSL        = 8;



datetime g_lastExportDay    = 0;
double   g_lastNotifiedSL   = 0;
datetime g_lastNotifyTime   = 0;



CTrade   trade;



int g_hATR_M1, g_hADX_M1;
int g_hCoralM1, g_hCoralM5, g_hCoralM15, g_hCoralM30, g_hCoralH1;

// Handle chi bao (MT5 yeu cau tao handle)
int g_hRsiM1 = INVALID_HANDLE;
int g_hRsiM5 = INVALID_HANDLE;
int g_hRsiM15= INVALID_HANDLE;
int g_hAtrM1 = INVALID_HANDLE;
int g_hAdxM1 = INVALID_HANDLE;



input int    InpRsiPeriod          = 14;   // RSI period
input int    InpMaFast             = 9;    // MA nhanh cua RSI
input int    InpMaSlow             = 45;   // MA cham cua RSI



//=============================================================================
// INIT
//=============================================================================
int OnInit()
{
    g_symbol = _Symbol; 
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) { Print("Trading not allowed!"); return 0; }



   g_tradeLotSize = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), 2) * g_lotMultiplier;
   trade.SetDeviationInPoints(500);



   g_hATR_M1   = iATR(_Symbol, PERIOD_M1, 14);
   g_hADX_M1   = iADX(_Symbol, PERIOD_M1, 14);
   
   g_hCoralM1  = iCustom(_Symbol, PERIOD_M1,  InpCoralIndicatorName, true, 14);
   g_hCoralM5  = iCustom(_Symbol, PERIOD_M5,  InpCoralIndicatorName, true, 14);
   g_hCoralM15 = iCustom(_Symbol, PERIOD_M15, InpCoralIndicatorName, true, 14);
   g_hCoralM30 = iCustom(_Symbol, PERIOD_M30, InpCoralIndicatorName, true, 14);
   g_hCoralH1  = iCustom(_Symbol, PERIOD_H1,  InpCoralIndicatorName, true, 14);
   
   g_hRsiM1  = iRSI(g_symbol, PERIOD_M1,  InpRsiPeriod, PRICE_CLOSE);
   g_hRsiM5  = iRSI(g_symbol, PERIOD_M5,  InpRsiPeriod, PRICE_CLOSE);
   g_hRsiM15 = iRSI(g_symbol, PERIOD_M15, InpRsiPeriod, PRICE_CLOSE);



   if(g_hATR_M1==INVALID_HANDLE || g_hADX_M1==INVALID_HANDLE ||
      g_hCoralM1==INVALID_HANDLE || g_hCoralM5==INVALID_HANDLE || g_hCoralM15==INVALID_HANDLE ||
      g_hCoralM30==INVALID_HANDLE || g_hCoralH1==INVALID_HANDLE)
   {
       Print("Indicator Coral handle create failed");
      return INIT_FAILED;
   }
   
   if (g_hRsiM1 == INVALID_HANDLE || g_hRsiM5 == INVALID_HANDLE || g_hRsiM15 == INVALID_HANDLE )
   {
      Print("Indicator RSI handle create failed");
      return INIT_FAILED;
   }



   Print("EA Initialized");
   



   return INIT_SUCCEEDED;
}



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
// TIME HELPERS (thay cho Hour()/Minute() của MQL4)
//=============================================================================
int Hour()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return dt.hour;
}



int Minute()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   return dt.min;
}



//=============================================================================
// TELEGRAM
//=============================================================================
bool SendTelegram(string message)
{
   char post[], result[];
   string headers;
   string msg = "Win MT5 %0A------------------%0A" + message;
   string url = "https://api.telegram.org/bot" + TelegramToken
              + "/sendMessage?chat_id=" + TelegramChatID
              + "&parse_mode=HTML"
              + "&text=" + msg;



   int res = WebRequest("GET", url, "", 5000, post, result, headers);
   if(res == -1)
   {
      Print("Telegram error: ", GetLastError());
      return false;
   }
   return true;
}



string TelegramMsg(string title, string entry, string sl, string dist, string swingPrice, string atr)
{
   double spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) / 10.0;



   double adxBuf[]; ArraySetAsSeries(adxBuf, true);
   double adx = 0;
   if(CopyBuffer(g_hADX_M1, 0, 1, 1, adxBuf) > 0) adx = adxBuf[0];
    bool upNowRSI    = IsRsiUp(PERIOD_M1, 1);
   bool downNowRSI  = IsRsiDown(PERIOD_M1, 1);
        double erK    = ERRank(InpERtf, InpERPeriod, InpERLookback);
   double er     = EfficiencyRatio(InpERtf, InpERPeriod, 1);
   string erKStr = DoubleToString(erK, 2);
   string erStr  = DoubleToString(er, 2);



   return title + "%0A------------------%0A"
        + "Entry:  $" + entry      + "%0A"
        + "SL:     $" + sl         + "%0A"
        + "Dist:    " + dist        + "%0A"
        + "Swing:  $" + swingPrice  + "%0A"
        + "spread:    " + DoubleToString(spread, 1) + "%0A"
        + "adx:  $" + DoubleToString(adx, 2)  + "%0A"
        + "ATR:     " + atr + "%0A"
        + "%0A upNowRSI: " + IntegerToString(upNowRSI) 
        + "%0A downNowRSI: " + IntegerToString(downNowRSI)
          + "%0A erKStr: " + IntegerToString(erKStr) 
        + "%0A erStr: " + IntegerToString(erStr);
}



//=============================================================================
// TICK
//=============================================================================
void OnTick()
{
   ExportDailyReport();
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
      TrailingStop(ticket);
      g_previousPosition = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "LONG" : "SHORT";
   }



  // if(AccountInfoDouble(ACCOUNT_PROFIT) > g_lotMultiplier * 100)
    //  CloseAllPositions();
}



//=============================================================================
// SIGNAL
//=============================================================================
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
   
   bool upNowRSI    = IsRsiUp(PERIOD_M1, 1);
   bool downNowRSI  = IsRsiDown(PERIOD_M1, 1);
   
  
  // if(g_previousPosition == "SHORT" && upNow)   ManageAllOrders((int)POSITION_TYPE_SELL);
   //if(g_previousPosition == "LONG"  && downNow) ManageAllOrders((int)POSITION_TYPE_BUY);
   
 if(g_previousPosition == "SHORT" && upNow)   CloseIfSLNotInProfit(POSITION_TYPE_SELL);
if(g_previousPosition == "LONG"  && downNow) CloseIfSLNotInProfit(POSITION_TYPE_BUY);



  // if(Hour() >= 21) return 1;
   if(Hour() == 20 && Minute() >= 55)
   {
      datetime startOfDay = TimeCurrent() - (TimeCurrent() % 86400);
      if(GetProfitByTimeRange(startOfDay, TimeCurrent()) + AccountInfoDouble(ACCOUNT_PROFIT) > g_lotMultiplier * 100)
         return 1;
   }



   Print("UpNow:", upNow, " UpPrev:", upPrev, " UpM5:", upM5, " UpM15:", upM15, " upNowRSI: ", upNowRSI, " downNowRSI: ", downNowRSI);



   if(upNow   && !upPrev   && upM5   && upM15)   OpenOrder((int)POSITION_TYPE_BUY,  shift);
   if(downNow && !downPrev && downM5 && downM15) OpenOrder((int)POSITION_TYPE_SELL, shift);



   return 0;
}



//=============================================================================
// OPEN ORDER
//=============================================================================
void OpenOrder(int orderType, int shift)
{
   bool   isBuy      = (orderType == (int)POSITION_TYPE_BUY);
   double entryPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   string label      = isBuy ? "Buy" : "Sell";



   int lowIdx  = iLowest(_Symbol,  PERIOD_M1, MODE_LOW,  14, 1);
   int highIdx = iHighest(_Symbol, PERIOD_M1, MODE_HIGH, 14, 1);
   double swingPrice = isBuy ? iLow(_Symbol, PERIOD_M1, lowIdx) : iHigh(_Symbol, PERIOD_M1, highIdx);



   double sl   = swingPrice;
   double dist = MathAbs(entryPrice - sl);



   double atrBuf[]; ArraySetAsSeries(atrBuf, true);
   if(CopyBuffer(g_hATR_M1, 0, 1, 1, atrBuf) <= 0) return;
   double atr = atrBuf[0];
   bool upNowRSI    = IsRsiUp(PERIOD_M1, shift);
   bool downNowRSI  = IsRsiDown(PERIOD_M1, shift);
     double erK    = ERRank(InpERtf, InpERPeriod, InpERLookback);
   double er     = EfficiencyRatio(InpERtf, InpERPeriod, 1);
   string erKStr = DoubleToString(erK, 2);
   string erStr  = DoubleToString(er, 2);


   if(atr < 2)
   {
      Print("atr < 3: ");
      SendTelegram("Signal: " + label + " %0A ATR: " + DoubleToString(atr, 2) + " %0A upNowRSI: " + IntegerToString(upNowRSI) + " %0A downNowRSI: " + IntegerToString(downNowRSI) ) + " %0A ek: " + erKStr + " %0A er: " + erStr;
      return;
   }



   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);



   // SL qua gan -> fixed +-5
   if(dist < 3)
   {
      double fixedSL = isBuy ? entryPrice - 5 : entryPrice + 5;
      double fixedTP = isBuy ? entryPrice + 5 : entryPrice - 5;
      bool ok = isBuy ? trade.Buy(g_tradeLotSize, _Symbol, entryPrice, fixedSL, fixedTP, label)
                      : trade.Sell(g_tradeLotSize, _Symbol, entryPrice, fixedSL, fixedTP, label);
      if(!ok) Print("Order failed: ", GetLastError());
      SendTelegram(TelegramMsg(label + " (fixed 5)",
         DoubleToString(entryPrice, 2), DoubleToString(fixedSL, 2),
         DoubleToString(dist, 2),       DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)));
      return;
   }



   // SL qua xa -> cap g_spacingSL
   if(dist > g_spacingSL) sl = isBuy ? entryPrice - g_spacingSL : entryPrice + g_spacingSL;



   string cmt = createComment(label);
   bool sent = isBuy ? trade.Buy(g_tradeLotSize, _Symbol, entryPrice, sl, 0, cmt)
                      : trade.Sell(g_tradeLotSize, _Symbol, entryPrice, sl, 0, cmt);



   if(!sent)
   {
      Print("Order failed: ", GetLastError());
      SendTelegram(TelegramMsg(label + " FAILED",
         DoubleToString(entryPrice, 2), DoubleToString(sl, 2),
         DoubleToString(dist, 2),       DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)));
      return;
   }



   if(PositionSelect(_Symbol))
   {
      SendTelegram(TelegramMsg(label + " OK",
         DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 2),
         DoubleToString(PositionGetDouble(POSITION_SL), 2),
         DoubleToString(dist, 2), DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)));
   }



   g_previousPosition = isBuy ? "LONG" : "SHORT";
   Print(label, " placed. Ticket: ", trade.ResultOrder());
}


//=============================================================================
// TRAILING STOP
//=============================================================================
void TrailingStop(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;

   double sl     = PositionGetDouble(POSITION_SL);
   double entry  = PositionGetDouble(POSITION_PRICE_OPEN);
   bool   isBuy  = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
   string symbol = PositionGetString(POSITION_SYMBOL);

   double bidNow = SymbolInfoDouble(symbol, SYMBOL_BID);
   double askNow = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double price  = isBuy ? bidNow : askNow;   // giá đóng lệnh hiện tại

   int    digits  = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double minStop = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL) * SymbolInfoDouble(symbol, SYMBOL_POINT);

   double profitDist = isBuy ? (price - entry) : (entry - price);  // lãi hiện tại (theo giá)
   bool   slAtOrAboveEntry = isBuy ? (sl >= entry) : (sl <= entry && sl != 0);

   double newSL = 0;

   // ----- GIAI DOAN 2: SL da >= entry -> trail theo 10 gia -----
   if(slAtOrAboveEntry)
   {
      newSL = isBuy ? NormalizeDouble(price - InpTrailDistance, digits)
                    : NormalizeDouble(price + InpTrailDistance, digits);

      // chi doi SL theo huong co loi
      if(isBuy  && newSL <= NormalizeDouble(sl, digits)) return;
      if(!isBuy && newSL >= NormalizeDouble(sl, digits)) return;

      // kiem tra stops level
      if(isBuy  && bidNow - newSL < minStop) return;
      if(!isBuy && newSL - askNow < minStop) return;
   }
   // ----- GIAI DOAN 1: lai >= 10 gia -> keo SL ve entry (breakeven) -----
   else if(profitDist >= InpTrailDistance)
   {
      newSL = NormalizeDouble(entry, digits);

      // SL moi phai tot hon SL hien tai
      if(isBuy  && newSL <= NormalizeDouble(sl, digits)) return;
      if(!isBuy && sl != 0 && newSL >= NormalizeDouble(sl, digits)) return;

      // kiem tra stops level
      if(isBuy  && bidNow - newSL < minStop) return;
      if(!isBuy && newSL - askNow < minStop) return;
   }
   else
   {
      return; // chua du dieu kien
   }

   if(!trade.PositionModify(ticket, newSL, PositionGetDouble(POSITION_TP))) return;

   // ----- Thong bao Telegram -----
   bool bigMove   = MathAbs(newSL - g_lastNotifiedSL) >= InpTrailNotifyStep;
   bool cooledOff = (TimeCurrent() - g_lastNotifyTime) >= InpTrailNotifyCooldown;

   if(bigMove && cooledOff)
   {
      SendTelegram(TelegramMsg("Trail " + (isBuy ? "BUY" : "SELL"),
         DoubleToString(entry, 2), DoubleToString(newSL, 2),
         "-", DoubleToString(sl, 2), "-"));
      g_lastNotifiedSL = newSL;
      g_lastNotifyTime = TimeCurrent();
   }
}
//=============================================================================
// Close cac lenh cung loai posType, NHUNG chi khi SL chua vao vung DUONG thuc su.
//   Giu lenh khi: BUY  -> sl > entry
//                 SELL -> sl < entry (va sl != 0)
//   Con lai (sl <= entry, gom ca sl == entry trailing lan 1, va sl == 0) -> close.
//
//   Khi giu lenh (da trailing): doi SL theo dinh/day 21 nen gan nhat,
//   chi doi theo huong siet chat hon SL hien tai.
//   Neu SL moi qua sat gia (vi pham stops level) -> close luon lenh.
//=============================================================================
void CloseIfSLNotInProfit(ENUM_POSITION_TYPE posType)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;

      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != posType) continue;

      double sl    = PositionGetDouble(POSITION_SL);
      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      bool   isBuy = (posType == POSITION_TYPE_BUY);

      // Chi giu lai khi SL da vuot han entry (vao vung duong thuc su)
      bool slInProfit = isBuy ? (sl > entry) : (sl != 0 && sl < entry);
      if(slInProfit)
      {
         // ----- Da trailing -> doi SL theo dinh/day 21 nen gan nhat -----
         int    digits  = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
         double minStop = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * SymbolInfoDouble(_Symbol, SYMBOL_POINT);
         double newSL;

         if(isBuy)
         {
            int    lowIdx = iLowest(_Symbol, PERIOD_M1, MODE_LOW, 21, 1);
            newSL = NormalizeDouble(iLow(_Symbol, PERIOD_M1, lowIdx), digits);

            // chi xu ly khi SL moi siet chat hon (cao hon SL hien tai)
            if(newSL > NormalizeDouble(sl, digits))
            {
               double bidNow = SymbolInfoDouble(_Symbol, SYMBOL_BID);

               if(bidNow - newSL >= minStop)
               {
                  // Hop le -> doi SL
                  if(trade.PositionModify(ticket, newSL, PositionGetDouble(POSITION_TP)))
                     Print("Dao chieu (BUY) -> siet SL theo day 21 nen: ", DoubleToString(newSL, digits), " Ticket=", ticket);
               }
               else
               {
                  // SL moi qua sat gia -> khong set duoc -> close luon
                  Print("Dao chieu (BUY) -> SL 21 nen qua sat gia (vi pham stops level) -> CLOSE. Ticket=", ticket);
                  if(!trade.PositionClose(ticket))
                     { Print("Close failed. Ticket=", ticket, " Err=", GetLastError()); ResetLastError(); }
               }
            }
         }
         else
         {
            int    highIdx = iHighest(_Symbol, PERIOD_M1, MODE_HIGH, 21, 1);
            newSL = NormalizeDouble(iHigh(_Symbol, PERIOD_M1, highIdx), digits);

            // chi xu ly khi SL moi siet chat hon (thap hon SL hien tai)
            if(newSL < NormalizeDouble(sl, digits))
            {
               double askNow = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

               if(newSL - askNow >= minStop)
               {
                  // Hop le -> doi SL
                  if(trade.PositionModify(ticket, newSL, PositionGetDouble(POSITION_TP)))
                     Print("Dao chieu (SELL) -> siet SL theo dinh 21 nen: ", DoubleToString(newSL, digits), " Ticket=", ticket);
               }
               else
               {
                  // SL moi qua sat gia -> khong set duoc -> close luon
                  Print("Dao chieu (SELL) -> SL 21 nen qua sat gia (vi pham stops level) -> CLOSE. Ticket=", ticket);
                  if(!trade.PositionClose(ticket))
                     { Print("Close failed. Ticket=", ticket, " Err=", GetLastError()); ResetLastError(); }
               }
            }
         }

         continue;   // da trailing -> khong close theo nhanh duoi
      }

      // SL <= entry -> close binh thuong
      if(!trade.PositionClose(ticket))
         { Print("Close failed. Ticket=", ticket, " Err=", GetLastError()); ResetLastError(); }
      else
         Print("Closed (SL <= entry). Ticket=", ticket);
   }
}
//=============================================================================
// MANAGE ORDERS
//=============================================================================
void ManageAllOrders(int omitType)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;



      string symbol   = PositionGetString(POSITION_SYMBOL);
      double closeSide = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                          ? SymbolInfoDouble(symbol, SYMBOL_BID)
                          : SymbolInfoDouble(symbol, SYMBOL_ASK);
      double threshold = MathAbs(PositionGetDouble(POSITION_PRICE_OPEN) - PositionGetDouble(POSITION_SL));
      double profitVal = PositionGetDouble(POSITION_PROFIT);



      if(profitVal > threshold)
      {
         trade.PositionClose(ticket);
         SendTelegram("Close%20Profit%3A%20" + DoubleToString(profitVal, 2));
         continue;
      }



      if(PositionGetInteger(POSITION_TYPE) == omitType) continue;
   }
}



void CloseAllPositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;



      string symbol = PositionGetString(POSITION_SYMBOL);
      if(symbol != _Symbol) continue;



      if(!trade.PositionClose(ticket))
         { Print("Close failed. Ticket=", ticket, " Err=", GetLastError()); ResetLastError(); }
      else
         Print("Closed: ", ticket);
   }
}



//=============================================================================
// PROFIT HISTORY
//=============================================================================
double GetProfitByTimeRange(datetime startTime, datetime endTime)
{
   double total = 0;
   if(!HistorySelect(startTime, endTime)) return total;



   int totalDeals = HistoryDealsTotal();
   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      total += HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
             + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
             + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   }
   return total;
}



//=============================================================================
// CORAL HELPERS
//=============================================================================
int GetCoralHandle(ENUM_TIMEFRAMES tf)
{
   switch(tf)
   {
      case PERIOD_M1:  return g_hCoralM1;
      case PERIOD_M5:  return g_hCoralM5;
      case PERIOD_M15: return g_hCoralM15;
      case PERIOD_M30: return g_hCoralM30;
      case PERIOD_H1:  return g_hCoralH1;
      default: return INVALID_HANDLE;
   }
}



bool IsCoralUp(ENUM_TIMEFRAMES tf, int shift)
{
   int handle = GetCoralHandle(tf);
   double buf[]; ArraySetAsSeries(buf, true);
   if(CopyBuffer(handle, 1, shift, 1, buf) <= 0) return false;
   return buf[0] != EMPTY_VALUE;
}



bool IsCoralDown(ENUM_TIMEFRAMES tf, int shift)
{
   int handle = GetCoralHandle(tf);
   double buf[]; ArraySetAsSeries(buf, true);
   if(CopyBuffer(handle, 2, shift, 1, buf) <= 0) return false;
   return buf[0] != EMPTY_VALUE;
}



//=============================================================================
// SWING HELPERS
//=============================================================================
double FindHighest(int bars, int startShift)
{
   double val = iHigh(_Symbol, PERIOD_CURRENT, startShift);
   for(int i = startShift; i < startShift + bars; i++)
   {
      double h = iHigh(_Symbol, PERIOD_CURRENT, i);
      if(h > val) val = h;
   }
   return val;
}



double FindLowest(int bars, int startShift)
{
   double val = iLow(_Symbol, PERIOD_CURRENT, startShift);
   for(int i = startShift; i < startShift + bars; i++)
   {
      double l = iLow(_Symbol, PERIOD_CURRENT, i);
      if(l < val) val = l;
   }
   return val;
}



string createComment(string label)
{
   double atrBuf[]; ArraySetAsSeries(atrBuf, true);
   double atr = 0;
   if(CopyBuffer(g_hATR_M1, 0, 1, 1, atrBuf) > 0) atr = atrBuf[0];
    double erK    = ERRank(InpERtf, InpERPeriod, InpERLookback);
   double er     = EfficiencyRatio(InpERtf, InpERPeriod, 1);
   string erKStr = DoubleToString(erK, 2);
   string erStr  = DoubleToString(er, 2);


   return "ATR : " + DoubleToString(atr, 1)+ ", ek: " + erKStr + ", er: " + erStr;
}



string TradeTypeToStr(int type)
{
   if(type == 0) return "BUY";   // POSITION_TYPE_BUY / DEAL_TYPE_BUY
   if(type == 1) return "SELL";  // POSITION_TYPE_SELL / DEAL_TYPE_SELL
   return "UNKNOWN";
}



//=============================================================================
// EXPORT CSV
//=============================================================================
void ExportDailyReport()
{



   datetime today = TimeCurrent() - (TimeCurrent() % 86400);
   if(today == g_lastExportDay) return;   // hôm nay xuất rồi



   if(Hour() < InpExportHour) return;     // chưa tới giờ





   string dateStr = TimeToString(TimeCurrent(), TIME_DATE);
   StringReplace(dateStr, ".", "-");
   string fileName = "DailyReport_" + _Symbol + "_" + dateStr + ".csv";



   int handle = FileOpen(fileName, FILE_CSV|FILE_WRITE, ',');
   if(handle == INVALID_HANDLE)
   {
      Print("Khong tao duoc file CSV, err=", GetLastError());
      return;
   }



   FileWrite(handle,
      "Ticket","Symbol","Type","Lots","OpenTime","OpenPrice",
      "StopLoss","TakeProfit","CloseTime","ClosePrice",
      "Commission","Swap","Profit","MagicNumber","Comment");



   datetime startOfDay = today;
   datetime endOfDay   = today + 86400 - 1;



   // ----- Lệnh đã đóng trong ngày -----
   HistorySelect(startOfDay, endOfDay);
   int totalDeals = HistoryDealsTotal();
   ulong dealTickets[];
   ArrayResize(dealTickets, totalDeals);
   for(int i = 0; i < totalDeals; i++) dealTickets[i] = HistoryDealGetTicket(i);



   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = dealTickets[i];
      if(dealTicket == 0) continue;



      ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT) continue; // chỉ lấy các deal đóng lệnh



      string dealSymbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      if(!InpExportAllSymbols && dealSymbol != _Symbol) continue;



      long dealTypeRaw = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      if(dealTypeRaw != DEAL_TYPE_BUY && dealTypeRaw != DEAL_TYPE_SELL) continue; // bỏ qua deposit/withdrawal



      long posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);



      // Tìm deal mở lệnh (DEAL_ENTRY_IN) tương ứng để lấy OpenPrice/OpenTime/OpenType
      double   openPrice   = 0;
      datetime openTime    = 0;
      long     openTypeRaw = -1;
      if(HistorySelectByPosition(posId))
      {
         int n = HistoryDealsTotal();
         for(int k = 0; k < n; k++)
         {
            ulong dt = HistoryDealGetTicket(k);
            if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(dt, DEAL_ENTRY) == DEAL_ENTRY_IN)
            {
               openPrice   = HistoryDealGetDouble(dt, DEAL_PRICE);
               openTime    = (datetime)HistoryDealGetInteger(dt, DEAL_TIME);
               openTypeRaw = HistoryDealGetInteger(dt, DEAL_TYPE);
               break;
            }
         }
      }
      HistorySelect(startOfDay, endOfDay); // khôi phục phạm vi lịch sử cho vòng lặp ngoài



      ulong  closingOrderId = HistoryDealGetInteger(dealTicket, DEAL_ORDER);
      double slVal = 0, tpVal = 0;
      if(HistoryOrderSelect(closingOrderId))
      {
         slVal = HistoryOrderGetDouble(closingOrderId, ORDER_SL);
         tpVal = HistoryOrderGetDouble(closingOrderId, ORDER_TP);
      }



      int digitsSym = (int)SymbolInfoInteger(dealSymbol, SYMBOL_DIGITS);



      FileWrite(handle,
         posId, dealSymbol, TradeTypeToStr((int)openTypeRaw),
         DoubleToString(HistoryDealGetDouble(dealTicket, DEAL_VOLUME), 2),
         TimeToString(openTime, TIME_DATE|TIME_SECONDS),
         DoubleToString(openPrice, digitsSym),
         DoubleToString(slVal, digitsSym),
         DoubleToString(tpVal, digitsSym),
         TimeToString((datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME), TIME_DATE|TIME_SECONDS),
         DoubleToString(HistoryDealGetDouble(dealTicket, DEAL_PRICE), digitsSym),
         DoubleToString(HistoryDealGetDouble(dealTicket, DEAL_COMMISSION), 2),
         DoubleToString(HistoryDealGetDouble(dealTicket, DEAL_SWAP), 2),
         DoubleToString(HistoryDealGetDouble(dealTicket, DEAL_PROFIT), 2),
         HistoryDealGetInteger(dealTicket, DEAL_MAGIC),
         HistoryDealGetString(dealTicket, DEAL_COMMENT));
   }



   // ----- Lệnh đang mở (tuỳ chọn) -----
   if(InpExportOpenOrders)
   {
      int totalOpen = PositionsTotal();
      for(int j = 0; j < totalOpen; j++)
      {
         ulong ticket = PositionGetTicket(j);
         if(ticket == 0) continue;



         string posSymbol = PositionGetString(POSITION_SYMBOL);
         if(!InpExportAllSymbols && posSymbol != _Symbol) continue;



         int posType = (int)PositionGetInteger(POSITION_TYPE);
         double curPrice = (posType == POSITION_TYPE_BUY)
                            ? SymbolInfoDouble(posSymbol, SYMBOL_BID)
                            : SymbolInfoDouble(posSymbol, SYMBOL_ASK);
         int digitsPos = (int)SymbolInfoInteger(posSymbol, SYMBOL_DIGITS);



         FileWrite(handle,
            ticket, posSymbol, TradeTypeToStr(posType) + "(OPEN)",
            DoubleToString(PositionGetDouble(POSITION_VOLUME), 2),
            TimeToString((datetime)PositionGetInteger(POSITION_TIME), TIME_DATE|TIME_SECONDS),
            DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), digitsPos),
            DoubleToString(PositionGetDouble(POSITION_SL), digitsPos),
            DoubleToString(PositionGetDouble(POSITION_TP), digitsPos),
            "-", DoubleToString(curPrice, digitsPos),
            DoubleToString(0.0, 2),
            DoubleToString(PositionGetDouble(POSITION_SWAP), 2),
            DoubleToString(PositionGetDouble(POSITION_PROFIT), 2),
            PositionGetInteger(POSITION_MAGIC),
            PositionGetString(POSITION_COMMENT));
      }
   }



   FileClose(handle);
   g_lastExportDay = today;



   SendTelegram("Da xuat bao cao CSV ngay " + TimeToString(TimeCurrent(), TIME_DATE));
   Print("Da xuat file: ", fileName);
}





//=============================================================================
// RSI + MA(RSI) HELPERS
//=============================================================================
int RsiHandle(ENUM_TIMEFRAMES tf)
{
   if (tf == PERIOD_M1)  return g_hRsiM1;
   if (tf == PERIOD_M5)  return g_hRsiM5;
   if (tf == PERIOD_M15) return g_hRsiM15;
   return g_hRsiM1;
}



// Lay gia tri RSI, MA9(RSI), MA45(RSI) tai mot shift cua khung tf
void GetRsiMa(ENUM_TIMEFRAMES tf, int shift, double &rsi, double &maFast, double &maSlow)
{
   int need = InpMaSlow + shift + 5;



   double rsiBuf[];
   ArraySetAsSeries(rsiBuf, true);
   if (CopyBuffer(RsiHandle(tf), 0, 0, need, rsiBuf) <= 0)
   {
      rsi = 0; maFast = 0; maSlow = 0;
      return;
   }



   rsi = rsiBuf[shift];



   // SMA cua RSI (thay cho iMAOnArray MODE_SMA)
   double sumF = 0;
   for (int i = shift; i < shift + InpMaFast; i++) sumF += rsiBuf[i];
   maFast = sumF / InpMaFast;



   double sumS = 0;
   for (int j = shift; j < shift + InpMaSlow; j++) sumS += rsiBuf[j];
   maSlow = sumS / InpMaSlow;
}



// RSI nam tren ca MA9 va MA45
bool IsRsiUp(ENUM_TIMEFRAMES tf, int shift)
{
   double rsi, maFast, maSlow;
   GetRsiMa(tf, shift, rsi, maFast, maSlow);
   return (rsi > maFast && rsi > maSlow && maFast > maSlow);
}



// RSI nam duoi ca MA9 va MA45
bool IsRsiDown(ENUM_TIMEFRAMES tf, int shift)
{
   double rsi, maFast, maSlow;
   GetRsiMa(tf, shift, rsi, maFast, maSlow);
   return (rsi < maFast && rsi < maSlow && maFast < maSlow);
}
//=============================================================================
// EFFICIENCY RATIO (ER) - do "hieu qua" cua xu huong gia: bien dong gia thuc te (disp) so
// voi tong quang duong di cua gia (path) trong "period" nen gan nhat. ER cang gan 1 nghia
// la gia di thang mot mach (trending manh), cang gan 0 nghia la gia di ngang (sideway/nhieu).
//=============================================================================
// Tinh ER tai 1 shift, tren khung thoi gian InpERtf (doc lap voi Coral M1/M5/M15).
// Tra ve -1.0 neu tham so khong hop le (period<2, shift<0) hoac khong du du lieu/gia di
// ngang tuyet doi (path<=0) - dong nhat 1 sentinel "khong dung duoc" cho moi truong hop.
double EfficiencyRatio(ENUM_TIMEFRAMES tf, int period, int shift)
{
   if(period < 2 || shift < 0) return -1.0;

   double c[];
   ArraySetAsSeries(c, true);
   if(CopyClose(_Symbol, tf, shift, period + 1, c) < period + 1) return -1.0;
   double disp = MathAbs(c[0] - c[period]);
   double path = 0.0;
   for(int i = 0; i < period; i++) path += MathAbs(c[i] - c[i + 1]);
   return (path > 0.0) ? disp / path : -1.0;
}

// Xep hang ER hien tai (shift=1) so voi "lookback" gia tri ER cua cac cua so truot qua khu
// tren cung khung thoi gian: tra ve ty le cac gia tri ER qua khu THAP HON ER hien tai (0..1).
// ERRank cang cao nghia la ER hien tai dang "hieu qua"/trending hon phan lon lich su gan day.
// Tra ve -1.0 neu khong du du lieu (chua dung de loc tin hieu, chi de bao cao).
double ERRank(ENUM_TIMEFRAMES tf, int period, int lookback)
{
   double cur = EfficiencyRatio(tf, period, 1);
   if(cur < 0) return -1.0;

   double c[];
   ArraySetAsSeries(c, true);
   int need = lookback + period + 2;
   if(CopyClose(_Symbol, tf, 0, need, c) < need) return -1.0;

   int below = 0, valid = 0;
   for(int s = 1; s <= lookback; s++)
   {
      double disp = MathAbs(c[s] - c[s + period]);
      double path = 0.0;
      for(int i = s; i < s + period; i++) path += MathAbs(c[i] - c[i + 1]);
      if(path <= 0.0) continue;
      valid++;
      if(disp / path < cur) below++;
   }
   return (valid > 0) ? (double)below / valid : -1.0;
}
