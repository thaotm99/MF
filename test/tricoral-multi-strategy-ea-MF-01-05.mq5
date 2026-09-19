#property strict
#include <Trade\Trade.mqh>

// EA gop 5 chien luoc Tricoral (MF_01..MF_05) vao 1 file. Moi chien luoc la 1 "config"
// bat/tat doc lap qua Inp<MaCode>_Enabled, co magic + volume + comment rieng, chay dong
// thoi tren cung symbol khong dung nhau. Nguon goc tung chien luoc:
//   MF_01 <- mt5/releases/tricoral-multi-timeframe-ea-MF01.mq5
//   MF_02 <- test/tricoral-multi-timeframe-ea-MF02-27082026.mq5   (+ RSI/SMA filter)
//   MF_03 <- test/tricoral-multi-timeframe-ea-MF03-290826.mq5     (thoat theo tung lenh M1/M5, trailing chi breakeven)
//   MF_04 <- test/tricoral-multi-timeframe-ea-MF04-150926.mq5     (= MF_01 nhung khong trailing)
//   MF_05 <- test/tricoral-multi-timeframe-ea-MF05-170926.mq5     (= MF_01 nhung dong lenh dao chieu co dieu kien:
//            lenh lai dong ngay, lenh lo chi dong khi da co chuoi >= N deal dong gan nhat cung huong)
//
// LUU Y TRIEN KHAI: neu tai khoan dang co lenh mo tu ban EA rieng le cu (comment "ATR : x.x"),
// EA nay se KHONG nhan dien duoc cac lenh do (comment prefix da doi thanh ma chien luoc,
// vd "MF_01"). Nen dong het lenh bot cu truoc khi thay EA.

//=============================================================================
// INPUTS (dung chung cho ca 5 chien luoc)
//=============================================================================
 string InpCoralIndicatorName = "Coral-custom";
 string InpTelegramToken         = "8696728373:AAFmkD2bLCRM2XviVvBtaSY2HGaoV4iY5cE";
 string InpTelegramChatID        = "-1004343744850"; //  MF-01-05

input double InpTrailNotifyStep     = 3.0;  // Chi gui Telegram khi SL doi them >= gia tri nay
input int    InpTrailNotifyCooldown = 30;   // Giay toi thieu giua 2 lan thong bao trailing (dung chung moi chien luoc)
input int    InpTrailModifyCooldown = 2;    // Giay toi thieu giua 2 lan THUC SU gui lenh sua SL len san (dung chung moi chien luoc, tach biet - khong lien quan thoi gian gui Telegram)

//=============================================================================
// INPUTS (Efficiency Ratio - do "hieu qua" xu huong gia tren 1 khung tf rieng, dung chung
// ca 5 chien luoc; chi de tinh/hien thi/gui Telegram + ghi vao comment lenh, CHUA dung de
// loc tin hieu vao lenh)
//=============================================================================
input int             InpERPeriod   = 12;         // So nen dung tinh Efficiency Ratio
input ENUM_TIMEFRAMES InpERtf       = PERIOD_M5;   // Khung thoi gian tinh ER (doc lap voi Coral)
input int             InpERLookback = 300;         // So gia tri ER qua khu dung de xep hang
input double          InpERRank     = 0.50;        // Nguong tham khao (chua dung de loc lenh)

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
// MF_03 - Coral 3TF thuan, thoat theo TUNG lenh (chua breakeven->M1, da breakeven->M5), trailing chi breakeven
//=============================================================================
input group "=== MF_03 ==="
input bool   InpMF03_Enabled             = true;
input long   InpMF03_Magic               = 20250808;
input double InpMF03_VolMultiplier       = 1;
input double InpMF03_SlSpacingDistance   = 8;
input double InpMF03_TakeProfitDistance  = 50;
input double InpMF03_TrailDistance       = 10;
input double InpMF03_DailyMaxLoss        = 40;
input double InpMF03_DailyMaxProfit      = 200;
input double InpMF03_TimeWindowMaxProfit = 70;

