#property strict

#include <Trade\Trade.mqh>
CTrade g_trade;

//=============================================================================
// INPUTS
//=============================================================================
input string TelegramToken         = "8891635886:AAECxE0RuKhLthb0E5QmLesg_tF_zaQqSqs";
input string TelegramChatID        = "7383830655";

input int    InpRsiPeriod          = 14;   // RSI period
input int    InpMaFast             = 9;    // MA nhanh cua RSI
input int    InpMaSlow             = 45;   // MA cham cua RSI

//---- Khung thoi gian dong: chinh truc tiep tren Inputs, khong can sua code ----
input ENUM_TIMEFRAMES InpTF_Low     = PERIOD_H1;  // Khung THAP  (tin hieu chinh, xac dinh nen moi)
input ENUM_TIMEFRAMES InpTF_Medium  = PERIOD_H4;   // Khung TRUNG (loc xu huong)
input ENUM_TIMEFRAMES InpTF_High    = PERIOD_D1;   // Khung CAO   (loc xu huong lon)

// Ban sao cua input timeframe, dung de map handle (khong sua duoc trong runtime nhung tien tra cuu)
ENUM_TIMEFRAMES g_tfLow    = PERIOD_H1;
ENUM_TIMEFRAMES g_tfMedium = PERIOD_H4;
ENUM_TIMEFRAMES g_tfHigh   = PERIOD_D1;

//=============================================================================
// GLOBALS
//=============================================================================
string g_symbol           = Symbol();
string g_previousPosition = "NONE";
double g_tradeLotSize     = 0;
double g_lotMultiplier    = 1;
int    g_spacingSL        = 10;

bool g_hasBuy  = false;
bool g_hasSell = false;



// Handle chi bao (MT5 yeu cau tao handle) - dat ten theo LEVEL thay vi ten khung co dinh
int g_hRsiLow    = INVALID_HANDLE;  // tuong ung InpTF_Low
int g_hRsiMedium = INVALID_HANDLE;  // tuong ung InpTF_Medium
int g_hRsiHigh   = INVALID_HANDLE;  // tuong ung InpTF_High
int g_hAtrM1     = INVALID_HANDLE;
int g_hAdxM1     = INVALID_HANDLE;

//=============================================================================
// INIT
//=============================================================================
int OnInit()
{
   if (!MQLInfoInteger(MQL_TRADE_ALLOWED)) { Print("Trading not allowed!"); return INIT_FAILED; }

   // Luu lai timeframe tu input vao bien global de cac ham khac tra cuu
   g_tfLow    = InpTF_Low;
   g_tfMedium = InpTF_Medium;
   g_tfHigh   = InpTF_High;

   // Canh bao neu nguoi dung chon trung khung (vo tinh lam mat y nghia da khung)
   if (g_tfLow == g_tfMedium || g_tfLow == g_tfHigh || g_tfMedium == g_tfHigh)
      Print("CANH BAO: Cac khung Low/Medium/High dang trung nhau. Kiem tra lai Inputs.");

   double minLot = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
   g_tradeLotSize = NormalizeDouble(minLot, 2);

   g_hRsiLow    = iRSI(g_symbol, g_tfLow,    InpRsiPeriod, PRICE_CLOSE);
   g_hRsiMedium = iRSI(g_symbol, g_tfMedium, InpRsiPeriod, PRICE_CLOSE);
   g_hRsiHigh   = iRSI(g_symbol, g_tfHigh,   InpRsiPeriod, PRICE_CLOSE);
   g_hAtrM1     = iATR(g_symbol, PERIOD_M1,  14);
   g_hAdxM1     = iADX(g_symbol, PERIOD_M1,  14);

   if (g_hRsiLow == INVALID_HANDLE || g_hRsiMedium == INVALID_HANDLE ||
       g_hRsiHigh == INVALID_HANDLE || g_hAtrM1 == INVALID_HANDLE || g_hAdxM1 == INVALID_HANDLE)
   {
      Print("Indicator handle create failed");
      return INIT_FAILED;
   }

   PrintFormat("EA Initialized | TF Low=%s Medium=%s High=%s",
      EnumToString(g_tfLow), EnumToString(g_tfMedium), EnumToString(g_tfHigh));
   return INIT_SUCCEEDED;
}

