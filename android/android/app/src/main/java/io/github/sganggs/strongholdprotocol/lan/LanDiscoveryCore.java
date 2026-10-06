package io.github.sganggs.strongholdprotocol.lan;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The seeker half of the LAN room beacon: finds other phones (or PCs) that are hosting, so the launcher can offer
 * them as one-tap joins.
 *
 * <p>It lives in Java rather than in the embedded Node.js runtime on purpose. The app's Node runtime only starts
 * when the user taps 「建立主机」, and starting it means writing ~330 MB of game assets out of the APK first
 * (@jadejr/capacitor-nodejs FileOperations.CopyAssetDir copies unconditionally on every start), so discovery through
 * Node would make 「加入房间」 — the light path — the one that has to unpack the whole game. This class needs
 * nothing from the app except a socket.
 *
 * <p>It is also deliberately free of Android and JSON dependencies: {@code java.net} only, so the exact code that
 * ships can be compiled and run by a desktop JVM (android/scripts/lan-verify.mjs does that against the real Node
 * announcer). Keep it that way — an Android import here would silently remove that test.
 *
 * <p>Wire format and ports: see android/scripts/nodejs-template/lan/protocol.mjs, which is the normative
 * description. In short: bind HOST_PORT, broadcast {@code who} to SEEK_PORT, collect {@code here} replies and
 * unsolicited announcements, forget a host after HOST_TTL_MS without a packet.
 *
 * <p>Thread-safe. {@link #start()} / {@link #stop()} may be called from any thread; {@link #snapshot()} is safe to
 * call while running.
 */
public final class LanDiscoveryCore {

    // Mirrors of protocol.mjs. Changing one without the other makes two builds unable to see each other.
    public static final String MAGIC = "splan";
    public static final int VERSION = 1;
    public static final int HOST_PORT = 45777;
    public static final int SEEK_PORT = 45778;
    public static final long QUERY_INTERVAL_MS = 2500L;
    public static final long HOST_TTL_MS = 8000L;
    public static final int MAX_DATAGRAM = 1200;
    public static final int MAX_ROOMS = 8;
    public static final int DEFAULT_GAME_PORT = 3000;

    /** How long a single receive() blocks, i.e. the granularity at which the loop notices a stop(). */
    private static final int SO_TIMEOUT_MS = 400;

    private final int hostPort;
    private final int seekPort;
    private final long queryIntervalMs;
    private final long ttlMs;
    private final String selfId;
    /** Addresses to query in addition to the real broadcasts. Only the desktop harness uses this. */
    private final List<InetAddress> extraTargets;

    private final Map<String, Host> hosts = new ConcurrentHashMap<>();

    private volatile boolean running = false;
    private volatile String error = null;
    private volatile DatagramSocket socket = null;
    private volatile Thread thread = null;

    public LanDiscoveryCore() {
        this(HOST_PORT, SEEK_PORT, QUERY_INTERVAL_MS, HOST_TTL_MS, Collections.<InetAddress>emptyList());
    }

    /** Convenience constructor for tests. */
    public LanDiscoveryCore(int hostPort, int seekPort, long queryIntervalMs, long ttlMs) {
        this(hostPort, seekPort, queryIntervalMs, ttlMs, Collections.<InetAddress>emptyList());
    }

    /**
     * @param extraTargets additional unicast/broadcast destinations for `who`. Exists so the desktop harness
     *     (android/test/java/LanProbe.java) can query 127.0.0.1 and get a deterministic answer on a machine whose
     *     firewall may drop inbound LAN broadcasts; the app never passes anything.
     */
    public LanDiscoveryCore(int hostPort, int seekPort, long queryIntervalMs, long ttlMs, List<InetAddress> extraTargets) {
        this.hostPort = hostPort;
        this.seekPort = seekPort;
        this.queryIntervalMs = queryIntervalMs;
        this.ttlMs = ttlMs;
        this.selfId = newInstanceId();
        this.extraTargets = extraTargets == null
            ? Collections.<InetAddress>emptyList()
            : Collections.unmodifiableList(new ArrayList<>(extraTargets));
    }

    /** A random id in the same `[0-9a-f]{16}` shape the Node side generates. */
    public static String newInstanceId() {
        byte[] bytes = new byte[8];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder(16);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }

    public boolean isRunning() {
        return running;
    }

    /** The last socket failure message, or null while healthy. Surfaced to the launcher for troubleshooting. */
    public String getError() {
        return error;
    }

    public int getHostPort() {
        return hostPort;
    }

    public int getSeekPort() {
        return seekPort;
    }

    public String getSelfId() {
        return selfId;
    }

    /** Start listening and querying. Idempotent; never throws (failures land in {@link #getError()}). */
    public synchronized void start() {
        if (running) return;
        error = null;
        running = true;
        Thread t = new Thread(this::loop, "sp-lan-discovery");
        t.setDaemon(true);
        thread = t;
        t.start();
    }

    /** Stop listening. Idempotent; returns once the socket is closed. */
    public synchronized void stop() {
        running = false;
        DatagramSocket s = socket;
        socket = null;
        if (s != null) {
            try {
                s.close();
            } catch (Exception ignored) {
                // closing is best effort
            }
        }
        Thread t = thread;
        thread = null;
        if (t != null && t != Thread.currentThread()) {
            try {
                t.join(1500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        hosts.clear();
    }

    /** The hosts heard from recently, sorted by name then address, for stable rendering. */
    public List<Host> snapshot() {
        List<Host> out = new ArrayList<>(hosts.values());
        Collections.sort(out, (a, b) -> {
            int byName = a.name.compareToIgnoreCase(b.name);
            if (byName != 0) return byName;
            return a.address.compareTo(b.address);
        });
        return out;
    }

    /** The broadcast addresses a `who` is sent to: the limited broadcast plus every interface's directed one. */
    public static List<InetAddress> broadcastTargets() {
        Set<InetAddress> out = new LinkedHashSet<>();
        try {
            out.add(InetAddress.getByName("255.255.255.255"));
        } catch (UnknownHostException ignored) {
            // cannot happen for a literal address
        }
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                try {
                    if (ni == null || !ni.isUp() || ni.isLoopback()) continue;
                    for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                        InetAddress broadcast = ia.getBroadcast();
                        if (broadcast != null) out.add(broadcast);
                    }
                } catch (Exception ignored) {
                    // one unusable interface must not hide the others
                }
            }
        } catch (Exception ignored) {
            // no interfaces at all: the limited broadcast above is all we have
        }
        return new ArrayList<>(out);
    }

    // -----------------------------------------------------------------------------------------------
    // the loop
    // -----------------------------------------------------------------------------------------------

    private void loop() {
        DatagramSocket sock;
        try {
            sock = new DatagramSocket(null);
            sock.setReuseAddress(true);
            sock.setBroadcast(true);
            sock.bind(new InetSocketAddress(hostPort));
            sock.setSoTimeout(SO_TIMEOUT_MS);
        } catch (Exception e) {
            error = describe(e);
            running = false;
            return;
        }

        socket = sock;
        List<InetAddress> targets = new ArrayList<>(broadcastTargets());
        for (InetAddress extra : extraTargets) {
            if (!targets.contains(extra)) targets.add(extra);
        }
        byte[] who = whoPacket().getBytes(StandardCharsets.UTF_8);
        byte[] buffer = new byte[MAX_DATAGRAM + 1];
        long lastQuery = 0L;

        try {
            while (running) {
                long now = System.currentTimeMillis();
                if (now - lastQuery >= queryIntervalMs) {
                    lastQuery = now;
                    for (InetAddress target : targets) {
                        try {
                            sock.send(new DatagramPacket(who, who.length, target, seekPort));
                        } catch (Exception ignored) {
                            // a single unreachable interface is not an error
                        }
                    }
                }

                DatagramPacket in = new DatagramPacket(buffer, buffer.length);
                try {
                    sock.receive(in);
                } catch (SocketTimeoutException timeout) {
                    in = null;
                }
                if (in != null) accept(in);
                prune();
            }
        } catch (Exception e) {
            // A closed socket while stopping is normal and must not be reported as a failure.
            if (running) error = describe(e);
        } finally {
            running = false;
            try {
                sock.close();
            } catch (Exception ignored) {
                // already closed
            }
            if (socket == sock) socket = null;
        }
    }

    private void accept(DatagramPacket in) {
        Map<String, String> packet = decode(in.getData(), in.getLength());
        if (packet == null || !"here".equals(packet.get("t"))) return;

        int port = parseInt(packet.get("port"), 0);
        if (port < 1 || port > 65535) return;

        String address = in.getAddress() == null ? null : in.getAddress().getHostAddress();
        if (address == null) return;

        String name = packet.get("name");
        if (name == null) name = "";
        if (name.length() > 40) name = name.substring(0, 40);

        String app = packet.get("app");
        if (app == null) app = "";
        if (app.length() > 24) app = app.substring(0, 24);

        Host host = new Host(
            packet.get("id"),
            name,
            address,
            port,
            parseInt(packet.get("proto"), 0),
            app,
            decodeRooms(packet.get("rooms")),
            System.currentTimeMillis()
        );
        hosts.put(host.key, host);
    }

    private void prune() {
        long deadline = System.currentTimeMillis() - ttlMs;
        for (Map.Entry<String, Host> entry : hosts.entrySet()) {
            if (entry.getValue().lastSeen < deadline) hosts.remove(entry.getKey());
        }
    }

    private String whoPacket() {
        return "sp=" + MAGIC + "\nv=" + VERSION + "\nt=who\nid=" + selfId + "\n";
    }

    private static String describe(Exception e) {
        String message = e.getMessage();
        return e.getClass().getSimpleName() + (message == null || message.isEmpty() ? "" : ": " + message);
    }

    // -----------------------------------------------------------------------------------------------
    // wire format (see protocol.mjs)
    // -----------------------------------------------------------------------------------------------

    private static boolean isKey(String key) {
        if (key.isEmpty()) return false;
        char first = key.charAt(0);
        if (first < 'a' || first > 'z') return false;
        for (int i = 1; i < key.length(); i++) {
            char c = key.charAt(i);
            if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))) return false;
        }
        return true;
    }

    private static boolean isInstanceId(String id) {
        if (id == null || id.length() < 8 || id.length() > 32) return false;
        for (int i = 0; i < id.length(); i++) {
            char c = id.charAt(i);
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
        }
        return true;
    }

    private static String unescape(String value) {
        if (value.indexOf('\\') < 0) return value;
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c != '\\' || i + 1 >= value.length()) {
                out.append(c);
                continue;
            }
            char next = value.charAt(++i);
            if (next == 'n') out.append('\n');
            else if (next == 'r') out.append('\r');
            else out.append(next);
        }
        return out.toString();
    }

    /**
     * Parse and validate one datagram. Returns null for anything that is not a well-formed packet of our version,
     * including another application's traffic on the same port.
     */
    static Map<String, String> decode(byte[] data, int length) {
        if (data == null || length <= 0 || length > MAX_DATAGRAM) return null;

        // Non-ASCII bytes are never altered into ASCII here: UTF-8 continuation bytes are all >= 0x80, so a
        // truncated multi-byte sequence can only produce replacement characters inside a value, never a new line.
        String text = new String(data, 0, length, StandardCharsets.UTF_8);

        Map<String, String> fields = new LinkedHashMap<>();
        for (String raw : text.split("\n", -1)) {
            String line = raw.endsWith("\r") ? raw.substring(0, raw.length() - 1) : raw;
            if (line.isEmpty()) continue;
            int eq = line.indexOf('=');
            if (eq <= 0) return null;
            String key = line.substring(0, eq);
            if (!isKey(key)) return null;
            fields.put(key, unescape(line.substring(eq + 1)));
        }

        if (!MAGIC.equals(fields.get("sp"))) return null;
        if (parseInt(fields.get("v"), -1) != VERSION) return null;
        String type = fields.get("t");
        if (!"who".equals(type) && !"here".equals(type)) return null;
        if (!isInstanceId(fields.get("id"))) return null;
        return fields;
    }

    /** `code,mode,diff,players,bots,max,inMatch` per room, rooms joined by `|`. */
    static List<RoomInfo> decodeRooms(String text) {
        List<RoomInfo> out = new ArrayList<>();
        if (text == null || text.isEmpty()) return out;
        for (String part : text.split("\\|", -1)) {
            String[] f = part.split(",", -1);
            if (f.length < 7) continue;
            if (f[0].length() != 4) continue;
            boolean ok = true;
            for (int i = 0; i < 4; i++) {
                char c = f[0].charAt(i);
                if (c < 'A' || c > 'Z') ok = false;
            }
            if (!ok) continue;
            out.add(new RoomInfo(
                f[0], f[1], f[2],
                parseInt(f[3], 0), parseInt(f[4], 0), parseInt(f[5], 0),
                "1".equals(f[6])
            ));
            if (out.size() >= MAX_ROOMS) break;
        }
        return out;
    }

    private static int parseInt(String value, int fallback) {
        if (value == null || value.isEmpty()) return fallback;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    // -----------------------------------------------------------------------------------------------
    // records
    // -----------------------------------------------------------------------------------------------

    /** One advertised room. */
    public static final class RoomInfo {
        public final String code;
        public final String mode;
        public final String diff;
        public final int players;
        public final int bots;
        public final int max;
        public final boolean inMatch;

        RoomInfo(String code, String mode, String diff, int players, int bots, int max, boolean inMatch) {
            this.code = code;
            this.mode = mode;
            this.diff = diff;
            this.players = players;
            this.bots = bots;
            this.max = max;
            this.inMatch = inMatch;
        }

        /** @return a mutable copy for the Capacitor bridge */
        public Map<String, Object> toMap() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("code", code);
            out.put("mode", mode);
            out.put("diff", diff);
            out.put("players", players);
            out.put("bots", bots);
            out.put("max", max);
            out.put("inMatch", inMatch);
            return out;
        }
    }

    /** One discovered host. */
    public static final class Host {
        /** Identity for the map: the same machine can announce more than one server. */
        public final String key;
        public final String id;
        public final String name;
        public final String address;
        public final int port;
        public final int proto;
        public final String app;
        public final List<RoomInfo> rooms;
        public final long lastSeen;

        Host(String id, String name, String address, int port, int proto, String app, List<RoomInfo> rooms, long lastSeen) {
            this.key = id + "@" + address;
            this.id = id;
            this.name = name;
            this.address = address;
            this.port = port;
            this.proto = proto;
            this.app = app;
            this.rooms = Collections.unmodifiableList(rooms);
            this.lastSeen = lastSeen;
        }

        /** The URL the launcher would navigate to. */
        public String baseUrl() {
            return "http://" + address + ":" + port + "/";
        }

        /** @return a mutable copy for the Capacitor bridge */
        public Map<String, Object> toMap() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", id);
            out.put("name", name);
            out.put("address", address);
            out.put("port", port);
            out.put("app", app);
            out.put("proto", proto);
            out.put("baseUrl", baseUrl());
            out.put("lastSeen", lastSeen);
            List<Map<String, Object>> roomMaps = new ArrayList<>();
            for (RoomInfo room : rooms) roomMaps.add(room.toMap());
            out.put("rooms", roomMaps);
            return out;
        }
    }
}