//=============================================================================
// MF_04 - Coral 3TF thuan, dong het lenh bot khi M1 dao chieu, KHONG trailing (chi SL/TP co dinh)
//=============================================================================
input group "=== MF_04 ==="
input bool   InpMF04_Enabled             = true;
input long   InpMF04_Magic               = 20250809;
input double InpMF04_VolMultiplier       = 1;
input double InpMF04_SlSpacingDistance   = 8;
input double InpMF04_TakeProfitDistance  = 50;
input double InpMF04_DailyMaxLoss        = 40;
input double InpMF04_DailyMaxProfit      = 100;
input double InpMF04_TimeWindowMaxProfit = 30;

//=============================================================================
// MF_05 - Coral 3TF thuan, trailing 2 giai doan (= MF_01); dao chieu KHONG dong het lenh
// ngay: lenh lai dong ngay, lenh lo chi dong khi da co >= HoldStreakCount deal dong gan
// nhat cung huong (con trong N lenh dau cua 1 chuoi moi thi giu lenh du dang lo)
//=============================================================================
input group "=== MF_05 ==="
input bool   InpMF05_Enabled             = true;
input long   InpMF05_Magic               = 20250810;
input double InpMF05_VolMultiplier       = 1;
input double InpMF05_SlSpacingDistance   = 8;
input double InpMF05_TakeProfitDistance  = 50;
input double InpMF05_TrailDistance       = 10;
input double InpMF05_DailyMaxLoss        = 40;
input double InpMF05_DailyMaxProfit      = 100;
input double InpMF05_TimeWindowMaxProfit = 30;
input int    InpMF05_HoldStreakCount     = 5;    // So deal dong gan nhat can cung huong lenh dang lo de xac nhan dong

//=============================================================================
// STRATEGY CONFIG
//=============================================================================
enum ENUM_TRAIL_MODE
{
   TRAIL_NONE,            // khong trailing, giu nguyen SL/TP co dinh luc vao lenh (MF_04)
   TRAIL_BREAKEVEN_ONLY,  // chi keo SL ve entry roi dung (MF_03)
   TRAIL_TWO_STAGE        // breakeven roi tiep tuc bam SL theo trailDistance (MF_01/MF_02)
};

enum ENUM_EXIT_MODE
{
   EXIT_LEGACY_CLOSE_ALL,          // dong HET lenh bot khi M1 dao chieu nguoc position gan nhat (MF_01/MF_02/MF_04)
   EXIT_PER_POSITION_M1_M5,        // xet tung lenh: chua breakeven->M1, da breakeven->M5 (MF_03)
   EXIT_STREAK_GUARDED_CLOSE_ALL   // M1 dao chieu nguoc position gan nhat: xet tung lenh, lai dong ngay,
                                   // lo chi dong khi da co chuoi deal dong gan nhat cung huong (MF_05)
};

struct StrategyConfig
{
   string          code;                 // "MF_01".."MF_04" - dung lam prefix comment lenh
   bool            enabled;
   long            magic;
   double          volMultiplier;        // he so nhan vol (min_lot * he so); dong thoi nhan vao nguong daily/time-window
   bool            useRsiFilter;
   ENUM_EXIT_MODE  exitMode;
   ENUM_TRAIL_MODE trailMode;
   double          slSpacingDistance;
   double          takeProfitDistance;
   double          trailDistance;        // khong dung khi trailMode == TRAIL_NONE
   double          dailyMaxLoss;
   double          dailyMaxProfit;
   double          timeWindowMaxProfit;
   int             holdStreakCount;      // so deal dong gan nhat can cung huong de xac nhan dong lenh dang lo
                                          // - chi dung khi exitMode == EXIT_STREAK_GUARDED_CLOSE_ALL
   // runtime state:
   string          previousPosition;     // "NONE"/"LONG"/"SHORT" - dung khi exitMode == EXIT_LEGACY_CLOSE_ALL
                                          // hoac EXIT_STREAK_GUARDED_CLOSE_ALL
};

StrategyConfig g_strategies[5];

//=============================================================================
// GLOBALS
//=============================================================================
double   g_tradeLotSize   = 0;