//=============================================================================
// TELEGRAM
//=============================================================================
bool SendTelegram(string message)
{
   char post[], result[];
   string result_headers;
   string msg = "MACOS MT5 RSI-MA XAUUSD H1-H4-D1 %0A" + message;
   string url = "https://api.telegram.org/bot" + TelegramToken
              + "/sendMessage?chat_id=" + TelegramChatID
              + "&parse_mode=HTML"
              + "&text=" + msg;

   int res = WebRequest("GET", url, "", 5000, post, result, result_headers);
   if (res == -1)
   {
      Print("Telegram error: ", GetLastError());
      return false;
   }
   return true;
}

string TelegramMsg(string title, string entry, string sl, string dist, string swingPrice, string atr)
{
   double spread = (double)SymbolInfoInteger(Symbol(), SYMBOL_SPREAD) / 10.0;

   double adxArr[];
   ArraySetAsSeries(adxArr, true);
   CopyBuffer(g_hAdxM1, 0, 1, 1, adxArr);
   double adx = (ArraySize(adxArr) > 0) ? adxArr[0] : 0;

   return title + "%0A------------------%0A"
        + "Entry:  $" + entry      + "%0A"
        + "SL:     $" + sl         + "%0A"
        + "Dist:    " + dist        + "%0A"
        + "Swing:  $" + swingPrice  + "%0A"
        + "spread:    " + DoubleToString(spread, 1) + "%0A"
        + "adx:  $" + DoubleToString(adx, 2) + "%0A"
        + "ATR:     " + atr;
}

//=============================================================================
// HELPERS GIA / NEN
//=============================================================================
double Ask() { return SymbolInfoDouble(Symbol(), SYMBOL_ASK); }
double Bid() { return SymbolInfoDouble(Symbol(), SYMBOL_BID); }

datetime BarTime(ENUM_TIMEFRAMES tf, int shift)
{
   datetime t[];
   ArraySetAsSeries(t, true);
   if (CopyTime(g_symbol, tf, shift, 1, t) <= 0) return 0;
   return t[0];
}

double LowestLow(ENUM_TIMEFRAMES tf, int count, int startShift)
{
   double low[];
   ArraySetAsSeries(low, true);
   if (CopyLow(g_symbol, tf, startShift, count, low) <= 0) return 0;
   int idx = ArrayMinimum(low, 0, count);
   return low[idx];
}

double HighestHigh(ENUM_TIMEFRAMES tf, int count, int startShift)
{
   double high[];
   ArraySetAsSeries(high, true);
   if (CopyHigh(g_symbol, tf, startShift, count, high) <= 0) return 0;
   int idx = ArrayMaximum(high, 0, count);
   return high[idx];
}

double AtrM1Shift1()
{
   double atrArr[];
   ArraySetAsSeries(atrArr, true);
   CopyBuffer(g_hAtrM1, 0, 1, 1, atrArr);
   return (ArraySize(atrArr) > 0) ? atrArr[0] : 0;
}

//=============================================================================
// TICK
//=============================================================================
void OnTick()
{
   static datetime lastBarTime = 0;
   // Nen moi tinh theo khung THAP (g_tfLow) - truoc day hardcode PERIOD_M15
   datetime currentBarTime = BarTime(g_tfLow, 0);

   if (currentBarTime > lastBarTime)
   {
      lastBarTime = currentBarTime;
      ProcessSignal(1);
   }

   // --- Chi gui tin hieu, khong quan ly position ---
   /*
   for (int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if (ticket == 0) continue;
      if (!PositionSelectByTicket(ticket)) continue;
      TrailingStop(ticket);
      g_previousPosition = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "LONG" : "SHORT";
   }

   if (AccountInfoDouble(ACCOUNT_PROFIT) > g_lotMultiplier * 100)
      CloseAllPositions();
   */
}

