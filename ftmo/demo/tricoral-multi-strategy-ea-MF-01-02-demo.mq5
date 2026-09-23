#property strict
#include <Trade\Trade.mqh>

// EA gop 2 chien luoc Tricoral (MF_01, MF_02) vao 1 file. Moi chien luoc la 1 "config"
// bat/tat doc lap qua Inp<MaCode>_Enabled, co magic + volume + comment rieng, chay dong
// thoi tren cung symbol khong dung nhau. Nguon goc tung chien luoc:
//   MF_01 <- mt5/releases/tricoral-multi-timeframe-ea-MF01.mq5
//   MF_02 <- test/tricoral-multi-timeframe-ea-MF02-27082026.mq5   (+ RSI/SMA filter)
//
// LUU Y TRIEN KHAI: neu tai khoan dang co lenh mo tu ban EA rieng le cu (comment "ATR : x.x"),
// EA nay se KHONG nhan dien duoc cac lenh do (comment prefix da doi thanh ma chien luoc,
// vd "MF_01"). Nen dong het lenh bot cu truoc khi thay EA.

//=============================================================================
// INPUTS (dung chung cho ca 2 chien luoc)
//=============================================================================
 string InpCoralIndicatorName = "Coral-custom";
 string InpTelegramToken         = "8696728373:AAFmkD2bLCRM2XviVvBtaSY2HGaoV4iY5cE";
 string InpTelegramChatID        = "-5336699036"; //  MTMO

input double InpTrailNotifyStep     = 3.0;  // Chi gui Telegram khi SL doi them >= gia tri nay
input int    InpTrailNotifyCooldown = 30;   // Giay toi thieu giua 2 lan thong bao trailing (dung chung moi chien luoc)
input int    InpTrailModifyCooldown = 2;    // Giay toi thieu giua 2 lan THUC SU gui lenh sua SL len san (dung chung moi chien luoc, tach biet - khong lien quan thoi gian gui Telegram)

//=============================================================================
// INPUTS (Efficiency Ratio - do "hieu qua" xu huong gia tren 1 khung tf rieng, dung chung
// ca 2 chien luoc; chi de tinh/hien thi/gui Telegram + ghi vao comment lenh, CHUA dung de
// loc tin hieu vao lenh)
//=============================================================================
input int             InpERPeriod   = 12;         // So nen dung tinh Efficiency Ratio
input ENUM_TIMEFRAMES InpERtf       = PERIOD_M5;   // Khung thoi gian tinh ER (doc lap voi Coral)
input int             InpERLookback = 300;         // So gia tri ER qua khu dung de xep hang
input double          InpERRank     = 0.50;        // Nguong tham khao (chua dung de loc lenh)
input int             InpSidewayNotifyCooldown = 1800;   // Giay toi thieu giua 2 lan gui canh bao sideway (ER thap) qua Telegram, dung chung ca 2 chien luoc

//=============================================================================
// MF_01 - Coral 3TF thuan, dong het lenh bot khi M1 dao chieu, trailing 2 giai doan
//=============================================================================
input group "=== MF_01 ==="
input bool   InpMF01_Enabled             = true;
input long   InpMF01_Magic               = 20250806;
input double InpMF01_VolMultiplier       = 1;    // vol lenh = min_lot * he so nay
input double InpMF01_SlSpacingDistance   = 8;    // Khoang cach SL toi da tinh tu entry (theo gia)
input double InpMF01_TakeProfitDistance  = 50;   // Khoang cach TP tinh tu entry (theo gia)
input double InpMF01_TrailDistance       = 10;   // Muc lai de breakeven, cung la khoang cach bam SL giai doan 2
input double InpMF01_DailyMaxLoss        = 40;   // Lo toi da trong ngay ($)
input double InpMF01_DailyMaxProfit      = 100;  // Lai toi da trong ngay ($)
input double InpMF01_TimeWindowMaxProfit = 30;   // Lai toi da trong 1 khung gio ($)

//=============================================================================
// MF_02 - Coral 3TF + RSI(9)/SMA(9,45) filter, dong het lenh khi M1 dao chieu, trailing 2 giai doan
//=============================================================================
input group "=== MF_02 ==="
input bool   InpMF02_Enabled             = true;
input long   InpMF02_Magic               = 20250807;
input double InpMF02_VolMultiplier       = 1;
input double InpMF02_SlSpacingDistance   = 8;
input double InpMF02_TakeProfitDistance  = 50;
input double InpMF02_TrailDistance       = 10;
input double InpMF02_DailyMaxLoss        = 40;
input double InpMF02_DailyMaxProfit      = 100;
input double InpMF02_TimeWindowMaxProfit = 30;
input int    InpMF02_RsiPeriod           = 9;    // RSI period (M1)
input int    InpMF02_MaFast              = 9;    // SMA nhanh cua RSI ("ema9") - thuc chat la SMA, khong phai EMA that
input int    InpMF02_MaSlow              = 45;   // SMA cham cua RSI ("ema45") - thuc chat la SMA, khong phai EMA that

//=============================================================================
// STRATEGY CONFIG
//=============================================================================
struct StrategyConfig
{
   string          code;                 // "MF_01"/"MF_02" - dung lam prefix comment lenh
   bool            enabled;
   long            magic;
   double          volMultiplier;        // he so nhan vol (min_lot * he so); dong thoi nhan vao nguong daily/time-window
   bool            useRsiFilter;
   double          slSpacingDistance;
   double          takeProfitDistance;
   double          trailDistance;
   double          dailyMaxLoss;
   double          dailyMaxProfit;
   double          timeWindowMaxProfit;
   // runtime state:
   string          previousPosition;     // "NONE"/"LONG"/"SHORT"
};