double   g_lastNotifiedSL = 0;
datetime g_lastNotifyTime = 0;
datetime g_lastModifyTime = 0;   // lan gan nhat THUC SU gui lenh sua SL len san (throttle InpTrailModifyCooldown, dung chung moi chien luoc)

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
   g_strategies[0].exitMode            = EXIT_LEGACY_CLOSE_ALL;
   g_strategies[0].trailMode           = TRAIL_TWO_STAGE;
   g_strategies[0].slSpacingDistance   = InpMF01_SlSpacingDistance;
   g_strategies[0].takeProfitDistance  = InpMF01_TakeProfitDistance;
   g_strategies[0].trailDistance       = InpMF01_TrailDistance;
   g_strategies[0].dailyMaxLoss        = InpMF01_DailyMaxLoss;
   g_strategies[0].dailyMaxProfit      = InpMF01_DailyMaxProfit;
   g_strategies[0].timeWindowMaxProfit = InpMF01_TimeWindowMaxProfit;
   g_strategies[0].holdStreakCount     = 0; // khong dung (exitMode khac STREAK_GUARDED)
   g_strategies[0].previousPosition    = "NONE";

   g_strategies[1].code                = "MF_02";
   g_strategies[1].enabled             = InpMF02_Enabled;
   g_strategies[1].magic               = InpMF02_Magic;
   g_strategies[1].volMultiplier       = InpMF02_VolMultiplier;
   g_strategies[1].useRsiFilter        = true;
   g_strategies[1].exitMode            = EXIT_LEGACY_CLOSE_ALL;
   g_strategies[1].trailMode           = TRAIL_TWO_STAGE;
   g_strategies[1].slSpacingDistance   = InpMF02_SlSpacingDistance;
   g_strategies[1].takeProfitDistance  = InpMF02_TakeProfitDistance;
   g_strategies[1].trailDistance       = InpMF02_TrailDistance;
   g_strategies[1].dailyMaxLoss        = InpMF02_DailyMaxLoss;
   g_strategies[1].dailyMaxProfit      = InpMF02_DailyMaxProfit;
   g_strategies[1].timeWindowMaxProfit = InpMF02_TimeWindowMaxProfit;
   g_strategies[1].holdStreakCount     = 0; // khong dung (exitMode khac STREAK_GUARDED)
   g_strategies[1].previousPosition    = "NONE";

   g_strategies[2].code                = "MF_03";
   g_strategies[2].enabled             = InpMF03_Enabled;
   g_strategies[2].magic               = InpMF03_Magic;
   g_strategies[2].volMultiplier       = InpMF03_VolMultiplier;
   g_strategies[2].useRsiFilter        = false;
   g_strategies[2].exitMode            = EXIT_PER_POSITION_M1_M5;
   g_strategies[2].trailMode           = TRAIL_BREAKEVEN_ONLY;
   g_strategies[2].slSpacingDistance   = InpMF03_SlSpacingDistance;
   g_strategies[2].takeProfitDistance  = InpMF03_TakeProfitDistance;
   g_strategies[2].trailDistance       = InpMF03_TrailDistance;
   g_strategies[2].dailyMaxLoss        = InpMF03_DailyMaxLoss;
   g_strategies[2].dailyMaxProfit      = InpMF03_DailyMaxProfit;
   g_strategies[2].timeWindowMaxProfit = InpMF03_TimeWindowMaxProfit;
   g_strategies[2].holdStreakCount     = 0; // khong dung (exitMode khac STREAK_GUARDED)
   g_strategies[2].previousPosition    = "NONE"; // khong dung (exitMode khac LEGACY), khoi tao cho sach

   g_strategies[3].code                = "MF_04";
   g_strategies[3].enabled             = InpMF04_Enabled;
   g_strategies[3].magic               = InpMF04_Magic;
   g_strategies[3].volMultiplier       = InpMF04_VolMultiplier;
   g_strategies[3].useRsiFilter        = false;
   g_strategies[3].exitMode            = EXIT_LEGACY_CLOSE_ALL;
   g_strategies[3].trailMode           = TRAIL_NONE;
   g_strategies[3].slSpacingDistance   = InpMF04_SlSpacingDistance;
   g_strategies[3].takeProfitDistance  = InpMF04_TakeProfitDistance;
   g_strategies[3].trailDistance       = 0; // khong dung, trailMode == TRAIL_NONE
   g_strategies[3].dailyMaxLoss        = InpMF04_DailyMaxLoss;
   g_strategies[3].dailyMaxProfit      = InpMF04_DailyMaxProfit;
   g_strategies[3].timeWindowMaxProfit = InpMF04_TimeWindowMaxProfit;
   g_strategies[3].holdStreakCount     = 0; // khong dung (exitMode khac STREAK_GUARDED)
   g_strategies[3].previousPosition    = "NONE";

   g_strategies[4].code                = "MF_05";
   g_strategies[4].enabled             = InpMF05_Enabled;
   g_strategies[4].magic               = InpMF05_Magic;
   g_strategies[4].volMultiplier       = InpMF05_VolMultiplier;
   g_strategies[4].useRsiFilter        = false;
   g_strategies[4].exitMode            = EXIT_STREAK_GUARDED_CLOSE_ALL;
   g_strategies[4].trailMode           = TRAIL_TWO_STAGE;
   g_strategies[4].slSpacingDistance   = InpMF05_SlSpacingDistance;
   g_strategies[4].takeProfitDistance  = InpMF05_TakeProfitDistance;
   g_strategies[4].trailDistance       = InpMF05_TrailDistance;
   g_strategies[4].dailyMaxLoss        = InpMF05_DailyMaxLoss;
   g_strategies[4].dailyMaxProfit      = InpMF05_DailyMaxProfit;
   g_strategies[4].timeWindowMaxProfit = InpMF05_TimeWindowMaxProfit;
   g_strategies[4].holdStreakCount     = InpMF05_HoldStreakCount;
   g_strategies[4].previousPosition    = "NONE";
}