//=============================================================================
// SIGNAL
//=============================================================================
int ProcessSignal(int shift)
{
   // Truoc day: IsRsiUp(PERIOD_M15/H1/H4, ...) hardcode
   // Bay gio: dung g_tfLow/g_tfMedium/g_tfHigh lay tu Inputs -> tuy chinh de dang
   bool upNow     = IsRsiUp  (g_tfLow, shift);
   bool upPrev    = IsRsiUp  (g_tfLow, shift + 1);
   bool downNow   = IsRsiDown(g_tfLow, shift);
   bool downPrev  = IsRsiDown(g_tfLow, shift + 1);

   bool upMedium   = IsRsiUp  (g_tfMedium, shift);
   bool downMedium = IsRsiDown(g_tfMedium, shift);

   bool upHigh     = IsRsiUp  (g_tfHigh, shift);
   bool downHigh   = IsRsiDown(g_tfHigh, shift);

   // --- Chi gui tin hieu, khong dao lenh ---
   // if (g_previousPosition == "SHORT" && upNow)   ManageAllOrders(POSITION_TYPE_SELL);
   // if (g_previousPosition == "LONG"  && downNow) ManageAllOrders(POSITION_TYPE_BUY);
   if (upNow  && g_hasSell)
   {
      // OpenOrder(POSITION_TYPE_BUY,  shift);
      SendTelegram("Close SELL %0A------------------%0A Close: " +   Ask());
      g_hasSell = false;
   }

   if (downNow  && g_hasBuy)
   {
      // OpenOrder(POSITION_TYPE_BUY,  shift);
      SendTelegram("Close BUY %0A------------------%0A Close: " +   Bid());
      g_hasBuy  = false;
   }


   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);

   if (dt.hour >= 21) return 1;
   if (dt.hour == 20 && dt.min >= 55)
   {
      datetime startOfDay = TimeCurrent() - (TimeCurrent() % 86400);
      if (GetProfitByTimeRange(startOfDay, TimeCurrent()) + AccountInfoDouble(ACCOUNT_PROFIT) > g_lotMultiplier * 100)
         return 1;
   }

   PrintFormat("UpNow(%s):%s UpPrev:%s UpMedium(%s):%s UpHigh(%s):%s",
      EnumToString(g_tfLow), (string)upNow, (string)upPrev,
      EnumToString(g_tfMedium), (string)upMedium,
      EnumToString(g_tfHigh), (string)upHigh);
   double atr = AtrM1Shift1();

   if (upNow   && upMedium   && upHigh   && !g_hasBuy)
   {
      // OpenOrder(POSITION_TYPE_BUY,  shift);
      SendTelegram("SIGNAL BUY %0A------------------%0A" + " Entry: " + Ask()  + " atr: " + atr  );
      g_hasBuy  = true;
   }
   if (downNow && downMedium && downHigh && !g_hasSell)
   {
      // OpenOrder(POSITION_TYPE_SELL, shift);
      SendTelegram("SIGNAL SELL %0A------------------%0A" + " Entry: " + Bid() + " atr: " + atr );
      g_hasSell = true;
   }


   return 0;
}

