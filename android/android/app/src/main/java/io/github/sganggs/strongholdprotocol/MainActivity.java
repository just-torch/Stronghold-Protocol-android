package io.github.sganggs.strongholdprotocol;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import io.github.sganggs.strongholdprotocol.lan.LanDiscoveryPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must come before super.onCreate(): BridgeActivity builds the Bridge (and freezes the plugin list) inside
        // its own onCreate, so anything registered afterwards is never reachable from the launcher page.
        registerPlugin(LanDiscoveryPlugin.class);
        super.onCreate(savedInstanceState);
        immersive();
    }

    @Override
    public void onResume() {
        super.onResume();
        // coming back from the task switcher, a permission dialog or the keyboard must restore it too
        immersive();
    }

    /**
     * Full screen by default: no status / navigation bar strip anywhere.
     *
     * Why not the two "official" ways of avoiding the camera cutout ("刘海"):
     *   - {@code android:windowLayoutInDisplayCutoutMode = never} / Capacitor's
     *     {@code android.adjustMarginsForEdgeToEdge} inset the window or the WebView, and what shows in that strip is
     *     the WINDOW background — on a phone in landscape (Xiaomi 14 Pro) that was a ~48 px white bar down the left
     *     edge (the punch-hole) and along the top (the status bar), i.e. 168 px of a 3200×1440 screenshot: reported as
     *     "这么大的左空白和上空白".
     *   - the game does not need either: css/devices.css section 2 puts the HUD layer and every screen inside
     *     {@code env(safe-area-inset-*)}, which the WebView still reports for the cutout with the bars hidden, so the
     *     in-match HUD and the panels start at --sa-l / --sa-t and the punch-hole only ever sits over the dark
     *     backdrop (the canvas is full bleed; the board's own left edge is ui/fieldHost.js hudPadding's 2.25 rem).
     *
     * The bars are not gone for good: a swipe from an edge brings them back transiently, and the game's own ⛶ button
     * keeps working (it asks the WebView for fullscreen, which is a no-op while the bars are already hidden).
     */
    private void immersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (c == null) return;
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