StrategyConfig g_strategies[2];

//=============================================================================
// GLOBALS
//=============================================================================
double   g_tradeLotSize   = 0;

double   g_lastNotifiedSL = 0;
datetime g_lastNotifyTime = 0;
datetime g_lastModifyTime = 0;   // lan gan nhat THUC SU gui lenh sua SL len san (throttle InpTrailModifyCooldown, dung chung moi chien luoc)
datetime g_lastSidewayNotifyTime = 0;   // lan gan nhat gui canh bao sideway (throttle InpSidewayNotifyCooldown, dung chung moi chien luoc)

CTrade   trade;

int g_hATR_M1, g_hADX_M1, g_hRsiM1;
int g_hCoralM1, g_hCoralM5, g_hCoralM15;

//=============================================================================
// INIT
//=============================================================================
// Do input vao mang g_strategies[] - goi 1 lan trong OnInit
void BuildStrategies()
{
   g_strategies[0].code                = "MF_01";
   g_strategies[0].enabled             = InpMF01_Enabled;
   g_strategies[0].magic               = InpMF01_Magic;
   g_strategies[0].volMultiplier       = InpMF01_VolMultiplier;
   g_strategies[0].useRsiFilter        = false;
   g_strategies[0].slSpacingDistance   = InpMF01_SlSpacingDistance;
   g_strategies[0].takeProfitDistance  = InpMF01_TakeProfitDistance;
   g_strategies[0].trailDistance       = InpMF01_TrailDistance;
   g_strategies[0].dailyMaxLoss        = InpMF01_DailyMaxLoss;
   g_strategies[0].dailyMaxProfit      = InpMF01_DailyMaxProfit;
   g_strategies[0].timeWindowMaxProfit = InpMF01_TimeWindowMaxProfit;
   g_strategies[0].previousPosition    = "NONE";

   g_strategies[1].code                = "MF_02";
   g_strategies[1].enabled             = InpMF02_Enabled;
   g_strategies[1].magic               = InpMF02_Magic;
   g_strategies[1].volMultiplier       = InpMF02_VolMultiplier;
   g_strategies[1].useRsiFilter        = true;
   g_strategies[1].slSpacingDistance   = InpMF02_SlSpacingDistance;
   g_strategies[1].takeProfitDistance  = InpMF02_TakeProfitDistance;
   g_strategies[1].trailDistance       = InpMF02_TrailDistance;
   g_strategies[1].dailyMaxLoss        = InpMF02_DailyMaxLoss;
   g_strategies[1].dailyMaxProfit      = InpMF02_DailyMaxProfit;
   g_strategies[1].timeWindowMaxProfit = InpMF02_TimeWindowMaxProfit;
   g_strategies[1].previousPosition    = "NONE";
}

// Khoi tao EA: setup CTrade, tao handle chi bao dung chung (ATR/ADX/RSI/Coral M1-M5-M15), do config 2 chien luoc
int OnInit()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) { Print("Auto trading is disabled in terminal - EA init aborted"); return 0; }

   // Canh bao neu tai khoan khong o che do HEDGING: co che tach lenh theo magic+comment
   // (IsBotPosition) chi dang tin cay tren HEDGING. Tren NETTING/EXCHANGE, cac lenh cung
   // huong tren cung symbol bi MT5 tu dong gop lam 1 position, TP/SL cua lenh moi khong
   // duoc ap dung rieng (giu nguyen TP/SL cua position da gop) - xem readme.md.
   ENUM_ACCOUNT_MARGIN_MODE marginMode = (ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE);
   if(marginMode != ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
   {
      string modeStr = (marginMode == ACCOUNT_MARGIN_MODE_RETAIL_NETTING) ? "NETTING" : "EXCHANGE";
      Print("CANH BAO: tai khoan dang o che do ", modeStr, ", khong phai HEDGING - lenh cung huong tren cung symbol se bi MT5 gop lam 1 position, TP/SL co the sai voi tung chien luoc.");
      SendTelegram("CANH BAO: Account " + _Symbol + " dang o che do " + modeStr + " (khong phai HEDGING) - lenh cua cac chien luoc co the bi gop sai TP/SL!");
   }

   g_tradeLotSize = NormalizeDouble(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), 2);
   trade.SetDeviationInPoints(500);

   BuildStrategies();

   g_hATR_M1  = iATR(_Symbol, PERIOD_M1, 14);
   g_hADX_M1  = iADX(_Symbol, PERIOD_M1, 14);
   g_hRsiM1   = iRSI(_Symbol, PERIOD_M1, InpMF02_RsiPeriod, PRICE_CLOSE);

   g_hCoralM1  = iCustom(_Symbol, PERIOD_M1,  InpCoralIndicatorName, true, 14);
   g_hCoralM5  = iCustom(_Symbol, PERIOD_M5,  InpCoralIndicatorName, true, 14);
   g_hCoralM15 = iCustom(_Symbol, PERIOD_M15, InpCoralIndicatorName, true, 14);

   if(g_hATR_M1==INVALID_HANDLE || g_hADX_M1==INVALID_HANDLE || g_hRsiM1==INVALID_HANDLE ||
      g_hCoralM1==INVALID_HANDLE || g_hCoralM5==INVALID_HANDLE || g_hCoralM15==INVALID_HANDLE)
   {
      Print("Failed to create ATR/ADX/RSI/Coral indicator handle(s) for ", _Symbol);
      return INIT_FAILED;
   }

   int enabledCount = 0;
   for(int s = 0; s < ArraySize(g_strategies); s++)
      if(g_strategies[s].enabled) enabledCount++;

   Print("EA initialized on ", _Symbol, ", strategies enabled: ", enabledCount, "/", ArraySize(g_strategies));

   return INIT_SUCCEEDED;
}

