package com.nvuillam

import groovy.transform.CompileDynamic
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicInteger
import org.codenarc.util.CodeNarcVersion

/**
 * Bounded LRU cache of per-file CodeNarc violations.
 *
 * Sound only because CodeNarc rules are per-SourceFile with no cross-file
 * analysis: a file's violations depend on its own content, its path, and the
 * ruleset, and nothing else.
 */
@CompileDynamic
class ResultCache {

    // Entries are small (a violation list per file); this is a soft memory bound.
    static final int DEFAULT_MAX_ENTRIES = 5000

    // Bump when the cached value shape changes, to invalidate stale in-memory entries.
    private static final String SCHEMA_VERSION = '1'

    private final Map<String, List<Map>> entries
    // One report per fingerprint, kept so a fully-cached run can still emit the
    // 'codeNarc' and 'rules' blocks that lib/codenarc-factory.js requires.
    private final Map<String, String> templates = new java.util.concurrent.ConcurrentHashMap<String, String>()
    private final AtomicInteger hitCount = new AtomicInteger(0)
    private final AtomicInteger missCount = new AtomicInteger(0)

    ResultCache(int maxEntries = DEFAULT_MAX_ENTRIES) {
        this.entries = Collections.synchronizedMap(
            new LinkedHashMap<String, List<Map>>(16, 0.75f, true) {

                @Override
                protected boolean removeEldestEntry(Map.Entry<String, List<Map>> eldest) {
                    return size() > maxEntries
                }

            })
    }

    String getTemplate(String fingerprint) {
        return templates.get(fingerprint)
    }

    void putTemplate(String fingerprint, String report) {
        if (report != null) {
            templates.put(fingerprint, report)
        }
    }

    int getHits() { return hitCount.get() }

    int getMisses() { return missCount.get() }

    void resetCounters() {
        hitCount.set(0)
        missCount.set(0)
    }

    // Rules that require CodeNarc's phase-4 (semantic analysis) compilation. Their result
    // can depend on classes resolved from the classpath, which varies with the real base
    // directory - so when any of them is enabled, per-file results are NOT shareable across
    // base directories and the fingerprint must include -basedir. The `advanced`, `tests`
    // and `grails` presets ship some of these enabled.
    private static final List<String> CLASSPATH_SENSITIVE_RULES = [
        'CloneWithoutCloneable',
        'JUnitAssertEqualsConstantActualValue',
        'MissingOverrideAnnotation',
        'UnsafeImplementationAsMap',
        'GrailsDomainGormMethods',
    ].asImmutable()

    /**
     * Build a fingerprint of everything that affects results other than the file itself.
     *
     * Includes the contents of any -rulesetfiles, so editing a ruleset file invalidates
     * the cache even though its path is unchanged.
     */
    String fingerprint(List<String> codeNarcArgs) {
        StringBuilder sb = new StringBuilder()
        sb.append(SCHEMA_VERSION).append('|')
        sb.append(CodeNarcVersion.getVersion()).append('|')
        String basedirArg = null
        boolean classpathSensitive = false
        codeNarcArgs.sort(false).each { String arg ->
            if (arg.startsWith('-basedir=')) {
                // -basedir is normally excluded: identical content at the same
                // basedir-relative path is shared across different base directories. That
                // is sound only as long as every enabled rule is per-SourceFile and sees
                // nothing but content plus the basedir-relative path (see class javadoc).
                // It breaks when a classpath-dependent (phase-4) rule is enabled, since
                // those can resolve imports relative to the real basedir - so in that case
                // the basedir is appended after this loop, see below.
                basedirArg = arg
                return
            }
            if (arg.startsWith('-includes=') || arg.startsWith('-report=')) {
                return // do not affect per-file results
            }
            sb.append(arg).append('|')
            if (mentionsClasspathSensitiveRule(arg)) {
                classpathSensitive = true
            }
            if (arg.startsWith('-rulesetfiles=')) {
                arg.substring('-rulesetfiles='.length()).split(',').each { String ref ->
                    String path = ref.startsWith('file:') ? ref.substring('file:'.length()) : ref
                    try {
                        File f = new File(URLDecoder.decode(path, 'UTF-8'))
                        if (f.exists()) {
                            byte[] rulesetBytes = f.bytes
                            sb.append(sha256(rulesetBytes)).append('|')
                            if (mentionsClasspathSensitiveRule(new String(rulesetBytes, 'UTF-8'))) {
                                classpathSensitive = true
                            }
                        }
                    } catch (Throwable ignored) {
                    // Unreadable ruleset reference: fall back to the raw string already appended.
                    }
                }
            }
        }
        if (classpathSensitive && basedirArg != null) {
            // Canonicalise so '.' and the absolute path of the same directory produce the
            // same fingerprint on the same server.
            String dir = basedirArg.substring('-basedir='.length())
            String canonical
            try {
                canonical = new File(dir).canonicalPath
            } catch (Throwable ignored) {
                canonical = dir
            }
            sb.append('-basedir=').append(canonical).append('|')
        }
        return sha256(sb.toString().getBytes('UTF-8'))
    }

    /**
     * True when the given text (a raw CodeNarc argument - including an url-encoded
     * -ruleset= JSON value, whose rule names encode to themselves - or the content of a
     * ruleset file) names any classpath-sensitive rule.
     */
    private static boolean mentionsClasspathSensitiveRule(String text) {
        return CLASSPATH_SENSITIVE_RULES.any { String rule -> text.contains(rule) }
    }

    /**
     * Build the cache key for one file.
     *
     * Keyed on fingerprint + basedir-relative path + content. The basedir takes part only
     * through the fingerprint, and only when a classpath-sensitive rule is enabled - see
     * fingerprint() above for the assumption this relies on.
     */
    String keyFor(String fingerprint, String relativePath, File file) {
        StringBuilder sb = new StringBuilder()
        sb.append(fingerprint).append('|').append(relativePath).append('|')
        sb.append(sha256(file.bytes))
        return sha256(sb.toString().getBytes('UTF-8'))
    }

    List<Map> get(String key) {
        List<Map> value = entries.get(key)
        if (value == null) {
            missCount.incrementAndGet()
        } else {
            hitCount.incrementAndGet()
        }
        return value
    }

    void put(String key, List<Map> violations) {
        entries.put(key, violations)
    }

    private static String sha256(byte[] data) {
        MessageDigest digest = MessageDigest.getInstance('SHA-256')
        return digest.digest(data).encodeHex().toString()
    }

}