// Khoi tao EA: setup CTrade, tao handle chi bao dung chung (ATR/ADX/RSI/Coral M1-M5-M15), do config 5 chien luoc
int OnInit()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) { Print("Auto trading is disabled in terminal - EA init aborted"); return 0; }

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
// CORAL SNAPSHOT (doc 1 lan/tick moi, dung chung cho ca 5 chien luoc)
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
// Dung chung ca 5 chien luoc (InpERPeriod/InpERtf/InpERLookback deu la input chung).
//=============================================================================
// Tinh ER tai 1 shift, tren khung thoi gian InpERtf (doc lap voi Coral M1/M5/M15)
double EfficiencyRatio(ENUM_TIMEFRAMES tf, int period, int shift)
{
   double c[];
   ArraySetAsSeries(c, true);
   if(CopyClose(_Symbol, tf, shift, period + 1, c) < period + 1) return -1.0;
   double disp = MathAbs(c[0] - c[period]);
   double path = 0.0;
   for(int i = 0; i < period; i++) path += MathAbs(c[i] - c[i + 1]);
   return (path > 0.0) ? disp / path : 0.0;
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
// Xu ly tin hieu cho 1 chien luoc: thoat lenh dao chieu theo exitMode, sau do mo lenh moi
// khi Coral 3TF dong thuan (+ RSI filter neu useRsiFilter)
void ProcessStrategySignal(int s, int shift, const CoralSnapshot &snap)
{
   if(g_strategies[s].exitMode == EXIT_LEGACY_CLOSE_ALL)
   {
      bool reversedAgainstPosition = (g_strategies[s].previousPosition == "SHORT" && snap.upNow) ||
                                      (g_strategies[s].previousPosition == "LONG"  && snap.downNow);
      if(reversedAgainstPosition) CloseAllPositions(s);
   }
   else if(g_strategies[s].exitMode == EXIT_STREAK_GUARDED_CLOSE_ALL)
   {
      bool reversedAgainstPosition = (g_strategies[s].previousPosition == "SHORT" && snap.upNow) ||
                                      (g_strategies[s].previousPosition == "LONG"  && snap.downNow);
      if(reversedAgainstPosition) CloseReversedPositions(s, snap.upNow, snap.downNow);
   }
   else
   {
      ExitPositionsOnReversal(s, snap);
   }

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
// "MF_xx, ATR: x.x, erK: x.xx, er: x.xx" (ma chien luoc + ATR + ERRank + EfficiencyRatio).
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

   if(atrRounded < 2)
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

   string orderComment = code + ", ATR: " + DoubleToString(atr, 1) + ", erK: " + erKStr + ", er: " + erStr;
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

// Lenh dang chon da duoc keo SL ve entry (breakeven) hay chua. Goi sau khi da
// PositionSelect / PositionSelectByTicket.
bool IsPositionAtBreakeven()
{
   double sl    = PositionGetDouble(POSITION_SL);
   double entry = PositionGetDouble(POSITION_PRICE_OPEN);
   bool   isBuy = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);

   if(sl == 0) return false;
   return isBuy ? (sl >= entry) : (sl <= entry);
}

// Gui thong bao Telegram khi trail SL, chong spam bang InpTrailNotifyStep/InpTrailNotifyCooldown
// (dung chung 1 bo dem cho ca 5 chien luoc, giong hanh vi ban goc)
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

// Dispatch trailing theo trailMode cua chien luoc s
void TrailingStop(int s, ulong ticket)
{
   switch(g_strategies[s].trailMode)
   {
      case TRAIL_TWO_STAGE:      TrailingStopTwoStage(s, ticket);      break;
      case TRAIL_BREAKEVEN_ONLY: TrailingStopBreakevenOnly(s, ticket); break;
      case TRAIL_NONE:           break; // khong lam gi, giu nguyen SL/TP co dinh
   }
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

// Trail chi breakeven (MF_03): keo SL ve entry khi lai du trailDistance roi dung, khong
// bam SL them nua - viec "gong lai" sau breakeven chuyen sang ExitPositionsOnReversal (nghe M5)
void TrailingStopBreakevenOnly(int s, ulong ticket)
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
   bool   slAtOrAboveEntry = IsPositionAtBreakeven();
   double trailDistance    = g_strategies[s].trailDistance;

   Print(g_strategies[s].code, " TrailingStop #", ticket, " ", (isBuy ? "BUY" : "SELL"),
         ": entry=", DoubleToString(entryPrice, digits), " sl=", DoubleToString(sl, digits),
         " price=", DoubleToString(price, digits), " profitDist=", DoubleToString(profitDist, digits),
         " slAtOrAboveEntry=", slAtOrAboveEntry);

   if(slAtOrAboveEntry)
   {
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": SL da o entry (breakeven), khong trail them");
      return;
   }

   if(profitDist < trailDistance)
   {
      Print(g_strategies[s].code, " TrailingStop #", ticket, ": not enough profit yet, skip (profitDist < trailDistance)");
      return;
   }

   double newSL = NormalizeDouble(entryPrice, digits);
   Print(g_strategies[s].code, " TrailingStop #", ticket, ": breakeven -> candidate newSL=", DoubleToString(newSL, digits));

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

//=============================================================================
// EXIT ON REVERSAL (MF_03 - EXIT_PER_POSITION_M1_M5)
//=============================================================================
// Thoat lenh khi Coral dao chieu nguoc huong lenh, xet rieng tung lenh cua chien luoc s:
//   - Lenh CHUA breakeven (SL chua ve entry): xet Coral M1 -> thoat nhanh, cat lo som.
//   - Lenh DA breakeven (SL da ve entry, rui ro = 0): gong lai, chi thoat khi Coral M5
//     dao nguoc huong lenh. M5 cham hon M1 nen lenh khong bi nhieu ngan han da ra;
//     xau nhat la SL o entry an truoc, hoa von.
void ExitPositionsOnReversal(int s, const CoralSnapshot &snap)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(!IsBotPosition(s)) continue;

      bool   isBuy       = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
      bool   atBreakeven = IsPositionAtBreakeven();
      string tfName      = atBreakeven ? "M5" : "M1";
      // doc truoc khi close - sau khi close position khong con select duoc nua
      double entryPrice  = PositionGetDouble(POSITION_PRICE_OPEN);
      double slNow       = PositionGetDouble(POSITION_SL);

      bool reversed = atBreakeven ? (isBuy ? snap.downM5 : snap.upM5)
                                  : (isBuy ? snap.downNow : snap.upNow);

      Print(g_strategies[s].code, " ExitPositionsOnReversal #", ticket, " ", (isBuy ? "BUY" : "SELL"),
            ": atBreakeven=", atBreakeven, " -> xet dao chieu tren ", tfName,
            ", reversed=", reversed);

      if(!reversed) continue;

      if(!trade.PositionClose(ticket))
      {
         Print(g_strategies[s].code, " ExitPositionsOnReversal #", ticket, ": close failed, error code: ", GetLastError());
         ResetLastError();
         continue;
      }

      Print(g_strategies[s].code, " ExitPositionsOnReversal #", ticket, ": closed - Coral ", tfName, " dao chieu");
      SendTelegram(TelegramMsg(g_strategies[s].code + " Exit " + (isBuy ? "BUY" : "SELL") + " - Coral " + tfName + " dao chieu",
         DoubleToString(entryPrice, 2), DoubleToString(slNow, 2),
         (atBreakeven ? "gong lai" : "chua breakeven"), "-", "-"));
   }
}