// Giai phong toan bo handle chi bao da tao trong OnInit khi EA go bo
void OnDeinit(const int reason)
{
   IndicatorRelease(g_hATR_M1);
   IndicatorRelease(g_hADX_M1);
   IndicatorRelease(g_hRsiM1);
   IndicatorRelease(g_hCoralM1);
   IndicatorRelease(g_hCoralM5);
   IndicatorRelease(g_hCoralM15);
}

//=============================================================================
// MAGIC HELPER: kiem tra lenh dang chon co phai cua chien luoc s khong
//   (goi sau khi da PositionSelect / PositionSelectByTicket / PositionGetTicket)
//=============================================================================
bool IsBotPosition(int s)
{
   if(PositionGetString(POSITION_SYMBOL) != _Symbol) return false;
   if(PositionGetInteger(POSITION_MAGIC) != g_strategies[s].magic) return false;
   // Lop check bo sung: lenh cua chien luoc s luon co comment bat dau bang ma chien luoc (vd "MF_01")
   // (xem orderComment trong OpenOrder). Lenh thu cong hoac cua chien luoc khac se bi loai.
   if(StringFind(PositionGetString(POSITION_COMMENT), g_strategies[s].code) != 0) return false;
   return true;
}

//=============================================================================
// TIME HELPERS (thay cho Hour()/Minute() cua MQL4)
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
// Gui message toi Telegram qua Bot API (WebRequest), tra ve false neu gui that bai
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

// Dung format noi dung telegram: ghep title voi cac thong so lenh (entry/SL/dist/swing/ATR) + spread/ADX hien tai
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
// CORAL SNAPSHOT (doc 1 lan/tick moi, dung chung cho ca 2 chien luoc)
//=============================================================================
struct CoralSnapshot
{
   bool upNow, upPrev, downNow, downPrev;
   bool upM5, downM5, upM15, downM15;
};

CoralSnapshot BuildCoralSnapshot(int shift)
{
   CoralSnapshot snap;
   snap.upNow    = IsCoralUp(PERIOD_M1, shift);
   snap.upPrev   = IsCoralUp(PERIOD_M1, shift + 1);
   snap.downNow  = IsCoralDown(PERIOD_M1, shift);
   snap.downPrev = IsCoralDown(PERIOD_M1, shift + 1);
   snap.upM5     = IsCoralUp(PERIOD_M5, shift);
   snap.downM5   = IsCoralDown(PERIOD_M5, shift);
   snap.upM15    = IsCoralUp(PERIOD_M15, shift);
   snap.downM15  = IsCoralDown(PERIOD_M15, shift);
   return snap;
}

//=============================================================================
// CORAL HELPERS
//=============================================================================
int GetCoralHandle(ENUM_TIMEFRAMES timeframe)
{
   switch(timeframe)
   {
      case PERIOD_M1:  return g_hCoralM1;
      case PERIOD_M5:  return g_hCoralM5;
      case PERIOD_M15: return g_hCoralM15;
      default: return INVALID_HANDLE;
   }
}

// Doc buffer chi bao Coral tai 1 shift: co gia tri (khac EMPTY_VALUE) nghia la dang trong trend do (up/down)
bool CoralBufferHasValue(ENUM_TIMEFRAMES timeframe, int bufferIndex, int shift)
{
   int handle = GetCoralHandle(timeframe);
   double coralBuf[]; ArraySetAsSeries(coralBuf, true);
   if(CopyBuffer(handle, bufferIndex, shift, 1, coralBuf) <= 0) return false;
   return coralBuf[0] != EMPTY_VALUE;
}

bool IsCoralUp(ENUM_TIMEFRAMES timeframe, int shift)   { return CoralBufferHasValue(timeframe, 1, shift); }
bool IsCoralDown(ENUM_TIMEFRAMES timeframe, int shift) { return CoralBufferHasValue(timeframe, 2, shift); }

//=============================================================================
// EFFICIENCY RATIO (ER) - do "hieu qua" cua xu huong gia: bien dong gia thuc te (disp) so
// voi tong quang duong di cua gia (path) trong "period" nen gan nhat. ER cang gan 1 nghia
// la gia di thang mot mach (trending manh), cang gan 0 nghia la gia di ngang (sideway/nhieu).
// Dung chung ca 2 chien luoc (InpERPeriod/InpERtf/InpERLookback deu la input chung).
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

