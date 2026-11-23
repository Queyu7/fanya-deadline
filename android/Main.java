package io.github.fanyadeadline.keqi;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.*;

public class Main extends Activity {
    static final String HOME="https://i.mooc.chaoxing.com/space/index", LOCAL="https://keqi.invalid/";
    FrameLayout root; WebView dashboard,worker,login; LinearLayout overlay; String script; boolean ready;
    static boolean safe(String value){Uri uri=Uri.parse(value);String host=uri.getHost();return "https".equals(uri.getScheme()) && host!=null && (host.equals("chaoxing.com")||host.endsWith(".chaoxing.com")) && uri.getUserInfo()==null;}
    @Override public void onCreate(Bundle saved){super.onCreate(saved);
        root=new FrameLayout(this);setContentView(root);
        try(InputStream input=getAssets().open("probe.js");java.util.Scanner reader=new java.util.Scanner(input, "UTF-8").useDelimiter("\\A")){script=reader.next();}catch(Exception error){throw new IllegalStateException(error);}
        worker=portal(true);root.addView(worker,new FrameLayout.LayoutParams(1,1));
        dashboard=new WebView(this);root.addView(dashboard);dashboard.getSettings().setJavaScriptEnabled(true);dashboard.getSettings().setDomStorageEnabled(true);dashboard.getSettings().setAllowFileAccess(false);dashboard.getSettings().setAllowContentAccess(false);
        dashboard.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){String url=request.getUrl().toString();if(url.startsWith(LOCAL)){String file=url.substring(LOCAL.length());if(file.matches("(index\\.html|app\\.css|app\\.mjs|core\\.mjs)"))try{return new WebResourceResponse(file.endsWith("html")?"text/html":file.endsWith("css")?"text/css":"application/javascript","utf-8",getAssets().open(file));}catch(IOException ignored){}}return new WebResourceResponse("text/plain","utf-8",null);}
        });dashboard.addJavascriptInterface(new Bridge(),"KeqiAndroid");dashboard.loadUrl(LOCAL+"index.html");Reminders.channel(this);
    }
    WebView portal(final boolean scan){WebView view=new WebView(this);WebSettings settings=view.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);settings.setUserAgentString("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
        CookieManager.getInstance().setAcceptThirdPartyCookies(view,true);
        view.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView web,WebResourceRequest request){return !safe(request.getUrl().toString());}
            @Override public void onPageStarted(WebView web,String url,android.graphics.Bitmap icon){if(scan)ready=false;}
            @Override public void onPageCommitVisible(WebView web,String url){if(scan && url.equals(web.getUrl()))ready=true;}
            @Override public void onPageFinished(WebView web,String url){if(scan && url.equals(web.getUrl()))ready=true;CookieManager.getInstance().flush();}
        });return view;}
    void openLogin(){if(overlay!=null)return;overlay=new LinearLayout(this);overlay.setOrientation(LinearLayout.VERTICAL);overlay.setBackgroundColor(-1);root.addView(overlay);Button done=new Button(this);done.setText("完成登录，返回作业看板");done.setOnClickListener(view->closeLogin());overlay.addView(done);login=portal(false);overlay.addView(login,new LinearLayout.LayoutParams(-1,0,1));login.loadUrl(Uri.parse("https://passport2.chaoxing.com/login").buildUpon().appendQueryParameter("fid","12").appendQueryParameter("refer",HOME).appendQueryParameter("space","2").build().toString());}
    void closeLogin(){if(overlay==null)return;CookieManager.getInstance().flush();overlay.removeView(login);login.destroy();root.removeView(overlay);overlay=null;}
    @Override public void onBackPressed(){if(overlay!=null)closeLogin();else super.onBackPressed();}
    public class Bridge {
        @JavascriptInterface public void login(){runOnUiThread(()->openLogin());}
        @JavascriptInterface public void go(String url){if(safe(url))runOnUiThread(()->{ready=false;worker.loadUrl(url);});}
        @JavascriptInterface public void probe(){runOnUiThread(()->{if(!ready||worker.getUrl()==null||!safe(worker.getUrl())){dashboard.evaluateJavascript("window.keqiProbe(null)",null);return;}worker.evaluateJavascript(script,value->{try{JSONObject data=new JSONObject(value);dashboard.evaluateJavascript("window.keqiProbe(JSON.parse("+JSONObject.quote(data.toString())+"))",null);}catch(JSONException error){dashboard.evaluateJavascript("window.keqiProbe(null)",null);}});});}
        @JavascriptInterface public void plan(String json){Reminders.replace(Main.this,json);}
        @JavascriptInterface public boolean permission(){if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){runOnUiThread(()->requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},7));return false;}return getSystemService(NotificationManager.class).areNotificationsEnabled();}
    }
    @Override public void onRequestPermissionsResult(int request,String[] names,int[] grants){super.onRequestPermissionsResult(request,names,grants);if(request==7 && grants.length>0 && grants[0]==PackageManager.PERMISSION_GRANTED)dashboard.evaluateJavascript("document.getElementById('enabled').checked || document.getElementById('enabled').click()",null);}
}