// Dong tat ca lenh dang mo cua chien luoc s (theo magic), giu nguyen lenh cua chien luoc
// khac / lenh thu cong. Dung boi EXIT_LEGACY_CLOSE_ALL (MF_01/MF_02/MF_04); voi MF_03 ham
// nay khong nam trong luong chinh, chi con la tien ich dong khan cap toan bo lenh chien luoc.
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
// EXIT ON REVERSAL - DONG CO DIEU KIEN LAI/LO (EXIT_STREAK_GUARDED_CLOSE_ALL - MF_05)
//=============================================================================
// Kiem tra holdStreakCount deal dong gan nhat (DEAL_ENTRY_OUT, loc theo magic chien luoc s)
// co CUNG huong voi isBuy khong. Chi 1 deal khac huong xen vao la coi nhu chuoi bi "cat",
// tra ve false ngay. Chua du holdStreakCount deal trong lich su cung tra ve false (chua du
// dieu kien dong).
bool LastClosedDealsSameDirection(int s, bool isBuy, int count)
{
   if(!HistorySelect(0, TimeCurrent())) return false;

   int totalDeals = HistoryDealsTotal();
   int matched = 0;
   for(int i = totalDeals - 1; i >= 0 && matched < count; i--)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      if(HistoryDealGetString(dealTicket, DEAL_SYMBOL) != _Symbol) continue;
      if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != g_strategies[s].magic) continue;
      if(HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;

      // Deal dong 1 lenh BUY luon co DEAL_TYPE = DEAL_TYPE_SELL (va nguoc lai)
      bool closedBuyPosition = (HistoryDealGetInteger(dealTicket, DEAL_TYPE) == DEAL_TYPE_SELL);
      if(closedBuyPosition != isBuy) return false;

      matched++;
   }

   return (matched >= count);
}