// Canh bao Telegram khi thi truong dang sideway (Efficiency Ratio qua thap tren InpERtf,
// mac dinh M5) - CHI de thong bao, khong lien quan gioi han vao/dong lenh, khong phu thuoc
// chien luoc nao (goi 1 lan duy nhat moi nen M1 moi trong OnTick, khong lap lai theo tung
// chien luoc dang bat). Throttle rieng bang InpSidewayNotifyCooldown (mac dinh 1800s = 30
// phut), doc lap voi moi cooldown khac.
void NotifySidewayMarket()
{
   double er = EfficiencyRatio(InpERtf, InpERPeriod, 1);
   if(!(er > 0 && er < 0.05)) return;   // khong sideway (hoac khong tinh duoc, er=-1.0)

   if((TimeCurrent() - g_lastSidewayNotifyTime) < InpSidewayNotifyCooldown)
   {
      Print("NotifySidewayMarket: sideway detected (er=", DoubleToString(er, 2), ") nhung chua du InpSidewayNotifyCooldown giay tu lan bao truoc");
      return;
   }

   double erK = ERRank(InpERtf, InpERPeriod, InpERLookback);

   double atrBuf[]; ArraySetAsSeries(atrBuf, true);
   double atr = 0;
   if(CopyBuffer(g_hATR_M1, 0, 1, 1, atrBuf) > 0) atr = atrBuf[0];

   SendTelegram("Sideway warning - " + _Symbol + " %0A ATR: " + DoubleToString(atr, 1) +
                " %0A erK: " + DoubleToString(erK, 2) + " %0A er: " + DoubleToString(er, 2));

   g_lastSidewayNotifyTime = TimeCurrent();
   Print("NotifySidewayMarket: sent Telegram (ATR=", DoubleToString(atr, 1), ", erK=", DoubleToString(erK, 2), ", er=", DoubleToString(er, 2), ")");
}

//=============================================================================
// RSI + SMA(RSI) HELPERS (M1) - chi dung cho chien luoc co useRsiFilter=true (MF_02).
// Goi la "ma/ema9" va "ma/ema45" nhung ban chat la SMA (trung binh cong don gian cua
// chuoi RSI), KHONG phai EMA that. Copy logic tu GetRsiMa trong rsi_dynamic_noti.mq5.
//=============================================================================
void GetRsiSma(int shift, double &rsi, double &maFast, double &maSlow)
{
   int need = InpMF02_MaSlow + shift + 5;

   double rsiBuf[];
   ArraySetAsSeries(rsiBuf, true);
   if(CopyBuffer(g_hRsiM1, 0, 0, need, rsiBuf) <= 0)
   {
      rsi = 0; maFast = 0; maSlow = 0;
      return;
   }

   rsi = rsiBuf[shift];

   double sumF = 0;
   for(int i = shift; i < shift + InpMF02_MaFast; i++) sumF += rsiBuf[i];
   maFast = sumF / InpMF02_MaFast;

   double sumS = 0;
   for(int j = shift; j < shift + InpMF02_MaSlow; j++) sumS += rsiBuf[j];
   maSlow = sumS / InpMF02_MaSlow;
}

//=============================================================================
// TICK
//=============================================================================
// Moi tick: khi co nen M1 moi, doc Coral snapshot 1 lan roi xu ly tin hieu cho tung
// chien luoc dang bat; sau do luon quan ly (trailing) lenh dang mo cua tung chien luoc.
void OnTick()
{
   static datetime lastBarTime = 0;
   datetime currentBarTime = iTime(_Symbol, PERIOD_M1, 0);
   bool newBar = (currentBarTime > lastBarTime);

   CoralSnapshot snap;
   if(newBar)
   {
      lastBarTime = currentBarTime;
      snap = BuildCoralSnapshot(1);
      Print("Coral trend snapshot - M1 up:", snap.upNow, " M1 up(prev):", snap.upPrev, " M5 up:", snap.upM5, " M15 up:", snap.upM15,
            " | M1 down:", snap.downNow, " M1 down(prev):", snap.downPrev, " M5 down:", snap.downM5, " M15 down:", snap.downM15);

      NotifySidewayMarket();   // canh bao rieng, 1 lan/nen, khong phu thuoc chien luoc nao
   }

   for(int s = 0; s < ArraySize(g_strategies); s++)
   {
      if(!g_strategies[s].enabled) continue;
      trade.SetExpertMagicNumber(g_strategies[s].magic);   // moi thao tac trade ben duoi deu gan dung magic chien luoc nay

      if(newBar) ProcessStrategySignal(s, 1, snap);

      ManageOpenPositions(s);
   }
}

//=============================================================================
// SIGNAL
//=============================================================================
// Xu ly tin hieu cho 1 chien luoc: dong het lenh khi M1 dao chieu nguoc position gan nhat,
// sau do mo lenh moi khi Coral 3TF dong thuan (+ RSI filter neu useRsiFilter)
void ProcessStrategySignal(int s, int shift, const CoralSnapshot &snap)
{
   bool reversedAgainstPosition = (g_strategies[s].previousPosition == "SHORT" && snap.upNow) ||
                                   (g_strategies[s].previousPosition == "LONG"  && snap.downNow);
   if(reversedAgainstPosition) CloseAllPositions(s);

   bool buySignal  = (snap.upNow   && !snap.upPrev   && snap.upM5   && snap.upM15);
   bool sellSignal = (snap.downNow && !snap.downPrev && snap.downM5 && snap.downM15);

   if(g_strategies[s].useRsiFilter)
   {
      double rsi, rsiMaFast, rsiMaSlow;
      GetRsiSma(shift, rsi, rsiMaFast, rsiMaSlow);
      Print(g_strategies[s].code, " RSI(M1) snapshot - rsi=", DoubleToString(rsi, 2),
            " maFast=", DoubleToString(rsiMaFast, 2), " maSlow=", DoubleToString(rsiMaSlow, 2));
      buySignal  = buySignal  && (rsi > rsiMaSlow);
      sellSignal = sellSignal && (rsi < rsiMaSlow);
   }

   if(buySignal)  OpenOrder(s, (int)POSITION_TYPE_BUY,  shift);
   if(sellSignal) OpenOrder(s, (int)POSITION_TYPE_SELL, shift);
}