//=============================================================================
// OPEN ORDER  (khong dung trong che do signal-only)
//=============================================================================
/*
void OpenOrder(ENUM_POSITION_TYPE orderType, int shift)
{
   bool   isBuy      = (orderType == POSITION_TYPE_BUY);
   double entryPrice = isBuy ? Ask() : Bid();
   string label      = isBuy ? "Buy" : "Sell";

   double swingPrice = isBuy
      ? LowestLow (g_tfLow, 14, 1)
      : HighestHigh(g_tfLow, 14, 1);

   double sl   = swingPrice;
   double dist = MathAbs(entryPrice - sl);

   double atr = AtrM1Shift1();
   if (atr < 2.5){
    Print("atr < 3: ");
    SendTelegram("atr duoi 2.5" + DoubleToString(atr, 2));
    return  ;
    }

   if (dist < 3)
   {
      double fixedSL = isBuy ? entryPrice - 5 : entryPrice + 5;
      double fixedTP = isBuy ? entryPrice + 5 : entryPrice - 5;

      bool ok = isBuy
         ? g_trade.Buy(g_tradeLotSize, Symbol(), entryPrice, fixedSL, fixedTP, DoubleToString(atr, 2))
         : g_trade.Sell(g_tradeLotSize, Symbol(), entryPrice, fixedSL, fixedTP, DoubleToString(atr, 2));

      if (!ok) Print("Order failed: ", GetLastError());
      else
      {
         g_hasBuy  = isBuy;
         g_hasSell = !isBuy;

         SendTelegram(TelegramMsg(label + " (fixed 5)",
         DoubleToString(entryPrice, 2), DoubleToString(fixedSL, 2),
         DoubleToString(dist, 2),       DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)));

         return;
      }
   }

   if (dist > g_spacingSL) sl = isBuy ? entryPrice - g_spacingSL : entryPrice + g_spacingSL;

   bool sent = isBuy
      ? g_trade.Buy(g_tradeLotSize, Symbol(), entryPrice, sl, 0, DoubleToString(atr, 2))
      : g_trade.Sell(g_tradeLotSize, Symbol(), entryPrice, sl, 0, DoubleToString(atr, 2));

   if (!sent)
   {
      Print("Order failed: ", GetLastError());
      SendTelegram(TelegramMsg(label + " FAILED",
         DoubleToString(entryPrice, 2), DoubleToString(sl, 2),
         DoubleToString(dist, 2),       DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)));
      return;
   }

   ulong  ticket    = g_trade.ResultOrder();
   double openPrice = entryPrice;
   double openSL    = sl;
   if (PositionSelectByTicket(ticket))
   {
      openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      openSL    = PositionGetDouble(POSITION_SL);
   }

   SendTelegram(TelegramMsg(label + " OK",
      DoubleToString(openPrice, 2), DoubleToString(openSL, 2),
      DoubleToString(dist, 2),      DoubleToString(swingPrice, 2),
      DoubleToString(atr, 2)));

   g_hasBuy  = isBuy;
   g_hasSell = !isBuy;
   g_previousPosition = isBuy ? "LONG" : "SHORT";

   Print(label, " placed. Ticket: ", ticket);
}
*/

//=============================================================================
// TRAILING STOP  (khong dung trong che do signal-only)
//=============================================================================
/*
void TrailingStop(ulong ticket)
{
   if (!PositionSelectByTicket(ticket)) return;

   double sl      = PositionGetDouble(POSITION_SL);
   double entry   = PositionGetDouble(POSITION_PRICE_OPEN);
   bool   isBuy   = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
   double price   = isBuy ? Bid() : Ask();
   int    digits  = (int)SymbolInfoInteger(Symbol(), SYMBOL_DIGITS);
   double minStop = (double)SymbolInfoInteger(Symbol(), SYMBOL_TRADE_STOPS_LEVEL) * SymbolInfoDouble(Symbol(), SYMBOL_POINT);
   double risk    = MathAbs(entry - sl);

   double ratioRisk  = (risk >= g_spacingSL - 3) ? risk : risk * 1.5;
   int    positiveSL = (risk >= g_spacingSL) ? 4 : 2;

   double target = isBuy ? entry + ratioRisk : entry - ratioRisk;
   if (isBuy  && price < target) return;
   if (!isBuy && price > target) return;

   double newSL = NormalizeDouble(isBuy ? entry + positiveSL : entry - positiveSL, digits);
   if (isBuy  && (newSL <= NormalizeDouble(sl, digits) || Bid() - newSL < minStop)) return;
   if (!isBuy && (newSL >= NormalizeDouble(sl, digits) || newSL - Ask() < minStop)) return;

   if (g_trade.PositionModify(ticket, newSL, PositionGetDouble(POSITION_TP)))
      SendTelegram(TelegramMsg("Trailing " + (isBuy ? "BUY" : "SELL"),
         DoubleToString(entry, 2), DoubleToString(newSL, 2), "-", DoubleToString(sl, 2), "-"));
}
*/