// Dong lenh cua chien luoc s (theo magic) ngược huong voi trend Coral M1 hien tai
// (upNow/downNow), giu nguyen lenh chien luoc khac / lenh thu cong. Voi tung lenh:
//   - Lenh dang lai (profit >= 0): dong ngay.
//   - Lenh dang lo (profit < 0): chi dong neu holdStreakCount deal dong gan nhat DEU cung
//     huong lenh nay (LastClosedDealsSameDirection) - tuc da co 1 chuoi lenh cung huong du
//     dai roi. Neu chuoi hien tai con trong N lenh dau (bi lenh nguoc huong "cat" truoc do),
//     giu lenh lai vi tin hieu dao chieu co the chi la nhieu ngan han.
void CloseReversedPositions(int s, bool upNow, bool downNow)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(!IsBotPosition(s)) continue;

      bool isBuy    = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
      bool reversed = isBuy ? downNow : upNow;
      if(!reversed) continue;

      double profit = PositionGetDouble(POSITION_PROFIT);
      if(profit < 0 && !LastClosedDealsSameDirection(s, isBuy, g_strategies[s].holdStreakCount))
      {
         Print(g_strategies[s].code, " Position #", ticket, " (", (isBuy ? "BUY" : "SELL"),
               ") dang lo nhung con trong ", g_strategies[s].holdStreakCount, " lenh dau chuoi moi - giu lenh");
         continue;
      }

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

      if(g_strategies[s].exitMode == EXIT_LEGACY_CLOSE_ALL || g_strategies[s].exitMode == EXIT_STREAK_GUARDED_CLOSE_ALL)
         g_strategies[s].previousPosition = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "LONG" : "SHORT";
   }
}

