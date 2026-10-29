#property strict
#property version   "1.000"
#property description "Read-only connectivity probe for the EASpaze public strategy API. It never sends trades."

input string InpPublishableKey = "";
input int    InpPollSeconds = 15;
input int    InpRequestTimeoutMs = 5000;

const string API_URL = "https://ugkfmlzqhdqdmbsscjfp.supabase.co/rest/v1/strategies?select=id%2Cname%2Cconfig%2Cupdated_at&is_public=eq.true&order=updated_at.desc&limit=1";
string g_last_payload = "";
ulong  g_sequence = 0;

int OnInit()
  {
   if(StringLen(InpPublishableKey) < 10)
     {
      Print("EASpaze probe: add the project's publishable key in EA Inputs.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(InpPollSeconds < 5 || InpRequestTimeoutMs < 1000)
     {
      Print("EASpaze probe: use a poll interval of at least 5 seconds and timeout of at least 1000 ms.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(!EventSetTimer(InpPollSeconds))
     {
      Print("EASpaze probe: could not start timer. Error=", GetLastError());
      return INIT_FAILED;
     }
   Print("EASpaze probe started. Read-only mode; no trading functions are used.");
   PollPublicStrategy();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Print("EASpaze probe stopped.");
  }

void OnTimer()
  {
   PollPublicStrategy();
  }

void PollPublicStrategy()
  {
   g_sequence++;
   char request_body[];
   char response_body[];
   string response_headers;
   string headers = "apikey: " + InpPublishableKey + "\r\nAccept: application/json\r\n";

   ResetLastError();
   int http_status = WebRequest("GET", API_URL, headers, InpRequestTimeoutMs, request_body, response_body, response_headers);
   if(http_status == -1)
     {
      Print("EASpaze probe poll ", g_sequence, " failed. Error=", GetLastError(),
            ". Check the WebRequest allow-list and network connection.");
      return;
     }
   if(http_status != 200)
     {
      string error_text = CharArrayToString(response_body, 0, WHOLE_ARRAY, CP_UTF8);
      Print("EASpaze probe poll ", g_sequence, " returned HTTP ", http_status,
            ". Response bytes=", ArraySize(response_body), ". Body: ", error_text);
      return;
     }

   string payload = CharArrayToString(response_body, 0, WHOLE_ARRAY, CP_UTF8);
   if(payload != g_last_payload)
     {
      g_last_payload = payload;
      if(StringFind(payload, "[]") >= 0)
         Print("EASpaze connected (HTTP 200), but no public Strategy is available yet.");
      else
         Print("EASpaze connected (HTTP 200). New public Strategy payload received; bytes=", StringLen(payload));
     }
   else
      Print("EASpaze connection remains healthy. Poll=", g_sequence, ", HTTP 200, payload unchanged.");
  }