//=============================================================================
// GIOI HAN LAI/LO TRONG NGAY / THEO KHUNG GIO (tinh rieng theo magic tung chien luoc)
//=============================================================================
// Tinh loi/lo DA CHOT (deal, loc theo symbol + magic) trong khoang [fromTime, toTime]
double GetRealizedProfitInRange(long magic, datetime fromTime, datetime toTime)
{
   double total = 0;
   if(!HistorySelect(fromTime, toTime)) return total;

   int totalDeals = HistoryDealsTotal();
   for(int i = 0; i < totalDeals; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      if(HistoryDealGetString(dealTicket, DEAL_SYMBOL) != _Symbol) continue;
      if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != magic) continue;
      total += HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
             + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
             + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   }
   return total;
}

// Tinh loi/lo DA CHOT tu dau ngay (server) den hien tai
double GetTodayRealizedProfit(long magic)
{
   datetime startOfDay = TimeCurrent() - (TimeCurrent() % 86400);
   return GetRealizedProfitInRange(magic, startOfDay, TimeCurrent());
}

// Tinh loi/lo NOI (floating) cua cac lenh dang mo cua chien luoc s
double GetBotFloatingProfit(int s)
{
   double total = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(!IsBotPosition(s)) continue;
      total += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
   }
   return total;
}

