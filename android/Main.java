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
    FrameLayout root; WebView dashboard,worker; LinearLayout overlay; String script,catalogCheck; boolean ready,reuseCatalog; int networkError;
    String asset(String name){try(InputStream input=getAssets().open(name);java.util.Scanner reader=new java.util.Scanner(input,"UTF-8").useDelimiter("\\A")){return reader.next();}catch(IOException error){throw new IllegalStateException(error);}}
    static boolean safe(String value){Uri uri=Uri.parse(value);String host=uri.getHost();return "https".equals(uri.getScheme()) && host!=null && (host.equals("chaoxing.com")||host.endsWith(".chaoxing.com")) && uri.getUserInfo()==null;}
    @Override public void onCreate(Bundle saved){super.onCreate(saved);
        root=new FrameLayout(this);setContentView(root);
        String source=asset("probe.js");script=source+"()";catalogCheck=source+"('connect')";
        worker=portal();root.addView(worker,new FrameLayout.LayoutParams(1,1));
        dashboard=new WebView(this);root.addView(dashboard);dashboard.getSettings().setJavaScriptEnabled(true);dashboard.getSettings().setDomStorageEnabled(true);dashboard.getSettings().setAllowFileAccess(false);dashboard.getSettings().setAllowContentAccess(false);
        dashboard.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){String url=request.getUrl().toString();if(url.startsWith(LOCAL)){String file=url.substring(LOCAL.length());if(file.matches("(index\\.html|app\\.css|app\\.mjs|core\\.mjs)"))try{return new WebResourceResponse(file.endsWith("html")?"text/html":file.endsWith("css")?"text/css":"application/javascript","utf-8",getAssets().open(file));}catch(IOException ignored){}}return new WebResourceResponse("text/plain","utf-8",null);}
        });dashboard.addJavascriptInterface(new Bridge(),"KeqiAndroid");dashboard.loadUrl(LOCAL+"index.html");Reminders.channel(this);
    }
    WebView portal(){WebView view=new WebView(this);WebSettings settings=view.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);settings.setUserAgentString("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
        CookieManager.getInstance().setAcceptThirdPartyCookies(view,true);
        view.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView web,WebResourceRequest request){
            Uri target=request.getUrl();
            if(request.isForMainFrame() && "GET".equals(request.getMethod()) && "http".equals(target.getScheme()) && "i.mooc.chaoxing.com".equals(target.getEncodedAuthority()) && "/space/index".equals(target.getEncodedPath())){web.loadUrl(HOME);return true;}
            return !safe(target.toString());}
            @Override public void onPageStarted(WebView web,String url,android.graphics.Bitmap icon){ready=false;networkError=0;}
            @Override public void onPageCommitVisible(WebView web,String url){if(url.equals(web.getUrl()))ready=true;}
            @Override public void onPageFinished(WebView web,String url){if(url.equals(web.getUrl()))ready=true;CookieManager.getInstance().flush();}
            @Override public void onReceivedError(WebView web,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())networkError=error.getErrorCode();}
            @Override public void onReceivedHttpError(WebView web,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame())networkError=response.getStatusCode();}
        });return view;}
    void openLogin(){if(overlay!=null)return;overlay=new LinearLayout(this);overlay.setOrientation(LinearLayout.VERTICAL);overlay.setBackgroundColor(-1);root.addView(overlay);Button done=new Button(this);done.setText("返回看板（登录成功将自动同步）");done.setOnClickListener(view->closeLogin(false));overlay.addView(done);root.removeView(worker);overlay.addView(worker,new LinearLayout.LayoutParams(-1,0,1));ready=false;worker.loadUrl(Uri.parse("https://passport2.chaoxing.com/login").buildUpon().appendQueryParameter("fid","12").appendQueryParameter("refer",HOME).appendQueryParameter("space","2").build().toString());checkLogin(overlay);}
    void checkLogin(LinearLayout active){worker.postDelayed(()->{
        if(overlay!=active)return;
        if(!ready || worker.getUrl()==null || !safe(worker.getUrl())){checkLogin(active);return;}
        worker.evaluateJavascript(catalogCheck,result->{
            if(overlay!=active)return;
            try{JSONObject page=new JSONObject(result);String type=page.optString("type"),url=page.optString("url");
                if("connected".equals(type)){closeLogin(true);return;}
                if("redirect".equals(type) && safe(url) && !url.equals(worker.getUrl())){ready=false;worker.loadUrl(url);}
            }catch(JSONException ignored){}
            checkLogin(active);
        });
    },500);}
    void closeLogin(boolean connected){if(overlay==null)return;CookieManager.getInstance().flush();overlay.removeView(worker);root.removeView(overlay);overlay=null;root.addView(worker,0,new FrameLayout.LayoutParams(1,1));reuseCatalog=connected;dashboard.evaluateJavascript("window.keqiLoginResult("+connected+")",null);}
    @Override public void onBackPressed(){if(overlay!=null)closeLogin(false);else super.onBackPressed();}
    public class Bridge {
        @JavascriptInterface public void login(){runOnUiThread(()->openLogin());}
        @JavascriptInterface public void go(String url){if(safe(url))runOnUiThread(()->{boolean reuse=reuseCatalog && HOME.equals(url);reuseCatalog=false;if(!reuse){ready=false;networkError=0;worker.loadUrl(url);}});}
        @JavascriptInterface public void probe(){runOnUiThread(()->{if(networkError!=0){dashboard.evaluateJavascript("window.keqiProbe({type:'network',code:"+networkError+"})",null);return;}if(!ready||worker.getUrl()==null||!safe(worker.getUrl())){dashboard.evaluateJavascript("window.keqiProbe(null)",null);return;}worker.evaluateJavascript(script,value->{try{JSONObject data=new JSONObject(value);dashboard.evaluateJavascript("window.keqiProbe(JSON.parse("+JSONObject.quote(data.toString())+"))",null);}catch(JSONException error){dashboard.evaluateJavascript("window.keqiProbe(null)",null);}});});}
        @JavascriptInterface public void plan(String json){Reminders.replace(Main.this,json);}
        @JavascriptInterface public boolean permission(){if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){runOnUiThread(()->requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},7));return false;}return getSystemService(NotificationManager.class).areNotificationsEnabled();}
    }
    @Override public void onRequestPermissionsResult(int request,String[] names,int[] grants){super.onRequestPermissionsResult(request,names,grants);if(request==7 && grants.length>0 && grants[0]==PackageManager.PERMISSION_GRANTED)dashboard.evaluateJavascript("document.getElementById('enabled').checked || document.getElementById('enabled').click()",null);}
}
