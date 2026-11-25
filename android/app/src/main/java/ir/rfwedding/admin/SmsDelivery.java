package ir.rfwedding.admin;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.telephony.SmsManager;
import android.telephony.SubscriptionManager;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

public final class SmsDelivery {
    private static final String PREFS = "sms-results";
    private static final long TIMEOUT_MS = TimeUnit.MINUTES.toMillis(3);
    private static final char PENDING = '?';
    private static final char SENT = '+';
    private static final char FAILED = '-';

    enum Status {
        NONE(""),
        SENDING("در حال ارسال پیامک…"),
        SENT("پیامک ارسال شد"),
        FAILED("ارسال پیامک ناموفق بود"),
        PARTIAL("فقط بخشی از پیامک ارسال شد"),
        UNKNOWN("نتیجهٔ ارسال نامشخص است");

        final String label;

        Status(String label) {
            this.label = label;
        }

        boolean mayHaveSent() {
            return this == SENT || this == PARTIAL || this == UNKNOWN;
        }
    }

    private record Attempt(String id, long startedAt, String parts) {
        String encode() {
            return id + ":" + startedAt + ":" + parts;
        }

        Status status(long now) {
            if (parts.indexOf(PENDING) >= 0) {
                return now - startedAt < TIMEOUT_MS ? Status.SENDING : Status.UNKNOWN;
            }
            if (parts.indexOf(SENT) < 0) return Status.FAILED;
            return parts.indexOf(FAILED) < 0 ? Status.SENT : Status.PARTIAL;
        }
    }

    static final class SendException extends Exception {
        SendException(String message) {
            super(message);
        }
    }

    private SmsDelivery() {}

    static SharedPreferences results(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static Status status(Context context, long guestId) {
        Attempt attempt = read(results(context), key(guestId));
        return attempt == null ? Status.NONE : attempt.status(System.currentTimeMillis());
    }

    private static String key(long guestId) {
        return Long.toString(guestId);
    }

    private static Attempt read(SharedPreferences preferences, String key) {
        String saved = preferences.getString(key, null);
        if (saved == null) return null;
        String[] values = saved.split(":", 3);
        return new Attempt(values[0], Long.parseLong(values[1]), values[2]);
    }

    static void send(Context context, long guestId, String number, String message) throws SendException {
        String feature = Build.VERSION.SDK_INT >= 33
            ? PackageManager.FEATURE_TELEPHONY_MESSAGING : PackageManager.FEATURE_TELEPHONY;
        if (!context.getPackageManager().hasSystemFeature(feature)) {
            throw new SendException("این دستگاه امکان ارسال پیامک با سیم‌کارت را ندارد.");
        }
        if (status(context, guestId) == Status.SENDING) {
            throw new SendException("ارسال قبلی این مهمان هنوز در حال انجام است.");
        }

        int subscription = SmsManager.getDefaultSmsSubscriptionId();
        if (subscription == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            throw new SendException("ابتدا در تنظیمات گوشی، سیم‌کارت پیش‌فرض پیامک را انتخاب کنید.");
        }
        SmsManager manager = managerFor(context, subscription);
        ArrayList<String> parts = manager.divideMessage(message);
        char[] initial = new char[parts.size()];
        Arrays.fill(initial, PENDING);
        Attempt attempt = new Attempt(UUID.randomUUID().toString(), System.currentTimeMillis(), new String(initial));
        SharedPreferences preferences = results(context);
        String guestKey = key(guestId);
        if (!preferences.edit().putString(guestKey, attempt.encode()).commit()) {
            throw new SendException("ثبت وضعیت پیامک ممکن نبود. کمی بعد دوباره تلاش کنید.");
        }

        ArrayList<PendingIntent> callbacks = new ArrayList<>(parts.size());
        for (int part = 0; part < parts.size(); part++) {
            Uri identifier = new Uri.Builder().scheme("rfsms").authority(attempt.id())
                .appendPath(guestKey).appendPath(Integer.toString(part)).build();
            Intent result = new Intent(context, ResultReceiver.class).setData(identifier);
            callbacks.add(PendingIntent.getBroadcast(context, 0, result,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT));
        }

        try {
            if (parts.size() == 1) {
                manager.sendTextMessage(number, null, parts.get(0), callbacks.get(0), null);
            } else {
                manager.sendMultipartTextMessage(number, null, parts, callbacks, null);
            }
        } catch (SecurityException | IllegalArgumentException | UnsupportedOperationException error) {
            for (PendingIntent callback : callbacks) callback.cancel();
            Arrays.fill(initial, FAILED);
            Attempt rejected = new Attempt(attempt.id(), attempt.startedAt(), new String(initial));
            preferences.edit().putString(guestKey, rejected.encode()).apply();
            throw error;
        }
    }

    @SuppressWarnings("deprecation")
    private static SmsManager managerFor(Context context, int subscription) {
        if (Build.VERSION.SDK_INT >= 31) {
            return context.getSystemService(SmsManager.class).createForSubscriptionId(subscription);
        }
        return SmsManager.getSmsManagerForSubscriptionId(subscription);
    }

    public static final class ResultReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            Uri result = intent.getData();
            if (result == null || result.getPathSegments().size() != 2) return;
            String guestKey = result.getPathSegments().get(0);
            int part = Integer.parseInt(result.getPathSegments().get(1));
            SharedPreferences preferences = results(context);
            Attempt attempt = read(preferences, guestKey);
            if (attempt == null || !attempt.id().equals(result.getAuthority())) return;
            char[] parts = attempt.parts().toCharArray();
            if (part < 0 || part >= parts.length || parts[part] != PENDING) return;
            parts[part] = getResultCode() == Activity.RESULT_OK ? SENT : FAILED;
            Attempt updated = new Attempt(attempt.id(), attempt.startedAt(), new String(parts));
            preferences.edit().putString(guestKey, updated.encode()).apply();
        }
    }
}
