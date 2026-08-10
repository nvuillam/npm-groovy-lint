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
        codeNarcArgs.sort(false).each { String arg ->
            if (arg.startsWith('-basedir=') || arg.startsWith('-includes=') || arg.startsWith('-report=')) {
                return // do not affect per-file results
            }
            sb.append(arg).append('|')
            if (arg.startsWith('-rulesetfiles=')) {
                arg.substring('-rulesetfiles='.length()).split(',').each { String ref ->
                    String path = ref.startsWith('file:') ? ref.substring('file:'.length()) : ref
                    try {
                        File f = new File(URLDecoder.decode(path, 'UTF-8'))
                        if (f.exists()) {
                            sb.append(sha256(f.bytes)).append('|')
                        }
                    } catch (Throwable ignored) {
                        // Unreadable ruleset reference: fall back to the raw string already appended.
                    }
                }
            }
        }
        return sha256(sb.toString().getBytes('UTF-8'))
    }

    /**
     * Build the cache key for one file.
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
