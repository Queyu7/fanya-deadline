package io.github.fanyadeadline.keqi;

import android.app.*;
import android.content.*;
import org.json.*;
import java.util.*;

public class Reminders extends BroadcastReceiver {
    static final String CHANNEL="deadlines",WAKE="io.github.fanyadeadline.keqi.REMIND";
    static SharedPreferences prefs(Context context){return context.getSharedPreferences("alarm-plan",0);}
    static void channel(Context context){context.getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"作业截止提醒",NotificationManager.IMPORTANCE_HIGH));}
    static PendingIntent alarm(Context context){return PendingIntent.getBroadcast(context,1,new Intent(context,Reminders.class).setAction(WAKE),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);}
    static synchronized void replace(Context context,String json){try{new JSONArray(json);prefs(context).edit().putString("entries",json).commit();deliver(context);}catch(JSONException ignored){}}
    static synchronized void deliver(Context context){try{
        channel(context);SharedPreferences store=prefs(context);JSONArray entries=new JSONArray(store.getString("entries","[]"));Set<String> sent=new HashSet<>(store.getStringSet("sent",Collections.emptySet())),active=new HashSet<>();long next=Long.MAX_VALUE,now=System.currentTimeMillis();
        NotificationManager notifications=context.getSystemService(NotificationManager.class);
        for(int index=0;index<entries.length();index++){JSONObject entry=entries.getJSONObject(index);String id=entry.getString("id");long at=entry.getLong("at");active.add(id);if(sent.contains(id)||entry.getLong("due")<=now)continue;
            if(at<=now){if(!notifications.areNotificationsEnabled())continue;PendingIntent open=PendingIntent.getActivity(context,0,new Intent(context,Main.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_IMMUTABLE);Notification message=new Notification.Builder(context,CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("课期 · 作业即将截止").setContentText(entry.getString("course")+" · "+entry.getString("title")).setContentIntent(open).setAutoCancel(true).build();notifications.notify(id,1,message);sent.add(id);}
            else next=Math.min(next,at);
        }sent.retainAll(active);store.edit().putStringSet("sent",sent).commit();AlarmManager manager=context.getSystemService(AlarmManager.class);manager.cancel(alarm(context));if(next!=Long.MAX_VALUE)manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,alarm(context));
    }catch(JSONException ignored){}}
    @Override public void onReceive(Context context,Intent intent){deliver(context);}
}
