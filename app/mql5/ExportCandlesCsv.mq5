//+------------------------------------------------------------------+
//| ExportCandlesCsv.mq5                                             |
//| Xuất nến M1 / M5 / M15 ra CSV cho dashboard (tab "Chart giá").   |
//|                                                                  |
//| Cách dùng:                                                       |
//|  1. Copy file vào MQL5/Scripts/ (File → Open Data Folder),       |
//|     mở MetaEditor và Compile (F7).                               |
//|  2. Kéo script vào chart, chỉnh input nếu cần, bấm OK.           |
//|  3. File ra ở MQL5/Files/candles/<MÃ>_<KHUNG>.csv → copy vào     |
//|     thư mục app/candles/ của dashboard.                          |
//| Lưu ý: Tools → Options → Charts → Max bars in chart = Unlimited, |
//| nếu không CopyRates bị giới hạn số nến.                          |
//+------------------------------------------------------------------+
#property script_show_inputs
#property strict

input string InpSymbols   = "";        // Mã (trống = mã của chart; nhiều mã cách nhau bằng dấu phẩy)
input int    InpDaysM1    = 30;        // Số ngày lịch sử M1 (0 = bỏ qua)
input int    InpDaysM5    = 90;        // Số ngày lịch sử M5 (0 = bỏ qua)
input int    InpDaysM15   = 180;       // Số ngày lịch sử M15 (0 = bỏ qua)
input string InpFolder    = "candles"; // Thư mục con trong MQL5/Files

//+------------------------------------------------------------------+
//| Lấy nến; lần đầu terminal có thể chưa tải xong lịch sử nên thử lại |
//+------------------------------------------------------------------+
int CopyRatesWithRetry(const string sym, const ENUM_TIMEFRAMES tf, const datetime from, const datetime to, MqlRates &rates[])
{
   int n = -1;
   for(int attempt = 0; attempt < 10 && !IsStopped(); attempt++)
   {
      ResetLastError();
      n = CopyRates(sym, tf, from, to, rates);
      if(n > 0 && SeriesInfoInteger(sym, tf, SERIES_SYNCHRONIZED)) break;
      Sleep(500);
   }
   return n;
}

//+------------------------------------------------------------------+
//| Ghi một khung thời gian: time,open,high,low,close,tick_volume      |
//| time = giờ server "YYYY.MM.DD HH:MM" (Exness: UTC+0)               |
//+------------------------------------------------------------------+
bool ExportTimeframe(const string sym, const ENUM_TIMEFRAMES tf, const string tfName, const int days)
{
   if(days <= 0) return true;
   datetime to   = TimeCurrent();
   datetime from = to - (datetime)days * 86400;
   MqlRates rates[];
   ArraySetAsSeries(rates, false); // cũ → mới
   int n = CopyRatesWithRetry(sym, tf, from, to, rates);
   if(n <= 0)
   {
      PrintFormat("ExportCandlesCsv: %s %s — không lấy được nến (lỗi %d)", sym, tfName, GetLastError());
      return false;
   }

   string fileName = InpFolder + "\\" + sym + "_" + tfName + ".csv";
   int h = FileOpen(fileName, FILE_WRITE | FILE_CSV | FILE_ANSI, ',');
   if(h == INVALID_HANDLE)
   {
      PrintFormat("ExportCandlesCsv: không mở được %s (lỗi %d)", fileName, GetLastError());
      return false;
   }
   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   FileWrite(h, "time", "open", "high", "low", "close", "tick_volume");
   for(int i = 0; i < n; i++)
   {
      FileWrite(h,
                TimeToString(rates[i].time, TIME_DATE | TIME_MINUTES),
                DoubleToString(rates[i].open, digits),
                DoubleToString(rates[i].high, digits),
                DoubleToString(rates[i].low, digits),
                DoubleToString(rates[i].close, digits),
                (string)rates[i].tick_volume);
   }
   FileClose(h);
   PrintFormat("ExportCandlesCsv: %s %s — %d nến (%s → %s) → MQL5\\Files\\%s",
               sym, tfName, n, TimeToString(rates[0].time), TimeToString(rates[n - 1].time), fileName);
   return true;
}

void OnStart()
{
   string list = InpSymbols;
   StringTrimLeft(list);
   StringTrimRight(list);
   if(list == "") list = _Symbol;

   string symbols[];
   int count = StringSplit(list, ',', symbols);
   for(int s = 0; s < count && !IsStopped(); s++)
   {
      string sym = symbols[s];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      if(sym == "") continue;
      if(!SymbolSelect(sym, true))
      {
         PrintFormat("ExportCandlesCsv: không tìm thấy mã %s", sym);
         continue;
      }
      ExportTimeframe(sym, PERIOD_M1, "M1", InpDaysM1);
      ExportTimeframe(sym, PERIOD_M5, "M5", InpDaysM5);
      ExportTimeframe(sym, PERIOD_M15, "M15", InpDaysM15);
   }
   Print("ExportCandlesCsv: xong. Copy các file .csv trong MQL5\\Files\\", InpFolder, " vào app/candles/ của dashboard.");
}
