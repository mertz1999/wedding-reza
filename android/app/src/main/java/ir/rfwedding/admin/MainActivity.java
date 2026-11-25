package ir.rfwedding.admin;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int INK = 0xff2b2329;
    private static final int MUTED = 0xff6b5d64;
    private static final int ROSE = 0xff894458;
    private static final int PAPER = 0xfffffcfd;
    private static final int CANVAS = 0xfffaf0f3;
    private static final int LINE = 0xffeddee3;
    private static final int ERROR = 0xff972e40;
    private static final int GREEN = 0xff286346;
    private static final int SMS_PERMISSION = 101;

    private record Credentials(String username, String password) {}
    private record Draft(long guestId, String number, String message) {}

    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private LinearLayout screen;
    private TextView notice;
    private Credentials session;
    private Draft pendingPermission;
    private List<Guest> guests = Collections.emptyList();
    private GuestAdapter adapter;
    private int requestGeneration;
    private final SharedPreferences.OnSharedPreferenceChangeListener onSmsResult = (preferences, key) -> {
        if (adapter != null) adapter.notifyDataSetChanged();
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        SmsDelivery.results(this).registerOnSharedPreferenceChangeListener(onSmsResult);
        showLogin("");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (adapter != null) adapter.notifyDataSetChanged();
    }

    @Override
    protected void onDestroy() {
        SmsDelivery.results(this).unregisterOnSharedPreferenceChangeListener(onSmsResult);
        network.shutdownNow();
        super.onDestroy();
    }

    private LinearLayout resetScreen() {
        screen = column();
        screen.setBackgroundColor(CANVAS);
        screen.setFocusableInTouchMode(true);
        screen.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left + dp(16), safe.top + dp(12), safe.right + dp(16), safe.bottom + dp(12));
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft() + dp(16), insets.getSystemWindowInsetTop() + dp(12),
                    insets.getSystemWindowInsetRight() + dp(16), insets.getSystemWindowInsetBottom() + dp(12));
            }
            return insets;
        });
        setContentView(screen);
        screen.requestApplyInsets();
        screen.requestFocus();
        return screen;
    }

    private void showLogin(String message) {
        requestGeneration++;
        session = null;
        guests = Collections.emptyList();
        adapter = null;
        pendingPermission = null;

        LinearLayout root = resetScreen();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout body = column();
        body.setGravity(Gravity.CENTER_VERTICAL);
        body.setPadding(0, dp(24), 0, dp(32));
        scroll.addView(body);

        LinearLayout card = column();
        card.setPadding(dp(22), dp(24), dp(22), dp(22));
        card.setBackground(shape(PAPER, 24, LINE));
        body.addView(card, fullWidth(0));
        card.addView(text("مدیریت مهمان‌ها", 28, INK, true));
        TextView host = text("rf-wedding.ir", 14, MUTED, false);
        host.setTextDirection(View.TEXT_DIRECTION_LTR);
        card.addView(host, fullWidth(5));

        EditText username = field("نام کاربری ادمین", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        username.setAutofillHints(View.AUTOFILL_HINT_USERNAME);
        card.addView(username, fullWidth(24));
        EditText password = field("رمز عبور", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        password.setSaveEnabled(false);
        password.setAutofillHints(View.AUTOFILL_HINT_PASSWORD);
        password.setImeOptions(EditorInfo.IME_ACTION_GO);
        card.addView(password, fullWidth(10));

        notice = text("", 14, ERROR, false);
        card.addView(notice, fullWidth(10));
        setNotice(message, true);
        Button signIn = button("ورود", true);
        card.addView(signIn, fullWidth(14));
        signIn.setOnClickListener(view -> {
            String user = username.getText().toString().trim();
            String pass = password.getText().toString();
            if (user.isEmpty() || pass.isEmpty()) {
                setNotice("نام کاربری و رمز عبور را وارد کنید.", true);
                return;
            }
            if (user.indexOf(':') >= 0) {
                setNotice("نام کاربری نمی‌تواند شامل «:» باشد.", true);
                return;
            }
            hideKeyboard();
            loadGuests(new Credentials(user, pass), signIn);
        });
        password.setOnEditorActionListener((view, action, event) ->
            action == EditorInfo.IME_ACTION_GO && signIn.performClick());
    }

    private void loadGuests(Credentials credentials, Button trigger) {
        int generation = ++requestGeneration;
        trigger.setEnabled(false);
        setNotice("در حال دریافت فهرست…", false);
        network.execute(() -> {
            try {
                List<Guest> loaded = WeddingApi.guests(credentials.username(), credentials.password());
                runOnUiThread(() -> {
                    if (!current(generation)) return;
                    guests = loaded;
                    boolean signingIn = session == null;
                    session = credentials;
                    if (signingIn) {
                        showGuests();
                    } else {
                        trigger.setEnabled(true);
                        adapter.update();
                    }
                });
            } catch (WeddingApi.SignInException error) {
                runOnUiThread(() -> {
                    if (!current(generation)) return;
                    String message = "نام کاربری یا رمز عبور صحیح نیست.";
                    if (session == null) {
                        trigger.setEnabled(true);
                        setNotice(message, true);
                    } else {
                        showLogin(message);
                    }
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    if (!current(generation)) return;
                    trigger.setEnabled(true);
                    setNotice("دریافت فهرست ممکن نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.", true);
                });
            }
        });
    }

    private boolean current(int generation) {
        return !isDestroyed() && !isFinishing() && generation == requestGeneration;
    }

    private void showGuests() {
        LinearLayout root = resetScreen();
        root.addView(text("مدیریت مهمان‌ها", 27, INK, true));

        LinearLayout actions = row();
        Button refresh = button("تازه‌سازی", false);
        Button signOut = button("خروج", false);
        actions.addView(refresh, new LinearLayout.LayoutParams(0, -2, 1));
        LinearLayout.LayoutParams second = new LinearLayout.LayoutParams(0, -2, 1);
        second.setMarginStart(dp(8));
        actions.addView(signOut, second);
        root.addView(actions, fullWidth(10));
        refresh.setOnClickListener(view -> loadGuests(session, refresh));
        signOut.setOnClickListener(view -> showLogin(""));

        EditText search = field("جستجوی نام یا شمارهٔ مهمان", InputType.TYPE_CLASS_TEXT);
        search.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        root.addView(search, fullWidth(10));
        notice = text("", 14, MUTED, false);
        notice.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        root.addView(notice, fullWidth(10));

        ListView list = new ListView(this);
        list.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        list.setDivider(null);
        list.setSelector(android.R.color.transparent);
        list.setItemsCanFocus(true);
        list.setClipToPadding(false);
        list.setVerticalScrollBarEnabled(false);
        adapter = new GuestAdapter();
        list.setAdapter(adapter);
        root.addView(list, new LinearLayout.LayoutParams(-1, 0, 1));
        adapter.update();

        search.setOnEditorActionListener((view, action, event) -> {
            if (action != EditorInfo.IME_ACTION_SEARCH) return false;
            hideKeyboard();
            return true;
        });
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                adapter.query = s.toString();
                adapter.update();
            }
            @Override public void afterTextChanged(Editable editable) {}
        });
    }

    private final class GuestAdapter extends BaseAdapter {
        private List<Guest> visible = Collections.emptyList();
        private String query = "";

        void update() {
            visible = new ArrayList<>();
            for (Guest guest : guests) {
                if (guest.matches(query)) visible.add(guest);
            }
            setNotice(visible.isEmpty() ? (guests.isEmpty() ? "هنوز مهمانی ثبت نشده است." : "مهمانی پیدا نشد.")
                : NumberFormat.getIntegerInstance(Locale.forLanguageTag("fa-IR")).format(visible.size()) + " مهمان", false);
            notifyDataSetChanged();
        }

        @Override public int getCount() { return visible.size(); }
        @Override public Guest getItem(int position) { return visible.get(position); }
        @Override public long getItemId(int position) { return getItem(position).id(); }
        @Override public boolean hasStableIds() { return true; }
        @Override public boolean isEnabled(int position) { return false; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            GuestCard card = convertView == null ? new GuestCard() : (GuestCard) convertView.getTag();
            card.bind(getItem(position));
            return card.root;
        }
    }

    private final class GuestCard {
        final LinearLayout root = column();
        final TextView name = text("", 18, INK, true);
        final TextView phone = text("", 14, MUTED, false);
        final TextView rsvp = text("", 14, MUTED, false);
        final TextView delivery = text("", 13, ROSE, false);
        final Button send = button("پیامک", true);

        GuestCard() {
            root.setTag(this);
            root.setPadding(0, dp(6), 0, dp(4));
            LinearLayout card = row();
            card.setPadding(dp(13), dp(11), dp(13), dp(11));
            card.setBackground(shape(PAPER, 17, LINE));
            root.addView(card, fullWidth(0));

            LinearLayout details = column();
            card.addView(details, new LinearLayout.LayoutParams(0, -2, 1));
            details.addView(name);
            details.addView(phone, fullWidth(3));
            details.addView(rsvp, fullWidth(3));
            details.addView(delivery, fullWidth(4));
            LinearLayout.LayoutParams sendLayout = new LinearLayout.LayoutParams(-2, -2);
            sendLayout.setMarginStart(dp(10));
            card.addView(send, sendLayout);
        }

        void bind(Guest guest) {
            String number = guest.smsNumber();
            SmsDelivery.Status status = SmsDelivery.status(MainActivity.this, guest.id());
            name.setText(guest.name());
            phone.setText(number.isEmpty() ? "بدون شمارهٔ مناسب پیامک" : "\u2066" + number + "\u2069");
            rsvp.setText(guest.rsvpLabel());
            rsvp.setTextColor("yes".equals(guest.rsvp()) ? GREEN : "no".equals(guest.rsvp()) ? ERROR : MUTED);
            delivery.setVisibility(status == SmsDelivery.Status.NONE ? View.GONE : View.VISIBLE);
            delivery.setText(status.label);
            delivery.setTextColor(status == SmsDelivery.Status.SENT ? GREEN : ROSE);
            send.setEnabled(!number.isEmpty());
            send.setContentDescription("پیامک به " + guest.name());
            send.setOnClickListener(view -> showInvitation(guest, number));
        }
    }

    private void showInvitation(Guest guest, String number) {
        SmsDelivery.Status status = SmsDelivery.status(this, guest.id());
        if (status == SmsDelivery.Status.SENDING) {
            showAlert(status.label);
            return;
        }

        ScrollView scroll = new ScrollView(this);
        LinearLayout content = column();
        content.setPadding(dp(22), dp(10), dp(22), dp(12));
        scroll.addView(content);
        content.addView(text(guest.name() + "  ·  \u2066" + number + "\u2069", 15, INK, true));
        if (status.mayHaveSent()) {
            content.addView(text(status.label + "؛ پیش از ارسال دوباره، پیام قبلی را بررسی کنید.", 14, ERROR, false),
                fullWidth(8));
        }

        RadioGroup senders = new RadioGroup(this);
        senders.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        for (Guest.Sender sender : Guest.Sender.values()) {
            RadioButton option = new RadioButton(this);
            option.setId(sender.ordinal() + 1);
            option.setText(sender.label);
            option.setMinHeight(dp(44));
            senders.addView(option);
        }
        senders.check(Guest.Sender.COUPLE.ordinal() + 1);
        content.addView(senders, fullWidth(8));

        TextView preview = text(guest.invitation(Guest.Sender.COUPLE), 14, INK, false);
        preview.setBackground(shape(CANVAS, 14, LINE));
        preview.setPadding(dp(12), dp(10), dp(12), dp(10));
        preview.setLineSpacing(dp(3), 1);
        content.addView(preview, fullWidth(6));
        senders.setOnCheckedChangeListener((group, id) ->
            preview.setText(guest.invitation(Guest.Sender.values()[id - 1])));

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("ارسال پیامک دعوت")
            .setView(scroll)
            .setNegativeButton("انصراف", null)
            .setPositiveButton(status.mayHaveSent() ? "ارسال دوباره" : "ارسال پیامک",
                (ignored, button) -> confirmSend(new Draft(guest.id(), number, preview.getText().toString())))
            .create();
        dialog.show();
        dialog.getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
    }

    private void confirmSend(Draft draft) {
        if (checkSelfPermission(Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
            send(draft);
        } else {
            pendingPermission = draft;
            requestPermissions(new String[] {Manifest.permission.SEND_SMS}, SMS_PERMISSION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request != SMS_PERMISSION) return;
        Draft draft = pendingPermission;
        pendingPermission = null;
        if (draft == null || session == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            send(draft);
        } else {
            showPermissionHelp();
        }
    }

    private void send(Draft draft) {
        try {
            SmsDelivery.send(this, draft.guestId(), draft.number(), draft.message());
            screen.postDelayed(() -> {
                if (adapter != null) adapter.notifyDataSetChanged();
            }, 181_000);
        } catch (SecurityException error) {
            showPermissionHelp();
        } catch (SmsDelivery.SendException error) {
            showAlert(error.getMessage());
        } catch (IllegalArgumentException | UnsupportedOperationException error) {
            showAlert("ارسال پیامک در این دستگاه ممکن نشد.");
        }
    }

    private void showPermissionHelp() {
        new AlertDialog.Builder(this)
            .setTitle("مجوز ارسال پیامک")
            .setMessage("برای ارسال مستقیم، مجوز پیامک را در تنظیمات برنامه فعال کنید. اگر این گزینه در دسترس نیست، روش نصب یا تنظیمات دستگاه این مجوز را محدود کرده است.")
            .setNegativeButton("بستن", null)
            .setPositiveButton("تنظیمات برنامه", (dialog, button) ->
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null))))
            .show();
    }

    private void showAlert(String message) {
        new AlertDialog.Builder(this).setMessage(message).setPositiveButton("باشه", null).show();
    }

    private void setNotice(String value, boolean error) {
        notice.setText(value);
        notice.setTextColor(error ? ERROR : MUTED);
        notice.setVisibility(value.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private void hideKeyboard() {
        getSystemService(InputMethodManager.class).hideSoftInputFromWindow(screen.getWindowToken(), 0);
        screen.requestFocus();
    }

    private LinearLayout column() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        return layout;
    }

    private LinearLayout row() {
        LinearLayout layout = column();
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        return layout;
    }

    private LinearLayout.LayoutParams fullWidth(int margin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(margin);
        return params;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.START);
        view.setTextDirection(View.TEXT_DIRECTION_FIRST_STRONG_RTL);
        if (bold) view.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        return view;
    }

    private Button button(String label, boolean primary) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(label);
        button.setTextSize(14);
        button.setMinHeight(dp(46));
        button.setMinimumWidth(0);
        button.setPadding(dp(15), 0, dp(15), 0);
        int color = primary ? Color.WHITE : ROSE;
        button.setTextColor(new ColorStateList(new int[][] {{-android.R.attr.state_enabled}, {}},
            new int[] {MUTED, color}));
        android.graphics.drawable.StateListDrawable surface = new android.graphics.drawable.StateListDrawable();
        surface.addState(new int[] {-android.R.attr.state_enabled}, shape(LINE, 12, Color.TRANSPARENT));
        surface.addState(new int[] {}, shape(primary ? ROSE : PAPER, 12, primary ? Color.TRANSPARENT : LINE));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(0x29894458), surface, null));
        return button;
    }

    private EditText field(String hint, int type) {
        EditText field = new EditText(this);
        field.setSingleLine(true);
        field.setHint(hint);
        field.setTextSize(16);
        field.setTextColor(INK);
        field.setHintTextColor(MUTED);
        field.setInputType(type);
        field.setMinHeight(dp(52));
        field.setTextDirection(View.TEXT_DIRECTION_FIRST_STRONG_RTL);
        field.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        field.setPadding(dp(14), dp(8), dp(14), dp(8));
        android.graphics.drawable.StateListDrawable border = new android.graphics.drawable.StateListDrawable();
        border.addState(new int[] {android.R.attr.state_focused}, shape(PAPER, 12, ROSE));
        border.addState(new int[] {}, shape(PAPER, 12, LINE));
        field.setBackground(border);
        return field;
    }

    private GradientDrawable shape(int fill, int radius, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radius));
        if (stroke != Color.TRANSPARENT) drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