// Kiem tra da cham nguong dung vao lenh moi trong ngay chua (theo chien luoc s):
// lo >= dailyMaxLoss hoac lai >= dailyMaxProfit. Lenh dang mo khong bi dong cuong buc,
// chi duong mo lenh moi (OpenOrder) bi chan.
bool DailyLimitReached(int s, double &dailyPnl)
{
   dailyPnl = GetTodayRealizedProfit(g_strategies[s].magic) + GetBotFloatingProfit(s);
   if(dailyPnl <= -g_strategies[s].dailyMaxLoss * g_strategies[s].volMultiplier) return true;
   if(dailyPnl >= g_strategies[s].dailyMaxProfit * g_strategies[s].volMultiplier) return true;
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

void GetTimeWindowRange(int windowIndex, int &startHour, int &endHour)
{
   if(windowIndex == 0)      { startHour = 0;  endHour = 6;  }
   else if(windowIndex == 1) { startHour = 6;  endHour = 12; }
   else                      { startHour = 12; endHour = 24; }
}

// Tinh loi/lo DA CHOT trong khung gio hien tai cua ngay server hom nay (theo magic)
double GetTimeWindowRealizedProfit(long magic)
{
   int startHour, endHour;
   GetTimeWindowRange(GetTimeWindowIndex(), startHour, endHour);

   datetime startOfDay  = TimeCurrent() - (TimeCurrent() % 86400);
   datetime windowStart = startOfDay + startHour * 3600;
   datetime windowEnd   = startOfDay + endHour   * 3600;

   return GetRealizedProfitInRange(magic, windowStart, windowEnd);
}

// Kiem tra da cham nguong lai toi da trong khung gio hien tai chua (theo chien luoc s)
bool TimeWindowLimitReached(int s, double &windowPnl)
{
   windowPnl = GetTimeWindowRealizedProfit(g_strategies[s].magic) + GetBotFloatingProfit(s);
   return (windowPnl > g_strategies[s].timeWindowMaxProfit * g_strategies[s].volMultiplier);
}

//=============================================================================
// VOLUME
//=============================================================================
double CalcOrderVolume(int s)
{
   return g_tradeLotSize * g_strategies[s].volMultiplier;
}

//=============================================================================
// OPEN ORDER
//=============================================================================
// Mo lenh buy/sell cho chien luoc s: tinh SL theo swing gan nhat (cap boi slSpacingDistance),
// bo qua neu ATR qua thap, da cham gioi han lai/lo trong ngay, hoac gioi han lai trong khung gio;
// gui thong bao Telegram (kem ER) cho ca truong hop thanh cong lan that bai. Comment lenh dang
// "MF_xx,A: x.x,ek: x.xx,er: x.xx" (ma chien luoc + ATR + ERRank + EfficiencyRatio).
void OpenOrder(int s, int orderType, int shift)
{
   bool   isBuy      = (orderType == (int)POSITION_TYPE_BUY);
   double entryPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   string code       = g_strategies[s].code;
   string label       = code + " " + (isBuy ? "Buy" : "Sell");

   double dailyPnl = 0;
   if(DailyLimitReached(s, dailyPnl))
   {
      Print(label, " signal skipped on ", _Symbol, ": daily P/L limit reached ($", DoubleToString(dailyPnl, 2),
            ", loss limit=-$", DoubleToString(g_strategies[s].dailyMaxLoss, 2), ", profit limit=$", DoubleToString(g_strategies[s].dailyMaxProfit, 2), ")");
      SendTelegram("Daily P/L limit reached - " + label + " signal skipped %0A P/L today: $" + DoubleToString(dailyPnl, 2));
      return;
   }

   double windowPnl = 0;
   if(TimeWindowLimitReached(s, windowPnl))
   {
      Print(label, " signal skipped on ", _Symbol, ": time-window profit limit reached (window #", GetTimeWindowIndex(),
            ", P/L $", DoubleToString(windowPnl, 2), " > $", DoubleToString(g_strategies[s].timeWindowMaxProfit, 2), ")");
      SendTelegram("Time-window profit limit reached - " + label + " signal skipped %0A P/L this window: $" + DoubleToString(windowPnl, 2));
      return;
   }

   double orderVol = CalcOrderVolume(s);

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

   if(atrRounded < 1.8)
   {
      Print(label, " signal skipped on ", _Symbol, ": ATR too low (", DoubleToString(atrRounded, 1), " < 2)");
      SendTelegram("Signal: " + label + " %0A ATR: " + DoubleToString(atrRounded, 1));
      return;
   }

   // SL qua xa -> cap slSpacingDistance cua chien luoc
   if(slDistance > g_strategies[s].slSpacingDistance)
      sl = isBuy ? entryPrice - g_strategies[s].slSpacingDistance : entryPrice + g_strategies[s].slSpacingDistance;

   // TP co dinh cach entry takeProfitDistance cua chien luoc
   double tp = isBuy ? entryPrice + g_strategies[s].takeProfitDistance : entryPrice - g_strategies[s].takeProfitDistance;

   double erK    = ERRank(InpERtf, InpERPeriod, InpERLookback);
   double er     = EfficiencyRatio(InpERtf, InpERPeriod, 1);
   string erKStr = DoubleToString(erK, 2);
   string erStr  = DoubleToString(er, 2);

   string orderComment = code + ",A: " + DoubleToString(atr, 1) + ",ek: " + erKStr + ",er: " + erStr;
   bool sent = isBuy ? trade.Buy(orderVol, _Symbol, entryPrice, sl, tp, orderComment)
                      : trade.Sell(orderVol, _Symbol, entryPrice, sl, tp, orderComment);

   if(!sent)
   {
      Print(label, " order failed on ", _Symbol, ", error code: ", GetLastError());
      SendTelegram(TelegramMsg(label + " FAILED",
         DoubleToString(entryPrice, 2), DoubleToString(sl, 2),
         DoubleToString(slDistance, 2), DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)) + "%0AerK:    " + erKStr + "%0Aer:     " + erStr);
      return;
   }

   // Lay dung position vua mo qua deal ket qua (khong dung PositionSelect(_Symbol) vi
   // nhieu chien luoc co the co lenh cung mo tren cung symbol - PositionSelect(symbol)
   // khong dam bao chon dung ticket vua tao trong truong hop nay)
   ulong dealTicket = trade.ResultDeal();
   ulong posTicket  = 0;
   if(dealTicket != 0 && HistoryDealSelect(dealTicket))
      posTicket = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);

   if(posTicket != 0 && PositionSelectByTicket(posTicket))
   {
      // Doi chieu SL/TP thuc te tren position voi SL/TP da gui trong lenh - phat hien truong
      // hop broker/prop firm (vd FTMO) ghi de/tu dong sua SL/TP sau khi lenh duoc mo.
      double actualSl    = PositionGetDouble(POSITION_SL);
      double actualTp    = PositionGetDouble(POSITION_TP);
      bool   slMismatch  = MathAbs(actualSl - sl) > SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      bool   tpMismatch  = MathAbs(actualTp - tp) > SymbolInfoDouble(_Symbol, SYMBOL_POINT);

      if(slMismatch || tpMismatch)
      {
         Print(label, " CANH BAO #", posTicket, ": SL/TP thuc te (SL=", DoubleToString(actualSl, 2),
               ", TP=", DoubleToString(actualTp, 2), ") khac gia tri da gui khi mo lenh (SL=",
               DoubleToString(sl, 2), ", TP=", DoubleToString(tp, 2), ") - co the bi broker ghi de. Dang tu set lai.");

         bool slTpFixed = trade.PositionModify(posTicket, sl, tp);
         if(!slTpFixed)
            Print(label, " #", posTicket, ": set lai SL/TP that bai, error code: ", GetLastError());
         else
            Print(label, " #", posTicket, ": da set lai SL/TP -> SL=", DoubleToString(sl, 2), " TP=", DoubleToString(tp, 2));

         SendTelegram("CANH BAO: SL/TP bi thay doi sau khi mo lenh #" + IntegerToString(posTicket) +
                       " (" + label + ")%0A SL da gui: " + DoubleToString(sl, 2) + " - thuc te: " + DoubleToString(actualSl, 2) +
                       "%0A TP da gui: " + DoubleToString(tp, 2) + " - thuc te: " + DoubleToString(actualTp, 2) +
                       "%0A Da tu set lai: " + (slTpFixed ? "OK" : "THAT BAI"));
      }

      SendTelegram(TelegramMsg(label + " OK",
         DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 2),
         DoubleToString(PositionGetDouble(POSITION_SL), 2),
         DoubleToString(slDistance, 2), DoubleToString(swingPrice, 2),
         DoubleToString(atr, 2)) + "%0AerK:    " + erKStr + "%0Aer:     " + erStr);
   }

   g_strategies[s].previousPosition = isBuy ? "LONG" : "SHORT";
   Print(label, " order placed on ", _Symbol, ", ticket: ", trade.ResultOrder(),
         ", entry: ", DoubleToString(entryPrice, 2), ", SL: ", DoubleToString(sl, 2), ", TP: ", DoubleToString(tp, 2),
         ", erK: ", erKStr, ", er: ", erStr);
}

//=============================================================================
// TRAILING STOP
//=============================================================================
// Kiem tra SL moi co vi pham stops level toi thieu cua broker khong (qua gan gia hien tai)
bool StopsLevelOk(bool isBuy, double newSL, double bidNow, double askNow, double minStop)
{
   return isBuy ? (bidNow - newSL >= minStop) : (newSL - askNow >= minStop);
}

