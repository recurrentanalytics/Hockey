package de.boniborstentiere.hockey;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Full-screen WebView running the game from the app's own assets (served under
 * https://appassets.androidplatform.net/ so ES modules and fetch work). Google 3D tiles still
 * come from the network.
 *
 * Gamepads (e.g. two 8BitDo Micro in D-input mode) are read natively and handed to the page in
 * the W3C "standard" layout, so they work whether or not the system WebView supports the
 * Gamepad API (see src/native/pads.js).
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/www/intro.html";
    private WebView web;

    /** One connected pad: standard-mapping buttons (0..16) and axes (0..3). */
    private static final class Pad {
        final int slot; final String name;
        final float[] buttons = new float[17];
        final float[] axes = new float[4];
        Pad(int slot, String name) { this.slot = slot; this.name = name; }
    }
    private final Map<Integer, Pad> pads = new HashMap<>();
    private final List<Integer> slots = new ArrayList<>();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "BoniAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                if (!HOST.equals(req.getUrl().getHost())) return null;
                String path = req.getUrl().getPath();
                if (path == null || path.equals("/") ) path = "/www/intro.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    WebResourceResponse r = new WebResourceResponse(mime(path), mime(path).startsWith("text") || mime(path).contains("javascript") || mime(path).contains("json") ? "utf-8" : null, in);
                    Map<String, String> h = new HashMap<>();
                    h.put("Access-Control-Allow-Origin", "*");
                    h.put("Cache-Control", "no-cache");
                    r.setResponseHeaders(h);
                    return r;
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
            }
        });
        setContentView(web);
        hideSystemBars();
        if (state == null) web.loadUrl(START);
        else web.restoreState(state);
    }

    private static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs") || p.endsWith(".cjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".glb")) return "model/gltf-binary";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".ogg")) return "audio/ogg";
        if (p.endsWith(".wav")) return "audio/wav";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) hideSystemBars(); }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); hideSystemBars(); }

    @Override
    public void onBackPressed() {
        // Back acts as the game's pause / back key instead of closing the app
        web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape'}));"
                + "setTimeout(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'Escape',key:'Escape'})),80);", null);
    }

    private void hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    // ------------------------------------------------------------------ gamepads

    private static boolean fromPad(int source) {
        return (source & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
                || (source & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                || (source & InputDevice.SOURCE_DPAD) == InputDevice.SOURCE_DPAD;
    }

    private Pad pad(InputDevice dev) {
        int id = dev.getId();
        Pad p = pads.get(id);
        if (p == null) {
            int slot = 0;
            while (slots.contains(slot)) slot++;
            slots.add(slot);
            p = new Pad(slot, dev.getName() + " (Vendor: " + String.format("%04x", dev.getVendorId()) + " Product: " + String.format("%04x", dev.getProductId()) + ")");
            pads.put(id, p);
        }
        return p;
    }

    /** Android key code → W3C standard gamepad button index, or -1. */
    private static int button(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_BUTTON_A: return 0;
            case KeyEvent.KEYCODE_BUTTON_B: return 1;
            case KeyEvent.KEYCODE_BUTTON_X: return 2;
            case KeyEvent.KEYCODE_BUTTON_Y: return 3;
            case KeyEvent.KEYCODE_BUTTON_L1: return 4;
            case KeyEvent.KEYCODE_BUTTON_R1: return 5;
            case KeyEvent.KEYCODE_BUTTON_L2: return 6;
            case KeyEvent.KEYCODE_BUTTON_R2: return 7;
            case KeyEvent.KEYCODE_BUTTON_SELECT: return 8;
            case KeyEvent.KEYCODE_BUTTON_START: return 9;
            case KeyEvent.KEYCODE_BUTTON_THUMBL: return 10;
            case KeyEvent.KEYCODE_BUTTON_THUMBR: return 11;
            case KeyEvent.KEYCODE_DPAD_UP: return 12;
            case KeyEvent.KEYCODE_DPAD_DOWN: return 13;
            case KeyEvent.KEYCODE_DPAD_LEFT: return 14;
            case KeyEvent.KEYCODE_DPAD_RIGHT: return 15;
            case KeyEvent.KEYCODE_BUTTON_MODE: return 16;
            default: return -1;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        InputDevice dev = e.getDevice();
        int b = button(e.getKeyCode());
        if (dev != null && b >= 0 && fromPad(e.getSource()) && !dev.isVirtual()) {
            if (e.getAction() == KeyEvent.ACTION_DOWN || e.getAction() == KeyEvent.ACTION_UP) {
                Pad p = pad(dev);
                p.buttons[b] = e.getAction() == KeyEvent.ACTION_DOWN ? 1f : 0f;
                push(p);
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        InputDevice dev = e.getDevice();
        if (dev != null && fromPad(e.getSource()) && e.getAction() == MotionEvent.ACTION_MOVE) {
            Pad p = pad(dev);
            p.axes[0] = e.getAxisValue(MotionEvent.AXIS_X);
            p.axes[1] = e.getAxisValue(MotionEvent.AXIS_Y);
            p.axes[2] = e.getAxisValue(MotionEvent.AXIS_Z);
            p.axes[3] = e.getAxisValue(MotionEvent.AXIS_RZ);
            float hx = e.getAxisValue(MotionEvent.AXIS_HAT_X), hy = e.getAxisValue(MotionEvent.AXIS_HAT_Y);
            p.buttons[12] = hy < -0.5f ? 1f : 0f;
            p.buttons[13] = hy > 0.5f ? 1f : 0f;
            p.buttons[14] = hx < -0.5f ? 1f : 0f;
            p.buttons[15] = hx > 0.5f ? 1f : 0f;
            float lt = Math.max(e.getAxisValue(MotionEvent.AXIS_LTRIGGER), e.getAxisValue(MotionEvent.AXIS_BRAKE));
            float rt = Math.max(e.getAxisValue(MotionEvent.AXIS_RTRIGGER), e.getAxisValue(MotionEvent.AXIS_GAS));
            if (lt > 0.05f || p.buttons[6] > 0 && lt <= 0.05f) p.buttons[6] = lt;
            if (rt > 0.05f || p.buttons[7] > 0 && rt <= 0.05f) p.buttons[7] = rt;
            push(p);
            return true;
        }
        return super.dispatchGenericMotionEvent(e);
    }

    private void push(Pad p) {
        StringBuilder sb = new StringBuilder("window.__nativePad&&__nativePad(").append(p.slot).append(',')
                .append(org.json.JSONObject.quote(p.name)).append(",[");
        for (int i = 0; i < p.buttons.length; i++) sb.append(i > 0 ? "," : "").append(p.buttons[i]);
        sb.append("],[");
        for (int i = 0; i < p.axes.length; i++) sb.append(i > 0 ? "," : "").append(p.axes[i]);
        sb.append("]);");
        web.evaluateJavascript(sb.toString(), null);
    }

    /** Lets the page know it runs inside the Android app. */
    private final class Bridge {
        @JavascriptInterface public String version() { return "0.1"; }
    }
}
