// android/test/java/LanProbe.java — run the shipping Java seeker on a desktop JVM.
//
// This is not an Android test. LanDiscoveryCore imports nothing from Android (see its class comment), precisely so
// that the code inside the APK can be executed here, by a plain `java`, against the real JavaScript announcer that
// the APK runs. android/scripts/lan-verify.mjs compiles this file with the JDK's javac (no Android SDK needed) and
// checks the JSON it writes.
//
// Usage:
//   java -cp <classes> LanProbe <seekPort> <hostPort> <seconds> <outFile> [extraTarget ...]
//
//     seekPort   port the announcer listens on (SEEK_PORT in protocol.mjs)
//     hostPort   port to bind for ourselves (HOST_PORT in protocol.mjs)
//     seconds    give up after this long
//     outFile    where the JSON result is written (stdout only carries it too, but the harness cannot rely on
//                capturing a child's stdout under every sandbox)
//     extraTarget  additional destination for `who`, e.g. 127.0.0.1 to make a run independent of whether the
//                machine's firewall lets LAN broadcasts through
//
// Result: {"found":n,"error":null|"...","hosts":[{"id":..,"name":..,"address":..,"port":n,"app":..,
//          "rooms":[{"code":..,"players":n,"max":n,"inMatch":bool}]}]}

import io.github.sganggs.strongholdprotocol.lan.LanDiscoveryCore;

import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class LanProbe {

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("usage: LanProbe <seekPort> <hostPort> <seconds> <outFile> [extraTarget ...]");
            System.exit(2);
        }
        int seekPort = Integer.parseInt(args[0]);
        int hostPort = Integer.parseInt(args[1]);
        long seconds = Long.parseLong(args[2]);
        String outFile = args[3];

        List<InetAddress> extra = new ArrayList<>();
        for (int i = 4; i < args.length; i++) extra.add(InetAddress.getByName(args[i]));

        // A short query interval: the probe only lives for a couple of seconds.
        LanDiscoveryCore core = new LanDiscoveryCore(hostPort, seekPort, 400L, 8000L, extra);
        core.start();

        List<LanDiscoveryCore.Host> hosts = Collections.emptyList();
        long deadline = System.currentTimeMillis() + (seconds * 1000L);
        while (System.currentTimeMillis() < deadline) {
            Thread.sleep(200L);
            hosts = core.snapshot();
            if (!hosts.isEmpty()) break;
        }

        // snapshot() before stop(), which clears the list.
        String json = toJson(hosts, core.getError());
        core.stop();

        Files.write(Paths.get(outFile), json.getBytes(StandardCharsets.UTF_8));
        System.out.println(json);
    }

    private static String toJson(List<LanDiscoveryCore.Host> hosts, String error) {
        StringBuilder sb = new StringBuilder(256);
        sb.append("{\"found\":").append(hosts.size());
        sb.append(",\"error\":").append(error == null ? "null" : quote(error));
        sb.append(",\"hosts\":[");
        for (int i = 0; i < hosts.size(); i++) {
            LanDiscoveryCore.Host h = hosts.get(i);
            if (i > 0) sb.append(',');
            sb.append("{\"id\":").append(quote(h.id));
            sb.append(",\"name\":").append(quote(h.name));
            sb.append(",\"address\":").append(quote(h.address));
            sb.append(",\"port\":").append(h.port);
            sb.append(",\"app\":").append(quote(h.app));
            sb.append(",\"rooms\":[");
            for (int j = 0; j < h.rooms.size(); j++) {
                LanDiscoveryCore.RoomInfo r = h.rooms.get(j);
                if (j > 0) sb.append(',');
                sb.append("{\"code\":").append(quote(r.code));
                sb.append(",\"mode\":").append(quote(r.mode));
                sb.append(",\"diff\":").append(quote(r.diff));
                sb.append(",\"players\":").append(r.players);
                sb.append(",\"bots\":").append(r.bots);
                sb.append(",\"max\":").append(r.max);
                sb.append(",\"inMatch\":").append(r.inMatch);
                sb.append('}');
            }
            sb.append("]}");
        }
        sb.append("]}");
        return sb.toString();
    }

    private static String quote(String value) {
        if (value == null) return "null";
        StringBuilder sb = new StringBuilder(value.length() + 2);
        sb.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        sb.append('"');
        return sb.toString();
    }
}