// Gui thong bao Telegram khi trail SL, chong spam bang InpTrailNotifyStep/InpTrailNotifyCooldown
// (dung chung 1 bo dem cho ca 2 chien luoc, giong hanh vi ban goc)
void NotifyTrailing(int s, ulong ticket, bool isBuy, double entryPrice, double oldSl, double newSL)
{
   bool bigMove   = MathAbs(newSL - g_lastNotifiedSL) >= InpTrailNotifyStep;
   bool cooledOff = (TimeCurrent() - g_lastNotifyTime) >= InpTrailNotifyCooldown;

   if(bigMove && cooledOff)
   {
      SendTelegram(TelegramMsg(g_strategies[s].code + " Trail " + (isBuy ? "BUY" : "SELL"),
         DoubleToString(entryPrice, 2), DoubleToString(newSL, 2),
         "-", DoubleToString(oldSl, 2), "-"));
      g_lastNotifiedSL = newSL;
      g_lastNotifyTime = TimeCurrent();
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": Telegram notification sent");
   }
   else
   {
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": Telegram notification skipped (bigMove=", bigMove, ", cooledOff=", cooledOff, ")");
   }
}

// Ca 2 chien luoc con lai (MF_01/MF_02) deu dung trailing 2 giai doan
void TrailingStop(int s, ulong ticket)
{
   TrailingStopTwoStage(s, ticket);
}

// Trail 2 giai doan (MF_01/MF_02): giai doan 1 keo SL ve entry (breakeven) khi lai du
// trailDistance, giai doan 2 tiep tuc bam SL cach gia hien tai trailDistance khi SL da >= entry
void TrailingStopTwoStage(int s, ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;
   if(!IsBotPosition(s)) return;

   double sl         = PositionGetDouble(POSITION_SL);
   double entryPrice = PositionGetDouble(POSITION_PRICE_OPEN);
   bool   isBuy      = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
   string symbol     = PositionGetString(POSITION_SYMBOL);

   double bidNow = SymbolInfoDouble(symbol, SYMBOL_BID);
   double askNow = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double price  = isBuy ? bidNow : askNow;

   int    digits  = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double minStop = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL) * SymbolInfoDouble(symbol, SYMBOL_POINT);

   double profitDist       = isBuy ? (price - entryPrice) : (entryPrice - price);
   bool   slAtOrAboveEntry = isBuy ? (sl >= entryPrice) : (sl <= entryPrice && sl != 0);
   double trailDistance    = g_strategies[s].trailDistance;

   Print(g_strategies[s].code, " TrailingStop #", ticket, " ", (isBuy ? "BUY" : "SELL"),
         ": entry=", DoubleToString(entryPrice, digits), " sl=", DoubleToString(sl, digits),
         " price=", DoubleToString(price, digits), " profitDist=", DoubleToString(profitDist, digits),
         " slAtOrAboveEntry=", slAtOrAboveEntry);

   double newSL = 0;

   if(slAtOrAboveEntry)
   {
      newSL = isBuy ? NormalizeDouble(price - trailDistance, digits)
                    : NormalizeDouble(price + trailDistance, digits);
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": phase 2 (trail) -> candidate newSL=", DoubleToString(newSL, digits));

      bool worseOrEqual = isBuy ? (newSL <= NormalizeDouble(sl, digits))
                                 : (newSL >= NormalizeDouble(sl, digits));
      if(worseOrEqual)
      {
         Print(g_strategies[s].code, " TrailingStop #", ticket, ": skipped - newSL not better than current SL");
         return;
      }

      if(!StopsLevelOk(isBuy, newSL, bidNow, askNow, minStop))
      {
         Print(g_strategies[s].code, " TrailingStop #", ticket, ": skipped - newSL violates broker's minimum stops level");
         return;
      }
   }
   else if(profitDist >= trailDistance)
   {
      newSL = NormalizeDouble(entryPrice, digits);
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": phase 1 (breakeven) -> candidate newSL=", DoubleToString(newSL, digits));

      bool worseOrEqual = isBuy ? (newSL <= NormalizeDouble(sl, digits))
                                 : (sl != 0 && newSL >= NormalizeDouble(sl, digits));
      if(worseOrEqual)
      {
         Print(g_strategies[s].code, " TrailingStop #", ticket, ": skipped - newSL not better than current SL");
         return;
      }

      if(!StopsLevelOk(isBuy, newSL, bidNow, askNow, minStop))
      {
         Print(g_strategies[s].code, " TrailingStop #", ticket, ": skipped - newSL violates broker's minimum stops level");
         return;
      }
   }
   else
   {
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": not enough profit yet, skip (profitDist < trailDistance)");
      return;
   }

   // ----- Throttle: khong gui lenh sua SL len san qua nhanh (doc lap voi cooldown Telegram) -----
   if((TimeCurrent() - g_lastModifyTime) < InpTrailModifyCooldown)
   {
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": skipped - chua du InpTrailModifyCooldown giay tu lan sua SL truoc");
      return;
   }

   if(!trade.PositionModify(ticket, newSL, PositionGetDouble(POSITION_TP)))
   {
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": PositionModify failed, error code: ", GetLastError());
      return;
   }

   g_lastModifyTime = TimeCurrent();
   Print(g_strategies[s].code, " TrailingStop #", ticket, ": SL updated -> ", DoubleToString(newSL, digits));
   NotifyTrailing(s, ticket, isBuy, entryPrice, sl, newSL);
}

