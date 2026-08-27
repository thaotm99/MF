//+------------------------------------------------------------------+
//|                                                  THV Coral.mq5  |
//|        Converted from MT4 to MT5 (logic giữ nguyên 100%)         |
//+------------------------------------------------------------------+
#property indicator_chart_window
#property indicator_buffers 4
#property indicator_plots   3

//--- colors
#property indicator_label1  "Coral Flat"
#property indicator_type1   DRAW_LINE
#property indicator_color1  Yellow
#property indicator_style1  STYLE_SOLID
#property indicator_width1  1

#property indicator_label2  "Coral Up"
#property indicator_type2   DRAW_LINE
#property indicator_color2  RoyalBlue
#property indicator_style2  STYLE_SOLID
#property indicator_width2  1

#property indicator_label3  "Coral Down"
#property indicator_type3   DRAW_LINE
#property indicator_color3  Red
#property indicator_style3  STYLE_SOLID
#property indicator_width3  1

//--- input
input bool   Alert_Coral_Crossing = false;
input int    CoralPeriod = 48;
input double SmoothFactor = 0.4;

//--- buffers
double BufFlat[];
double BufUp[];
double BufDown[];
double BufMain[];

//--- temp arrays
double gda_112[];
double gda_116[];
double gda_120[];
double gda_124[];
double gda_128[];
double gda_132[];

//--- variables
double gd_136, gd_144, gd_152, gd_160;
double gd_168, gd_176, gd_184;
bool gi_208=false, gi_212=false;

//+------------------------------------------------------------------+
//| Custom indicator initialization                                  |
//+------------------------------------------------------------------+
int OnInit()
  {
   SetIndexBuffer(0,BufFlat,INDICATOR_DATA);
   SetIndexBuffer(1,BufUp,INDICATOR_DATA);
   SetIndexBuffer(2,BufDown,INDICATOR_DATA);
   SetIndexBuffer(3,BufMain,INDICATOR_CALCULATIONS);

   IndicatorSetString(INDICATOR_SHORTNAME,"THV Coral ("+(string)CoralPeriod+")");

   //--- hệ số bộ lọc
   double gd_192 = SmoothFactor * SmoothFactor;
   double gd_200 = gd_192 * SmoothFactor;

   gd_136 = -gd_200;
   gd_144 = 3.0 * (gd_192 + gd_200);
   gd_152 = -3.0 * (2.0 * gd_192 + SmoothFactor + gd_200);
   gd_160 = 3.0 * SmoothFactor + 1.0 + gd_200 + 3.0 * gd_192;

   gd_168 = CoralPeriod;
   if(gd_168 < 1.0) gd_168 = 1.0;
   gd_168 = (gd_168 - 1.0) / 2.0 + 1.0;

   gd_176 = 2.0 / (gd_168 + 1.0);
   gd_184 = 1.0 - gd_176;

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Custom indicator iteration function                              |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   int start = prev_calculated;
   if(start > 0) start--; else start = 0;

   ArrayResize(gda_112,rates_total);
   ArrayResize(gda_116,rates_total);
   ArrayResize(gda_120,rates_total);
   ArrayResize(gda_124,rates_total);
   ArrayResize(gda_128,rates_total);
   ArrayResize(gda_132,rates_total);

   for(int i=start; i<rates_total; i++)
     {
      if(i==0)
        {
         gda_112[i]=close[i];
         gda_116[i]=gda_112[i];
         gda_120[i]=gda_116[i];
         gda_124[i]=gda_120[i];
         gda_128[i]=gda_124[i];
         gda_132[i]=gda_128[i];
        }
      else
        {
         gda_112[i] = gd_176*close[i] + gd_184*gda_112[i-1];
         gda_116[i] = gd_176*gda_112[i] + gd_184*gda_116[i-1];
         gda_120[i] = gd_176*gda_116[i] + gd_184*gda_120[i-1];
         gda_124[i] = gd_176*gda_120[i] + gd_184*gda_124[i-1];
         gda_128[i] = gd_176*gda_124[i] + gd_184*gda_128[i-1];
         gda_132[i] = gd_176*gda_128[i] + gd_184*gda_132[i-1];
        }

      BufMain[i] = gd_136*gda_132[i] + gd_144*gda_128[i] + gd_152*gda_124[i] + gd_160*gda_120[i];

      //--- phân loại hướng
      if(i>0)
        {
         double cur = BufMain[i];
         double prev= BufMain[i-1];

         BufFlat[i] = cur;
         BufUp[i]   = cur;
         BufDown[i] = cur;

         if(prev > cur)
            BufUp[i]=EMPTY_VALUE;
         else if(prev < cur)
            BufDown[i]=EMPTY_VALUE;
         else
            BufFlat[i]=EMPTY_VALUE;
        }
     }

   //--- alert crossing
   if(Alert_Coral_Crossing && rates_total>2)
     {
      if(!gi_208 && close[1] > close[2] && close[1] > BufMain[rates_total-2] && close[2] < BufMain[rates_total-2])
        {
         Print(Symbol(),": PA crossing Coral from below !");
         gi_208 = true;
         gi_212 = false;
        }
      if(!gi_212 && close[1] < close[2] && close[1] < BufMain[rates_total-2] && close[2] > BufMain[rates_total-2])
        {
         Print(Symbol(),": PA crossing Coral from above !");
         gi_208 = false;
         gi_212 = true;
        }
     }

   return(rates_total);
  }
