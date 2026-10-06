package io.github.sganggs.strongholdprotocol.lan;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

/**
 * Capacitor bridge for {@link LanDiscoveryCore}, so the launcher page (which runs in the WebView and therefore has
 * no sockets) can list the rooms that are being hosted on the same Wi-Fi.
 *
 * <p>Registered in MainActivity before {@code super.onCreate()}. Exposed to JS as
 * {@code Capacitor.Plugins.LanDiscovery} with:
 * <ul>
 *   <li>{@code start()} → status. Begins listening; safe to call twice.</li>
 *   <li>{@code stop()} → status. Stops listening (the launcher calls this before navigating into the game).</li>
 *   <li>{@code getHosts()} → status + {@code hosts[]}. The launcher polls this; there is no push event, because a
 *       1.5 s poll of an in-memory list is simpler and cannot miss a listener registration.</li>
 *   <li>{@code status()} → the same fields as above without the list, for diagnostics.</li>
 * </ul>
 * Every reply carries {@code running}, {@code error}, {@code hostPort}, {@code seekPort} and {@code selfId}, so a
 * device that cannot discover anything can be told apart from a device that cannot open a socket at all.
 */
@CapacitorPlugin(name = "LanDiscovery")
public class LanDiscoveryPlugin extends Plugin {

    private LanDiscoveryCore core = null;
    private boolean shouldRun = false;

    @Override
    public void load() {
        ensureCore();
    }

    private synchronized LanDiscoveryCore ensureCore() {
        if (core == null) core = new LanDiscoveryCore();
        return core;
    }

    @PluginMethod
    public void start(PluginCall call) {
        shouldRun = true;
        try {
            ensureCore().start();
            call.resolve(status());
        } catch (Exception e) {
            call.reject("无法开始搜索局域网房间", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        shouldRun = false;
        try {
            if (core != null) core.stop();
            call.resolve(status());
        } catch (Exception e) {
            call.reject("无法停止搜索局域网房间", e);
        }
    }

    @PluginMethod
    public void getHosts(PluginCall call) {
        try {
            JSObject out = status();
            JSArray arr = new JSArray();
            LanDiscoveryCore c = core;
            if (c != null) {
                List<LanDiscoveryCore.Host> hosts = c.snapshot();
                for (int i = 0; i < hosts.size(); i++) {
                    LanDiscoveryCore.Host host = hosts.get(i);
                    JSObject o = new JSObject();
                    o.put("id", host.id);
                    o.put("name", host.name);
                    o.put("address", host.address);
                    o.put("port", host.port);
                    o.put("app", host.app);
                    o.put("proto", host.proto);
                    o.put("baseUrl", host.baseUrl());
                    JSArray rooms = new JSArray();
                    for (LanDiscoveryCore.RoomInfo room : host.rooms) {
                        JSObject r = new JSObject();
                        r.put("code", room.code);
                        r.put("mode", room.mode);
                        r.put("diff", room.diff);
                        r.put("players", room.players);
                        r.put("bots", room.bots);
                        r.put("max", room.max);
                        r.put("inMatch", room.inMatch);
                        rooms.put(r);
                    }
                    o.put("rooms", rooms);
                    arr.put(o);
                }
            }
            out.put("hosts", arr);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("读取局域网房间列表失败", e);
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status());
    }

    private JSObject status() {
        LanDiscoveryCore c = core;
        JSObject out = new JSObject();
        out.put("running", c != null && c.isRunning());
        out.put("hostPort", c != null ? c.getHostPort() : LanDiscoveryCore.HOST_PORT);
        out.put("seekPort", c != null ? c.getSeekPort() : LanDiscoveryCore.SEEK_PORT);
        out.put("selfId", c != null ? c.getSelfId() : "");
        String error = c != null ? c.getError() : null;
        if (error != null) out.put("error", error);
        return out;
    }

    // -----------------------------------------------------------------------------------------------
    // lifecycle: the launcher is a normal page, so it can be backgrounded at any moment. Keep listening only
    // while the app is actually in front, but remember that the launcher asked for it.
    // -----------------------------------------------------------------------------------------------

    @Override
    protected void handleOnPause() {
        if (core != null) core.stop();
    }

    @Override
    protected void handleOnResume() {
        if (shouldRun) ensureCore().start();
    }

    @Override
    protected void handleOnDestroy() {
        shouldRun = false;
        if (core != null) core.stop();
    }
}