//=============================================================================
// Y TUONG KIEN TRUC CUA EA GOP (tong quan)
//=============================================================================
// 1. Tin hieu vao lenh (dung chung ca 5 chien luoc): Coral 3 khung M1 (chinh)/M5/M15 (xac
//    nhan). BUY khi Coral M1 vua chuyen sang uptrend (up hien tai, khong up nen truoc) VA
//    ca M5, M15 cung dang uptrend. Tuong tu cho SELL. MF_02 AND them dieu kien RSI(M1):
//    rsi > SMA45(rsi) cho buy, rsi < SMA45(rsi) cho sell.
//
// 2. Thoat lenh khi dao chieu - 3 kieu (ENUM_EXIT_MODE):
//    - EXIT_LEGACY_CLOSE_ALL (MF_01/MF_02/MF_04): theo doi previousPosition rieng tung
//      chien luoc, M1 Coral dao chieu nguoc position gan nhat -> dong HET lenh cua chien
//      luoc do, khong xet lai/lo tung lenh.
//    - EXIT_PER_POSITION_M1_M5 (MF_03): xet tung lenh rieng - chua breakeven -> thoat theo
//      M1 (cat lo som); da breakeven -> chi thoat theo M5 (gong lai, tranh nhieu M1).
//    - EXIT_STREAK_GUARDED_CLOSE_ALL (MF_05, CloseReversedPositions): giong dieu kien kich
//      hoat cua EXIT_LEGACY_CLOSE_ALL (M1 dao chieu nguoc previousPosition), nhung xet tung
//      lenh rieng: lenh dang lai dong ngay; lenh dang lo chi dong khi holdStreakCount deal
//      dong gan nhat (LastClosedDealsSameDirection) DEU cung huong lenh do (da co 1 chuoi
//      lenh cung huong du dai); neu lenh con nam trong N lenh dau cua 1 chuoi moi thi giu
//      lenh lai du dang lo, vi tin hieu dao chieu co the chi la nhieu ngan han.
//
// 3. SL/TP & loc tin hieu (OpenOrder, dung chung cong thuc, tham so rieng tung chien luoc):
//    SL theo swing gan nhat (14 nen M1), cap boi slSpacingDistance. TP co dinh cach entry
//    takeProfitDistance. Bo qua tin hieu neu ATR M1 < 2.
//
// 4. Trailing stop - 3 kieu (ENUM_TRAIL_MODE): TRAIL_TWO_STAGE (MF_01/MF_02/MF_05, breakeven
//    roi bam SL tiep theo trailDistance), TRAIL_BREAKEVEN_ONLY (MF_03, chi breakeven roi
//    dung), TRAIL_NONE (MF_04, khong trailing, chi con SL/TP co dinh). Ca 2 ham
//    TrailingStopTwoStage/TrailingStopBreakevenOnly chay MOI tick; de tranh spam
//    PositionModify() len san khi gia chay lien tuc, chi THUC SU gui lenh sua SL toi da 1
//    lan moi InpTrailModifyCooldown giay (mac dinh 2s, g_lastModifyTime dung chung moi
//    chien luoc) - throttle nay doc lap hoan toan voi InpTrailNotifyCooldown (chi chi phoi
//    tan suat gui Telegram).
//
// 5. Volume: vol = min lot cua symbol * volMultiplier rieng tung chien luoc (input
//    MFxx_VolMultiplier), khong tang theo chuoi lenh.
//
// 6. Phan tach lenh giua 5 chien luoc & lenh thu cong: moi chien luoc co magic rieng
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
// 9. Efficiency Ratio (goi trong OpenOrder, dung chung ca 5 chien luoc): do "do hieu qua"
//    cua xu huong gia tren khung InpERtf (mac dinh M5, doc lap voi Coral M1/M5/M15). Ghi 2
//    gia tri, lam tron 2 chu so thap phan:
//      - er  (EfficiencyRatio): ER hien tai tai shift=1.
//      - erK (ERRank): xep hang ER hien tai so voi InpERLookback (300) gia tri ER qua khu.
//    Hien CHI de bao cao (ghi vao comment lenh dang "MF_xx, ATR: x.x, erK: x.xx, er: x.xx"
//    + gui Telegram khi mo lenh), CHUA dung de loc tin hieu vao lenh (input InpERRank chung
//    chua duoc tham chieu o dau khac).
//=============================================================================
