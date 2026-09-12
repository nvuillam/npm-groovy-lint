package com.nvuillam

import groovy.transform.CompileStatic
import java.util.concurrent.ExecutorService

/**
 * Carries per-server collaborators into request processing.
 *
 * Request instances are deserialized by Jackson, so these cannot be
 * constructor-injected into Request itself.
 */
@CompileStatic
class LintContext {

    final ExecutorService pool
    final ResultCache cache

    LintContext(ExecutorService pool, ResultCache cache) {
        this.pool = pool
        this.cache = cache
    }

}