// Dong tat ca lenh dang mo cua chien luoc s (theo magic), giu nguyen lenh cua chien luoc
// khac / lenh thu cong. Dung khi M1 dao chieu nguoc position gan nhat (xem reversedAgainstPosition
// trong ProcessStrategySignal).
void CloseAllPositions(int s)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(!IsBotPosition(s)) continue;

      if(!trade.PositionClose(ticket))
         { Print(g_strategies[s].code, " Failed to close bot position, ticket=", ticket, ", error code: ", GetLastError()); ResetLastError(); }
      else
         Print(g_strategies[s].code, " Bot position closed, ticket=", ticket);
   }
}

//=============================================================================
// QUAN LY LENH DANG MO (chay moi tick, cho tung chien luoc dang bat)
//=============================================================================
void ManageOpenPositions(int s)
{
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(!IsBotPosition(s)) continue;

      TrailingStop(s, ticket);

      g_strategies[s].previousPosition = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "LONG" : "SHORT";
   }
}

//=============================================================================
// Y TUONG KIEN TRUC CUA EA GOP (tong quan)
//=============================================================================
// 1. Tin hieu vao lenh (dung chung ca 2 chien luoc): Coral 3 khung M1 (chinh)/M5/M15 (xac
//    nhan). BUY khi Coral M1 vua chuyen sang uptrend (up hien tai, khong up nen truoc) VA
//    ca M5, M15 cung dang uptrend. Tuong tu cho SELL. MF_02 AND them dieu kien RSI(M1):
//    rsi > SMA45(rsi) cho buy, rsi < SMA45(rsi) cho sell.
//
// 2. Thoat lenh khi dao chieu (ProcessStrategySignal): theo doi previousPosition rieng
//    tung chien luoc, khi M1 Coral dao chieu nguoc position gan nhat -> dong HET lenh cua
//    chien luoc do (CloseAllPositions), khong xet lai/lo tung lenh.
//
// 3. SL/TP & loc tin hieu (OpenOrder, dung chung cong thuc, tham so rieng tung chien luoc):
//    SL theo swing gan nhat (14 nen M1), cap boi slSpacingDistance. TP co dinh cach entry
//    takeProfitDistance. Bo qua tin hieu neu ATR M1 < 2.
//
// 4. Trailing stop 2 giai doan (TrailingStopTwoStage, ca 2 chien luoc, chay MOI tick):
//    breakeven roi bam SL tiep theo trailDistance. De tranh spam PositionModify() len san
//    khi gia chay lien tuc, chi THUC SU gui lenh sua SL toi da 1 lan moi InpTrailModifyCooldown
//    giay (mac dinh 2s, g_lastModifyTime dung chung moi chien luoc) - throttle nay doc lap
//    hoan toan voi InpTrailNotifyCooldown (chi chi phoi tan suat gui Telegram).
//
// 5. Volume: vol = min lot cua symbol * volMultiplier rieng tung chien luoc (input
//    MFxx_VolMultiplier), khong tang theo chuoi lenh.
//
// 6. Phan tach lenh giua 2 chien luoc & lenh thu cong: moi chien luoc co magic rieng
//    (InpMFxx_Magic) + moi lenh mo deu gan comment dung bang ma chien luoc (vd "MF_01",
//    xem orderComment trong OpenOrder). IsBotPosition(s) check ca 2 lop nay. Moi thao tac trail/dong lenh
//    deu di qua IsBotPosition(s) de chi dung tung lenh cua dung chien luoc.
//    LUU Y: co che nay chi dang tin cay tren tai khoan HEDGING (nhu ban goc). Tren NETTING,
//    lenh cua cac chien luoc khac nhau tren cung symbol se bi MT5 tu dong gop lam mot.
//
// 7. Gioi han lai/lo ngay + theo khung gio: tinh RIENG theo magic tung chien luoc
//    (DailyLimitReached(s,...), TimeWindowLimitReached(s,...)), nguong lay tu input rieng
//    tung chien luoc. Cham nguong chi chan OpenOrder cua chien luoc do, khong dong lenh
//    dang mo, khong anh huong chien luoc khac.
//
// 8. Thong bao: moi su kien quan trong (mo lenh thanh cong/that bai, trail SL, thoat lenh,
//    tin hieu bi bo qua, cham gioi han P/L) deu gui Telegram, tieu de gan ma chien luoc.
//
// 9. Efficiency Ratio (dung chung ca 2 chien luoc): do "do hieu qua" cua xu huong gia tren
//    khung InpERtf (mac dinh M5, doc lap voi Coral M1/M5/M15).
//    - Trong OpenOrder: ghi 2 gia tri (lam tron 2 chu so thap phan) vao comment lenh dang
//      "MF_xx,A: x.x,ek: x.xx,er: x.xx" + gui Telegram khi mo lenh - er (EfficiencyRatio,
//      ER hien tai tai shift=1) va erK (ERRank, xep hang ER hien tai so voi InpERLookback=300
//      gia tri ER qua khu). CHUA dung de loc tin hieu vao lenh (input InpERRank chung chua
//      duoc tham chieu o dau khac).
//    - Canh bao sideway (NotifySidewayMarket, goi trong OnTick moi nen M1 moi, 1 lan duy
//      nhat khong phu thuoc chien luoc nao): neu 0<er<0.05 thi gui Telegram (ATR + erK + er),
//      toi da 1 lan moi InpSidewayNotifyCooldown giay (mac dinh 1800s = 30 phut,
//      g_lastSidewayNotifyTime) - khong anh huong toi viec vao/dong lenh cua bat ky chien
//      luoc nao.
//=============================================================================