//=============================================================================
// MANAGE ORDERS  (khong dung trong che do signal-only)
//=============================================================================
/*
void ManageAllOrders(ENUM_POSITION_TYPE omitType)
{
   for (int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if (ticket == 0) continue;
      if (!PositionSelectByTicket(ticket)) continue;

      ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      double threshold = MathAbs(PositionGetDouble(POSITION_PRICE_OPEN) - PositionGetDouble(POSITION_SL));

      if (PositionGetDouble(POSITION_PROFIT) > threshold)
      {
         g_trade.PositionClose(ticket);
         SendTelegram("Close%20Profit%3A%20" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2));
         continue;
      }

      if (type == omitType) continue;
   }
}

void CloseAllPositions()
{
   for (int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if (ticket == 0) continue;
      if (!PositionSelectByTicket(ticket)) continue;
      if (PositionGetString(POSITION_SYMBOL) != Symbol()) continue;

      if (!g_trade.PositionClose(ticket))
         { Print("Close failed. Ticket=", ticket, " Err=", GetLastError()); ResetLastError(); }
      else
         Print("Closed: ", ticket);
   }
}
*/

//=============================================================================
// PROFIT HISTORY  (van dung trong ProcessSignal -> giu nguyen)
//=============================================================================
double GetProfitByTimeRange(datetime startTime, datetime endTime)
{
   double total = 0;
   if (!HistorySelect(startTime, endTime)) return 0;

   int deals = HistoryDealsTotal();
   for (int i = 0; i < deals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if (dealTicket == 0) continue;
      datetime t = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      if (t >= startTime && t <= endTime)
         total += HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
                + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
                + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   }
   return total;
}

//=============================================================================
// RSI + MA(RSI) HELPERS
//=============================================================================
// Map tu ENUM_TIMEFRAMES sang handle tuong ung theo LEVEL (Low/Medium/High)
// Truoc day so sanh cung PERIOD_M15/H1/H4 -> neu doi input thi ham nay se "mu",
// nen phai so sanh voi bien global g_tfLow/g_tfMedium/g_tfHigh (gia tri thuc te dang dung).
int RsiHandle(ENUM_TIMEFRAMES tf)
{
   if (tf == g_tfLow)    return g_hRsiLow;
   if (tf == g_tfMedium) return g_hRsiMedium;
   if (tf == g_tfHigh)   return g_hRsiHigh;

   // Fallback: neu truyen vao mot khung khong nam trong 3 khung da cau hinh
   Print("CANH BAO: RsiHandle() nhan khung khong khop Low/Medium/High: ", EnumToString(tf));
   return g_hRsiLow;
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

   // SMA cua RSI
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
   //return (rsi > maFast && rsi > maSlow && maFast > maSlow);
   return (rsi > maFast && rsi > maSlow);
}

// RSI nam duoi ca MA9 va MA45
bool IsRsiDown(ENUM_TIMEFRAMES tf, int shift)
{
   double rsi, maFast, maSlow;
   GetRsiMa(tf, shift, rsi, maFast, maSlow);
   //return (rsi < maFast && rsi < maSlow && maFast < maSlow);
   return (rsi < maFast && rsi < maSlow);
}

//=============================================================================
// SWING HELPERS  (khong duoc goi trong che do signal-only)
//=============================================================================
/*
double FindHighest(int bars, int startShift)
{
   double high[];
   ArraySetAsSeries(high, true);
   if (CopyHigh(g_symbol, PERIOD_CURRENT, startShift, bars, high) <= 0) return 0;
   double val = high[0];
   for (int i = 0; i < bars; i++)
      if (high[i] > val) val = high[i];
   return val;
}

double FindLowest(int bars, int startShift)
{
   double low[];
   ArraySetAsSeries(low, true);
   if (CopyLow(g_symbol, PERIOD_CURRENT, startShift, bars, low) <= 0) return 0;
   double val = low[0];
   for (int i = 0; i < bars; i++)
      if (low[i] < val) val = low[i];
   return val;
}

string createComment(string label)
{
   double atr = AtrM1Shift1();
   return "ATR : " + DoubleToString(atr, 1);
}
*/